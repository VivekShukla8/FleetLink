// ─────────────────────────────────────────────────────────
// Shared Prisma Client — single instance, single connection pool
// ─────────────────────────────────────────────────────────
// Every file that needs the database imports this instead of
// creating its own PrismaClient. Multiple instances would open
// competing connection pools to MySQL and eventually exhaust
// the connection limit.
//
// Prisma v7 requires a "driver adapter" — it no longer
// connects to the database directly using DATABASE_URL.
// Instead, we create a connection pool using the mariadb
// driver and pass it to Prisma via PrismaMariaDb adapter.

const { PrismaClient } = require('../generated/prisma');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fleetlink_dev',
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
