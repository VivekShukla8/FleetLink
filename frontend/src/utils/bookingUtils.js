// ─────────────────────────────────────────────────────────
// Booking Utilities — shared constants for booking pages
// ─────────────────────────────────────────────────────────

// ── Booking status badge styles ──────────────────────────
// Used by MyBookingsPage, BookingDetailPage, StoreBookingsPage.
// Colors follow common UX conventions:
//   amber = waiting, green = confirmed, blue = active,
//   indigo = done, red = negative outcomes.

export const BOOKING_STATUS_STYLES = {
  PENDING:         { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
  PAYMENT_PENDING: { bg: '#FEF9C3', color: '#854D0E', label: 'Payment Pending' },
  CONFIRMED:       { bg: '#D1FAE5', color: '#065F46', label: 'Confirmed' },
  ACTIVE:          { bg: '#DBEAFE', color: '#1E40AF', label: 'Active' },
  COMPLETED:       { bg: '#E0E7FF', color: '#3730A3', label: 'Completed' },
  CANCELLED:       { bg: '#FEE2E2', color: '#991B1B', label: 'Cancelled' },
  REJECTED:        { bg: '#FECACA', color: '#7F1D1D', label: 'Rejected' },
}

// ── Payment status badge styles ──────────────────────────
export const PAYMENT_STATUS_STYLES = {
  PENDING: { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
  SUCCESS: { bg: '#D1FAE5', color: '#065F46', label: 'Paid' },
  FAILED:  { bg: '#FEE2E2', color: '#991B1B', label: 'Failed' },
}

// ── Deposit status badge styles ──────────────────────────
export const DEPOSIT_STATUS_STYLES = {
  HELD:                { bg: '#DBEAFE', color: '#1E40AF', label: 'Held' },
  REFUNDED:            { bg: '#D1FAE5', color: '#065F46', label: 'Refunded' },
  PARTIALLY_REFUNDED:  { bg: '#FEF3C7', color: '#92400E', label: 'Partially Refunded' },
  FORFEITED:           { bg: '#FEE2E2', color: '#991B1B', label: 'Forfeited' },
}

// ── Category emoji + vehicle images (from shared utility) ──
import { CATEGORY_EMOJI as _EMOJI, getVehicleImage as _getImg } from './vehicleImage.js'
export const CATEGORY_EMOJI = _EMOJI
export const getVehicleImage = _getImg

// ── Date formatting ──────────────────────────────────────
// Prisma @db.Date fields arrive as ISO strings like "2025-09-20T00:00:00.000Z".
// We format them as readable dates: "20 Sep 2025".

export function formatDate(isoString) {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',          // dates are date-only, interpret as UTC to avoid timezone shift
  })
}

export function formatDateRange(startDate, endDate) {
  return `${formatDate(startDate)} → ${formatDate(endDate)}`
}

// ── Price formatting ─────────────────────────────────────
export function formatPrice(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

// ── Duration in days (exclusive end date) ────────────────
export function getDurationDays(startDate, endDate) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}
