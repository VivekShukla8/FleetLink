// ─────────────────────────────────────────────────────────
// Store Controller — "List Your Fleet" upgrade flow
// ─────────────────────────────────────────────────────────

const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// POST /api/v1/stores
// Upgrades a CUSTOMER to STORE_OWNER by creating their Store.
//
// Why a transaction?
//   Two writes must be atomic: store.create + user.update(role).
//   If store.create succeeds but user.update fails without a
//   transaction, we'd have a "ghost store" — a Store row linked
//   to a User still marked as CUSTOMER. The user can't retry
//   (ownerId unique constraint blocks them) and can't manage
//   vehicles (role is still CUSTOMER). Transaction ensures both
//   succeed or both roll back.

const createStore = async (req, res, next) => {
  try {
    const { name, address, latitude, longitude } = req.body;

    // ── Validation ─────────────────────────────────────
    const errors = [];
    if (!name || typeof name !== 'string' || !name.trim()) {
      errors.push('name is required');
    }
    if (!address || typeof address !== 'string' || !address.trim()) {
      errors.push('address is required');
    }
    if (typeof latitude !== 'number' || Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      errors.push('latitude must be a number between -90 and 90');
    }
    if (typeof longitude !== 'number' || Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      errors.push('longitude must be a number between -180 and 180');
    }

    if (errors.length > 0) {
      throw new ApiError(422, 'Validation failed', errors);
    }

    // ── Transaction: create Store + upgrade role ───────
    const [store, updatedUser] = await prisma.$transaction([
      prisma.store.create({
        data: {
          ownerId: req.user.id,
          name: name.trim(),
          address: address.trim(),
          latitude,
          longitude,
        },
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: { role: 'STORE_OWNER' },
      }),
    ]);

    return res.status(201).json(
      new ApiResponse(201, { store, user: updatedUser }, 'Store created — you are now a STORE_OWNER')
    );
  } catch (error) {
    // ── Race condition: two concurrent requests from the
    // same CUSTOMER both pass requireRole('CUSTOMER') before
    // either transaction commits. The second transaction's
    // store.create() hits the ownerId @unique constraint.
    // That's P2002 — we return a clean 409 instead of 500.
    if (error.code === 'P2002') {
      return next(
        new ApiError(409, 'You already own a store')
      );
    }

    next(error);
  }
};

// GET /api/v1/stores/my-store
// Returns the store details for the authenticated store owner.
// req.store is already set by requireStore middleware.

const getMyStore = async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, req.store, 'Store details fetched successfully')
  );
};

module.exports = { createStore, getMyStore };
