// ─────────────────────────────────────────────────────────
// ApiResponse — structured success response for consistent API shape
// ─────────────────────────────────────────────────────────
// Use in controllers:
//   res.status(200).json(new ApiResponse(200, storeData, 'Store fetched successfully'));
//   res.status(201).json(new ApiResponse(201, booking, 'Booking created'));
//
// Ensures every success response has the same envelope:
//   { statusCode, data, message, success }

class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

module.exports = ApiResponse;
