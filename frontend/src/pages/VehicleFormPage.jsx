// ─────────────────────────────────────────────────────────
// VehicleFormPage — Add / Edit Vehicle
// ─────────────────────────────────────────────────────────
//
// Shared by two routes:
//   /store/vehicles/new         → mode = 'create'
//   /store/vehicles/:id/edit    → mode = 'edit'
//
// Mode is determined by the presence of an :id URL param.
// In edit mode we fetch the existing vehicle (public GET),
// pre-fill all fields, and PATCH on submit.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import AppIcon, { VehicleIcon } from '../components/AppIcon.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ─────────────────────────────────────────────────────────
// VEHICLE_SPECS_CONFIG — single source of truth for the
// form's dynamic spec fields per vehicle category.
//
// Mirrors the backend's CATEGORY_SPECS (required/allowed)
// but adds UI metadata: label, input type, options, etc.
//
// ⚠️  IMPORTANT: The dropdown option VALUES here (e.g.
// 'Manual'/'Automatic', 'Petrol'/'Diesel') are a
// frontend-only convention. The backend's validateSpecs
// does NOT check these values — it only checks that the
// key EXISTS and is non-empty for required fields.
//
// Do NOT rename option values casually — old vehicles
// already stored in the database won't retroactively
// update. Add new options freely, but treat renames as
// migrations.
// ─────────────────────────────────────────────────────────

const VEHICLE_CATEGORIES = ['CAR', 'BIKE', 'SCOOTER', 'BICYCLE']

const CATEGORY_LABELS = {
  CAR: 'Car',
  BIKE: 'Bike',
  SCOOTER: 'Scooter',
  BICYCLE: 'Bicycle',
}

const VEHICLE_SPECS_CONFIG = {
  CAR: [
    { name: 'seats', label: 'Seating Capacity', type: 'number', required: true, placeholder: 'e.g. 5', min: 1 },
    { name: 'transmission', label: 'Transmission', type: 'select', required: true, options: ['Manual', 'Automatic'] },
    { name: 'fuelType', label: 'Fuel Type', type: 'select', required: true, options: ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'] },
    { name: 'airConditioning', label: 'Air Conditioning', type: 'checkbox', required: false },
    { name: 'bootSpaceLiters', label: 'Boot Space (Liters)', type: 'number', required: false, placeholder: 'e.g. 450', min: 0 },
  ],
  BIKE: [
    { name: 'engineCC', label: 'Engine (CC)', type: 'number', required: true, placeholder: 'e.g. 350', min: 50 },
    { name: 'fuelType', label: 'Fuel Type', type: 'select', required: true, options: ['Petrol', 'Electric'] },
    { name: 'abs', label: 'ABS (Anti-lock Braking)', type: 'checkbox', required: false },
    { name: 'helmetIncluded', label: 'Helmet Included', type: 'checkbox', required: false },
  ],
  SCOOTER: [
    { name: 'fuelType', label: 'Fuel Type', type: 'select', required: true, options: ['Petrol', 'Electric'] },
    { name: 'engineCC', label: 'Engine (CC)', type: 'number', required: false, placeholder: 'e.g. 110', min: 50 },
    { name: 'batteryRangeKm', label: 'Battery Range (Km)', type: 'number', required: false, placeholder: 'e.g. 120', min: 10 },
    { name: 'helmetIncluded', label: 'Helmet Included', type: 'checkbox', required: false },
  ],
  BICYCLE: [
    { name: 'type', label: 'Bicycle Type', type: 'select', required: true, options: ['Mountain', 'Road', 'Hybrid', 'City', 'Electric'] },
    { name: 'gearCount', label: 'Gear Count', type: 'number', required: false, placeholder: 'e.g. 21', min: 1 },
    { name: 'frameSize', label: 'Frame Size', type: 'select', required: false, options: ['S', 'M', 'L', 'XL'] },
    { name: 'helmetIncluded', label: 'Helmet Included', type: 'checkbox', required: false },
  ],
}

// Price field definitions — matches backend's validatePrices
const PRICE_FIELDS = [
  { name: 'dailyPrice', label: 'Daily Price (₹)' },
  { name: 'weeklyPrice', label: 'Weekly Price (₹)' },
  { name: 'monthlyPrice', label: 'Monthly Price (₹)' },
  { name: 'maintenanceFee', label: 'Maintenance Fee (₹)' },
  { name: 'securityDeposit', label: 'Security Deposit (₹)' },
]

// ── Helper: build empty specs for a given category ───────
function emptySpecsFor(category) {
  const specs = {}
  const fields = VEHICLE_SPECS_CONFIG[category] || []
  for (const field of fields) {
    if (field.type === 'checkbox') {
      specs[field.name] = false
    } else {
      specs[field.name] = ''
    }
  }
  return specs
}

// ── Helper: parse 422 error arrays into field map + banner ─
// Backend returns: { errors: ["specs.seats is required for category CAR", "dailyPrice is required", ...] }
//
// Strategy:
//   1. If string starts with "specs.<key>", map to fieldErrors['specs.<key>']
//   2. If string starts with a known field name, map to fieldErrors[field]
//   3. Anything else → falls through to the banner (NEVER silently dropped)
function parseBackendErrors(errorArray) {
  const fieldErrors = {}
  const bannerErrors = []

  const knownFields = ['category', 'brand', 'model', 'status', ...PRICE_FIELDS.map(f => f.name)]

  for (const msg of errorArray) {
    // Check for specs.xxx pattern
    const specMatch = msg.match(/^specs\.(\w+)/)
    if (specMatch) {
      fieldErrors[`specs.${specMatch[1]}`] = msg
      continue
    }

    // Check for known standard field names at the start
    let matched = false
    for (const field of knownFields) {
      if (msg.startsWith(field)) {
        fieldErrors[field] = msg
        matched = true
        break
      }
    }

    // ⚠️ If nothing matched, push to banner — never silently dropped
    if (!matched) {
      bannerErrors.push(msg)
    }
  }

  return { fieldErrors, bannerErrors }
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

function VehicleFormPage() {
  const { id } = useParams() // undefined for create, present for edit
  const isEditMode = Boolean(id)
  const navigate = useNavigate()
  const { getToken } = useAuth()

  // ── Form data ──────────────────────────────────────────
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [specs, setSpecs] = useState({})
  const [prices, setPrices] = useState({
    dailyPrice: '',
    weeklyPrice: '',
    monthlyPrice: '',
    maintenanceFee: '',
    securityDeposit: '',
  })

  // ── UI state ───────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFetching, setIsFetching] = useState(isEditMode) // only true in edit mode
  const [fieldErrors, setFieldErrors] = useState({})
  const [bannerError, setBannerError] = useState(null)
  const [showCategoryWarning, setShowCategoryWarning] = useState(false)
  const [pendingCategory, setPendingCategory] = useState(null)
  const [originalCategory, setOriginalCategory] = useState('')

  // ── Edit mode: fetch existing vehicle ──────────────────
  useEffect(() => {
    if (!isEditMode) return

    async function fetchVehicle() {
      try {
        const token = await getToken()
        const response = await fetch(`${API_BASE}/api/v1/vehicles/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const result = await response.json()

        if (!response.ok) {
          setBannerError(result.message || 'Failed to load vehicle')
          return
        }

        const v = result.data
        setCategory(v.category)
        setOriginalCategory(v.category)
        setBrand(v.brand)
        setModel(v.model)

        // Pre-fill specs — merge with empty defaults so all fields exist
        const defaults = emptySpecsFor(v.category)
        setSpecs({ ...defaults, ...(v.specs || {}) })

        // Pre-fill prices — convert Decimal strings to number strings
        setPrices({
          dailyPrice: v.dailyPrice ?? '',
          weeklyPrice: v.weeklyPrice ?? '',
          monthlyPrice: v.monthlyPrice ?? '',
          maintenanceFee: v.maintenanceFee ?? '',
          securityDeposit: v.securityDeposit ?? '',
        })
      } catch (err) {
        setBannerError(err.message)
      } finally {
        setIsFetching(false)
      }
    }

    fetchVehicle()
  }, [id, isEditMode, getToken])

  // ── Category change handler ────────────────────────────
  const handleCategoryChange = (newCategory) => {
    if (!newCategory) return

    // In edit mode, warn if changing from original category
    if (isEditMode && category && newCategory !== category) {
      setPendingCategory(newCategory)
      setShowCategoryWarning(true)
      return
    }

    // Fresh selection (create mode, or first pick in edit)
    setCategory(newCategory)
    setSpecs(emptySpecsFor(newCategory))
    setFieldErrors({})
    setBannerError(null)
  }

  const confirmCategorySwitch = () => {
    setCategory(pendingCategory)
    setSpecs(emptySpecsFor(pendingCategory))
    setShowCategoryWarning(false)
    setPendingCategory(null)
    setFieldErrors({})
  }

  const cancelCategorySwitch = () => {
    setShowCategoryWarning(false)
    setPendingCategory(null)
  }

  // ── Spec field change handler ──────────────────────────
  const handleSpecChange = (fieldName, value) => {
    setSpecs(prev => ({ ...prev, [fieldName]: value }))
    // Clear field-level error on change
    setFieldErrors(prev => {
      const next = { ...prev }
      delete next[`specs.${fieldName}`]
      return next
    })
  }

  // ── Price change handler ───────────────────────────────
  const handlePriceChange = (fieldName, value) => {
    setPrices(prev => ({ ...prev, [fieldName]: value }))
    setFieldErrors(prev => {
      const next = { ...prev }
      delete next[fieldName]
      return next
    })
  }

  // ── Client-side validation ─────────────────────────────
  const validate = useCallback(() => {
    const errors = {}

    if (!category) errors.category = 'Please select a vehicle category'
    if (!brand.trim()) errors.brand = 'Brand is required'
    if (!model.trim()) errors.model = 'Model is required'

    // Price validation — all required, all non-negative numbers
    for (const pf of PRICE_FIELDS) {
      const val = prices[pf.name]
      if (val === '' || val === undefined || val === null) {
        errors[pf.name] = `${pf.label.replace(' (₹)', '')} is required`
      } else if (isNaN(Number(val)) || Number(val) < 0) {
        errors[pf.name] = `${pf.label.replace(' (₹)', '')} must be a non-negative number`
      }
    }

    // Spec validation — check required fields for selected category
    if (category) {
      const specFields = VEHICLE_SPECS_CONFIG[category] || []
      for (const field of specFields) {
        if (field.required) {
          const val = specs[field.name]
          if (val === '' || val === undefined || val === null) {
            errors[`specs.${field.name}`] = `${field.label} is required`
          }
        }
      }
    }

    return errors
  }, [category, brand, model, prices, specs])

  // ── Submit handler ─────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFieldErrors({})
    setBannerError(null)

    // Client-side validation
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const token = await getToken()

      // Build clean specs object — strip empty optional fields,
      // coerce numbers from strings
      const cleanSpecs = {}
      const specFields = VEHICLE_SPECS_CONFIG[category] || []
      for (const field of specFields) {
        const val = specs[field.name]
        if (field.type === 'checkbox') {
          cleanSpecs[field.name] = Boolean(val)
        } else if (field.type === 'number') {
          if (val !== '' && val !== undefined && val !== null) {
            cleanSpecs[field.name] = Number(val)
          }
          // Skip empty optional number fields
        } else if (field.type === 'select') {
          if (val) cleanSpecs[field.name] = val
        }
      }

      const body = {
        category,
        brand: brand.trim(),
        model: model.trim(),
        specs: cleanSpecs,
        dailyPrice: Number(prices.dailyPrice),
        weeklyPrice: Number(prices.weeklyPrice),
        monthlyPrice: Number(prices.monthlyPrice),
        maintenanceFee: Number(prices.maintenanceFee),
        securityDeposit: Number(prices.securityDeposit),
      }

      const url = isEditMode
        ? `${API_BASE}/api/v1/vehicles/${id}`
        : `${API_BASE}/api/v1/vehicles`

      const response = await fetch(url, {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (!response.ok) {
        // Handle 422 validation errors with field mapping
        if (response.status === 422 && result.errors && Array.isArray(result.errors)) {
          const { fieldErrors: mapped, bannerErrors } = parseBackendErrors(result.errors)
          setFieldErrors(mapped)
          if (bannerErrors.length > 0) {
            setBannerError(bannerErrors.join('. '))
          } else if (Object.keys(mapped).length === 0) {
            // Edge case: 422 with no parseable errors
            setBannerError(result.message || 'Validation failed')
          }
        } else {
          setBannerError(result.message || `Request failed (${response.status})`)
        }
        return
      }

      // Success → redirect to dashboard
      navigate('/store/dashboard')
    } catch (err) {
      setBannerError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Loading state (edit mode only) ─────────────────────
  if (isFetching) {
    return (
      <div className="fleet-page">
        <div className="loading-screen" style={{ minHeight: '50vh' }}>
          <div className="spinner" />
          <p>Loading vehicle...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fleet-page">
      <div className="vehicle-form-container">
        {/* ── Header ──────────────────────────────────── */}
        <div className="fleet-form-header">
          <div className="fleet-form-icon"><AppIcon name={isEditMode ? 'edit' : 'car'} size={30} /></div>
          <h1>{isEditMode ? 'Edit Vehicle' : 'Add New Vehicle'}</h1>
          <p>{isEditMode ? 'Update the details below.' : 'Fill in the details to list a new vehicle.'}</p>
        </div>

        {/* ── Banner Error ────────────────────────────── */}
        {bannerError && (
          <div className="fleet-error-banner">
            <span className="fleet-error-icon"><AppIcon name="alert" size={18} /></span>
            <span>{bannerError}</span>
          </div>
        )}

        {/* ── Category Switch Warning Modal ───────────── */}
        {showCategoryWarning && (
          <div className="category-warning-overlay">
            <div className="category-warning-modal">
              <h3><AppIcon name="alert" size={19} /> Change category?</h3>
              <p>
                Switching from <strong>{CATEGORY_LABELS[category]}</strong> to{' '}
                <strong>{CATEGORY_LABELS[pendingCategory]}</strong> will{' '}
                <strong>reset all specification fields</strong>. Standard fields
                (brand, model, prices) will be kept.
              </p>
              <div className="category-warning-actions">
                <button className="btn btn-outline" onClick={cancelCategorySwitch}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={confirmCategorySwitch}>
                  Switch Category
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* ── Category Selector ─────────────────────── */}
          <div className="form-group">
            <label>Vehicle Category *</label>
            <div className="category-selector">
              {VEHICLE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-chip ${category === cat ? 'category-chip-active' : ''}`}
                  onClick={() => handleCategoryChange(cat)}
                >
                  <VehicleIcon category={cat} size={17} /> {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            {fieldErrors.category && <span className="field-error">{fieldErrors.category}</span>}
          </div>

          {/* ── Standard Fields ───────────────────────── */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="brand">Brand *</label>
              <input
                id="brand"
                type="text"
                className={fieldErrors.brand ? 'input-error' : ''}
                placeholder="e.g. Honda"
                value={brand}
                onChange={(e) => {
                  setBrand(e.target.value)
                  setFieldErrors(prev => { const n = { ...prev }; delete n.brand; return n })
                }}
              />
              {fieldErrors.brand && <span className="field-error">{fieldErrors.brand}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="model">Model *</label>
              <input
                id="model"
                type="text"
                className={fieldErrors.model ? 'input-error' : ''}
                placeholder="e.g. City"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value)
                  setFieldErrors(prev => { const n = { ...prev }; delete n.model; return n })
                }}
              />
              {fieldErrors.model && <span className="field-error">{fieldErrors.model}</span>}
            </div>
          </div>

          {/* ── Dynamic Spec Fields ───────────────────── */}
          {category && (
            <fieldset className="specs-fieldset">
              <legend>
                {CATEGORY_LABELS[category]} Specifications
              </legend>
              <div className="specs-grid">
                {VEHICLE_SPECS_CONFIG[category].map((field) => (
                  <SpecFieldRenderer
                    key={`${category}-${field.name}`}
                    field={field}
                    value={specs[field.name]}
                    onChange={(val) => handleSpecChange(field.name, val)}
                    error={fieldErrors[`specs.${field.name}`]}
                  />
                ))}
              </div>
            </fieldset>
          )}

          {/* ── Price Fields ──────────────────────────── */}
          <fieldset className="specs-fieldset">
            <legend><AppIcon name="wallet" size={16} /> Pricing</legend>
            <div className="specs-grid">
              {PRICE_FIELDS.map((pf) => (
                <div key={pf.name} className="form-group">
                  <label htmlFor={pf.name}>{pf.label} *</label>
                  <input
                    id={pf.name}
                    type="number"
                    className={fieldErrors[pf.name] ? 'input-error' : ''}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    value={prices[pf.name]}
                    onChange={(e) => handlePriceChange(pf.name, e.target.value)}
                  />
                  {fieldErrors[pf.name] && <span className="field-error">{fieldErrors[pf.name]}</span>}
                </div>
              ))}
            </div>
          </fieldset>

          {/* ── Actions ───────────────────────────────── */}
          <div className="vehicle-form-actions">
            <Link to="/store/dashboard" className="btn btn-outline">
              ← Back to Dashboard
            </Link>
            <button
              type="submit"
              className="btn btn-primary fleet-submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? (isEditMode ? 'Saving...' : 'Creating...')
                : (isEditMode ? <><AppIcon name="check" size={17} /> Save changes</> : <><AppIcon name="plus" size={17} /> Add vehicle</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// SpecFieldRenderer — renders one spec field based on config
// ═══════════════════════════════════════════════════════════

function SpecFieldRenderer({ field, value, onChange, error }) {
  const { name, label, type, required, options, placeholder, min } = field

  // ── Checkbox ───────────────────────────────────────────
  if (type === 'checkbox') {
    return (
      <div className="form-group form-group-checkbox">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{label}</span>
        </label>
      </div>
    )
  }

  // ── Select ─────────────────────────────────────────────
  if (type === 'select') {
    return (
      <div className="form-group">
        <label htmlFor={`spec-${name}`}>
          {label} {required && '*'}
        </label>
        <select
          id={`spec-${name}`}
          className={error ? 'input-error' : ''}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select {label}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {error && <span className="field-error">{error}</span>}
      </div>
    )
  }

  // ── Number / Text ──────────────────────────────────────
  return (
    <div className="form-group">
      <label htmlFor={`spec-${name}`}>
        {label} {required && '*'}
      </label>
      <input
        id={`spec-${name}`}
        type={type}
        className={error ? 'input-error' : ''}
        placeholder={placeholder || ''}
        min={min}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

export default VehicleFormPage
