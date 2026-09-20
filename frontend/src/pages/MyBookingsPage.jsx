// ─────────────────────────────────────────────────────────
// MyBookingsPage — authenticated user's booking list
// ─────────────────────────────────────────────────────────
//
// Route: /my-bookings (any authenticated user)
//
// API: GET /api/v1/bookings/my-bookings?status=...&page=...&limit=10
// Returns: { bookings, pagination: { page, limit, total, totalPages } }
// Each booking includes: vehicle (with store), payment

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import {
  BOOKING_STATUS_STYLES,
  CATEGORY_EMOJI,
  getVehicleImage,
  formatDateRange,
  formatPrice,
  getDurationDays,
} from '../utils/bookingUtils.js'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Status options for the filter dropdown
const STATUS_OPTIONS = [
  { value: '', label: 'All Bookings' },
  { value: 'PAYMENT_PENDING', label: 'Payment Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REJECTED', label: 'Rejected' },
]

function MyBookingsPage() {
  const { getToken } = useAuth()

  const [bookings, setBookings] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── Fetch bookings ─────────────────────────────────────
  const fetchBookings = useCallback(async (page = 1) => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()
      const params = new URLSearchParams({ page, limit: 10 })
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(
        `${API_BASE}/api/v1/bookings/my-bookings?${params}`,
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
  }, [getToken, statusFilter])

  // Re-fetch when filter changes (always reset to page 1)
  useEffect(() => {
    fetchBookings(1)
  }, [fetchBookings])

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="mb-page">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="mb-header">
        <div className="mb-header-text">
          <h1 className="mb-title">My Bookings</h1>
          <p className="mb-subtitle">Track and manage all your vehicle rentals</p>
        </div>

        {/* ── Filter ──────────────────────────────────── */}
        <div className="mb-filters">
          <select
            className="mb-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────── */}
      {error && (
        <div className="mb-error">
          <span>⚠️</span> {error}
          <button className="mb-error-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── Loading state ───────────────────────────────── */}
      {isLoading && (
        <div className="mb-loading">
          <div className="spinner" />
          <p>Loading your bookings…</p>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────── */}
      {!isLoading && !error && bookings.length === 0 && (
        <div className="mb-empty">
          <div className="mb-empty-icon">📋</div>
          <h3>No bookings found</h3>
          <p>
            {statusFilter
              ? `No bookings with status "${STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}".`
              : "You haven't made any bookings yet."}
          </p>
          <Link to="/vehicles" className="mb-browse-btn">Browse Vehicles</Link>
        </div>
      )}

      {/* ── Booking cards ───────────────────────────────── */}
      {!isLoading && bookings.length > 0 && (
        <div className="mb-grid">
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────── */}
      {!isLoading && pagination.totalPages > 1 && (
        <div className="mb-pagination">
          <button
            className="mb-page-btn"
            disabled={pagination.page <= 1}
            onClick={() => fetchBookings(pagination.page - 1)}
          >
            ← Previous
          </button>
          <span className="mb-page-info">
            Page {pagination.page} of {pagination.totalPages}
            <span className="mb-page-total"> ({pagination.total} bookings)</span>
          </span>
          <button
            className="mb-page-btn"
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

// ── Individual Booking Card ──────────────────────────────
function BookingCard({ booking }) {
  const vehicle = booking.vehicle
  const statusStyle = BOOKING_STATUS_STYLES[booking.status] || BOOKING_STATUS_STYLES.PENDING
  const emoji = CATEGORY_EMOJI[vehicle?.category] || '🚗'
  const duration = getDurationDays(booking.startDate, booking.endDate)

  return (
    <Link to={`/bookings/${booking.id}`} className="mb-card">
      {/* Top row: vehicle info + status badge */}
      <div className="mb-card-top">
        <div className="mb-card-vehicle">
          <img
            src={getVehicleImage(vehicle?.brand, vehicle?.model, vehicle?.category)}
            alt={`${vehicle?.brand} ${vehicle?.model}`}
            className="mb-card-thumb"
          />
          <div>
            <h3 className="mb-card-name">
              {vehicle?.brand} {vehicle?.model}
            </h3>
            <p className="mb-card-category">{vehicle?.category}</p>
          </div>
        </div>
        <span
          className="mb-status-badge"
          style={{ background: statusStyle.bg, color: statusStyle.color }}
        >
          {statusStyle.label}
        </span>
      </div>

      {/* Middle: dates + store */}
      <div className="mb-card-details">
        <div className="mb-card-detail-row">
          <span className="mb-card-label">📅 Dates</span>
          <span className="mb-card-value">
            {formatDateRange(booking.startDate, booking.endDate)}
            <span className="mb-card-duration"> ({duration} day{duration !== 1 ? 's' : ''})</span>
          </span>
        </div>
        {vehicle?.store && (
          <div className="mb-card-detail-row">
            <span className="mb-card-label">📍 Store</span>
            <span className="mb-card-value">{vehicle.store.name}</span>
          </div>
        )}
      </div>

      {/* Bottom: price */}
      <div className="mb-card-footer">
        <span className="mb-card-price">{formatPrice(booking.totalPrice)}</span>
        <span className="mb-card-arrow">→</span>
      </div>
    </Link>
  )
}

export default MyBookingsPage
