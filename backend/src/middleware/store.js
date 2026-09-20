// ─────────────────────────────────────────────────────────
// requireStore — attaches req.store for store-owner routes
// ─────────────────────────────────────────────────────────
// Placed on routes where a STORE_OWNER needs their store context
// (e.g., creating/managing vehicles). Must run AFTER requireAuth
// and requireRole('STORE_OWNER').
//
// Pipeline: requireAuth → requireRole('STORE_OWNER') → requireStore → controller
//
// After this middleware, controllers use req.store.id directly —
// no redundant store lookups in every handler.

const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const requireStore = async (req, res, next) => {
  try {
    const store = await prisma.store.findUnique({
      where: { ownerId: req.user.id },
    });

    if (!store) {
      throw new ApiError(
        404,
        'No store found for your account — create a store first via POST /api/v1/stores'
      );
    }

    req.store = store;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireStore };
