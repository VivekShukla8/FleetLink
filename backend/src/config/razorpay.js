// ─────────────────────────────────────────────────────────
// Razorpay Client — shared singleton
// ─────────────────────────────────────────────────────────
// TEST MODE ONLY — keys must start with rzp_test_
// Production keys (rzp_live_) will be rejected at startup.

const Razorpay = require('razorpay');

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.warn(
    '⚠️  RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in .env — payment endpoints will fail'
  );
}

if (keyId && !keyId.startsWith('rzp_test_')) {
  throw new Error(
    'FATAL: RAZORPAY_KEY_ID must be a test key (rzp_test_...). ' +
    'Live keys are not allowed in development.'
  );
}

const razorpay = new Razorpay({
  key_id: keyId || '',
  key_secret: keySecret || '',
});

module.exports = razorpay;
