// ─────────────────────────────────────────────────────────
// Payment Controller — POST /api/v1/bookings/:id/pay
// ─────────────────────────────────────────────────────────
//
// Creates a Razorpay order for an existing PAYMENT_PENDING booking.
// Does NOT capture the payment — that happens via Razorpay's webhook
// after the customer completes the checkout widget.

const prisma = require('../config/prisma');
const razorpay = require('../config/razorpay');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const initiatePayment = async (req, res, next) => {
  try {
    const bookingId = req.params.id;

    // ── Fetch booking with ownership check ─────────────
    // Returns 404 for both "doesn't exist" and "not yours"
    // to prevent booking ID enumeration.
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId: req.user.id,
      },
      include: { payment: true },
    });

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // ── Status check ───────────────────────────────────
    if (booking.status !== 'PAYMENT_PENDING') {
      const messages = {
        CONFIRMED: 'This booking is already paid and confirmed',
        ACTIVE: 'This booking is already active',
        COMPLETED: 'This booking has already been completed',
        CANCELLED: 'This booking was cancelled — please create a new booking',
        PENDING: 'This booking is in an unexpected state — contact support',
      };
      throw new ApiError(
        400,
        messages[booking.status] || `Cannot pay for a booking with status: ${booking.status}`
      );
    }

    // ── Expiry check ───────────────────────────────────
    // Even though the hold-expiry cron doesn't exist yet,
    // we reject stale holds at the gate. Without this check,
    // a customer could pay for a hold that logically expired
    // 30 minutes ago but wasn't cleaned up.
    if (booking.expiresAt && new Date(booking.expiresAt) <= new Date()) {
      throw new ApiError(
        410, // 410 Gone — resource existed but is no longer available
        'This booking hold has expired — please create a new booking',
        [`Hold expired at: ${booking.expiresAt.toISOString()}`]
      );
    }

    // ── Idempotency: return existing Payment if already created ──
    // Handles double-clicks / network retries.
    // If a Payment row exists and hasn't been paid yet,
    // return the same Razorpay order ID to the frontend.
    if (booking.payment) {
      if (booking.payment.status === 'SUCCESS') {
        throw new ApiError(400, 'Payment has already been completed for this booking');
      }

      // Payment exists but not yet captured — return the existing order
      return res.status(200).json(
        new ApiResponse(200, {
          orderId: booking.payment.razorpayOrderId,
          razorpayKey: process.env.RAZORPAY_KEY_ID,
          amount: Math.round(Number(booking.totalPrice) * 100),
          currency: 'INR',
          bookingId: booking.id,
        }, 'Payment order already exists — use this to complete checkout')
      );
    }

    // ── Convert totalPrice to paise ────────────────────
    // Razorpay expects amounts in smallest currency unit.
    // booking.totalPrice is a Prisma Decimal with exactly 2
    // decimal places. Number() converts it to a JS float,
    // multiplying by 100 may introduce floating-point drift
    // (e.g., 35.85 * 100 = 3584.9999999999995), so we
    // Math.round to snap back to the nearest integer.
    const amountInPaise = Math.round(Number(booking.totalPrice) * 100);

    // ── Create Razorpay order ──────────────────────────
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: booking.id, // our booking ID as the receipt reference
      notes: {
        bookingId: booking.id,
        userId: req.user.id,
      },
    });

    // ── Create Payment row (status: PENDING) ───────────
    // razorpayPaymentId stays null — it will be filled by
    // the webhook when payment is captured.
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        razorpayOrderId: razorpayOrder.id,
        amount: Number(booking.totalPrice),
        status: 'PENDING',
      },
    });

    return res.status(201).json(
      new ApiResponse(201, {
        orderId: razorpayOrder.id,
        razorpayKey: process.env.RAZORPAY_KEY_ID,
        amount: amountInPaise,
        currency: 'INR',
        bookingId: booking.id,
      }, 'Payment order created — complete checkout using Razorpay')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { initiatePayment };
