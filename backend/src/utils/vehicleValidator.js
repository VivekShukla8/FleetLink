// ─────────────────────────────────────────────────────────
// Vehicle Validator — per-category specs + price validation
// ─────────────────────────────────────────────────────────

// Each category defines which spec fields are required vs optional.
// Fields NOT in `allowed` are rejected outright — prevents a
// BICYCLE from storing engineCC or a CAR from storing frameSize.

const CATEGORY_SPECS = {
  CAR: {
    required: ['seats', 'transmission', 'fuelType'],
    allowed: ['seats', 'transmission', 'fuelType', 'airConditioning', 'bootSpaceLiters'],
  },
  BIKE: {
    required: ['engineCC', 'fuelType'],
    allowed: ['engineCC', 'fuelType', 'abs', 'helmetIncluded'],
  },
  SCOOTER: {
    required: ['fuelType'],
    allowed: ['fuelType', 'engineCC', 'batteryRangeKm', 'helmetIncluded'],
  },
  BICYCLE: {
    required: ['type'],
    allowed: ['type', 'gearCount', 'frameSize', 'helmetIncluded'],
  },
};

const VALID_CATEGORIES = Object.keys(CATEGORY_SPECS);
const VALID_STATUSES = ['AVAILABLE', 'MAINTENANCE'];

/**
 * Validates the specs JSON object against the category's schema.
 * Returns an array of error strings (empty = valid).
 */
function validateSpecs(category, specs) {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) {
    return ['specs must be a valid JSON object'];
  }

  const rules = CATEGORY_SPECS[category];
  if (!rules) return [`Invalid category: ${category}`];

  const errors = [];
  const keys = Object.keys(specs);

  // Check missing required fields
  for (const field of rules.required) {
    if (specs[field] === undefined || specs[field] === null || specs[field] === '') {
      errors.push(`specs.${field} is required for category ${category}`);
    }
  }

  // Reject unrecognized fields for this category
  for (const key of keys) {
    if (!rules.allowed.includes(key)) {
      errors.push(`specs.${key} is not a valid specification for category ${category}`);
    }
  }

  return errors;
}

/**
 * Validates all price fields are positive numbers.
 * Returns an array of error strings (empty = valid).
 */
function validatePrices({ dailyPrice, weeklyPrice, monthlyPrice, maintenanceFee, securityDeposit }) {
  const errors = [];
  const fields = { dailyPrice, weeklyPrice, monthlyPrice, maintenanceFee, securityDeposit };

  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) {
      errors.push(`${name} is required`);
    } else if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      errors.push(`${name} must be a non-negative number`);
    }
  }

  return errors;
}

module.exports = {
  CATEGORY_SPECS,
  VALID_CATEGORIES,
  VALID_STATUSES,
  validateSpecs,
  validatePrices,
};
