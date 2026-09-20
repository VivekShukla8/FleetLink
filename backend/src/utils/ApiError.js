// ─────────────────────────────────────────────────────────
// ApiError — structured error class for consistent API errors
// ─────────────────────────────────────────────────────────
// Throw this anywhere in middleware/controllers:
//   throw new ApiError(404, 'Vehicle not found');
//   throw new ApiError(422, 'Validation failed', ['startDate is required', 'endDate must be after startDate']);
//
// The centralized errorHandler catches it and sends a
// consistent JSON response to the client.

class ApiError extends Error {
  constructor(
    statusCode,
    message = 'Something went wrong',
    errors = [],
    stack = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;
    this.isOperational = true; // distinguishes expected errors from bugs

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
