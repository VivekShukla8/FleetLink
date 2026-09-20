// ─────────────────────────────────────────────────────────
// Vehicle Routes — /api/v1/vehicles
// ─────────────────────────────────────────────────────────

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireStore } = require('../middleware/store');
const {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} = require('../controllers/vehicleController');

const router = express.Router();

// ── Public Routes ────────────────────────────────────────
// No auth required — customers browse vehicles without signing in

router.get('/', getVehicles);            // GET /api/v1/vehicles?category=CAR&status=AVAILABLE
router.get('/:id', getVehicleById);      // GET /api/v1/vehicles/:id

// ── Store Owner Routes ───────────────────────────────────
// Full pipeline: requireAuth → requireRole → requireStore → controller
// requireStore attaches req.store so controllers use req.store.id

router.post('/', requireAuth, requireRole('STORE_OWNER'), requireStore, createVehicle);
router.patch('/:id', requireAuth, requireRole('STORE_OWNER'), requireStore, updateVehicle);
router.delete('/:id', requireAuth, requireRole('STORE_OWNER'), requireStore, deleteVehicle);

module.exports = router;
