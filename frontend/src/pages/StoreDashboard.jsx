// ─────────────────────────────────────────────────────────
// StoreDashboard — Redesigned to match reference UI
// ─────────────────────────────────────────────────────────
// Layout:
//   Row 1: Welcome banner + Add Vehicle button
//   Row 2: 4 stat cards (Total Vehicles, Active Bookings, Completed, Revenue)
//   Row 3: Your Vehicles (left) + Quick Actions (right)
//   Row 4: Recent Bookings panel

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useLocalUser } from '../context/UserContext.jsx'
import { getVehicleImage, CATEGORY_EMOJI } from '../utils/vehicleImage'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const STATUS_STYLES = {
  AVAILABLE: { bg: '#D1FAE5', color: '#065F46', label: 'Available' },
  MAINTENANCE: { bg: '#FEF3C7', color: '#92400E', label: 'Maintenance' },
}

function StoreDashboard() {
  const { getToken } = useAuth()
  const { localUser } = useLocalUser()
  const navigate = useNavigate()

  const [store, setStore] = useState(null)
  const [storeLoading, setStoreLoading] = useState(true)
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

  const goToPage = (page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchVehicles(page)
    }
  }

  // ── Derive stats ───────────────────────────────────────
  const totalVehicles = pagination.total || 0
  const firstName = localUser?.name?.split(' ')[0] || 'User'

  return (
    <div className="dash">
      {/* ── Row 1: Welcome Banner ──────────────────────── */}
      <div className="dash-welcome">
        <div>
          <h1 className="dash-welcome-title">
            👋 Welcome back, {firstName}!
          </h1>
          <p className="dash-welcome-sub">
            Manage your fleet, vehicles, and bookings from one place.
          </p>
        </div>
        <Link to="/store/vehicles/new" className="dash-add-btn">
          🚗 Add Vehicle
        </Link>
      </div>

      {/* ── Row 2: Stats Cards ─────────────────────────── */}
      <div className="dash-stats">
        <div className="dash-stat-card">
          <div className="dash-stat-icon" style={{ background: '#EDE9FE', color: '#7C3AED' }}>🚗</div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">{totalVehicles}</span>
            <span className="dash-stat-label">Total Vehicles</span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon" style={{ background: '#DBEAFE', color: '#2563EB' }}>📅</div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">0</span>
            <span className="dash-stat-label">Active Bookings</span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon" style={{ background: '#D1FAE5', color: '#059669' }}>✅</div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">0</span>
            <span className="dash-stat-label">Completed Bookings</span>
          </div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>₹</div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">₹0</span>
            <span className="dash-stat-label">Total Revenue</span>
          </div>
        </div>
      </div>

      {/* ── Row 3: Vehicles + Quick Actions ────────────── */}
      <div className="dash-grid">
        {/* Left: Your Vehicles */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h2>
              🚗 Your Vehicles
              <span className="dash-badge">{totalVehicles} vehicle{totalVehicles !== 1 ? 's' : ''}</span>
            </h2>
            {vehicles.length > 0 && (
              <Link to="/store/dashboard" className="dash-view-all">View All →</Link>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="loading-screen" style={{ minHeight: '20vh' }}>
              <div className="spinner" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="fleet-error-banner">
              <span>⚠️</span> {error}
              <button onClick={() => fetchVehicles()} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 600 }}>
                Retry
              </button>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !error && vehicles.length === 0 && (
            <div className="dash-empty">
              <p>🚘 No vehicles yet. Add your first vehicle!</p>
              <Link to="/store/vehicles/new" className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
                + Add Vehicle
              </Link>
            </div>
          )}

          {/* Vehicle cards */}
          {!isLoading && vehicles.length > 0 && (
            <div className="dash-vehicles-list">
              {vehicles.map((vehicle) => {
                const statusStyle = STATUS_STYLES[vehicle.status] || STATUS_STYLES.AVAILABLE
                return (
                  <div key={vehicle.id} className="dash-vehicle-card">
                    <div className="dash-vehicle-img-wrap">
                      <img
                        src={getVehicleImage(vehicle.brand, vehicle.model, vehicle.category)}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        className="dash-vehicle-img"
                      />
                      <span
                        className="dash-vehicle-status"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}
                      >
                        ● {statusStyle.label}
                      </span>
                      <button className="dash-vehicle-menu">⋯</button>
                    </div>

                    <div className="dash-vehicle-body">
                      <h3 className="dash-vehicle-name">{vehicle.brand} {vehicle.model}</h3>
                      <div className="dash-vehicle-meta">
                        <span>{CATEGORY_EMOJI[vehicle.category] || '🚗'} {vehicle.category}</span>
                        {store && (
                          <span>📍 {store.name}<br/><small>{store.address}</small></span>
                        )}
                      </div>

                      <div className="dash-vehicle-prices">
                        <div>
                          <span className="price-label">📅 Daily</span>
                          <span className="price-value">₹{vehicle.dailyPrice?.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="price-label">📅 Weekly</span>
                          <span className="price-value">₹{vehicle.weeklyPrice?.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="price-label">📅 Monthly</span>
                          <span className="price-value">₹{vehicle.monthlyPrice?.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="dash-vehicle-actions">
                        <button
                          className="dash-btn-edit"
                          onClick={() => navigate(`/store/vehicles/${vehicle.id}/edit`)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="dash-btn-delete"
                          onClick={() => handleDelete(vehicle.id, `${vehicle.brand} ${vehicle.model}`)}
                          disabled={deletingId === vehicle.id}
                        >
                          {deletingId === vehicle.id ? '...' : '🗑️ Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination-bar">
              <button className="btn-page" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}>
                ← Prev
              </button>
              <span className="page-info">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button className="btn-page" disabled={pagination.page >= pagination.totalPages} onClick={() => goToPage(pagination.page + 1)}>
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="dash-right-col">
          {/* Quick Actions */}
          <div className="dash-panel">
            <div className="dash-panel-header">
              <h2>⚡ Quick Actions</h2>
            </div>
            <div className="dash-quick-actions">
              <Link to="/store/vehicles/new" className="dash-action-card">
                <span className="dash-action-icon">🚗</span>
                <span>Add Vehicle</span>
              </Link>
              <Link to="/store/bookings" className="dash-action-card">
                <span className="dash-action-icon">📅</span>
                <span>View Bookings</span>
              </Link>
              <Link to="/vehicles" className="dash-action-card">
                <span className="dash-action-icon">🔍</span>
                <span>Browse Vehicles</span>
              </Link>
              <Link to="/my-bookings" className="dash-action-card">
                <span className="dash-action-icon">📋</span>
                <span>My Bookings</span>
              </Link>
            </div>
          </div>

          {/* Recent Bookings */}
          <div className="dash-panel">
            <div className="dash-panel-header">
              <h2>🕐 Recent Bookings</h2>
              <Link to="/store/bookings" className="dash-view-all">View All →</Link>
            </div>
            <div className="dash-empty">
              <p><strong>No bookings yet</strong></p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Bookings made for your vehicles will appear here.
              </p>
              <Link to="/vehicles" className="dash-browse-btn">
                🔍 Browse Vehicles
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StoreDashboard
