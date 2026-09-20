// ─────────────────────────────────────────────────────────
// Vehicle Image Utility — shared across all pages
// ─────────────────────────────────────────────────────────
//
// Maps brand+model to a real vehicle image.
// Falls back to a category-based generic image.
// Images are served from /vehicles/ in the public folder.

// Curated mapping: "brand model" (lowercase) → filename
const VEHICLE_IMAGE_MAP = {
  'audi a4': '/vehicles/audi-a4.jpg',
  'bmw m3': '/vehicles/bmw-m3.jpg',
  'hyundai creta': '/vehicles/hyundai-creta.jpg',
  'honda activa 6g': '/vehicles/honda-activa-6g.jpg',
  'tvs jupiter': '/vehicles/tvs-jupiter.jpg',
  'royal enfield classic 350': '/vehicles/royal-enfield-classic-350.jpg',
}

// Category fallbacks for vehicles not in the map
const CATEGORY_FALLBACK = {
  CAR: '/vehicles/fallback-car.jpg',
  BIKE: '/vehicles/fallback-bike.jpg',
  SCOOTER: '/vehicles/fallback-scooter.jpg',
  BICYCLE: '/vehicles/fallback-bicycle.jpg',
}

/**
 * Get the image URL for a vehicle.
 *
 * @param {string} brand   - e.g. "Audi"
 * @param {string} model   - e.g. "A4"
 * @param {string} category - e.g. "CAR", "BIKE", "SCOOTER", "BICYCLE"
 * @returns {string} URL path to the vehicle image
 */
export function getVehicleImage(brand, model, category) {
  if (brand && model) {
    const key = `${brand} ${model}`.toLowerCase()
    if (VEHICLE_IMAGE_MAP[key]) {
      return VEHICLE_IMAGE_MAP[key]
    }
  }
  return CATEGORY_FALLBACK[category] || CATEGORY_FALLBACK.CAR
}

// Category emojis — still used in chips, popups, and text labels
export const CATEGORY_EMOJI = {
  CAR: '🚗',
  BIKE: '🏍️',
  SCOOTER: '🛵',
  BICYCLE: '🚲',
}
