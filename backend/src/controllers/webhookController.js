// ─────────────────────────────────────────────────────────
// Razorpay Webhook Controller
// ─────────────────────────────────────────────────────────
//
// POST /api/v1/webhooks/razorpay
//
// This is the highest-risk file in the payment module.
// Design priorities: correctness > simplicity > performance.
//
// Critical invariant: signature verification happens FIRST,
// unconditionally, before the event type or any payload
// content is read. We never make decisions based on payload
// data until the signature proves it's genuinely from Razorpay.
//
// req.body is a raw Buffer (not parsed JSON) because this
// route uses express.raw() instead of express.json().

const crypto = require('crypto');
const prisma = require('../config/prisma');

const handleWebhook = async (req, res) => {
  // ────────────────────────────────────────────────────────
  // STEP 1: Verify signature — BEFORE reading any payload
  // ────────────────────────────────────────────────────────
  // This MUST happen first. If we branched on event type
  // before verifying the signature, an attacker could craft
  // a fake payload with event: "payment.captured" and a
  // forged razorpayOrderId, causing us to confirm a booking
  // that was never actually paid.

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const receivedSignature = req.headers['x-razorpay-signature'];

  if (!receivedSignature) {
    return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
  }

  if (!webhookSecret) {
    console.error('FATAL: RAZORPAY_WEBHOOK_SECRET is not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // req.body is a Buffer because we used express.raw()
  const rawBody = req.body;

  // Compute HMAC-SHA256 of the raw request body
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  // Timing-safe comparison to prevent timing oracle attacks.
  // A plain === check returns false on the first mismatched byte,
  // leaking timing information about which bytes are correct.
  // timingSafeEqual always compares ALL bytes in constant time.
  //
  // Important: timingSafeEqual throws if buffers differ in length,
  // so we check length first. SHA-256 hex is always 64 chars,
  // so a length mismatch means the signature is definitely wrong.
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  const receivedBuf = Buffer.from(receivedSignature, 'hex');

  if (expectedBuf.length !== receivedBuf.length) {
    console.warn('Webhook signature length mismatch — rejecting');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    console.warn('Webhook signature mismatch — rejecting');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // ────────────────────────────────────────────────────────
  // Signature verified — payload is trustworthy from here on
  // ────────────────────────────────────────────────────────

  // Now safe to parse the raw body as JSON
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    console.error('Webhook body is not valid JSON:', err.message);
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // ────────────────────────────────────────────────────────
  // STEP 2: Event type filter
  // ────────────────────────────────────────────────────────
  // Razorpay sends many event types (order.paid, payment.authorized,
  // payment.failed, refund.processed, etc.). We only handle
  // payment.captured — return 200 for everything else so Razorpay
  // stops retrying.

  if (event.event !== 'payment.captured') {
    return res.status(200).json({ status: 'ignored', event: event.event });
  }

  // ────────────────────────────────────────────────────────
  // STEP 3: Extract IDs from the payload
  // ────────────────────────────────────────────────────────

  const paymentEntity = event.payload?.payment?.entity;

  if (!paymentEntity) {
    console.error('Webhook payload missing payment entity');
    return res.status(400).json({ error: 'Malformed payload: missing payment entity' });
  }

  const razorpayPaymentId = paymentEntity.id;        // pay_XXXXXXXXXXXXXX
  const razorpayOrderId = paymentEntity.order_id;    // order_XXXXXXXXXXXXXX

  if (!razorpayPaymentId || !razorpayOrderId) {
    console.error('Webhook payload missing payment or order ID');
    return res.status(400).json({ error: 'Malformed payload: missing IDs' });
  }

  // ────────────────────────────────────────────────────────
  // STEP 4: Idempotency check
  // ────────────────────────────────────────────────────────
  // Razorpay retries webhooks until they get a 200. If we
  // already processed this payment ID, return 200 immediately
  // without reprocessing.

  const existingPayment = await prisma.payment.findFirst({
    where: { razorpayPaymentId },
  });

  if (existingPayment) {
    return res.status(200).json({ status: 'already_processed', paymentId: existingPayment.id });
  }

  // ────────────────────────────────────────────────────────
  // STEP 5: Find the Payment row by razorpayOrderId
  // ────────────────────────────────────────────────────────

  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId },
    include: { booking: true },
  });

  if (!payment) {
    // This can happen if the order was created outside our system
    // or if the database was wiped. Log it but return 200 so
    // Razorpay doesn't keep retrying a permanently unfixable error.
    console.error(`Webhook: no Payment found for razorpayOrderId ${razorpayOrderId}`);
    return res.status(200).json({ status: 'no_matching_order' });
  }

  if (payment.status === 'SUCCESS') {
    // Already processed (edge case: idempotency check above didn't
    // catch it because razorpayPaymentId was set in a different format)
    return res.status(200).json({ status: 'already_processed' });
  }

  // ────────────────────────────────────────────────────────
  // STEP 5b: Booking status guard (hold-expiry race)
  // ────────────────────────────────────────────────────────
  // If the hold-expiry cron cancelled this booking between the
  // customer paying on Razorpay's widget and the webhook arriving
  // here, the booking is already CANCELLED. We must NOT revive it.
  //
  // This is an extremely rare race (~1-second window) but we
  // handle it gracefully. The Razorpay payment was captured, so
  // customer support will need to issue a manual refund via the
  // Razorpay Dashboard using the razorpayPaymentId logged below.
  if (payment.booking.status !== 'PAYMENT_PENDING') {
    console.warn(
      `⚠️  Webhook race: booking ${payment.bookingId} is ${payment.booking.status}, ` +
      `not PAYMENT_PENDING. Razorpay payment ${razorpayPaymentId} may need manual refund.`
    );
    return res.status(200).json({
      status: 'booking_not_pending',
      bookingStatus: payment.booking.status,
    });
  }

  // ────────────────────────────────────────────────────────
  // STEP 6: Update Payment + Booking in ONE transaction
  // ────────────────────────────────────────────────────────
  // Atomic: either both update or neither does.
  // - Payment: set razorpayPaymentId, status = SUCCESS
  // - Booking: status = CONFIRMED, depositStatus = HELD

  try {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId,
          status: 'SUCCESS',
        },
      }),
      prisma.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: 'CONFIRMED',
          depositStatus: 'HELD',
        },
      }),
    ]);

    console.log(
      `✅ Payment confirmed: booking=${payment.bookingId} razorpayPayment=${razorpayPaymentId}`
    );

    return res.status(200).json({ status: 'processed', bookingId: payment.bookingId });
  } catch (err) {
    // Genuine processing error — return 500 so Razorpay retries
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Internal processing error' });
  }
};

module.exports = { handleWebhook };
