# Vehicle Rental Platform — Feature Implementation Guide

For every feature: what it does, how to build it yourself, and whether a third-party service can replace/support that work — with a recommendation on which way to go for a portfolio project.

**General principle used throughout:** build the core differentiator features (booking concurrency, caching, async processing, real-time) yourself — that's the whole point of the project. Use third-party services for commodity problems that every app needs but nobody gets extra credit for reinventing (email delivery, image hosting, payments, maps).

---

## PHASE 1 — MVP

### 1. Authentication (customer + store-owner roles)

**What it does:** Register, login, role-based access, session persistence.

**How to implement:**
- Password hashing with `bcrypt`
- JWT access token (short-lived, ~15 min) + refresh token (long-lived, ~7 days, stored hashed in DB, rotated on use)
- Role stored on the `users` table (`customer` / `store_owner` / `admin`), checked via Express middleware on protected routes
- Refresh endpoint issues a new access token using a valid refresh token; logout invalidates the refresh token server-side

**Third-party option:** **Auth0** or **Clerk** — handle registration, login, password reset, social login out of the box.
**Recommendation: build it yourself.** Auth is one of the most commonly-asked backend interview topics (JWT vs sessions, refresh token rotation, why hash passwords). Outsourcing it removes your best talking point for a very cheap feature to build (maybe 1 day of work).

---

### 2. Vehicle Listing, Search & Filters

**What it does:** Browse/search vehicles by category, price range, location, availability dates.

**How to implement:**
- Postgres query with `WHERE` clauses on category/price, joined against a subquery excluding vehicles with overlapping `CONFIRMED` bookings in the requested date range
- Full-text search on vehicle name/brand using Postgres's built-in `tsvector`/`tsquery` (no need for a separate search engine at this scale)
- Pagination via `LIMIT`/`OFFSET` or keyset pagination for larger result sets

**Third-party option:** **Algolia** or **Elasticsearch** for search/filtering.
**Recommendation: build it yourself with Postgres full-text search.** Algolia is genuinely excellent, but it's overkill at your data volume, costs money past a free tier, and using Postgres's native search capability is itself a good interview talking point ("why didn't you reach for Elasticsearch here?").

---

### 3. Store Map View

**What it does:** Shows store locations on a map, click for details, distance from user.

**How to implement:**
- Store `lat`/`lng` on the `stores` table
- Distance calculation via Postgres's `earthdistance`/`cube` extension, or the Haversine formula in a query, to find "stores within N km"
- Frontend renders markers using a maps SDK

**Third-party option (required here — you can't reasonably build your own map tiles):**
- **Mapbox GL JS** — generous free tier (50k map loads/month), more customizable styling
- **Google Maps JavaScript API** — free tier with usage caps, more familiar UI/UX for Indian users, better geocoding accuracy for Indian addresses
**Recommendation: Mapbox for the map rendering, Google Places Autocomplete specifically for address input** (its Indian address matching is noticeably better than most alternatives).

---

### 4. Price Calculator

**What it does:** Live price breakdown as the user selects dates/add-ons.

**How to implement:**
- Pure function: `basePrice × duration ± discountTiers + fees`
- Duration-based tiering logic (daily vs weekly vs monthly rate applied based on booking length) computed client-side for instant feedback, then **re-validated server-side** before charging — never trust a price the client computed
- No external service needed — this is business logic, not infrastructure

**Third-party option:** None applicable. This is core domain logic.

---

### 5. Booking Flow (Concurrency + Idempotency)

**What it does:** The centerpiece — prevents double-booking and duplicate charges.

**How to implement:**
- Postgres exclusion constraint: `EXCLUDE USING gist (vehicle_id WITH =, daterange(start_date, end_date) WITH &&) WHERE (status = 'CONFIRMED')`
- Booking creation wrapped in a transaction; constraint violation → catch and return `409 Conflict`
- Client sends `Idempotency-Key` header (UUID generated once per booking attempt, reused on retry); server checks for an existing booking with that key before creating a new one

**Third-party option:** None — this needs to be yours. It's the single feature this whole project exists to demonstrate.

---

### 6. Booking Status Lifecycle

**What it does:** `PENDING → CONFIRMED → ACTIVE → COMPLETED`, plus `CANCELLED`/`REJECTED` branches.

**How to implement:**
- `status` enum column on `bookings`
- State transitions enforced in a service-layer function (not scattered across controllers) — e.g., `transitionBooking(bookingId, newStatus)` validates the current state allows that transition before writing
- A scheduled job (simple cron, or a `pg_cron` extension) flips `CONFIRMED` → `ACTIVE` at the start date and `ACTIVE` → `COMPLETED` at the end date

**Third-party option:** None needed for the state machine itself. For the scheduled job, **node-cron** (in-process, free) is enough at this scale — no need for a managed scheduler service.

---

### 7. Redis-Cached Vehicle Search

**Covered in the architecture spec — build yourself, that's the point.** No third-party alternative makes sense here; Redis itself can be self-hosted (Docker) or you can use a free tier of **Upstash** or **Redis Cloud** if you want a hosted instance without running your own container in production.

---

### 8. Store-Owner Dashboard

**What it does:** Add/edit vehicles, view/manage bookings, see basic stats.

**How to implement:**
- Standard authenticated CRUD screens, scoped to `store_id = current user's store`
- Image upload for vehicle photos (see #9 below)

**Third-party option:** None beyond what's already listed for auth/images. This is your own UI.

---

### 9. Vehicle Image Upload

**What it does:** Store owners upload photos when adding a vehicle.

**How to implement (if self-hosted):**
- Store files on disk or a mounted volume — fine for local dev, **not recommended for anything you'll deploy or demo publicly** (no CDN, server restarts can lose files depending on setup)

**Third-party option:** **Cloudinary** (recommended) — free tier, handles upload, resizing, format optimization, and serves via CDN automatically. Alternative: **AWS S3 + CloudFront** if you want the "real production setup" story, but it's more setup for the same result.
**Recommendation: use Cloudinary.** Image hosting/CDN is a solved problem; building your own isn't demonstrating anything an interviewer cares about.

---

### 10. Admin Dashboard

**What it does:** View/manage all users, stores, vehicles, bookings platform-wide.

**How to implement:** Same as store-owner dashboard but `role = admin` bypasses the `store_id` scoping.

**Third-party option:** None needed.

---

## PHASE 2 — Enhanced

### 11. RabbitMQ + Async Notification Worker

**What it does:** Booking confirmation triggers email/notification without blocking the API response.

**How to implement:** Covered in the architecture spec — publish an event on booking confirm, a worker process consumes it and sends the actual email/notification.

**Third-party option for the "sends the actual email" part** (RabbitMQ itself stays self-built — that's the point):
- **SendGrid** or **Resend** for transactional email — free tier (100/day on SendGrid, more generous on Resend), reliable deliverability (way better than trying to send raw SMTP yourself, which often lands in spam)
- **Twilio** for SMS notifications, if you want that channel too
**Recommendation: RabbitMQ + worker is yours to build (the async architecture is the interview story); SendGrid/Resend handles the actual email sending inside the worker** (nobody should build their own SMTP delivery infrastructure — that's a genuinely hard problem with no payoff for you here).

---

### 12. Socket.IO — Real-Time Chat & Status Updates

**Build yourself** — covered in the architecture spec. No third-party alternative makes sense; this is exactly the kind of infra work the project is meant to showcase. (If you ever wanted a managed alternative for a *production* app, **Pusher** or **Ably** exist, but using them here would remove the feature you're trying to demonstrate.)

---

### 13. Reviews & Ratings

**How to implement:** Simple table (`reviews`: booking_id, rating, comment), only writable if the booking is `COMPLETED` (enforce server-side, not just in the UI) and only one review per booking.

**Third-party option:** None needed — this is straightforward CRUD.

---

### 14. Rental History + Invoice Generation

**How to implement:**
- History: query `bookings WHERE user_id = current_user`
- Invoice: generate a PDF server-side

**Third-party option:**
- **PDFKit** (Node library, free, self-hosted) — generate PDFs yourself, full control
- **Puppeteer** rendering an HTML invoice template to PDF — easier to style nicely if you're comfortable with HTML/CSS
**Recommendation: PDFKit or Puppeteer, self-built.** Invoice generation is simple enough that a third-party service (like DocRaptor) isn't worth the integration overhead or cost here.

---

### 15. Cancellation & Refund Policy Engine

**How to implement:** Pure business logic — a function that takes `(bookingStartDate, cancellationTime)` and returns a refund percentage based on tiers (>48hr = 100%, 24-48hr = 75%, <24hr = 50%). No infrastructure needed, since you're mocking payments (see #16) rather than processing real refunds.

**Third-party option:** None applicable.

---

### 16. Mock Payment Flow (Phase 3, listing here since it's related)

**How to implement (mock):** A `payments` table with a fake "processing" step (simulate a 1-2 second delay, then mark success/failure) — no real money moves.

**Third-party option if you want the real thing later:** **Razorpay** (most relevant for an India-facing app — supports UPI, cards, netbanking) has a full sandbox/test mode that mimics real payment flows without moving real money, which is actually the *better* choice for a portfolio project over building your own mock, since it teaches you a real payment integration (webhooks, signature verification, idempotent payment confirmation) which is itself great interview material.
**Recommendation: use Razorpay's test mode**, not a hand-rolled mock — you get a realistic integration story for free.

---

### 17. Rate Limiting

**How to implement:** Redis-backed sliding window counter (`express-rate-limit` with a Redis store) on auth and booking endpoints.

**Third-party option:** **Cloudflare** (if deployed behind it) offers rate limiting at the edge for free, but doing it in your own app with Redis is more relevant to what you're trying to demonstrate.
**Recommendation: build with Redis** — reuses infrastructure you already have running, and it's a natural Redis use-case to discuss.

---

## PHASE 3 — Optional Stretch

### 18. Mock KYC

**How to implement:** Simple file upload (via Cloudinary) + a `kyc_status` enum (`pending`/`verified`/`rejected`) that an admin manually flips in the admin dashboard. **Never collect real government ID documents for a portfolio project** — use obviously-fake/test images.

**Third-party option:** Real KYC providers (like **Signzy** or **Cashfree Verification** in India) exist but are entirely inappropriate to integrate here — they require business registration and are meant for licensed companies. Skip this — the mock is the correct choice, not a compromise.

---

### 19. Coupon Codes

**How to implement:** `coupons` table (code, discount type, min booking amount, expiry, usage limit), validated and applied at checkout in the price calculation.

**Third-party option:** None needed — simple domain logic.

---

### 20. Vehicle Maintenance Status

**How to implement:** `status` field on vehicles (`available`/`maintenance`/`booked`), store owner manually toggles it; excluded from search results when in maintenance.

**Third-party option:** None needed.

---

### 21. Basic Analytics

**How to implement:** Aggregate SQL queries (`GROUP BY` on booking date, vehicle category, store) rendered as charts on the dashboard using **Recharts** (you've already used this in a prior project).

**Third-party option:** **Mixpanel** or **PostHog** for proper product analytics/event tracking.
**Recommendation: build the simple aggregation queries yourself** for booking/revenue stats (that's core SQL skill demonstration); **PostHog's free tier** is worth adding only if you want to also track user behavior events (page views, funnel drop-off) — genuinely optional, skip if time-constrained.

---

## Third-Party Services Summary Table

| Service | Used for | Free tier? | Build-yourself instead? |
|---|---|---|---|
| Mapbox / Google Maps | Store map, geocoding | Yes | No — infeasible to build |
| Cloudinary | Image upload/hosting/CDN | Yes | Not worth it — solved problem |
| SendGrid / Resend | Transactional email | Yes | No — deliverability is genuinely hard |
| Razorpay (test mode) | Payment flow | Yes (sandbox) | Use test mode instead of hand-rolled mock |
| PDFKit / Puppeteer | Invoice generation | N/A (library, free) | This one you build yourself |
| PostHog (optional) | Analytics/event tracking | Yes | Optional — basic stats are worth building yourself |

**The pattern:** anything that's genuinely hard infrastructure with no interview payoff (email deliverability, map tiles, image CDN, payment rails) → use a service. Anything that demonstrates the system-design skills this project exists to show off (booking concurrency, caching, async processing, real-time, auth) → build it yourself, even though a service could technically do it.
