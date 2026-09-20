// ─────────────────────────────────────────────────────────
// FleetLink Server Entry Point
// ─────────────────────────────────────────────────────────

require('dotenv').config();
const app = require('./app');
const { startHoldExpiryCron, stopHoldExpiryCron } = require('./cron/holdExpiryCron');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 FleetLink backend server running on http://localhost:${PORT}`);

  // ── Background Jobs ──────────────────────────────────
  // Start AFTER the server is listening so the DB connection
  // pool is warm and health checks pass before cron ticks.
  startHoldExpiryCron();
});

// ── Graceful Shutdown ────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server...');
  stopHoldExpiryCron();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
