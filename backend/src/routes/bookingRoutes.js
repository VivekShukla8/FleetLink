// ─────────────────────────────────────────────────────────
// Booking Routes — /api/v1/bookings
// ─────────────────────────────────────────────────────────

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createBooking, getMyBookings, getBookingById } = require('../controllers/bookingController');
const { initiatePayment } = require('../controllers/paymentController');

const router = express.Router();

// POST /api/v1/bookings — create a booking (CUSTOMER only)
// Pipeline: requireAuth (gate + sync) → requireRole → controller
router.post('/', requireAuth, requireRole('CUSTOMER'), createBooking);

// GET /api/v1/bookings/my-bookings — list authenticated user's bookings
// Registered BEFORE /:id so Express doesn't match 'my-bookings' as a UUID.
// No requireRole — any authenticated user can see their own bookings.
router.get('/my-bookings', requireAuth, getMyBookings);

// GET /api/v1/bookings/:id — single booking detail (ownership-scoped)
router.get('/:id', requireAuth, getBookingById);

// POST /api/v1/bookings/:id/pay — create Razorpay order for a booking
// No requireRole — ownership check is inside the controller.
router.post('/:id/pay', requireAuth, initiatePayment);

module.exports = router;
