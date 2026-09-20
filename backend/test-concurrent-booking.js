// ─────────────────────────────────────────────────────────
// Concurrent Booking Test
// ─────────────────────────────────────────────────────────
// Simulates 5 users trying to book the SAME vehicle for the
// SAME dates at the EXACT same time.
//
// Expected: exactly 1 wins, 4 get "overlap" rejections.
// This proves SELECT ... FOR UPDATE serialization works.
//
// Usage:
//   node test-concurrent-booking.js
//
// The script:
//   1. Creates 5 temporary test users in the DB
//   2. Picks a real vehicle from the DB
//   3. Fires 5 concurrent booking transactions (Promise.all)
//   4. Reports results (who won, who got blocked)
//   5. Cleans up all test data
// ─────────────────────────────────────────────────────────

require('dotenv').config();

const { PrismaClient } = require('./src/generated/prisma');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const crypto = require('crypto');

// ── DB Setup ─────────────────────────────────────────────
const adapter = new PrismaMariaDb({
  host: 'localhost',
  port: 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fleetlink_dev',
  connectionLimit: 20, // Need enough connections for concurrent transactions
});

const prisma = new PrismaClient({ adapter });

// ── Config ───────────────────────────────────────────────
const NUM_USERS = 50;
const TEST_START_DATE = new Date('2026-12-01');
const TEST_END_DATE = new Date('2026-12-05');
const BLOCKING_STATUSES = ['CONFIRMED', 'PAYMENT_PENDING', 'ACTIVE'];

// ── Price calculator (mirrors bookingController) ─────────
function calculateTotalPrice(durationDays, vehicle) {
  let remaining = durationDays;
  let total = 0;

  const fullMonths = Math.floor(remaining / 30);
  if (fullMonths > 0) {
    total += fullMonths * Number(vehicle.monthlyPrice);
    remaining -= fullMonths * 30;
  }

  const fullWeeks = Math.floor(remaining / 7);
  if (fullWeeks > 0) {
    total += fullWeeks * Number(vehicle.weeklyPrice);
    remaining -= fullWeeks * 7;
  }

  if (remaining > 0) {
    total += remaining * Number(vehicle.dailyPrice);
  }

  return parseFloat(total.toFixed(2));
}

// ── Single booking attempt (same logic as bookingController) ──
async function attemptBooking(userId, vehicleId, startDate, endDate, label) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  const idempotencyKey = crypto.randomUUID();

  const startTime = Date.now();

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // Step 1: Lock the vehicle row (SELECT ... FOR UPDATE)
      const lockedVehicle = await tx.$queryRaw`
        SELECT id, dailyPrice, weeklyPrice, monthlyPrice,
               maintenanceFee, securityDeposit, status
        FROM \`Vehicle\`
        WHERE id = ${vehicleId}
        FOR UPDATE
      `;

      if (lockedVehicle.length === 0) {
        throw new Error('Vehicle not found');
      }

      const vehicle = lockedVehicle[0];

      // Step 2: Overlap check
      const overlapping = await tx.booking.findFirst({
        where: {
          vehicleId,
          status: { in: BLOCKING_STATUSES },
          startDate: { lt: end },
          endDate: { gt: start },
        },
      });

      if (overlapping) {
        throw new Error(
          `OVERLAP — blocked by booking ${overlapping.id.slice(0, 8)}… ` +
          `(${overlapping.startDate.toISOString().slice(0, 10)} to ${overlapping.endDate.toISOString().slice(0, 10)})`
        );
      }

      // Step 3: Calculate price and create booking
      const totalPrice = calculateTotalPrice(durationDays, vehicle);

      const newBooking = await tx.booking.create({
        data: {
          userId,
          vehicleId,
          startDate: start,
          endDate: end,
          status: 'PAYMENT_PENDING',
          totalPrice,
          idempotencyKey,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          maintenanceFeeCharged: Number(vehicle.maintenanceFee),
          securityDepositCharged: Number(vehicle.securityDeposit),
        },
      });

      return newBooking;
    });

    const elapsed = Date.now() - startTime;
    return {
      label,
      success: true,
      bookingId: booking.id,
      elapsed,
    };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    return {
      label,
      success: false,
      error: err.message,
      elapsed,
    };
  }
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  🏁 CONCURRENT BOOKING TEST');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Find a real vehicle to book
  const vehicle = await prisma.vehicle.findFirst({
    where: { status: 'AVAILABLE' },
    select: { id: true, brand: true, model: true },
  });

  if (!vehicle) {
    console.error('❌ No AVAILABLE vehicle found in the database.');
    process.exit(1);
  }

  console.log(`🚗 Target vehicle: ${vehicle.brand} ${vehicle.model} (${vehicle.id.slice(0, 8)}…)`);
  console.log(`📅 Date range: ${TEST_START_DATE.toISOString().slice(0, 10)} → ${TEST_END_DATE.toISOString().slice(0, 10)}`);
  console.log(`👥 Concurrent users: ${NUM_USERS}\n`);

  // 2. Clear any existing bookings for this date range on this vehicle
  //    (so the test is clean)
  const deleted = await prisma.booking.deleteMany({
    where: {
      vehicleId: vehicle.id,
      startDate: { lt: TEST_END_DATE },
      endDate: { gt: TEST_START_DATE },
    },
  });
  if (deleted.count > 0) {
    console.log(`🧹 Cleaned up ${deleted.count} existing booking(s) for this range\n`);
  }

  // 3. Create temporary test users
  const testUsers = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const user = await prisma.user.upsert({
      where: { clerkId: `test-concurrent-user-${i}` },
      update: {},
      create: {
        clerkId: `test-concurrent-user-${i}`,
        email: `concurrent-test-${i}@test.local`,
        name: `Test User ${i + 1}`,
        role: 'CUSTOMER',
      },
    });
    testUsers.push(user);
  }
  console.log(`✅ Created ${testUsers.length} test users\n`);

  // 4. Fire ALL booking attempts simultaneously
  console.log('🚀 Firing all bookings simultaneously...\n');
  const startTime = Date.now();

  const results = await Promise.all(
    testUsers.map((user, i) =>
      attemptBooking(
        user.id,
        vehicle.id,
        TEST_START_DATE,
        TEST_END_DATE,
        `User ${i + 1} (${user.name})`
      )
    )
  );

  const totalElapsed = Date.now() - startTime;

  // 5. Report results
  console.log('─── RESULTS ─────────────────────────────────\n');

  const winners = results.filter((r) => r.success);
  const losers = results.filter((r) => !r.success);

  for (const r of results) {
    if (r.success) {
      console.log(`  ✅ ${r.label}: WON → booking ${r.bookingId.slice(0, 8)}… (${r.elapsed}ms)`);
    } else {
      console.log(`  ❌ ${r.label}: BLOCKED → ${r.error} (${r.elapsed}ms)`);
    }
  }

  console.log(`\n─── SUMMARY ─────────────────────────────────\n`);
  console.log(`  Winners: ${winners.length}  |  Blocked: ${losers.length}  |  Total time: ${totalElapsed}ms`);

  if (winners.length === 1) {
    console.log('\n  🎉 PASS — Exactly 1 booking succeeded. FOR UPDATE serialization works!');
  } else if (winners.length === 0) {
    console.log('\n  ⚠️  UNEXPECTED — No bookings succeeded. Check for errors.');
  } else {
    console.log('\n  🚨 FAIL — Multiple bookings succeeded! Race condition detected!');
  }

  // 6. Skip cleanup — leave data in DB for inspection in Prisma Studio
  console.log('\n─── DATA PRESERVED ──────────────────────────\n');
  console.log('  📋 Test users and the winning booking are still in the DB.');
  console.log('  🔍 Open Prisma Studio to inspect them.');
  console.log('  🧹 To clean up later, run:');
  console.log('     node -e "require(\'dotenv\').config(); ...(cleanup script)"');
  console.log('\n═══════════════════════════════════════════════\n');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
