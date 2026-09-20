# Vehicle Rental & Booking Platform — Full Project Specification

A multi-vendor vehicle rental platform (cars, bikes, scooters, bicycles) with location-based store discovery, concurrency-safe booking, and real-time communication — built as a system-design-focused portfolio project, deliberately distinct from a standard MERN CRUD app.

---

## 1. Tech Stack & Why Each Piece Exists

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + JavaScript | Already comfortable here; energy goes into backend depth instead |
| Frontend state | Zustand / React Query | Server-state caching + simple client state, avoids Redux boilerplate |
| Maps | Mapbox or Google Maps API | Store discovery, distance-based search |
| Backend | Node.js + Express | Familiar runtime, minimal ceremony for a modular monolith |
| Database | **PostgreSQL** (not MongoDB) | Domain is relational — users, stores, vehicles, bookings, payments, reviews — and booking requires transactional guarantees MongoDB doesn't give you as naturally |
| ORM | Prisma | Type-safe queries, migrations, readable schema file |
| Cache | Redis | Cuts DB load on repeated vehicle-search queries; also powers rate limiting |
| Message broker | RabbitMQ | Decouples the booking API from slow side-effects (email, notifications, analytics) |
| Real-time | Socket.IO | Live chat + instant booking-status updates without polling |
| Containerization | Docker + Docker Compose | One-command dev environment (Postgres, Redis, RabbitMQ, API, frontend) |
| CI/CD | GitHub Actions | Lint → test → build on every push |
| Reverse proxy | Nginx | Sits in front of the API; also the natural seam if this ever splits into services |

**Deliberately excluded for now:** TypeScript (no architectural payoff for this project), Kubernetes (massive overkill for one service), microservices (a modular monolith is the more mature call at this scale), real payment gateway (mock it), real KYC document handling (mock it — never collect real IDs in a portfolio project).

---

## 2. System Architecture

```
                         USER
                          │
                          ▼
                       React (SPA)
                          │
                          ▼
                        Nginx
                          │
                          ▼
                  Node.js/Express API
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
     Redis           PostgreSQL          RabbitMQ
   (cache, rate         │                   │
    limiting)      (source of truth,  ┌─────┼─────┐
        │           transactions)     ▼     ▼     ▼
        │                          Email  Push  Analytics
        │                          Worker Worker Worker
        │
        └──────────────► Socket.IO ◄──────────────┐
                             │                     │
                        Customer ↔ Store (real-time)
```

**Why a modular monolith, not microservices:** at this scale, microservices add network calls, deployment complexity, and distributed-transaction headaches for no real benefit. The API is internally organized into modules (Auth, Vehicles, Stores, Booking, Pricing, Reviews) with clear boundaries — so it *could* split later, and that evolution story is itself a good interview answer ("why not microservices from day one?").

---

## 3. Core Data Model (PostgreSQL)

```
users            (id, name, email, phone, password_hash, role, kyc_status, created_at)
stores           (id, owner_id → users, name, location(lat/lng), address, rating)
vehicles         (id, store_id → stores, category, brand, model, specs(jsonb),
                  daily_price, weekly_price, monthly_price, status)
bookings         (id, user_id → users, vehicle_id → vehicles, start_date, end_date,
                  status, total_price, idempotency_key, created_at)
payments         (id, booking_id → bookings, amount, status, method)
reviews          (id, booking_id → bookings, rating, comment)
messages         (id, sender_id, receiver_id, booking_id, content, created_at)
```

**Key relational decisions:**
- `bookings.idempotency_key` has a **unique constraint** — the database itself rejects a duplicate booking request, not just application logic.
- Booking date-range overlap checks use PostgreSQL's `tsrange`/`daterange` + exclusion constraints (`EXCLUDE USING gist`), so the database *physically cannot* store two overlapping CONFIRMED bookings for the same vehicle — this is stronger than checking in application code.
- Foreign keys + `ON DELETE` policies enforce referential integrity (e.g., you can't delete a store with active bookings).

---

## 4. Feature Breakdown by Phase

### Phase 1 — MVP (core, ships first)
- Auth: register/login (customer + store-owner roles), JWT with refresh tokens
- Vehicle listing, search, and filters (category, price, distance, availability)
- Store map view (Mapbox/Google Maps) with store markers
- Price calculator (daily/weekly/monthly rate breakdown)
- **Booking flow with concurrency-safe conflict prevention + idempotent requests** — the centerpiece feature
- Booking status lifecycle: `PENDING → CONFIRMED → ACTIVE → COMPLETED` / `CANCELLED` / `REJECTED`
- Redis-cached vehicle search
- Store-owner dashboard: add/edit vehicles, view bookings
- Basic admin view: users, stores, vehicles

### Phase 2 — Enhanced (adds the async/real-time story)
- RabbitMQ + worker: booking confirmation triggers async email/notification, doesn't block the API response
- Socket.IO: real-time chat between customer and store, live booking-status push
- Reviews & ratings (post-booking)
- Rental history + downloadable invoice
- Cancellation policy engine (time-based refund tiers)
- Rate limiting on auth/search endpoints via Redis

### Phase 3 — Optional stretch (only if time allows)
- Mock payment flow (Razorpay sandbox)
- Simple KYC mock (upload → pending → verified, no real ID storage)
- Coupon codes
- Vehicle maintenance status affecting availability
- Basic analytics (bookings/revenue by day, most-rented vehicle)

Everything cut from the original 40-feature brainstorm (subscriptions, corporate accounts, AI trip planner, damage-photo diffing, dynamic pricing engine) is intentionally out of scope — they don't add interview-defensible engineering depth proportional to their build cost.

---

## 5. The Booking System, in Depth

This is the feature to get right — it's what the whole project is built to demonstrate.

**Problem 1 — Double booking.** Two users request the same vehicle for overlapping dates simultaneously.
- Mitigation: a Postgres exclusion constraint on `(vehicle_id, daterange(start_date, end_date))` for `CONFIRMED` bookings. The second concurrent transaction fails at the database level — no race condition possible, no need for manual locking.
- Booking creation runs inside a transaction: check availability → insert booking → commit. If the constraint violation fires, the transaction rolls back and the API returns a clear "vehicle no longer available" error.

**Problem 2 — Duplicate request from the same user** (double-click, retried network request).
- Mitigation: client sends an `Idempotency-Key` header (a UUID generated once per booking attempt). The API checks if a booking with that key already exists; if so, it returns the existing booking instead of creating a new one.

**Booking state machine:**
```
PENDING → CONFIRMED → ACTIVE → COMPLETED
   │                              
   ├──→ REJECTED (store declines)
   └──→ CANCELLED (user/store cancels, refund tier applied)
```

---

## 6. Caching Strategy (Redis)

- **Query cache:** `vehicles:search:{location}:{category}:{dateRange}` → cached result set, TTL ~60-300s. Cache is invalidated when a vehicle's availability changes (booking created/cancelled).
- **Rate limiting:** sliding-window counter per IP on `/login` (e.g., 5/min) and per user on `/bookings` (prevent spam booking attempts).
- **Not used for:** session storage (JWT is stateless) or as a source of truth for availability (Postgres owns that — Redis is a read-through cache only, never authoritative).

---

## 7. Asynchronous Processing (RabbitMQ)

```
Booking confirmed
       │
   Save to DB (synchronous, must succeed)
       │
   Publish "booking.confirmed" event
       │
   API returns response immediately
       │
   ┌───┴────┬─────────┐
   ▼        ▼         ▼
 Email    Push      Analytics
 Worker   Worker     Worker
```
- The API never waits on email/notification delivery — booking confirmation is fast regardless of downstream service latency.
- Workers are idempotent consumers (can safely reprocess a message if redelivered after a crash).
- Dead-letter queue configured for messages that fail repeatedly, so failures are visible instead of silently dropped.

---

## 8. Real-Time (Socket.IO)

- Namespaced by booking/conversation room: `booking:{bookingId}` for status updates, `chat:{userId}:{storeId}` for messages.
- Auth on socket connection via JWT (same token as REST API).
- Used for: instant chat delivery, live booking-status changes (no polling), "store is typing" indicators (nice-to-have).
- Fallback: if a client is offline, the message is still persisted to Postgres and delivered on reconnect / shown in-app.

---

## 9. Security Concerns & Mitigations

| Concern | Mitigation |
|---|---|
| Password storage | bcrypt/argon2 hashing, never plaintext, never logged |
| Auth tokens | Short-lived JWT access token + longer-lived refresh token (rotated on use); refresh tokens stored hashed in DB so they can be revoked |
| Authorization | Role-based access control (customer / store-owner / admin) enforced at the middleware layer on every route, not just hidden in the UI |
| SQL injection | Parameterized queries via Prisma (no raw string concatenation) |
| XSS | React escapes by default; sanitize any user-generated HTML (e.g., chat messages) before render if rich text is ever allowed |
| CSRF | Not a major risk for a token-based API (no cookies for auth), but CORS is locked to known origins |
| Rate limiting / brute force | Redis-backed limits on login and password-reset endpoints |
| IDOR (insecure direct object reference) | Every resource fetch checks the requester owns/has access to that booking/vehicle/store — not just that they're logged in |
| Secrets management | `.env` files never committed; secrets injected via environment variables in Docker/CI, not hardcoded |
| File uploads (vehicle images, mock KYC) | Restrict file types/size, store in object storage (not directly served from the app server), never trust client-provided MIME type alone |
| Dependency vulnerabilities | `npm audit` / Dependabot as part of CI |
| Transport security | HTTPS enforced everywhere in production; Nginx handles TLS termination |
| Logging & PII | Structured logs (booking IDs, timings, error codes) — never log passwords, tokens, or full payment details |
| Idempotency abuse | Idempotency keys scoped per-user so one user can't reuse another's key to read their booking |

---

## 10. API Design

- REST, versioned from day one: `/api/v1/...`
- Consistent response shape: `{ data, error, meta }`
- Pagination on list endpoints (`?page=&limit=`)
- Standard HTTP status codes used meaningfully (409 for booking conflicts, 422 for validation errors, 429 for rate limiting)

---

## 11. DevOps

**Docker Compose services:** `frontend`, `backend`, `postgres`, `redis`, `rabbitmq`, `nginx` — `docker compose up` brings up the full stack.

**CI/CD pipeline (GitHub Actions):**
```
push → install deps → lint → run tests → build → (optional) deploy
```

**Observability (lightweight):** structured JSON logs (request ID, latency, status code), basic request-count/error-rate tracking. Doesn't need a full Prometheus/Grafana stack for a portfolio project — but knowing where you'd add it is worth being able to explain.

---

## 12. Testing Strategy

- Unit tests: pricing calculator, booking-conflict logic, idempotency handling
- Integration tests: booking API end-to-end against a test Postgres instance (including the concurrency test — fire two simultaneous booking requests, assert only one succeeds)
- CI runs the full suite on every push before allowing merge

---

## Why this scope, specifically

Every technology here exists because a real problem needed it, not because it looks good on a resume:

- Repeated vehicle searches → Redis caching
- Two users booking the same vehicle → Postgres exclusion constraint + transactions
- Duplicate booking request → Idempotency key
- Booking response shouldn't wait on email → RabbitMQ + worker
- Real-time store/customer communication → Socket.IO
- "It works on my machine" → Docker
- Catching regressions before they ship → GitHub Actions CI

That's the story to tell in an interview: not "I used 8 technologies," but "each of these solved a specific problem, here's the problem, here's why this was the right tool."
