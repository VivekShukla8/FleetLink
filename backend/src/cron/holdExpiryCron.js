// ─────────────────────────────────────────────────────────
// Hold Expiry Cron — cancels unpaid booking holds
// ─────────────────────────────────────────────────────────
//
// Runs every 60 seconds. Finds bookings that are still
// PAYMENT_PENDING past their expiresAt deadline and:
//   1. Sets booking status → CANCELLED
//   2. Sets associated payment status → FAILED
//
// Both updates happen in a single Prisma transaction so
// the system never sees an inconsistent state (e.g., booking
// cancelled but payment still PENDING).
//
// Race condition with webhook:
//   If a webhook sets the booking to CONFIRMED between the
//   findMany and the updateMany, the updateMany's WHERE clause
//   (status: 'PAYMENT_PENDING') simply matches zero rows.
//   The webhook wins — which is correct, because the customer
//   actually paid.

const cron = require('node-cron');
const prisma = require('../config/prisma');

let task = null;

/**
 * Scans for expired holds and cancels them.
 * Exported separately so it can be called in tests without
 * waiting for the cron schedule.
 */
async function expireStaleHolds() {
  try {
    // ── Step 1: Find all expired PAYMENT_PENDING bookings ──
    // We fetch IDs first (not updateMany directly) because we
    // need the same set of IDs for BOTH the booking and payment
    // updates inside the transaction.
    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: 'PAYMENT_PENDING',
        expiresAt: { lte: new Date() },
      },
      select: { id: true },
    });

    if (expiredBookings.length === 0) {
      return 0; // Nothing to do — skip logging to avoid spam
    }

    const bookingIds = expiredBookings.map((b) => b.id);

    // ── Step 2: Atomic cancel — bookings + payments ────────
    // Both use conditional WHERE clauses for safety:
    //
    // • Booking WHERE includes `status: 'PAYMENT_PENDING'`
    //   → If the webhook confirmed it between Step 1 and now,
    //     the update matches zero rows (webhook wins).
    //
    // • Payment WHERE includes `status: 'PENDING'`
    //   → If the webhook set it to SUCCESS, we don't overwrite.
    const [bookingResult, paymentResult] = await prisma.$transaction([
      prisma.booking.updateMany({
        where: {
          id: { in: bookingIds },
          status: 'PAYMENT_PENDING', // Safety: don't cancel if webhook already confirmed
        },
        data: { status: 'CANCELLED' },
      }),
      prisma.payment.updateMany({
        where: {
          bookingId: { in: bookingIds },
          status: 'PENDING', // Safety: don't overwrite SUCCESS if webhook already processed
        },
        data: { status: 'FAILED' },
      }),
    ]);

    console.log(
      `🕐 Hold expiry: cancelled ${bookingResult.count} booking(s), ` +
      `failed ${paymentResult.count} payment(s)`
    );

    return bookingResult.count;
  } catch (error) {
    // Log but don't crash — the cron will retry next tick.
    // Common causes: DB connection blip, deadlock (auto-retried by MySQL).
    console.error('Hold expiry cron error:', error.message);
    return 0;
  }
}

/**
 * Starts the cron schedule. Call once at server startup.
 * Returns the cron task so it can be stopped during shutdown.
 */
function startHoldExpiryCron() {
  // '*/1 * * * *' = every 1 minute
  // Fields: minute hour day-of-month month day-of-week
  task = cron.schedule('*/1 * * * *', expireStaleHolds, {
    scheduled: true,
    timezone: 'Asia/Kolkata',             // Match the server's timezone
    recoverMissedExecutions: false,       // Skip missed ticks (e.g., laptop sleep) silently
  });

  console.log('🕐 Hold expiry cron started (runs every 60 seconds)');
  return task;
}

/**
 * Stops the cron schedule. Call during graceful shutdown.
 */
function stopHoldExpiryCron() {
  if (task) {
    task.stop();
    console.log('🕐 Hold expiry cron stopped');
  }
}

module.exports = { startHoldExpiryCron, stopHoldExpiryCron, expireStaleHolds };
