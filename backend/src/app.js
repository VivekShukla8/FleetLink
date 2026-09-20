// ─────────────────────────────────────────────────────────
// FleetLink Express Application Setup
// ─────────────────────────────────────────────────────────

const express = require('express');
const cors = require('cors');
const { clerkAuth, requireAuth } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const ApiResponse = require('./utils/ApiResponse');
const storeRoutes = require('./routes/storeRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const { handleWebhook } = require('./controllers/webhookController');

const app = express();

// ── Global Middlewares ───────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// ── Razorpay Webhook — MUST be BEFORE express.json() ─────
// This route needs the RAW, unparsed request body (Buffer) to
// compute the HMAC signature. express.json() would consume the
// raw bytes and replace them with a parsed JS object, making
// signature verification impossible.
//
// Registration order is what makes this work:
//   1. This route matches POST /api/v1/webhooks/razorpay →
//      express.raw() puts raw Buffer in req.body → handler runs
//   2. express.json() below never fires for this route because
//      the response was already sent
//   3. All other routes hit express.json() normally
app.post(
  '/api/v1/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  handleWebhook
);

// ── JSON body parsing for all other routes ───────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Verifies Clerk JWT on all incoming requests (non-blocking)
app.use(clerkAuth);

// ── Health Check Route ───────────────────────────────────
app.get('/health', (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, { status: 'healthy', timestamp: new Date() }, 'FleetLink API is operational')
  );
});

// ── Auth Verification Test Route ─────────────────────────
// Syncs and returns the local database user for the authenticated Clerk user
app.get('/api/v1/auth/me', requireAuth, (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, req.user, 'Current user profile fetched')
  );
});

// ── API Routes ───────────────────────────────────────────
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/bookings', bookingRoutes);

// ── Centralized Error Handler ────────────────────────────
// Must be mounted AFTER all routes
app.use(errorHandler);

module.exports = app;
