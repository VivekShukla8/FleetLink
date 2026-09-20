# FleetLink — Payment Reliability Deep Dive: Reconciliation, Webhook Security, and the Hold-Expiry Cron

This covers three connected topics from building the payment module: what reconciliation is, the security terms in the webhook handler, and how the hold-expiry background job works.

---

## Part 1: What is Reconciliation?

Reconciliation is the **safety net for the safety net** — it only makes sense once you see the specific gap it fills.

### The literal meaning

"Reconciliation" normally means comparing two records of the same thing to make sure they agree — like reconciling a bank statement against your own checkbook to catch any discrepancy. In this system, it means the same idea: **comparing what the database *thinks* happened against what Razorpay *actually* knows happened**, and fixing any mismatch.

### Why this is needed at all

The webhook is supposed to tell the server the moment a payment succeeds. So why would you ever need to separately double-check? Because **webhooks are not 100% guaranteed to arrive.** Real-world reasons this happens:

```
- The server was briefly down or deploying when Razorpay tried to send it
- A network blip between Razorpay and the server
- A bug in the webhook handler crashes before it finishes processing
- Razorpay's retry mechanism eventually gives up after several failed attempts
```

Razorpay does retry failed webhook deliveries (exponential backoff over 24 hours), but it's not infinite, and it's not instant. So there's a real possibility — rare, but real — that a payment genuinely succeeded, and the server never finds out through the webhook path at all.

### What happens without reconciliation, concretely

```
User pays successfully → Razorpay charges them
       ↓
Webhook attempt fails (server was mid-deploy, say)
       ↓
Booking sits at PAYMENT_PENDING, expiresAt ticks down
       ↓
10 minutes pass, expiry job runs, sees expiresAt has passed
       ↓
Expiry job assumes "payment never happened" and CANCELS the hold
       ↓
The vehicle becomes bookable by someone else again
       ↓
BUT the original customer's money was already taken —
they have no booking, and someone else might now book
the same vehicle they thought they'd already secured
```

### What full reconciliation would do — actively check, don't assume

```js
// Conceptual design — NOT what was ultimately built, see "Honest Scope" below
async function reconcilePendingPayments() {
  const stuckBookings = await prisma.booking.findMany({
    where: {
      status: 'PAYMENT_PENDING',
      expiresAt: { lt: new Date() },
    },
  });

  for (const booking of stuckBookings) {
    // Don't just assume it failed — actually ASK Razorpay
    const razorpayOrder = await razorpay.orders.fetch(booking.razorpayOrderId);

    if (razorpayOrder.status === 'paid') {
      // The webhook must have been lost — but the payment DID happen.
      await confirmBooking(booking.id, razorpayOrder);
    } else {
      await releaseBooking(booking.id);
    }
  }
}
```

### Honest Scope — what was designed vs. what was actually built

**Designed**: full reconciliation that actively calls Razorpay's API to check the real status of every stuck booking before deciding to cancel it.

**Built**: the simpler hold-expiry cron (Part 3, below) — which handles the common case (genuinely unpaid) via conditional database updates, without calling Razorpay's API at all. The webhook's Step 5b guard (Part 2) handles the rare race case by logging it for manual review rather than automatically querying Razorpay. This is a smaller, sufficient version of the fuller reconciliation design — worth being precise about this distinction if asked directly "did you build reconciliation?"

### Interview answer

> "My system doesn't assume 'no webhook received' means 'nothing happened.' I designed reconciliation logic that would actively query Razorpay's API to confirm the real status of a booking before acting — rather than trusting silence as proof of failure. What I actually implemented is a leaner version: a hold-expiry cron with conditional database checks that correctly defers to the webhook if it already confirmed the booking, plus a guard in the webhook itself that detects and logs the rare case where the cron beat it — rather than full API-based reconciliation for every stuck booking, since that case is extremely rare at this scale."

---

## Part 2: Webhook Security Terms

### Payload

**Means: "the actual data being sent."** When Razorpay sends a webhook, the HTTP request has a body — that body's content is the "payload." Like a package delivery: the payload is what's inside the box, not the box itself or the shipping label.

```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": { "id": "pay_XXX", "order_id": "order_XXX", ... }
    }
  }
}
```

### Buffer

**Means: "raw bytes, not yet turned into something readable."** Data traveling over the internet arrives as a stream of raw bytes — a `Buffer` in Node.js is literally that: unprocessed bytes, before being interpreted as text, numbers, or a JavaScript object. Like a sealed envelope containing a letter you haven't read yet.

```js
const rawBody = req.body; // a Buffer — raw bytes, not readable JSON yet
```

**Why the raw buffer matters here specifically**: Razorpay computed a security signature based on the *exact original bytes* they sent. If Express converts those bytes into a JS object and then that gets converted back into a string to check the signature, it might not come out byte-for-byte identical (JSON can be written with different spacing/key order and still mean the same thing, but the signature check cares about the literal bytes). So this one route deliberately skips the "convert to a nice JS object" step, using `express.raw()` instead of `express.json()`.

### HMAC (HMAC-SHA256)

**Means: "a way to prove a message hasn't been tampered with, using a shared secret password."**

Both sides (Razorpay and the server) know a secret password (`RAZORPAY_WEBHOOK_SECRET`). Razorpay runs the message and the secret through a formula, producing a short "fingerprint." The server receives the message, runs the *same* message and *same* secret through the *same* formula, and checks: does the fingerprint match?

- Match → the message really came from someone who knows the secret, and wasn't altered in transit
- No match → either a fake message, or the real message got altered

```js
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)  // "use this secret password"
  .update(rawBody)                       // "and this exact message"
  .digest('hex');                        // "give me the fingerprint"
```

"SHA256" is just the specific mathematical formula used — reliably produces the same fingerprint for the same input, and a completely different one if even one character changes.

### Signature

**Means: "the fingerprint Razorpay sends along with the message."** The output of the HMAC calculation — a 64-character string arriving in the `x-razorpay-signature` header.

### Timing-Safe Comparison

**Means: "checking if two things match, without accidentally giving away hints about how close a guess was."**

A normal `===` comparison stops checking the moment it finds a mismatch. This is fast, but leaks information: how long the check took reveals how many characters matched before it gave up. An attacker could theoretically send thousands of guesses and measure response time to reconstruct the correct signature one character at a time — without ever knowing the actual secret.

`crypto.timingSafeEqual` always checks every character, no matter what, so every comparison takes exactly the same time — no timing hints leak.

```js
const expectedBuf = Buffer.from(expectedSignature, 'hex');
const receivedBuf = Buffer.from(receivedSignature, 'hex');

if (expectedBuf.length !== receivedBuf.length) {
  // Length check FIRST — timingSafeEqual throws on mismatched lengths.
  // SHA-256 hex is always 64 chars, so a length mismatch is definitely wrong.
  return res.status(400).json({ error: 'Invalid signature' });
}

if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
  return res.status(400).json({ error: 'Invalid signature' });
}
```

### The Critical Ordering Rule

Signature verification happens **first, unconditionally**, before the event type or any payload content is read. Never branch on event type (or anything else in the payload) before the signature proves the payload is genuinely from Razorpay — otherwise an attacker could craft a fake `payment.captured` event with a forged order ID, and the code would act on unverified data.

### Interview answer

> "I verify the webhook signature before reading any payload content — I never branch on event type first, since that would mean trusting unverified data to decide whether to trust it. The signature itself is an HMAC-SHA256 fingerprint computed over the raw, unparsed request bytes — which is why this one route uses `express.raw()` instead of the app's normal JSON body parser, since re-serializing an already-parsed object could produce different bytes than what was actually signed. And I compare the signature using `crypto.timingSafeEqual`, not a plain `===`, to avoid leaking timing information that could theoretically help an attacker guess a valid signature byte by byte."

---

## Part 3: The Hold-Expiry Cron Job

### What is Cron?

**Cron is a way to tell a computer "run this task automatically, on a repeating schedule, without a human clicking anything."** The name comes from an old Unix tool (crontab) that's been doing this since the 1970s. Today, "a cron job" just means "scheduled, recurring, automated task," in any language.

**Analogy**: like an alarm clock that never stops resetting itself — it goes off on a schedule you set once, without anyone triggering it manually each time.

**Why this project needs one**: nobody manually checks "has this booking's 10-minute hold expired?" every few seconds. Something has to watch the clock automatically and continuously.

### The Cron Schedule Syntax

```js
cron.schedule('*/1 * * * *', expireStaleHolds, { ... })
```

```
*/1  *  *  *  *
 │   │  │  │  └── day of week (0-6, Sunday=0)
 │   │  │  └───── month (1-12)
 │   │  └──────── day of month (1-31)
 │   └─────────── hour (0-23)
 └─────────────── minute (0-59)
```

`*/1` in the minute slot means "every 1 minute." A `*` alone means "any/every" for that field. So this schedule runs every single minute, forever.

### `expireStaleHolds()` — Step by Step

```js
async function expireStaleHolds() {
  try {
    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: 'PAYMENT_PENDING',
        expiresAt: { lte: new Date() },
      },
      select: { id: true },
    });
```
Finds bookings still waiting to be paid, whose 10-minute window has passed. `lte` = "less than or equal to" (expiry time is now in the past). `select: { id: true }` only fetches the ID column — faster than pulling every field.

```js
    if (expiredBookings.length === 0) {
      return 0; // Nothing to do — skip logging to avoid spam
    }
```
If nothing's expired, stop immediately without logging — since this runs every 60 seconds forever, logging "nothing to do" every time would flood the logs with noise, burying anything actually worth noticing.

```js
    const bookingIds = expiredBookings.map((b) => b.id);

    const [bookingResult, paymentResult] = await prisma.$transaction([
      prisma.booking.updateMany({
        where: { id: { in: bookingIds }, status: 'PAYMENT_PENDING' },
        data: { status: 'CANCELLED' },
      }),
      prisma.payment.updateMany({
        where: { bookingId: { in: bookingIds }, status: 'PENDING' },
        data: { status: 'FAILED' },
      }),
    ]);
```
`updateMany` updates every row matching a condition in one go, rather than one row at a time. Both updates happen inside one transaction — the same array-form `$transaction` pattern used for store creation.

**The race-condition defense**: re-checking `status: 'PAYMENT_PENDING'` here — not just in the earlier `findMany` — means if a webhook confirmed one of these bookings in the few milliseconds between the find and this update, that booking's status is no longer `PAYMENT_PENDING`, so the update simply won't match it. The webhook's confirmation wins, correctly.

**Why `Payment → FAILED` too, not just `Booking → CANCELLED`**: without this, a cancelled booking's `Payment` row would silently stay `PENDING` forever. If a late webhook ever arrived for it, the webhook's own `payment.status === 'SUCCESS'` check wouldn't block it (since it's still `PENDING`), risking a wrongly-revived cancelled booking. Marking it `FAILED` here removes that ambiguity at the source.

```js
    console.log(`🕐 Hold expiry: cancelled ${bookingResult.count} booking(s), failed ${paymentResult.count} payment(s)`);
    return bookingResult.count;
  } catch (error) {
    console.error('Hold expiry cron error:', error.message);
    return 0;
  }
}
```
`updateMany` returns a `count` of rows actually changed — logged for visibility. The `catch` block prevents an error here from crashing the *entire application* — since this is a recurring background job, an uncaught error could otherwise take down every other feature. Instead, it logs and waits for the next tick, 60 seconds later, to try again.

### `startHoldExpiryCron()` and `stopHoldExpiryCron()`

```js
function startHoldExpiryCron() {
  task = cron.schedule('*/1 * * * *', expireStaleHolds, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  console.log('🕐 Hold expiry cron started (runs every 60 seconds)');
  return task;
}

function stopHoldExpiryCron() {
  if (task) {
    task.stop();
    console.log('🕐 Hold expiry cron stopped');
  }
}
```
`startHoldExpiryCron` kicks off the recurring schedule, saving the returned `task` so it can be stopped later. `stopHoldExpiryCron` stops it cleanly — called during graceful shutdown. The `if (task)` guard prevents crashing if `.stop()` is called on something never started.

**Note on `timezone: 'Asia/Kolkata'`**: this only controls *when the schedule fires* (for readable log timestamps) — `expiresAt` itself is stored as an absolute UTC timestamp, so this setting doesn't affect the correctness of the expiry logic at all.

### Wiring It Into the Server

```js
const server = app.listen(PORT, () => {
  console.log(`🚀 FleetLink backend server running...`);
  startHoldExpiryCron();
});
```
The cron starts the moment the server successfully begins listening — from then on, it runs on its own timeline, completely independent of any incoming HTTP request. This is the key distinction from everything else in the app: **every other piece of code only runs in response to a user action; the cron runs on a timer, regardless of whether anyone is using the app.**

```js
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server...');
  stopHoldExpiryCron();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
```
`SIGTERM` is a signal the OS sends to request a clean shutdown (e.g., when Docker stops a container, or a host redeploys). This handler shuts down in the correct order: stop the cron first (so it doesn't start a new tick mid-shutdown), then close the HTTP server (finishing in-flight requests), then exit.

### Design Decisions Worth Remembering

- **Bulk `updateMany` over one-at-a-time**: no per-booking side effects exist yet (no emails, no external calls), so a single bulk query is simpler and faster. Would revisit if per-row side effects were added later.
- **No Razorpay API call needed in the cron itself**: if the customer actually paid, the webhook already confirmed it, so the cron's conditional `WHERE` simply won't match that booking. Calling Razorpay's API per booking would add unnecessary latency and a network dependency to a job that should be fast and self-contained.
- **Two-sided race defense**: the cron's conditional update AND the webhook's Step 5b guard both independently detect the same rare race, so whichever side "wins," the system stays consistent — rather than trying to prevent the race with coordination overhead disproportionate to a once-in-millions-of-transactions event.
- **Same process, not a separate service**: `node-cron` is in-process, shares the existing Prisma connection pool, and needs no extra infrastructure (Redis/queue) at this scale. Would need database-level scheduled events or a dedicated worker at real production scale with multiple server instances.

### Interview answer

> "The hold-expiry cron is a background job — not triggered by any user request, but running on its own timer every 60 seconds — that finds bookings still `PAYMENT_PENDING` past their expiry and cancels them, along with their associated Payment row, inside one transaction. The interesting part is the race with the webhook: rather than trying to prevent the two from ever colliding, I built both sides to detect it independently and degrade gracefully. The cron's update includes a conditional `WHERE status = PAYMENT_PENDING`, so if a webhook already confirmed the booking a moment earlier, the cron's update simply matches nothing. And the webhook has its own guard for the rarer reverse case — if the cron already cancelled a booking right before a late-arriving webhook confirms the payment was actually captured, it logs a warning for manual review rather than silently reviving a cancelled booking or crashing."

---

## The One Thread Connecting All Three

All three of these — reconciliation, the webhook's security checks, and the hold-expiry cron — exist to answer the same underlying question from a different angle: **"how does the system stay correct when it can't fully trust or rely on an external, asynchronous, occasionally-unreliable notification (a webhook) to tell it the truth?"** The signature verification ensures a webhook that *does* arrive can be trusted. The cron ensures the system doesn't wait forever for one that never arrives. And the race-condition guards on both sides ensure that even when both mechanisms are active at nearly the same moment, the system never ends up in a state that contradicts what actually happened with the customer's money.
