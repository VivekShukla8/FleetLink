// ─────────────────────────────────────────────────────────
// StoreBookingsPage — store owner's fleet booking list
// ─────────────────────────────────────────────────────────
//
// Route: /store/bookings (STORE_OWNER only)
//
// APIs:
//   GET /api/v1/stores/my-store/bookings?status=...&vehicleId=...&page=...&limit=10
//   GET /api/v1/stores/my-store/vehicles?limit=50  (for vehicle filter dropdown)

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  BOOKING_STATUS_STYLES,
  PAYMENT_STATUS_STYLES,
  CATEGORY_EMOJI,
  formatDateRange,
  formatPrice,
  getDurationDays,
} from '../utils/bookingUtils.js'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAYMENT_PENDING', label: 'Payment Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REJECTED', label: 'Rejected' },
]

function StoreBookingsPage() {
  const { getToken } = useAuth()

  // Bookings state
  const [bookings, setBookings] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('')

  // Vehicle list for filter dropdown
  const [vehicles, setVehicles] = useState([])

  // ── Fetch vehicles for dropdown (one-time) ─────────────
  useEffect(() => {
    async function loadVehicles() {
      try {
        const token = await getToken()
        const res = await fetch(
          `${API_BASE}/api/v1/stores/my-store/vehicles?limit=50`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const result = await res.json()
        if (res.ok) {
          setVehicles(result.data.vehicles || [])
        }
      } catch {
        // Non-critical — filter just won't populate
        console.error('Failed to load vehicle list for filter')
      }
    }
    loadVehicles()
  }, [getToken])

  // ── Fetch bookings ─────────────────────────────────────
  const fetchBookings = useCallback(async (page = 1) => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()
      const params = new URLSearchParams({ page, limit: 10 })
      if (statusFilter) params.set('status', statusFilter)
      if (vehicleFilter) params.set('vehicleId', vehicleFilter)

      const res = await fetch(
        `${API_BASE}/api/v1/stores/my-store/bookings?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.message || 'Failed to load bookings')
      }

      setBookings(result.data.bookings)
      setPagination(result.data.pagination)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [getToken, statusFilter, vehicleFilter])

  // Re-fetch on filter change
  useEffect(() => {
    fetchBookings(1)
  }, [fetchBookings])

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="sb-page">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="sb-header">
        <div className="sb-header-text">
          <h1 className="sb-title">Fleet Bookings</h1>
          <p className="sb-subtitle">All bookings for vehicles in your store</p>
        </div>

        {/* ── Filters ─────────────────────────────────────  */}
        <div className="sb-filters">
          <select
            className="sb-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            className="sb-filter-select"
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
          >
            <option value="">All Vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {CATEGORY_EMOJI[v.category] || '🚗'} {v.brand} {v.model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────── */}
      {error && (
        <div className="sb-error">
          <span>⚠️</span> {error}
          <button className="sb-error-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────── */}
      {isLoading && (
        <div className="sb-loading">
          <div className="spinner" />
          <p>Loading fleet bookings…</p>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────── */}
      {!isLoading && !error && bookings.length === 0 && (
        <div className="sb-empty">
          <div className="sb-empty-icon">📋</div>
          <h3>No bookings found</h3>
          <p>
            {statusFilter || vehicleFilter
              ? 'No bookings match the selected filters.'
              : "No bookings for your fleet yet. Bookings will appear here when customers reserve your vehicles."}
          </p>
        </div>
      )}

      {/* ── Booking cards ───────────────────────────────── */}
      {!isLoading && bookings.length > 0 && (
        <div className="sb-grid">
          {bookings.map((booking) => (
            <StoreBookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────── */}
      {!isLoading && pagination.totalPages > 1 && (
        <div className="sb-pagination">
          <button
            className="sb-page-btn"
            disabled={pagination.page <= 1}
            onClick={() => fetchBookings(pagination.page - 1)}
          >
            ← Previous
          </button>
          <span className="sb-page-info">
            Page {pagination.page} of {pagination.totalPages}
            <span className="sb-page-total"> ({pagination.total} bookings)</span>
          </span>
          <button
            className="sb-page-btn"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchBookings(pagination.page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Individual Store Booking Card ────────────────────────
function StoreBookingCard({ booking }) {
  const vehicle = booking.vehicle
  const customer = booking.user
  const payment = booking.payment
  const statusStyle = BOOKING_STATUS_STYLES[booking.status] || BOOKING_STATUS_STYLES.PENDING
  const paymentStyle = payment
    ? (PAYMENT_STATUS_STYLES[payment.status] || PAYMENT_STATUS_STYLES.PENDING)
    : null
  const emoji = CATEGORY_EMOJI[vehicle?.category] || '🚗'
  const duration = getDurationDays(booking.startDate, booking.endDate)

  return (
    <div className="sb-card">
      {/* Top: Customer info + booking status */}
      <div className="sb-card-top">
        <div className="sb-card-customer">
          <div className="sb-customer-avatar">
            {customer?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="sb-customer-name">{customer?.name || 'Unknown'}</h3>
            <p className="sb-customer-contact">
              {customer?.email}
              {customer?.phone && <span> · {customer.phone}</span>}
            </p>
          </div>
        </div>
        <span
          className="sb-status-badge"
          style={{ background: statusStyle.bg, color: statusStyle.color }}
        >
          {statusStyle.label}
        </span>
      </div>

      {/* Vehicle + dates */}
      <div className="sb-card-details">
        <div className="sb-card-detail-row">
          <span className="sb-card-label">🚗 Vehicle</span>
          <span className="sb-card-value">
            {emoji} {vehicle?.brand} {vehicle?.model}
          </span>
        </div>
        <div className="sb-card-detail-row">
          <span className="sb-card-label">📅 Dates</span>
          <span className="sb-card-value">
            {formatDateRange(booking.startDate, booking.endDate)}
            <span className="sb-card-duration"> ({duration}d)</span>
          </span>
        </div>
      </div>

      {/* Bottom: price + payment status */}
      <div className="sb-card-footer">
        <span className="sb-card-price">{formatPrice(booking.totalPrice)}</span>
        {paymentStyle && (
          <span
            className="sb-payment-badge"
            style={{ background: paymentStyle.bg, color: paymentStyle.color }}
          >
            {paymentStyle.label}
          </span>
        )}
      </div>
    </div>
  )
}

export default StoreBookingsPage
