// ─────────────────────────────────────────────────────────
// Store Routes — /api/v1/stores
// ─────────────────────────────────────────────────────────

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireStore } = require('../middleware/store');
const { createStore, getMyStore } = require('../controllers/storeController');
const { getStoreBookings } = require('../controllers/bookingController');
const { getStoreVehicles } = require('../controllers/vehicleController');

const router = express.Router();

// POST /api/v1/stores — "List Your Fleet" upgrade
// Pipeline: requireAuth (gate + sync) → requireRole (only CUSTOMER) → controller
router.post('/', requireAuth, requireRole('CUSTOMER'), createStore);

// GET /api/v1/stores/my-store — store details for the owner
router.get(
  '/my-store',
  requireAuth,
  requireRole('STORE_OWNER'),
  requireStore,
  getMyStore
);

// GET /api/v1/stores/my-store/vehicles — all vehicles in the owner's store
// Pipeline: requireAuth → requireRole → requireStore (sets req.store) → controller
router.get(
  '/my-store/vehicles',
  requireAuth,
  requireRole('STORE_OWNER'),
  requireStore,
  getStoreVehicles
);

// GET /api/v1/stores/my-store/bookings — bookings for the owner's fleet
// Pipeline: requireAuth → requireRole → requireStore (sets req.store) → controller
router.get(
  '/my-store/bookings',
  requireAuth,
  requireRole('STORE_OWNER'),
  requireStore,
  getStoreBookings
);

module.exports = router;
