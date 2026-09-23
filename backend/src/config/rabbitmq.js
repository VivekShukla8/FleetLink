// ─────────────────────────────────────────────────────────
// RabbitMQ Connection + Publisher
// ─────────────────────────────────────────────────────────
//
// Maintains a single persistent connection and channel to
// RabbitMQ. Exposes a publishToQueue() helper that the
// webhook controller calls after a booking is confirmed.
//
// Design decisions:
//   • Connection is lazy — created on first publish, not
//     at server startup. This keeps the Express server
//     functional even if RabbitMQ is temporarily down.
//   • publishToQueue() never throws — it catches errors
//     internally and logs them. A failed publish must NOT
//     crash the webhook handler or prevent the 200 response
//     to Razorpay.
//   • If RabbitMQ is unreachable, the message is lost (we
//     log the bookingId so it can be resent manually).
//     At our scale this is acceptable — see implementation
//     plan Q1 for the rationale.

const amqp = require('amqplib');

let connection = null;
let channel = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

/**
 * Returns (or creates) a persistent AMQP channel.
 * Throws if RabbitMQ is unreachable — caller must catch.
 */
async function getChannel() {
  if (channel) return channel;

  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();

  // If the connection drops, reset so next call reconnects
  connection.on('close', () => {
    console.warn('[RabbitMQ] Connection closed — will reconnect on next publish');
    channel = null;
    connection = null;
  });

  connection.on('error', (err) => {
    console.error('[RabbitMQ] Connection error:', err.message);
    channel = null;
    connection = null;
  });

  console.log('[RabbitMQ] ✅ Connected to', RABBITMQ_URL.replace(/\/\/.*@/, '//***@'));
  return channel;
}

/**
 * Publish a JSON message to a durable queue.
 *
 * @param {string} queueName - e.g. 'booking-confirmed'
 * @param {object} data      - will be JSON.stringified
 * @returns {boolean} true if published, false if failed
 */
async function publishToQueue(queueName, data) {
  try {
    const ch = await getChannel();

    // assertQueue is idempotent — safe to call every time.
    // durable: true → queue survives RabbitMQ restarts.
    await ch.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',                   // default exchange
        'x-dead-letter-routing-key': `${queueName}-dlq`, // dead-letter queue name
      },
    });

    ch.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
      persistent: true,  // message survives broker restart
    });

    return true;
  } catch (err) {
    console.error(`[RabbitMQ] ❌ Failed to publish to "${queueName}":`, err.message);
    return false;
  }
}

/**
 * Graceful shutdown — call from process exit handler.
 */
async function closeRabbitMQ() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('[RabbitMQ] Connection closed gracefully');
  } catch (err) {
    console.error('[RabbitMQ] Error during shutdown:', err.message);
  }
}

module.exports = { publishToQueue, closeRabbitMQ };
