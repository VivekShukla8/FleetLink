// ─────────────────────────────────────────────────────────
// AppError — custom error class with HTTP status code
// ─────────────────────────────────────────────────────────
// Throw this anywhere in middleware/controllers:
//   throw new AppError('Vehicle not found', 404);
//
// The centralized error handler (errorHandler) will catch it,
// read the statusCode, and format a consistent JSON response.

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes expected errors from bugs
  }
}

module.exports = AppError;
