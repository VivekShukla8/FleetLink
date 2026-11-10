// ─────────────────────────────────────────────────────────
// VehicleDetailPage — public vehicle view + booking flow
// ─────────────────────────────────────────────────────────
//
// Route: /vehicles/:id (public for viewing, auth for booking)
//
// Flow:
//   1. Fetch vehicle details (GET /api/v1/vehicles/:id)
//   2. User picks dates → live price preview
//   3. "Book Now" → POST /bookings → POST /bookings/:id/pay
//   4. Open Razorpay checkout → on success redirect to /bookings/:id

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { getVehicleImage } from '../utils/vehicleImage'
import AppIcon, { VehicleIcon } from '../components/AppIcon.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const CATEGORY_COLORS = {
  CAR: { bg: '#F0E9FF', color: '#6D28D9' },
  BIKE: { bg: '#F0E9FF', color: '#6D28D9' },
  SCOOTER: { bg: '#F0E9FF', color: '#6D28D9' },
  BICYCLE: { bg: '#F0E9FF', color: '#6D28D9' },
}

// ── Spec label map for human-readable display ────────────
const SPEC_LABELS = {
  seats: 'Seats',
  transmission: 'Transmission',
  fuelType: 'Fuel type',
  airConditioning: 'Air conditioning',
  bootSpaceLiters: 'Boot space',
  engineCC: 'Engine',
  abs: 'ABS',
  helmetIncluded: 'Helmet included',
  type: 'Type',
  gearCount: 'Gears',
  frameSize: 'Frame size',
  batteryRangeKm: 'Battery range',
}

const SPEC_ICONS = {
  seats: 'seat', transmission: 'settings', fuelType: 'wrench', airConditioning: 'settings',
  bootSpaceLiters: 'grid', engineCC: 'settings', abs: 'shield', helmetIncluded: 'shield',
  type: 'bicycle', gearCount: 'settings', frameSize: 'settings', batteryRangeKm: 'battery',
}

// ── Razorpay script loader (lazy, one-time) ──────────────
// Loaded only when user clicks "Book Now", not on page mount.
// Checks window.Razorpay first to avoid duplicate script tags.
function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(window.Razorpay)
    script.onerror = () => reject(new Error('Failed to load payment gateway'))
    document.head.appendChild(script)
  })
}

// ── Idempotency key management ───────────────────────────
// Key format in sessionStorage: idem-{vehicleId}-{startDate}-{endDate}
// Value: UUID string
// Changing dates → different key → new UUID automatically.
function getIdempotencyKey(vehicleId, startDate, endDate) {
  const storageKey = `idem-${vehicleId}-${startDate}-${endDate}`
  let key = sessionStorage.getItem(storageKey)
  if (!key) {
    key = crypto.randomUUID()
    sessionStorage.setItem(storageKey, key)
  }
  return key
}

// ── Price preview calculator ─────────────────────────────
// Mirrors backend's calculateTotalPrice exactly: months(30d) →
// weeks(7d) → remaining days. This is an ESTIMATE — the backend
// is the source of truth for the actual charge.
function calculatePricePreview(durationDays, vehicle) {
  let remaining = durationDays
  let total = 0
  const breakdown = []

  const daily = Number(vehicle.dailyPrice)
  const weekly = Number(vehicle.weeklyPrice)
  const monthly = Number(vehicle.monthlyPrice)

  // Full months (30-day blocks)
  const fullMonths = Math.floor(remaining / 30)
  if (fullMonths > 0) {
    total += fullMonths * monthly
    breakdown.push({ label: `${fullMonths} month${fullMonths > 1 ? 's' : ''}`, amount: fullMonths * monthly })
    remaining -= fullMonths * 30
  }

  // Full weeks (7-day blocks)
  const fullWeeks = Math.floor(remaining / 7)
  if (fullWeeks > 0) {
    total += fullWeeks * weekly
    breakdown.push({ label: `${fullWeeks} week${fullWeeks > 1 ? 's' : ''}`, amount: fullWeeks * weekly })
    remaining -= fullWeeks * 7
  }

  // Remaining days
  if (remaining > 0) {
    total += remaining * daily
    breakdown.push({ label: `${remaining} day${remaining > 1 ? 's' : ''}`, amount: remaining * daily })
  }

  return { total: parseFloat(total.toFixed(2)), breakdown, durationDays }
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

function VehicleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getToken, isSignedIn } = useAuth()
  const { user } = useUser()

  // Vehicle data
  const [vehicle, setVehicle] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // Booking form
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dateError, setDateError] = useState(null)

  // Booking flow state
  const [bookingState, setBookingState] = useState('idle')
  // idle → booking → paying → checkout → confirming → done | error
  const [bookingError, setBookingError] = useState(null)
  const [conflictInfo, setConflictInfo] = useState(null)
  const [pendingBookingId, setPendingBookingId] = useState(null)

  // ── Fetch vehicle ──────────────────────────────────────
  useEffect(() => {
    async function fetchVehicle() {
      try {
        const response = await fetch(`${API_BASE}/api/v1/vehicles/${id}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message || `Failed (${response.status})`)
        }

        setVehicle(result.data)
      } catch (err) {
        setFetchError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchVehicle()
  }, [id])

  // ── Date validation ────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }, [startDate, endDate])

  // ── Live price preview ─────────────────────────────────
  const pricePreview = useMemo(() => {
    if (!vehicle || durationDays <= 0) return null
    return calculatePricePreview(durationDays, vehicle)
  }, [vehicle, durationDays])

  // Validate dates on change
  useEffect(() => {
    setDateError(null)
    setConflictInfo(null)
    setBookingError(null)

    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (end <= start) {
        setDateError('Return date must be after pickup date (minimum 1 day)')
      }
    }
  }, [startDate, endDate])

  // ── Format spec values for display ─────────────────────
  const specEntries = useMemo(() => {
    if (!vehicle?.specs) return []
    return Object.entries(vehicle.specs)
      .filter(([, val]) => val !== null && val !== undefined && val !== '' && val !== false)
      .map(([key, val]) => ({
        key,
        label: SPEC_LABELS[key] || key,
        value: val === true ? 'Yes' : typeof val === 'number' ? `${val}${key.includes('Liters') ? 'L' : key.includes('CC') || key === 'engineCC' ? 'cc' : key.includes('Km') ? ' km' : ''}` : String(val),
      }))
  }, [vehicle])

  // ── Book Now handler ───────────────────────────────────
  const handleBookNow = useCallback(async () => {
    // Validate dates first
    if (!startDate || !endDate) {
      setDateError('Please select pickup and return dates')
      return
    }
    if (durationDays <= 0) {
      setDateError('Return date must be after pickup date')
      return
    }

    // Auth check — redirect to sign-in preserving return URL
    if (!isSignedIn) {
      const returnPath = `/vehicles/${id}?startDate=${startDate}&endDate=${endDate}`
      navigate(`/sign-in?redirect_url=${encodeURIComponent(returnPath)}`)
      return
    }

    setBookingError(null)
    setConflictInfo(null)

    try {
      const token = await getToken()
      const idempotencyKey = getIdempotencyKey(id, startDate, endDate)

      // ── Step 1: Create booking ───────────────────────
      setBookingState('booking')

      const bookingRes = await fetch(`${API_BASE}/api/v1/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vehicleId: id,
          startDate,
          endDate,
          idempotencyKey,
        }),
      })

      const bookingResult = await bookingRes.json()

      if (!bookingRes.ok) {
        if (bookingRes.status === 409) {
          // Date conflict — check if it's the user's own pending booking
          setConflictInfo(bookingResult.errors?.[0] || 'Dates are unavailable')
          setBookingError(bookingResult.message)
          setPendingBookingId(bookingResult.pendingBookingId || null)
          setBookingState('idle')
          return
        }
        throw new Error(bookingResult.message || 'Booking failed')
      }

      // ── Stale idempotency key check ─────────────────
      // If the backend replayed a CANCELLED/COMPLETED booking
      // (same idempotencyKey from a previous attempt), clear
      // the old key and retry once with a fresh UUID.
      const TERMINAL_STATUSES = ['CANCELLED', 'COMPLETED', 'REJECTED']
      const returnedBooking = bookingResult.data.booking

      if (TERMINAL_STATUSES.includes(returnedBooking.status)) {
        // Clear stale key
        const storageKey = `idem-${id}-${startDate}-${endDate}`
        sessionStorage.removeItem(storageKey)

        // Generate fresh key and retry
        const freshKey = crypto.randomUUID()
        sessionStorage.setItem(storageKey, freshKey)

        const retryRes = await fetch(`${API_BASE}/api/v1/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            vehicleId: id,
            startDate,
            endDate,
            idempotencyKey: freshKey,
          }),
        })

        const retryResult = await retryRes.json()

        if (!retryRes.ok) {
          if (retryRes.status === 409) {
            setConflictInfo(retryResult.errors?.[0] || 'Dates are unavailable')
            setBookingError(retryResult.message)
            setBookingState('idle')
            return
          }
          throw new Error(retryResult.message || 'Booking failed on retry')
        }

        // Use the fresh booking
        Object.assign(returnedBooking, retryResult.data.booking)
      }

      const bookingId = returnedBooking.id

      // ── Idempotent replay notice ──────────────────────
      // If the booking was created more than 5s ago, this is
      // a replay of a previous booking (e.g. user refreshed).
      // Show a brief notice so the user knows what's happening.
      const ageMs = Date.now() - new Date(returnedBooking.createdAt).getTime()
      if (ageMs > 5000) {
        setBookingState('resuming')
        await new Promise((r) => setTimeout(r, 1500))
      }

      // ── Step 2: Initiate payment ─────────────────────
      setBookingState('paying')

      const payRes = await fetch(`${API_BASE}/api/v1/bookings/${bookingId}/pay`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      const payResult = await payRes.json()

      if (!payRes.ok) {
        // 410 = hold expired
        if (payRes.status === 410) {
          // Clear the idempotency key so user can retry
          sessionStorage.removeItem(`idem-${id}-${startDate}-${endDate}`)
          throw new Error('Booking hold expired. Please try again.')
        }
        throw new Error(payResult.message || 'Payment initiation failed')
      }

      const { orderId, razorpayKey, amount, currency } = payResult.data

      // ── Step 3: Load Razorpay & open checkout ────────
      setBookingState('checkout')

      const Razorpay = await loadRazorpayScript()

      const rzp = new Razorpay({
        key: razorpayKey,
        amount,
        currency,
        order_id: orderId,
        name: 'FleetLink',
        description: `${vehicle.brand} ${vehicle.model} — ${durationDays} day rental`,
        prefill: {
          name: user?.fullName || '',
          email: user?.primaryEmailAddress?.emailAddress || '',
        },
        theme: { color: '#6C47FF' },

        handler: function () {
          // Payment submitted — Razorpay fires this on UI success.
          // The actual confirmation happens asynchronously via webhook.
          // We show a "confirming" state and redirect to booking page.
          setBookingState('confirming')
          setTimeout(() => {
            navigate(`/bookings/${bookingId}`)
          }, 2000)
        },

        modal: {
          ondismiss: function () {
            // User closed the checkout widget without paying
            setBookingState('idle')
            setBookingError('Payment was cancelled. Your booking hold is still active — you can retry within 10 minutes.')
          },
        },
      })

      rzp.on('payment.failed', function (response) {
        setBookingState('idle')
        setBookingError(`Payment failed: ${response.error?.description || 'Unknown error'}. You can retry.`)
      })

      rzp.open()

    } catch (err) {
      setBookingState('idle')
      setBookingError(err.message)
    }
  }, [startDate, endDate, durationDays, isSignedIn, id, vehicle, user, getToken, navigate])

  // ── Pre-fill dates from URL query (returning from sign-in) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sd = params.get('startDate')
    const ed = params.get('endDate')
    if (sd) setStartDate(sd)
    if (ed) setEndDate(ed)
  }, [])

  // ── Loading / Error states ─────────────────────────────
  if (isLoading) {
    return (
      <div className="vd-page">
        <div className="loading-screen" style={{ minHeight: '60vh' }}>
          <div className="spinner" />
          <p>Loading vehicle details...</p>
        </div>
      </div>
    )
  }

  if (fetchError || !vehicle) {
    return (
      <div className="vd-page">
        <div className="vd-error-state">
          <div className="vd-error-icon"><AppIcon name="alert" size={30} /></div>
          <h2>Vehicle Not Found</h2>
          <p>{fetchError || 'This vehicle may have been removed.'}</p>
          <Link to="/vehicles" className="btn btn-primary">← Browse Vehicles</Link>
        </div>
      </div>
    )
  }

  const catColor = CATEGORY_COLORS[vehicle.category] || CATEGORY_COLORS.CAR

  // ── Confirming state (post-payment) ────────────────────
  if (bookingState === 'confirming') {
    return (
      <div className="vd-page">
        <div className="vd-confirming">
          <div className="vd-confirming-icon"><AppIcon name="check" size={30} /></div>
          <h2>Payment Submitted!</h2>
          <p>Your payment is being confirmed. You'll be redirected to your booking shortly...</p>
          <div className="spinner" style={{ marginTop: '1rem' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="vd-page">
      <div className="vd-container">
        {/* ── Back link ──────────────────────────────── */}
        <Link to="/vehicles" className="vd-back-link">← Back to Browse</Link>

        <div className="vd-layout">
          {/* ════════════════════════════════════════════ */}
          {/* LEFT: Vehicle Info                          */}
          {/* ════════════════════════════════════════════ */}
          <div className="vd-info">
            {/* Hero image area */}
            <div className="vd-hero">
              <img
                src={getVehicleImage(vehicle.brand, vehicle.model, vehicle.category)}
                alt={`${vehicle.brand} ${vehicle.model}`}
                className="vd-hero-photo"
              />
            </div>

            {/* Title area */}
            <div className="vd-title-area">
              <span
                className="vd-cat-badge"
                style={{ background: catColor.bg, color: catColor.color }}
              >
                <VehicleIcon category={vehicle.category} size={15} /> {vehicle.category}
              </span>
              <h1 className="vd-title">{vehicle.brand} {vehicle.model}</h1>
              {vehicle.store && (
                <p className="vd-store"><AppIcon name="pin" size={15} /> {vehicle.store.name} — {vehicle.store.address}</p>
              )}
            </div>

            {/* Specs grid */}
            {specEntries.length > 0 && (
              <div className="vd-section">
                <h3 className="vd-section-title">Specifications</h3>
                <div className="vd-specs-grid">
                  {specEntries.map((spec) => (
                    <div key={spec.label} className="vd-spec-item">
                      <span className="vd-spec-label"><AppIcon name={SPEC_ICONS[spec.key] || 'settings'} size={14} /> {spec.label}</span>
                      <span className="vd-spec-value">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing tiers */}
            <div className="vd-section">
              <h3 className="vd-section-title">Pricing</h3>
              <div className="vd-price-tiers">
                <div className="vd-tier">
                  <span className="vd-tier-label">Daily</span>
                  <span className="vd-tier-price">₹{vehicle.dailyPrice}</span>
                  <span className="vd-tier-sub">/day</span>
                </div>
                <div className="vd-tier">
                  <span className="vd-tier-label">Weekly</span>
                  <span className="vd-tier-price">₹{vehicle.weeklyPrice}</span>
                  <span className="vd-tier-sub">/week</span>
                </div>
                <div className="vd-tier">
                  <span className="vd-tier-label">Monthly</span>
                  <span className="vd-tier-price">₹{vehicle.monthlyPrice}</span>
                  <span className="vd-tier-sub">/month</span>
                </div>
              </div>
              <div className="vd-fees-row">
                <span>Maintenance Fee: <strong>₹{vehicle.maintenanceFee}</strong></span>
                <span>Security Deposit: <strong>₹{vehicle.securityDeposit}</strong></span>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════ */}
          {/* RIGHT: Booking Card                         */}
          {/* ════════════════════════════════════════════ */}
          <div className="vd-booking-card">
            <div className="vd-booking-header">
              <span className="vd-booking-price">₹{vehicle.dailyPrice}</span>
              <span className="vd-booking-period">/day</span>
            </div>

            {/* Date pickers */}
            <div className="vd-dates">
              <div className="form-group">
                <label htmlFor="startDate"><AppIcon name="calendar" size={15} /> Pickup date</label>
                <input
                  id="startDate"
                  type="date"
                  className={dateError || conflictInfo ? 'input-error' : ''}
                  min={today}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="endDate"><AppIcon name="calendar" size={15} /> Return date</label>
                <input
                  id="endDate"
                  type="date"
                  className={dateError || conflictInfo ? 'input-error' : ''}
                  min={startDate || today}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {dateError && <div className="vd-field-error">{dateError}</div>}

            {/* Conflict info */}
            {conflictInfo && (
              <div className="vd-conflict-banner">
                <span><AppIcon name="alert" size={18} /></span>
                <div>
                  <strong>{pendingBookingId ? 'You have a pending booking' : 'Dates unavailable'}</strong>
                  <p>{conflictInfo}</p>
                  {pendingBookingId ? (
                    <Link to={`/bookings/${pendingBookingId}`} className="vd-resume-link">
                      Resume Payment →
                    </Link>
                  ) : (
                    <p className="vd-conflict-hint">Please choose different dates.</p>
                  )}
                </div>
              </div>
            )}

            {/* Price preview */}
            {pricePreview && !dateError && (
              <div className="vd-price-preview">
                <h4><AppIcon name="wallet" size={16} /> Price estimate</h4>
                <div className="vd-breakdown">
                  {pricePreview.breakdown.map((item, i) => (
                    <div key={i} className="vd-breakdown-row">
                      <span>{item.label}</span>
                      <span>₹{item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="vd-breakdown-row vd-breakdown-fee">
                    <span>Maintenance fee</span>
                    <span>₹{Number(vehicle.maintenanceFee).toFixed(2)}</span>
                  </div>
                  <div className="vd-breakdown-row vd-breakdown-fee">
                    <span>Security deposit</span>
                    <span>₹{Number(vehicle.securityDeposit).toFixed(2)}</span>
                  </div>
                  <div className="vd-breakdown-total">
                    <span>Estimated Total</span>
                    <span>₹{(pricePreview.total + Number(vehicle.maintenanceFee) + Number(vehicle.securityDeposit)).toFixed(2)}</span>
                  </div>
                </div>
                <p className="vd-estimate-note">
                  * Estimate only — final charge calculated by the server
                </p>
              </div>
            )}

            {/* Booking error */}
            {bookingError && !conflictInfo && (
              <div className="vd-booking-error">
                <AppIcon name="alert" size={16} /> {bookingError}
              </div>
            )}

            {/* Book Now button */}
            <button
              className="btn btn-primary vd-book-btn"
              onClick={handleBookNow}
              disabled={bookingState !== 'idle' || !!dateError}
            >
              {bookingState === 'idle' && <><AppIcon name={isSignedIn ? 'shield' : 'user'} size={17} /> {isSignedIn ? 'Book now' : 'Sign in to book'}</>}
              {bookingState === 'booking' && <><AppIcon name="clock" size={17} /> Creating booking...</>}
              {bookingState === 'resuming' && <><AppIcon name="refresh" size={17} /> Resuming previous booking...</>}
              {bookingState === 'paying' && <><AppIcon name="clock" size={17} /> Preparing payment...</>}
              {bookingState === 'checkout' && <><AppIcon name="wallet" size={17} /> Opening checkout...</>}
            </button>

            {vehicle.status !== 'AVAILABLE' && (
              <div className="vd-unavailable-badge">
                <><AppIcon name="alert" size={16} /> This vehicle is currently under maintenance</>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VehicleDetailPage
