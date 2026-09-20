// ─────────────────────────────────────────────────────────
// StoreDashboard — store info + manage vehicles
// ─────────────────────────────────────────────────────────
//
// Two fetches on mount:
//   1. GET /api/v1/stores/my-store        → store details card
//   2. GET /api/v1/stores/my-store/vehicles → vehicle grid

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useLocalUser } from '../context/UserContext.jsx'
import { getVehicleImage, CATEGORY_EMOJI } from '../utils/vehicleImage'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// CATEGORY_EMOJI imported from ../utils/vehicleImage

// Status badge colors
const STATUS_STYLES = {
  AVAILABLE: { bg: '#D1FAE5', color: '#065F46', label: 'Available' },
  MAINTENANCE: { bg: '#FEF3C7', color: '#92400E', label: 'Maintenance' },
}

function StoreDashboard() {
  const { getToken } = useAuth()
  const { localUser } = useLocalUser()
  const navigate = useNavigate()

  // Store details
  const [store, setStore] = useState(null)
  const [storeLoading, setStoreLoading] = useState(true)

  // Vehicles
  const [vehicles, setVehicles] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // ── Fetch store details ────────────────────────────────
  useEffect(() => {
    async function fetchStore() {
      try {
        const token = await getToken()
        const response = await fetch(`${API_BASE}/api/v1/stores/my-store`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const result = await response.json()
        if (response.ok) {
          setStore(result.data)
        }
      } catch (err) {
        console.error('Failed to fetch store:', err)
      } finally {
        setStoreLoading(false)
      }
    }
    fetchStore()
  }, [getToken])

  // ── Fetch vehicles ─────────────────────────────────────
  const fetchVehicles = useCallback(async (page = 1) => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await getToken()
      const response = await fetch(
        `${API_BASE}/api/v1/stores/my-store/vehicles?page=${page}&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `Request failed (${response.status})`)
      }

      setVehicles(result.data.vehicles)
      setPagination(result.data.pagination)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

  // ── Delete handler ─────────────────────────────────────
  const handleDelete = async (vehicleId, vehicleName) => {
    if (!window.confirm(`Delete "${vehicleName}"? This action cannot be undone.`)) {
      return
    }

    setDeletingId(vehicleId)

    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE}/api/v1/vehicles/${vehicleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Delete failed')
      }

      await fetchVehicles(pagination.page)
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  // ── Pagination handler ─────────────────────────────────
  const goToPage = (page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchVehicles(page)
    }
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        {/* ── Header ──────────────────────────────────── */}
        <div className="dashboard-header">
          <div>
            <h1>Store Dashboard</h1>
            <p>Welcome back, {localUser?.name}. Manage your fleet below.</p>
          </div>
          <Link to="/store/vehicles/new" className="btn btn-primary">
            + Add Vehicle
          </Link>
        </div>

        {/* ── Store Info Card ─────────────────────────── */}
        {storeLoading ? (
          <div className="store-info-card">
            <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
          </div>
        ) : store ? (
          <div className="store-info-card">
            <div className="store-info-left">
              <div className="store-info-icon">🏪</div>
              <div>
                <h2 className="store-info-name">{store.name}</h2>
                <p className="store-info-address">📍 {store.address}</p>
                <div className="store-info-meta">
                  <span>Lat: {store.latitude}</span>
                  <span className="store-info-dot">•</span>
                  <span>Lng: {store.longitude}</span>
                  <span className="store-info-dot">•</span>
                  <span>Since {new Date(store.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="store-info-stats">
              <div className="store-stat">
                <span className="store-stat-value">{pagination.total}</span>
                <span className="store-stat-label">Vehicles</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Error State ─────────────────────────────── */}
        {error && (
          <div className="fleet-error-banner">
            <span className="fleet-error-icon">⚠️</span>
            {error}
            <button onClick={() => fetchVehicles()} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 600 }}>
              Retry
            </button>
          </div>
        )}

        {/* ── Loading State ───────────────────────────── */}
        {isLoading && (
          <div className="loading-screen" style={{ minHeight: '30vh' }}>
            <div className="spinner" />
            <p>Loading your vehicles...</p>
          </div>
        )}

        {/* ── Empty State ─────────────────────────────── */}
        {!isLoading && !error && vehicles.length === 0 && (
          <div className="dashboard-empty">
            <div className="dashboard-empty-icon">🚘</div>
            <h2>No vehicles yet</h2>
            <p>Add your first vehicle to start receiving bookings.</p>
            <Link to="/store/vehicles/new" className="btn btn-primary">
              + Add Your First Vehicle
            </Link>
          </div>
        )}

        {/* ── Vehicle Grid ────────────────────────────── */}
        {!isLoading && vehicles.length > 0 && (
          <>
            <div className="vehicle-grid">
              {vehicles.map((vehicle) => {
                const statusStyle = STATUS_STYLES[vehicle.status] || STATUS_STYLES.AVAILABLE

                return (
                  <div key={vehicle.id} className="vehicle-card">
                    <div className="vehicle-card-top">
                      <img
                        src={getVehicleImage(vehicle.brand, vehicle.model, vehicle.category)}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        className="vehicle-card-photo"
                      />
                      <span
                        className="vehicle-status-badge"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}
                      >
                        {statusStyle.label}
                      </span>
                    </div>

                    <h3 className="vehicle-card-title">{vehicle.brand} {vehicle.model}</h3>
                    <p className="vehicle-card-category">{vehicle.category}</p>

                    <div className="vehicle-card-prices">
                      <div className="price-item">
                        <span className="price-label">Daily</span>
                        <span className="price-value">₹{vehicle.dailyPrice}</span>
                      </div>
                      <div className="price-item">
                        <span className="price-label">Weekly</span>
                        <span className="price-value">₹{vehicle.weeklyPrice}</span>
                      </div>
                      <div className="price-item">
                        <span className="price-label">Monthly</span>
                        <span className="price-value">₹{vehicle.monthlyPrice}</span>
                      </div>
                    </div>

                    <div className="vehicle-card-actions">
                      <button
                        className="btn-card btn-card-edit"
                        onClick={() => navigate(`/store/vehicles/${vehicle.id}/edit`)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn-card btn-card-delete"
                        onClick={() => handleDelete(vehicle.id, `${vehicle.brand} ${vehicle.model}`)}
                        disabled={deletingId === vehicle.id}
                      >
                        {deletingId === vehicle.id ? '...' : '🗑️ Delete'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Pagination ──────────────────────────── */}
            {pagination.totalPages > 1 && (
              <div className="pagination-bar">
                <button
                  className="btn-page"
                  disabled={pagination.page <= 1}
                  onClick={() => goToPage(pagination.page - 1)}
                >
                  ← Prev
                </button>
                <span className="page-info">
                  Page {pagination.page} of {pagination.totalPages}
                  {' '}({pagination.total} vehicles)
                </span>
                <button
                  className="btn-page"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default StoreDashboard
