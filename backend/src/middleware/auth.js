// ─────────────────────────────────────────────────────────
// Auth Middleware — Clerk verification + local User sync
// ─────────────────────────────────────────────────────────

const { clerkMiddleware, getAuth, clerkClient } = require('@clerk/express');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

// ── Middleware 1: clerkAuth ──────────────────────────────
// Runs on EVERY route. Verifies the Clerk session JWT
// (signature check against Clerk's public keys) and makes
// getAuth(req) available downstream.
//
// Does NOT block unauthenticated requests — a public route
// like GET /api/v1/vehicles can still work without a token.
// It just means getAuth(req).userId will be null.
const clerkAuth = clerkMiddleware();

// ── Middleware 2: requireAuth ────────────────────────────
// Runs on PROTECTED routes only. Two jobs:
//
// Job 1 — Gate: if no valid session, return 401.
//
// Job 2 — Sync: if the Clerk user has no row in our User
// table yet (first request after signup), create one.
// This is the "on-first-request sync" pattern we discussed:
//   - Clerk owns authentication (who is this person?)
//   - Our User table owns domain data (role, bookings, store)
//   - clerkId is the bridge between the two
//
// After sync, req.user is the LOCAL User row from our DB —
// every downstream controller uses req.user.id (our UUID),
// NOT the Clerk ID, for foreign keys and business logic.

const requireAuth = async (req, res, next) => {
  try {
    const auth = getAuth(req);

    // Job 1: no valid session → block
    if (!auth.userId) {
      throw new ApiError(401, 'Unauthorized — no valid session token');
    }

    const clerkId = auth.userId;

    // Job 2: find or create the local User row
    let user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      // First time this Clerk user hits our API.
      // Fetch their profile from Clerk to populate name/email.
      const clerkUser = typeof clerkClient === 'function'
        ? await (await clerkClient()).users.getUser(clerkId)
        : await clerkClient.users.getUser(clerkId);

      const name = [clerkUser.firstName, clerkUser.lastName]
        .filter(Boolean)
        .join(' ') || 'Unknown';

      const email =
        clerkUser.emailAddresses[0]?.emailAddress || '';

      const phone =
        clerkUser.phoneNumbers?.[0]?.phoneNumber || null;

      try {
        user = await prisma.user.create({
          data: {
            clerkId,
            name,
            email,
            phone,
            role: 'CUSTOMER',
          },
        });
      } catch (createError) {
        // Race condition: another concurrent request already created
        // this user between our findUnique and create. The unique
        // constraint on clerkId rejected our duplicate INSERT (P2002).
        // That's fine — the row exists now, just re-fetch it.
        if (createError.code === 'P2002') {
          user = await prisma.user.findUnique({
            where: { clerkId },
          });
        } else {
          throw createError; // unexpected error — rethrow to outer catch
        }
      }
    }

    // Attach the local User to the request object.
    // Controllers use req.user.id, req.user.role, etc.
    req.user = user;
    next();
  } catch (error) {
    next(error); // forward to centralized errorHandler
  }
};

// ── Middleware 3: requireRole ─────────────────────────────
// Higher-order function: takes one or more allowed roles,
// returns a middleware that checks req.user.role against them.
//
// MUST run after requireAuth — depends on req.user being set.
//
// Usage:
//   router.post('/vehicles', requireAuth, requireRole('STORE_OWNER'), handler)
//   router.get('/admin/stats', requireAuth, requireRole('ADMIN'), handler)
//   router.get('/bookings/:id', requireAuth, requireRole('CUSTOMER', 'STORE_OWNER'), handler)

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    // Guard: if req.user doesn't exist, requireAuth wasn't called first
    if (!req.user) {
      return next(
        new ApiError(500, 'Server misconfiguration — auth middleware missing')
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Forbidden — requires one of: ${allowedRoles.join(', ')}`)
      );
    }

    next();
  };
};

module.exports = { clerkAuth, requireAuth, requireRole };
