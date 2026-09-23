// ─────────────────────────────────────────────────────────
// Worker — RabbitMQ Consumer for Booking Confirmation Emails
// ─────────────────────────────────────────────────────────
//
// This is a SEPARATE process from the Express server.
// Run with: npm run worker (or: node src/worker.js)
//
// Why separate?
//   1. Crash isolation — if Resend fails, the API stays up.
//   2. Independent scaling — spin up multiple workers if needed.
//   3. Memory isolation — email rendering doesn't starve Express.
//
// Retry strategy:
//   Each message gets up to 3 attempts. On each failure we
//   increment an x-retry-count header and NACK with requeue.
//   After 3 failures, NACK without requeue → RabbitMQ routes
//   the message to the dead-letter queue (booking-confirmed-dlq)
//   for manual inspection.

// Load environment variables (same .env as the main backend)
require('dotenv').config();

const amqp = require('amqplib');
const { sendBookingConfirmationEmail } = require('./services/emailService');

const QUEUE_NAME = 'booking-confirmed';
const DLQ_NAME = `${QUEUE_NAME}-dlq`;
const MAX_RETRIES = 3;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

/**
 * Start consuming messages from the booking-confirmed queue.
 */
async function startWorker() {
  let connection;
  let channel;

  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // ── Set up the dead-letter queue first ──────────────────
    // This queue catches messages that fail 3 times.
    // It's a plain durable queue — messages sit here for
    // manual inspection / replay.
    await channel.assertQueue(DLQ_NAME, { durable: true });

    // ── Set up the main queue ──────────────────────────────
    // x-dead-letter-exchange + routing-key tell RabbitMQ
    // where to send NACKed messages (when requeue = false).
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',           // default exchange
        'x-dead-letter-routing-key': DLQ_NAME,  // route to DLQ
      },
    });

    // Process one message at a time — don't overwhelm Resend
    channel.prefetch(1);

    console.log(`📬 Worker started — listening on queue "${QUEUE_NAME}"`);
    console.log(`   Dead-letter queue: "${DLQ_NAME}"`);
    console.log(`   Max retries: ${MAX_RETRIES}`);
    console.log(`   RabbitMQ: ${RABBITMQ_URL.replace(/\/\/.*@/, '//***@')}`);

    // ── Consume messages ───────────────────────────────────
    channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return; // consumer cancelled by RabbitMQ

      let data;
      try {
        data = JSON.parse(msg.content.toString());
      } catch (err) {
        // Unparseable message — dead-letter it immediately
        console.error('❌ Unparseable message — sending to DLQ:', err.message);
        channel.nack(msg, false, false);
        return;
      }

      // Read retry count from message headers (default 0)
      const retryCount = (msg.properties.headers && msg.properties.headers['x-retry-count']) || 0;

      console.log(
        `📩 Processing: booking=${data.bookingId} email=${data.userEmail} ` +
        `attempt=${retryCount + 1}/${MAX_RETRIES}`
      );

      // ── Try sending the email ────────────────────────────
      const result = await sendBookingConfirmationEmail(data);

      if (result.success) {
        // ✅ Email sent — ACK the message (removes from queue)
        channel.ack(msg);
        console.log(`✅ Email sent for booking ${data.bookingId}`);
      } else {
        // ❌ Email failed
        console.error(
          `❌ Email failed for booking ${data.bookingId}: ${result.error}`
        );

        if (retryCount + 1 >= MAX_RETRIES) {
          // Max retries exhausted — NACK without requeue → DLQ
          console.error(
            `💀 Max retries (${MAX_RETRIES}) reached for booking ${data.bookingId} — sending to DLQ`
          );
          channel.nack(msg, false, false);
        } else {
          // Retry: NACK without requeue (to avoid immediate re-delivery),
          // then re-publish with incremented retry count + a small delay.
          channel.ack(msg); // ack the original
          
          // Re-publish with updated retry count
          // (Small delay via setTimeout prevents tight retry loops)
          setTimeout(() => {
            channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(data)), {
              persistent: true,
              headers: { 'x-retry-count': retryCount + 1 },
            });
            console.log(
              `🔄 Requeued booking ${data.bookingId} — retry ${retryCount + 2}/${MAX_RETRIES}`
            );
          }, 5000); // 5-second delay between retries
        }
      }
    });

    // ── Graceful shutdown ──────────────────────────────────
    const shutdown = async (signal) => {
      console.log(`\n🛑 ${signal} received — shutting down worker...`);
      try {
        await channel.close();
        await connection.close();
      } catch (err) {
        // Ignore close errors during shutdown
      }
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    console.error('🚨 Worker failed to start:', err.message);
    console.error('   Is RabbitMQ running? Check: docker ps | grep rabbit');
    process.exit(1);
  }
}

startWorker();
