// ─────────────────────────────────────────────────────────
// Booking Controller
// ─────────────────────────────────────────────────────────
//
// Creates a booking in PAYMENT_PENDING status with a 10-minute
// hold expiry. Payment processing is a separate step.
//
// Uses an INTERACTIVE Prisma transaction with SELECT ... FOR UPDATE
// on the Vehicle row to serialize concurrent booking attempts for
// the same vehicle.

const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// ── Pricing ────────────────────────────────────────────────
// Tiering: full months at monthlyPrice, remaining full weeks
// at weeklyPrice, remaining days at dailyPrice.
//
// Example: 45 days → 1 month (30 days) at monthlyPrice
//                   + 2 weeks (14 days) at weeklyPrice
//                   + 1 day at dailyPrice
//
// endDate is EXCLUSIVE (the return date, not a billed day).

function calculateTotalPrice(durationDays, vehicle) {
  let remaining = durationDays;
  let total = 0;

  // Full months (30-day blocks)
  const fullMonths = Math.floor(remaining / 30);
  if (fullMonths > 0) {
    total += fullMonths * Number(vehicle.monthlyPrice);
    remaining -= fullMonths * 30;
  }

  // Full weeks (7-day blocks) from the remainder
  const fullWeeks = Math.floor(remaining / 7);
  if (fullWeeks > 0) {
    total += fullWeeks * Number(vehicle.weeklyPrice);
    remaining -= fullWeeks * 7;
  }

  // Remaining days
  if (remaining > 0) {
    total += remaining * Number(vehicle.dailyPrice);
  }

  return parseFloat(total.toFixed(2));
}

// ── Overlap check SQL explanation ──────────────────────────
// Two date ranges [A_start, A_end) and [B_start, B_end) overlap
// if and only if: A_start < B_end AND B_start < A_end
//
// With exclusive endDate, a booking ending Aug 3 and another
// starting Aug 3 are NON-conflicting:
//   A: [Aug 1, Aug 3)  B: [Aug 3, Aug 5)
//   A_start(1) < B_end(5)? YES  AND  B_start(3) < A_end(3)? NO → no overlap ✅

const BLOCKING_STATUSES = ['CONFIRMED', 'PAYMENT_PENDING', 'ACTIVE'];

// ── Controller ─────────────────────────────────────────────

const createBooking = async (req, res, next) => {
  try {
    const { vehicleId, startDate, endDate, idempotencyKey } = req.body;

    // ── Basic validation ─────────────────────────────────
    const errors = [];

    if (!vehicleId || typeof vehicleId !== 'string') {
      errors.push('vehicleId is required');
    }
    if (!startDate) {
      errors.push('startDate is required');
    }
    if (!endDate) {
      errors.push('endDate is required');
    }
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      errors.push('idempotencyKey is required (client-generated UUID)');
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime())) {
      errors.push('startDate must be a valid date');
    }
    if (Number.isNaN(end.getTime())) {
      errors.push('endDate must be a valid date');
    }

    // endDate is exclusive — must be strictly after startDate (minimum 1 day)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start >= end) {
      errors.push('endDate must be after startDate (minimum 1 rental day)');
    }

    if (errors.length > 0) {
      throw new ApiError(422, 'Validation failed', errors);
    }

    // Duration in days (endDate exclusive)
    const durationDays = Math.round((end - start) / (1000 * 60 * 60 * 24));

    // ── Interactive transaction ───────────────────────────
    // EVERY query inside uses `tx`, never the plain `prisma` client.
    // Using `prisma` here would run on a separate DB connection that
    // doesn't see the FOR UPDATE lock or uncommitted writes, making
    // the lock meaningless and re-introducing the race condition.

    const booking = await prisma.$transaction(async (tx) => {
      // Step 1: Lock the vehicle row
      // SELECT ... FOR UPDATE acquires a row-level exclusive lock.
      // Any concurrent transaction attempting the same lock will WAIT
      // until this transaction commits or rolls back.
      const lockedVehicle = await tx.$queryRaw`
        SELECT id, dailyPrice, weeklyPrice, monthlyPrice,
               maintenanceFee, securityDeposit, status
        FROM \`Vehicle\`
        WHERE id = ${vehicleId}
        FOR UPDATE
      `;

      if (lockedVehicle.length === 0) {
        throw new ApiError(404, 'Vehicle not found');
      }

      const vehicle = lockedVehicle[0];

      // Check vehicle is available for rental
      if (vehicle.status !== 'AVAILABLE') {
        throw new ApiError(409, 'Vehicle is currently under maintenance and cannot be booked');
      }

      // Step 2: Idempotency check
      // If this idempotencyKey already produced a booking, return it
      // immediately. This handles network retries / double-clicks —
      // the client gets back the same booking without a duplicate insert.
      const existingBooking = await tx.booking.findUnique({
        where: { idempotencyKey },
      });

      if (existingBooking) {
        // Idempotent replay — return the existing booking as-is
        return existingBooking;
      }

      // Step 3: Date-range overlap check
      // Two half-open ranges [A_start, A_end) and [B_start, B_end)
      // overlap iff: A_start < B_end AND B_start < A_end
      //
      // This correctly allows back-to-back bookings:
      //   Booking A: [Aug 1, Aug 3)  Booking B: [Aug 3, Aug 5)
      //   A_start(1) < B_end(5)? YES  AND  B_start(3) < A_end(3)? NO → no overlap ✅
      const overlapping = await tx.booking.findFirst({
        where: {
          vehicleId,
          status: { in: BLOCKING_STATUSES },
          startDate: { lt: end },   // existing.start < requested.end
          endDate: { gt: start },   // existing.end   > requested.start
        },
      });

      if (overlapping) {
        // If the blocking booking is the user's own PAYMENT_PENDING booking,
        // include its ID so the frontend can offer a "Resume Payment" link
        // instead of a generic "choose different dates" dead-end.
        const isOwnPending =
          overlapping.userId === req.user.id &&
          overlapping.status === 'PAYMENT_PENDING';

        const error = new ApiError(
          409,
          isOwnPending
            ? 'You already have a pending booking for these dates'
            : 'Vehicle is already booked for the requested dates',
          [`Conflicting booking: ${overlapping.startDate.toISOString().slice(0, 10)} to ${overlapping.endDate.toISOString().slice(0, 10)}`]
        );

        // Attach extra data for the frontend (ApiError → JSON serialization
        // will include any enumerable properties on the error object).
        if (isOwnPending) {
          error.pendingBookingId = overlapping.id;
        }

        throw error;
      }

      // Step 4: Calculate pricing
      const totalPrice = calculateTotalPrice(durationDays, vehicle);

      // Step 5: Snapshot fees (frozen at booking time)
      const maintenanceFeeCharged = Number(vehicle.maintenanceFee);
      const securityDepositCharged = Number(vehicle.securityDeposit);

      // Step 6: Insert the booking
      const newBooking = await tx.booking.create({
        data: {
          userId: req.user.id,
          vehicleId,
          startDate: start,
          endDate: end,
          status: 'PAYMENT_PENDING',
          totalPrice,
          idempotencyKey,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // +10 minutes
          maintenanceFeeCharged,
          securityDepositCharged,
        },
      });

      return newBooking;
    });

    // Determine if this was a new booking or an idempotent replay
    // by checking if expiresAt was set recently (within last second)
    // For simplicity, always return 201 — the client doesn't need
    // to differentiate since the result is the same.
    return res.status(201).json(
      new ApiResponse(201, {
        booking,
        pricing: {
          durationDays,
          totalPrice: booking.totalPrice,
          maintenanceFeeCharged: booking.maintenanceFeeCharged,
          securityDepositCharged: booking.securityDepositCharged,
        },
      }, 'Booking created — complete payment within 10 minutes')
    );
  } catch (error) {
    // Catch P2002 on idempotencyKey — race between two identical
    // requests that both passed the findUnique check. The second
    // create() fails on the unique constraint. Re-fetch and return.
    if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
      try {
        const existing = await prisma.booking.findUnique({
          where: { idempotencyKey: req.body.idempotencyKey },
        });
        if (existing) {
          return res.status(201).json(
            new ApiResponse(201, { booking: existing }, 'Booking created (idempotent replay)')
          );
        }
      } catch (retryError) {
        return next(retryError);
      }
    }

    next(error);
  }
};



// ── Shared Constants ──────────────────────────────────────

const VALID_BOOKING_STATUSES = [
  'PENDING', 'PAYMENT_PENDING', 'CONFIRMED',
  'ACTIVE', 'COMPLETED', 'CANCELLED', 'REJECTED',
];

// Reusable select/include shapes to keep the controller DRY
// and to enforce consistent field exposure across endpoints.

const VEHICLE_WITH_STORE_SELECT = {
  id: true,
  category: true,
  brand: true,
  model: true,
  dailyPrice: true,
  weeklyPrice: true,
  monthlyPrice: true,
  status: true,
  store: {
    select: { id: true, name: true, address: true, latitude: true, longitude: true },
  },
};

const CUSTOMER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  // Excluded: clerkId (auth plumbing), role (always CUSTOMER), createdAt (irrelevant)
};

// ── GET /api/v1/bookings/my-bookings ─────────────────────
// Returns the authenticated user's own bookings.
// No role restriction — any logged-in user can view their bookings.
//
// Query params:
//   ?status=CONFIRMED   — optional filter by booking status
//   ?page=1&limit=10    — pagination (same clamping pattern as getVehicles)

const getMyBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    // ── Build WHERE clause ─────────────────────────────
    const where = { userId: req.user.id };

    if (status && VALID_BOOKING_STATUSES.includes(status)) {
      where.status = status;
    }

    // ── Pagination (same clamping as getVehicles) ──────
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: VEHICLE_WITH_STORE_SELECT },
          payment: {
            select: { id: true, status: true, razorpayOrderId: true, amount: true },
          },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        bookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      }, 'Your bookings fetched successfully')
    );
  } catch (error) {
    next(error);
  }
};

// ── GET /api/v1/bookings/:id ─────────────────────────────
// Returns a single booking with full details.
// Ownership check: booking.userId must match req.user.id.
// Returns 404 for both "doesn't exist" and "not yours"
// (same anti-enumeration pattern as paymentController).

const getBookingById = async (req, res, next) => {
  try {
    // findFirst with TWO conditions: id + userId
    // If the booking exists but belongs to someone else → null → 404
    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: {
        vehicle: { select: VEHICLE_WITH_STORE_SELECT },
        payment: {
          select: {
            id: true,
            status: true,
            razorpayOrderId: true,
            razorpayPaymentId: true,
            amount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    return res.status(200).json(
      new ApiResponse(200, booking, 'Booking fetched successfully')
    );
  } catch (error) {
    next(error);
  }
};

// ── GET /api/v1/stores/my-store/bookings ─────────────────
// Returns all bookings for vehicles in the store owner's store.
// Requires: requireAuth → requireRole('STORE_OWNER') → requireStore
// so req.store is already set.
//
// Filters through the vehicle relation:
//   WHERE vehicle.storeId = req.store.id
//
// Query params:
//   ?status=CONFIRMED   — optional filter by booking status
//   ?vehicleId=abc-123  — optional filter by specific vehicle
//   ?page=1&limit=10    — pagination

const getStoreBookings = async (req, res, next) => {
  try {
    const { status, vehicleId, page = 1, limit = 10 } = req.query;

    // ── Build WHERE clause ─────────────────────────────
    // The key pattern: filtering through a Prisma relation.
    // Booking doesn't have a storeId field, but it has a
    // `vehicle` relation, and Vehicle has `storeId`.
    // Prisma lets us nest: { vehicle: { storeId: '...' } }
    const where = {
      vehicle: { storeId: req.store.id },
    };

    if (status && VALID_BOOKING_STATUSES.includes(status)) {
      where.status = status;
    }

    if (vehicleId && typeof vehicleId === 'string') {
      where.vehicleId = vehicleId;
    }

    // ── Pagination ─────────────────────────────────────
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          // Customer info: only what the store owner needs to
          // service the booking — no clerkId, role, or createdAt.
          user: { select: CUSTOMER_SELECT },
          vehicle: {
            select: {
              id: true,
              category: true,
              brand: true,
              model: true,
              status: true,
            },
          },
          payment: {
            select: { id: true, status: true, amount: true },
          },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        bookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      }, 'Store bookings fetched successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { createBooking, getMyBookings, getBookingById, getStoreBookings };
