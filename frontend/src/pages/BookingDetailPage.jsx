// ─────────────────────────────────────────────────────────
// BookingDetailPage — single booking with full details
// ─────────────────────────────────────────────────────────
//
// Route: /bookings/:id (authenticated, owner-scoped on backend)
//
// API: GET /api/v1/bookings/:id
// Returns booking with vehicle (+ store), payment, deposit info
//
// PAYMENT_PENDING polling:
//   Auto-poll every 5s, pause on tab hidden, cap at 60 polls (5 min),
//   then show manual "Refresh Status" button.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import AppIcon from '../components/AppIcon.jsx'
import {
  BOOKING_STATUS_STYLES,
  PAYMENT_STATUS_STYLES,
  DEPOSIT_STATUS_STYLES,
  getVehicleImage,
  formatDate,
  formatDateRange,
  formatPrice,
  getDurationDays,
} from '../utils/bookingUtils.js'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ── Polling config ───────────────────────────────────────
const POLL_INTERVAL_MS = 5000   // 5 seconds
const MAX_POLL_COUNT = 60       // 5 minutes total

function BookingDetailPage() {
  const { id } = useParams()
  const { getToken } = useAuth()

  const [booking, setBooking] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Polling refs — survive re-renders without causing them
  const pollTimerRef = useRef(null)
  const pollCountRef = useRef(0)
  const [pollExhausted, setPollExhausted] = useState(false)

  // ── Fetch booking ──────────────────────────────────────
  const fetchBooking = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const token = await getToken()
      const res = await fetch(`${API_BASE}/api/v1/bookings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.message || 'Failed to load booking')
      }

      setBooking(result.data)
      setError(null)
      return result.data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [getToken, id])

  // ── Initial load ───────────────────────────────────────
  useEffect(() => {
    fetchBooking()
  }, [fetchBooking])

  // ── PAYMENT_PENDING auto-polling ───────────────────────
  useEffect(() => {
    // Only poll when status is PAYMENT_PENDING
    if (!booking || booking.status !== 'PAYMENT_PENDING') {
      return
    }

    // Already exhausted poll budget
    if (pollCountRef.current >= MAX_POLL_COUNT) {
      setPollExhausted(true)
      return
    }

    const poll = async () => {
      // Pause when tab is hidden
      if (document.hidden) return

      pollCountRef.current += 1

      const updated = await fetchBooking({ silent: true })

      // If status changed, polling will stop on next effect run
      // because the dependency (booking.status) will differ.
      if (!updated || updated.status !== 'PAYMENT_PENDING') {
        return
      }

      // Check poll budget
      if (pollCountRef.current >= MAX_POLL_COUNT) {
        setPollExhausted(true)
      }
    }

    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [booking?.status, fetchBooking])

  // ── Cleanup on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
      }
    }
  }, [])

  // ── Manual refresh ─────────────────────────────────────
  const handleManualRefresh = async () => {
    // Reset poll count so auto-polling can resume if needed
    pollCountRef.current = 0
    setPollExhausted(false)
    await fetchBooking({ silent: true })
  }

  // ── Loading / Error states ─────────────────────────────
  if (isLoading) {
    return (
      <div className="bd-page">
        <div className="bd-loading">
          <div className="spinner" />
          <p>Loading booking details…</p>
        </div>
      </div>
    )
  }

  if (error && !booking) {
    return (
      <div className="bd-page">
        <div className="bd-error-full">
          <span className="bd-error-icon"><AppIcon name="alert" size={26} /></span>
          <h2>Unable to load booking</h2>
          <p>{error}</p>
          <Link to="/my-bookings" className="bd-back-btn">← Back to My Bookings</Link>
        </div>
      </div>
    )
  }

  if (!booking) return null

  // ── Derived values ─────────────────────────────────────
  const vehicle = booking.vehicle
  const store = vehicle?.store
  const payment = booking.payment
  const statusStyle = BOOKING_STATUS_STYLES[booking.status] || BOOKING_STATUS_STYLES.PENDING
  const duration = getDurationDays(booking.startDate, booking.endDate)

  // Price breakdown
  // Backend's `totalPrice` = rental cost only (from calculateTotalPrice tiering).
  // Maintenance fee and security deposit are stored separately.
  // Grand total = rental + maintenance + deposit.
  const rentalCost = parseFloat(booking.totalPrice)
  const maintenanceFee = parseFloat(booking.maintenanceFeeCharged)
  const securityDeposit = parseFloat(booking.securityDepositCharged)
  const grandTotal = rentalCost + maintenanceFee + securityDeposit

  const isPaymentPending = booking.status === 'PAYMENT_PENDING'

  return (
    <div className="bd-page">
      {/* ── Back nav ──────────────────────────────────────── */}
      <Link to="/my-bookings" className="bd-back-link">
        ← Back to My Bookings
      </Link>

      {/* ── PAYMENT_PENDING banner ────────────────────────── */}
      {isPaymentPending && (
        <div className="bd-pending-banner">
          <div className="bd-pending-icon"><AppIcon name="clock" size={22} /></div>
          <div className="bd-pending-text">
            <strong>Payment is being processed</strong>
            <p>
              {pollExhausted
                ? 'Auto-refresh has paused. Use the button below to check the latest status.'
                : 'We\'re automatically checking for updates…'}
            </p>
          </div>
          <button
            className="bd-refresh-btn"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            <AppIcon name="refresh" size={16} /> {isRefreshing ? 'Checking…' : 'Refresh status'}
          </button>
        </div>
      )}

      {/* ── Main content grid ─────────────────────────────── */}
      <div className="bd-content">
        {/* ── Left: Vehicle & Store info ──────────────────── */}
        <div className="bd-left">
          <div className="bd-vehicle-card">
            <div className="bd-vehicle-header">
              <img
                src={getVehicleImage(vehicle?.brand, vehicle?.model, vehicle?.category)}
                alt={`${vehicle?.brand} ${vehicle?.model}`}
                className="bd-vehicle-thumb"
              />
              <div>
                <h2 className="bd-vehicle-name">{vehicle?.brand} {vehicle?.model}</h2>
                <span className="bd-vehicle-category">{vehicle?.category}</span>
              </div>
            </div>

            {store && (
              <div className="bd-store-info">
                <h4 className="bd-store-heading"><AppIcon name="pin" size={16} /> Rental store</h4>
                <p className="bd-store-name">{store.name}</p>
                {store.address && (
                  <p className="bd-store-address">{store.address}</p>
                )}
              </div>
            )}
          </div>

          {/* ── Dates section ──────────────────────────────── */}
          <div className="bd-dates-card">
            <h4 className="bd-section-title"><AppIcon name="calendar" size={17} /> Rental period</h4>
            <div className="bd-date-grid">
              <div className="bd-date-item">
                <span className="bd-date-label">Pick-up</span>
                <span className="bd-date-value">{formatDate(booking.startDate)}</span>
              </div>
              <div className="bd-date-divider">→</div>
              <div className="bd-date-item">
                <span className="bd-date-label">Return</span>
                <span className="bd-date-value">{formatDate(booking.endDate)}</span>
              </div>
            </div>
            <p className="bd-duration">
              {duration} day{duration !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>

        {/* ── Right: Status, Price, Payment ──────────────── */}
        <div className="bd-right">
          {/* ── Status section ─────────────────────────────── */}
          <div className="bd-status-card">
            <h4 className="bd-section-title">Booking Status</h4>
            <span
              className="bd-status-badge-large"
              style={{ background: statusStyle.bg, color: statusStyle.color }}
            >
              {statusStyle.label}
            </span>
            <div className="bd-meta">
              <div className="bd-meta-row">
                <span className="bd-meta-label">Booking ID</span>
                <span className="bd-meta-value bd-booking-id" title={booking.id}>
                  {booking.id.slice(0, 8)}…
                </span>
              </div>
              <div className="bd-meta-row">
                <span className="bd-meta-label">Created</span>
                <span className="bd-meta-value">
                  {new Date(booking.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* ── Price breakdown ────────────────────────────── */}
          <div className="bd-price-card">
            <h4 className="bd-section-title"><AppIcon name="wallet" size={17} /> Price breakdown</h4>
            <div className="bd-price-rows">
              <div className="bd-price-row">
                <span>Rental cost</span>
                <span>{formatPrice(rentalCost)}</span>
              </div>
              <div className="bd-price-row">
                <span>Maintenance fee</span>
                <span>{formatPrice(maintenanceFee)}</span>
              </div>
              <div className="bd-price-row">
                <span>
                  Security deposit
                  {booking.depositStatus && (
                    <span
                      className="bd-deposit-badge"
                      style={{
                        background: (DEPOSIT_STATUS_STYLES[booking.depositStatus] || {}).bg,
                        color: (DEPOSIT_STATUS_STYLES[booking.depositStatus] || {}).color,
                      }}
                    >
                      {(DEPOSIT_STATUS_STYLES[booking.depositStatus] || {}).label}
                    </span>
                  )}
                </span>
                <span>{formatPrice(securityDeposit)}</span>
              </div>
              <div className="bd-price-row bd-price-total">
                <span>Total</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* ── Payment info ──────────────────────────────── */}
          {payment && (
            <div className="bd-payment-card">
              <h4 className="bd-section-title"><AppIcon name="wallet" size={17} /> Payment</h4>
              <div className="bd-payment-rows">
                <div className="bd-payment-row">
                  <span>Status</span>
                  <span
                    className="bd-payment-badge"
                    style={{
                      background: (PAYMENT_STATUS_STYLES[payment.status] || {}).bg,
                      color: (PAYMENT_STATUS_STYLES[payment.status] || {}).color,
                    }}
                  >
                    {(PAYMENT_STATUS_STYLES[payment.status] || {}).label || payment.status}
                  </span>
                </div>
                <div className="bd-payment-row">
                  <span>Amount</span>
                  <span>{formatPrice(payment.amount)}</span>
                </div>
                {payment.razorpayPaymentId && (
                  <div className="bd-payment-row">
                    <span>Payment ID</span>
                    <span className="bd-booking-id" title={payment.razorpayPaymentId}>
                      {payment.razorpayPaymentId.slice(0, 14)}…
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookingDetailPage
