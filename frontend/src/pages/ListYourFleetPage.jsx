// ─────────────────────────────────────────────────────────
// ListYourFleetPage — POST /api/v1/stores form
// ─────────────────────────────────────────────────────────
//
// Upgrades a CUSTOMER to STORE_OWNER by creating their store.
// On success, updates localUser in context (role flip) and
// redirects to /store/dashboard.
//
// Lat/lng are manual number inputs for now. The submit handler
// reads from formData state, so swapping in Google Places
// Autocomplete later only changes how lat/lng get filled —
// the submit logic stays the same.

import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useLocalUser } from '../context/UserContext.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function ListYourFleetPage() {
  const { getToken } = useAuth()
  const { setLocalUser, isStoreOwner, isUserLoaded } = useLocalUser()
  const navigate = useNavigate()

  // ── Already a store owner? Redirect to dashboard ───────
  // This catches cases where a STORE_OWNER types the URL directly.
  // The Navbar already hides this link for STORE_OWNER users.
  if (isUserLoaded && isStoreOwner) {
    return <Navigate to="/store/dashboard" replace />
  }

  // ── Form state ─────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
  })

  // Per-field validation errors (client-side)
  const [fieldErrors, setFieldErrors] = useState({})
  // Backend error message (409 "already own a store", etc.)
  const [submitError, setSubmitError] = useState(null)
  // Loading flag for the submit button
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Input handler ──────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // Clear the field error when the user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const copy = { ...prev }
        delete copy[name]
        return copy
      })
    }
  }

  // ── Client-side validation ─────────────────────────────
  // Mirrors the backend validation in storeController.js
  const validate = () => {
    const errors = {}

    if (!formData.name.trim()) {
      errors.name = 'Store name is required'
    }

    if (!formData.address.trim()) {
      errors.address = 'Store address is required'
    }

    const lat = parseFloat(formData.latitude)
    if (formData.latitude === '' || Number.isNaN(lat) || lat < -90 || lat > 90) {
      errors.latitude = 'Must be a number between -90 and 90'
    }

    const lng = parseFloat(formData.longitude)
    if (formData.longitude === '' || Number.isNaN(lng) || lng < -180 || lng > 180) {
      errors.longitude = 'Must be a number between -180 and 180'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Submit handler ─────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)

    if (!validate()) return

    setIsSubmitting(true)

    try {
      const token = await getToken()

      const response = await fetch(`${API_BASE}/api/v1/stores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          address: formData.address.trim(),
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        // Backend returns errors array for 422 (validation)
        // or a single message for 409 (already own a store)
        if (result.errors && Array.isArray(result.errors)) {
          throw new Error(result.errors.join('. '))
        }
        throw new Error(result.message || `Request failed (${response.status})`)
      }

      // ── Success: update UserContext with new role ─────
      // result.data.user is the updated user with role: 'STORE_OWNER'
      // This instantly flips the role in the context — no refetch needed.
      setLocalUser(result.data.user)

      // Redirect to the store dashboard
      navigate('/store/dashboard', { replace: true })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fleet-page">
      <div className="fleet-form-container">
        <div className="fleet-form-header">
          <div className="fleet-form-icon">🏪</div>
          <h1>List Your Fleet</h1>
          <p>
            Create your rental store and start listing vehicles.
            Your account will be upgraded to Store Owner.
          </p>
        </div>

        {submitError && (
          <div className="fleet-error-banner">
            <span className="fleet-error-icon">⚠️</span>
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Store Name */}
          <div className="form-group">
            <label htmlFor="store-name">Store Name</label>
            <input
              id="store-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. SpeedRide Rentals"
              className={fieldErrors.name ? 'input-error' : ''}
            />
            {fieldErrors.name && (
              <span className="field-error">{fieldErrors.name}</span>
            )}
          </div>

          {/* Store Address */}
          <div className="form-group">
            <label htmlFor="store-address">Store Address</label>
            <input
              id="store-address"
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="e.g. 123 MG Road, Bengaluru"
              className={fieldErrors.address ? 'input-error' : ''}
            />
            {fieldErrors.address && (
              <span className="field-error">{fieldErrors.address}</span>
            )}
          </div>

          {/* Latitude & Longitude (side by side) */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="store-lat">Latitude</label>
              <input
                id="store-lat"
                type="number"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                placeholder="e.g. 12.9716"
                step="any"
                min="-90"
                max="90"
                className={fieldErrors.latitude ? 'input-error' : ''}
              />
              {fieldErrors.latitude && (
                <span className="field-error">{fieldErrors.latitude}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="store-lng">Longitude</label>
              <input
                id="store-lng"
                type="number"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                placeholder="e.g. 77.5946"
                step="any"
                min="-180"
                max="180"
                className={fieldErrors.longitude ? 'input-error' : ''}
              />
              {fieldErrors.longitude && (
                <span className="field-error">{fieldErrors.longitude}</span>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary fleet-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Creating Store...
              </>
            ) : (
              <>Create Store & Become a Store Owner</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ListYourFleetPage
