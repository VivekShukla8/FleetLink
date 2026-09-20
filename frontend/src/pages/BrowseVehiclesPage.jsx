// ─────────────────────────────────────────────────────────
// BrowseVehiclesPage — full-screen map with overlay controls
// ─────────────────────────────────────────────────────────
//
// Layout:
//   Full-viewport dark-themed map as background
//   Overlaid: title, search, category chips (top-left)
//   Overlaid: Map/List View toggle (top-right)
//   Overlaid: horizontal card carousel (bottom)
//   Overlaid: store summary badge (bottom-right)
//
// Data source: GET /api/v1/vehicles (public, no auth)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getVehicleImage, CATEGORY_EMOJI } from '../utils/vehicleImage'

// ── Leaflet imports + Vite marker icon fix ───────────────
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

// ── Numbered circle marker factory ───────────────────────
function createNumberedIcon(number) {
  return L.divIcon({
    className: 'bv-numbered-marker',
    html: `<div class="bv-marker-circle">${number}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const CATEGORIES = ['ALL', 'CAR', 'BIKE', 'SCOOTER', 'BICYCLE']

// CATEGORY_EMOJI imported from ../utils/vehicleImage

// Helper: extract human-readable spec tags from vehicle.specs
function getSpecTags(vehicle) {
  const tags = []
  const s = vehicle.specs || {}

  if (s.seats) tags.push(`🪑 ${s.seats} Seater`)
  if (s.transmission) tags.push(`⚙️ ${s.transmission}`)
  if (s.fuelType) tags.push(`⛽ ${s.fuelType}`)
  if (s.engineCC) tags.push(`🔧 ${s.engineCC}cc`)
  if (s.type) tags.push(`🚲 ${s.type}`)
  if (s.gearCount) tags.push(`⚙️ ${s.gearCount} Gears`)
  if (s.batteryRangeKm) tags.push(`🔋 ${s.batteryRangeKm}km`)

  return tags.slice(0, 3) // max 3 tags per card
}

const DEFAULT_CENTER = [20.5937, 78.9629]
const DEFAULT_ZOOM = 5

// Standard OpenStreetMap tiles — dark effect via CSS filter (no API key)
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

// ═══════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════

function BrowseVehiclesPage() {
  const [vehicles, setVehicles] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedVehicleId, setHighlightedVehicleId] = useState(null)

  // View mode toggle
  const [viewMode, setViewMode] = useState('map') // 'map' | 'list'

  // Carousel scroll ref
  const carouselRef = useRef(null)

  // ── Fetch vehicles ─────────────────────────────────────
  const fetchVehicles = useCallback(async (page = 1, category = categoryFilter) => {
    setIsLoading(true)
    setError(null)
    setHighlightedVehicleId(null)

    try {
      let url = `${API_BASE}/api/v1/vehicles?page=${page}&limit=20`
      if (category && category !== 'ALL') {
        url += `&category=${category}`
      }

      const response = await fetch(url)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `Failed (${response.status})`)
      }

      setVehicles(result.data.vehicles)
      setPagination(result.data.pagination)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [categoryFilter])

  useEffect(() => {
    fetchVehicles(1, categoryFilter)
  }, [categoryFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Client-side search filter ──────────────────────────
  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return vehicles
    const q = searchQuery.toLowerCase()
    return vehicles.filter((v) =>
      v.brand.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      (v.store?.name || '').toLowerCase().includes(q) ||
      (v.store?.address || '').toLowerCase().includes(q)
    )
  }, [vehicles, searchQuery])

  // ── Deduplicate stores for map markers ─────────────────
  const uniqueStores = useMemo(() => {
    const storeMap = new Map()
    for (const v of filteredVehicles) {
      if (!v.store || !v.store.latitude || !v.store.longitude) continue
      const sid = v.store.id
      if (!storeMap.has(sid)) {
        storeMap.set(sid, {
          ...v.store,
          vehicleCount: 0,
          vehicles: [],
        })
      }
      const entry = storeMap.get(sid)
      entry.vehicleCount += 1
      entry.vehicles.push(v)
    }
    return Array.from(storeMap.values())
  }, [filteredVehicles])

  // ── Compute map bounds ─────────────────────────────────
  const mapBounds = useMemo(() => {
    if (uniqueStores.length === 0) return null
    const lats = uniqueStores.map((s) => Number(s.latitude))
    const lngs = uniqueStores.map((s) => Number(s.longitude))
    return L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    )
  }, [uniqueStores])

  // ── Marker click → highlight card in carousel ──────────
  const handleMarkerClick = (store) => {
    if (store.vehicles.length > 0) {
      setHighlightedVehicleId(store.vehicles[0].id)
      // Scroll carousel to this card
      const cardEl = document.getElementById(`bv-card-${store.vehicles[0].id}`)
      if (cardEl && carouselRef.current) {
        cardEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }

  // ── Carousel scroll ────────────────────────────────────
  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = 320
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  const handleCategoryChange = (cat) => {
    setCategoryFilter(cat)
  }

  return (
    <div className="bv-page">
      {/* ── Full-screen Map ───────────────────────────── */}
      <div className={`bv-map-container ${viewMode === 'list' ? 'bv-map-hidden' : ''}`}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={true}
          className="bv-map"
          zoomControl={false}
        >
          <TileLayer
            attribution={TILE_ATTRIBUTION}
            url={TILE_URL}
            className="bv-dark-tiles"
          />

          <MapBoundsUpdater bounds={mapBounds} />

          {uniqueStores.map((store, index) => (
            <Marker
              key={store.id}
              position={[Number(store.latitude), Number(store.longitude)]}
              icon={createNumberedIcon(index + 1)}
              eventHandlers={{
                click: () => handleMarkerClick(store),
              }}
            >
              <Popup className="bv-popup-wrap">
                <div className="bv-popup">
                  {store.vehicles[0] && (
                    <>
                      <div className="bv-popup-emoji">
                        {CATEGORY_EMOJI[store.vehicles[0].category] || '🚗'}
                      </div>
                      <h4 className="bv-popup-title">
                        {store.vehicles[0].brand} {store.vehicles[0].model}
                      </h4>
                      <p className="bv-popup-price">
                        ₹{store.vehicles[0].dailyPrice}<span>/day</span>
                      </p>
                    </>
                  )}
                  <p className="bv-popup-store">{store.name}</p>
                  <p className="bv-popup-count">
                    {store.vehicleCount} vehicle{store.vehicleCount > 1 ? 's' : ''} here
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* ── Overlay: Title + Search + Filters (top-left) ── */}
      <div className="bv-overlay-top">
        <div className="bv-overlay-header">
          <div>
            <h1 className="bv-title">Browse Vehicles</h1>
            <p className="bv-subtitle">Find the perfect vehicle for your next journey</p>
          </div>
        </div>

        <div className="bv-search-input-wrap">
          <span className="bv-search-icon">🔍</span>
          <input
            type="text"
            className="bv-search-input"
            placeholder="Search by brand, model or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="bv-category-chips">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`bv-chip ${categoryFilter === cat ? 'bv-chip-active' : ''}`}
              onClick={() => handleCategoryChange(cat)}
            >
              {cat === 'ALL'
                ? `📋 All (${pagination.total})`
                : `${CATEGORY_EMOJI[cat]} ${cat.charAt(0) + cat.slice(1).toLowerCase()}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overlay: View Toggle (top-right) ────────────── */}
      <div className="bv-overlay-toggle">
        <button
          className="bv-toggle-btn"
          onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
        >
          {viewMode === 'map' ? '📋 List View' : '🗺️ Map/List View'}
        </button>
      </div>

      {/* ── Overlay: Bottom Card Carousel ──────────────── */}
      <div className={`bv-carousel-wrap ${viewMode === 'list' ? 'bv-carousel-list-mode' : ''}`}>
        {/* Error */}
        {error && (
          <div className="fleet-error-banner" style={{ margin: '0 1rem 0.5rem' }}>
            <span className="fleet-error-icon">⚠️</span>
            {error}
            <button
              onClick={() => fetchVehicles(1, categoryFilter)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 600 }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="bv-carousel-loading">
            <div className="spinner" />
            <p>Searching vehicles...</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && filteredVehicles.length === 0 && (
          <div className="bv-carousel-empty">
            <span>🔍</span>
            <p>
              {searchQuery
                ? `No results for "${searchQuery}".`
                : categoryFilter !== 'ALL'
                  ? `No ${categoryFilter.toLowerCase()}s available.`
                  : 'No vehicles available.'}
            </p>
          </div>
        )}

        {/* Cards carousel */}
        {!isLoading && filteredVehicles.length > 0 && (
          <>
            <button
              className="bv-carousel-arrow bv-carousel-arrow-left"
              onClick={() => scrollCarousel('left')}
              aria-label="Scroll left"
            >
              ‹
            </button>

            <div className="bv-carousel" ref={carouselRef}>
              {filteredVehicles.map((vehicle) => {
                const isHighlighted = highlightedVehicleId === vehicle.id
                const specTags = getSpecTags(vehicle)

                return (
                  <div
                    key={vehicle.id}
                    id={`bv-card-${vehicle.id}`}
                    className={`bv-card ${isHighlighted ? 'bv-card-highlight' : ''}`}
                  >
                    <div className="bv-card-img">
                      <img
                        src={getVehicleImage(vehicle.brand, vehicle.model, vehicle.category)}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        className="bv-card-photo"
                      />
                    </div>

                    {/* Body */}
                    <div className="bv-card-body">
                      <h3 className="bv-card-title">
                        {vehicle.brand} {vehicle.model}
                      </h3>

                      {vehicle.store && (
                        <p className="bv-card-store">
                          📍 {vehicle.store.name}
                        </p>
                      )}

                      {/* Spec tags */}
                      {specTags.length > 0 && (
                        <div className="bv-card-specs">
                          {specTags.map((tag, i) => (
                            <span key={i} className="bv-spec-tag">{tag}</span>
                          ))}
                        </div>
                      )}

                      {/* Price + CTA */}
                      <div className="bv-card-footer">
                        <div className="bv-card-price">
                          <span className="bv-price-amount">₹{vehicle.dailyPrice}</span>
                          <span className="bv-price-period">/day</span>
                        </div>
                        <Link
                          to={`/vehicles/${vehicle.id}`}
                          className="bv-card-cta"
                        >
                          View Details →
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              className="bv-carousel-arrow bv-carousel-arrow-right"
              onClick={() => scrollCarousel('right')}
              aria-label="Scroll right"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* ── Overlay: Store count badge (bottom-right) ──── */}
      {!isLoading && filteredVehicles.length > 0 && viewMode === 'map' && (
        <div className="bv-map-badge">
          📍 {uniqueStores.length} store{uniqueStores.length !== 1 ? 's' : ''} •{' '}
          {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? 's' : ''} in this area
        </div>
      )}

      {/* ── List View Mode (full grid, replaces map) ───── */}
      {viewMode === 'list' && (
        <div className="bv-list-fullscreen">
          {!isLoading && filteredVehicles.length > 0 && (
            <div className="bv-list-grid">
              {filteredVehicles.map((vehicle) => {
                const specTags = getSpecTags(vehicle)
                return (
                  <div key={vehicle.id} className="bv-card">
                    <div className="bv-card-img">
                      <img
                        src={getVehicleImage(vehicle.brand, vehicle.model, vehicle.category)}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        className="bv-card-photo"
                      />
                    </div>
                    <div className="bv-card-body">
                      <h3 className="bv-card-title">
                        {vehicle.brand} {vehicle.model}
                      </h3>
                      {vehicle.store && (
                        <p className="bv-card-store">📍 {vehicle.store.name}</p>
                      )}
                      {specTags.length > 0 && (
                        <div className="bv-card-specs">
                          {specTags.map((tag, i) => (
                            <span key={i} className="bv-spec-tag">{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="bv-card-footer">
                        <div className="bv-card-price">
                          <span className="bv-price-amount">₹{vehicle.dailyPrice}</span>
                          <span className="bv-price-period">/day</span>
                        </div>
                        <Link to={`/vehicles/${vehicle.id}`} className="bv-card-cta">
                          View Details →
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination in list mode */}
          {pagination.totalPages > 1 && (
            <div className="pagination-bar">
              <button
                className="btn-page"
                disabled={pagination.page <= 1}
                onClick={() => fetchVehicles(pagination.page - 1, categoryFilter)}
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
                onClick={() => fetchVehicles(pagination.page + 1, categoryFilter)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MapBoundsUpdater — fits map to bounds when results change
// ═══════════════════════════════════════════════════════════

function MapBoundsUpdater({ bounds }) {
  const map = useMap()

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
    }
  }, [bounds, map])

  return null
}

export default BrowseVehiclesPage
