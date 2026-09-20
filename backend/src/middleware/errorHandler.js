// ─────────────────────────────────────────────────────────
// Centralized Error Handler — single place for all errors
// ─────────────────────────────────────────────────────────
// Express recognizes a middleware with 4 arguments (err, req, res, next)
// as an error handler. Register it AFTER all routes:
//
//   app.use('/api/v1/vehicles', vehicleRoutes);
//   app.use('/api/v1/bookings', bookingRoutes);
//   app.use(errorHandler);  // <-- catches everything above
//
// Two types of errors arrive here:
//   1. ApiError (operational) — thrown intentionally (404, 409, 403, etc.)
//      → log lightly, send structured response to the client
//   2. Unexpected errors (bugs) — TypeError, null reference, DB connection lost
//      → log the full stack trace, send a generic message to the client
//      (never leak internal details like SQL errors to the client)

const ApiError = require('../utils/ApiError');

const errorHandler = (err, req, res, next) => {
  // If the error isn't an ApiError, normalize it into one
  // so the response shape is always consistent
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, [], err.stack);
  }

  // ── Logging ──────────────────────────────────────────
  if (error.isOperational) {
    // Expected business error — light log
    console.error(`[ApiError] ${error.statusCode} — ${error.message}`);
  } else {
    // Unexpected bug — full stack trace for debugging
    console.error('[UnexpectedError]', err);
  }

  // ── Response ─────────────────────────────────────────
  // Consistent envelope for every error across the entire API
  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
    errors: error.errors,
    // If the user's own PAYMENT_PENDING booking is blocking, include its ID
    // so the frontend can offer a "Resume Payment" link.
    ...(error.pendingBookingId && { pendingBookingId: error.pendingBookingId }),
    // Only include stack trace in development — never in production
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};

module.exports = errorHandler;
