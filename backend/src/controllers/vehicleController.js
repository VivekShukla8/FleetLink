// ─────────────────────────────────────────────────────────
// Vehicle Controller — CRUD for store vehicles
// ─────────────────────────────────────────────────────────

const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const {
  VALID_CATEGORIES,
  VALID_STATUSES,
  validateSpecs,
  validatePrices,
} = require('../utils/vehicleValidator');
const {
  buildCacheKey,
  getCachedVehicles,
  setCachedVehicles,
  invalidateVehicleCache,
} = require('../utils/vehicleCache');

// ── POST /api/v1/vehicles ────────────────────────────────
// Creates a new vehicle for the authenticated store owner's store.
// req.store is set by requireStore middleware.

const createVehicle = async (req, res, next) => {
  try {
    const {
      category, brand, model, specs,
      dailyPrice, weeklyPrice, monthlyPrice,
      maintenanceFee, securityDeposit,
    } = req.body;

    // ── Validation ─────────────────────────────────────
    const errors = [];

    if (!category || !VALID_CATEGORIES.includes(category)) {
      errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
    if (!brand || typeof brand !== 'string' || !brand.trim()) {
      errors.push('brand is required');
    }
    if (!model || typeof model !== 'string' || !model.trim()) {
      errors.push('model is required');
    }

    // Specs validation (per-category)
    if (category && VALID_CATEGORIES.includes(category)) {
      errors.push(...validateSpecs(category, specs));
    }

    // Price validation
    errors.push(
      ...validatePrices({ dailyPrice, weeklyPrice, monthlyPrice, maintenanceFee, securityDeposit })
    );

    if (errors.length > 0) {
      throw new ApiError(422, 'Validation failed', errors);
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        storeId: req.store.id,
        category,
        brand: brand.trim(),
        model: model.trim(),
        specs,
        dailyPrice,
        weeklyPrice,
        monthlyPrice,
        maintenanceFee,
        securityDeposit,
      },
    });

    // Invalidate vehicle search cache — new vehicle should appear
    await invalidateVehicleCache();

    return res.status(201).json(
      new ApiResponse(201, vehicle, 'Vehicle listed successfully')
    );
  } catch (error) {
    next(error);
  }
};

// ── GET /api/v1/vehicles ─────────────────────────────────
// Public endpoint — returns available vehicles with optional filters.
// Query params: ?category=CAR&status=AVAILABLE&page=1&limit=10

const getVehicles = async (req, res, next) => {
  try {
    const {
      category,
      status = 'AVAILABLE',
      page = 1,
      limit = 10,
    } = req.query;

    const startTime = Date.now();
    const cacheKey = buildCacheKey({ status, category, page, limit });

    // ── Cache check ──────────────────────────────────────
    const cached = await getCachedVehicles(cacheKey);
    if (cached) {
      const elapsed = Date.now() - startTime;
      console.log(`[VehicleCache] HIT  ${cacheKey} (${elapsed}ms)`);
      return res.status(200).json(
        new ApiResponse(200, cached, 'Vehicles fetched successfully (cached)')
      );
    }

    // ── Cache miss → query MySQL ──────────────────────────
    const where = {};

    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          store: {
            select: { id: true, name: true, address: true, latitude: true, longitude: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicle.count({ where }),
    ]);

    const data = {
      vehicles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    // ── Populate cache (fire-and-forget) ──────────────────
    setCachedVehicles(cacheKey, data);

    const elapsed = Date.now() - startTime;
    console.log(`[VehicleCache] MISS ${cacheKey} → MySQL (${elapsed}ms) → cached 90s`);

    return res.status(200).json(
      new ApiResponse(200, data, 'Vehicles fetched successfully')
    );
  } catch (error) {
    next(error);
  }
};

// ── GET /api/v1/vehicles/:id ─────────────────────────────
// Public endpoint — returns a single vehicle with its store info.

const getVehicleById = async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id },
      include: {
        store: {
          select: { id: true, name: true, address: true, latitude: true, longitude: true },
        },
      },
    });

    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }

    return res.status(200).json(
      new ApiResponse(200, vehicle, 'Vehicle fetched successfully')
    );
  } catch (error) {
    next(error);
  }
};

// ── PATCH /api/v1/vehicles/:id ───────────────────────────
// Updates a vehicle belonging to the authenticated store owner.
// Ownership check: vehicle must belong to req.store (this owner's store).
// Returns 404 for non-existent OR non-owned vehicles (prevents ID enumeration).

const updateVehicle = async (req, res, next) => {
  try {
    // ── Ownership check ────────────────────────────────
    // Single query: find vehicle by ID AND verify it belongs
    // to this store owner's store. If either condition fails,
    // findFirst returns null → 404.
    const existing = await prisma.vehicle.findFirst({
      where: {
        id: req.params.id,
        storeId: req.store.id,
      },
    });

    if (!existing) {
      throw new ApiError(404, 'Vehicle not found or you do not have permission to modify it');
    }

    // ── Build update data (only provided fields) ───────
    const updateData = {};
    const errors = [];

    const {
      category, brand, model, specs, status,
      dailyPrice, weeklyPrice, monthlyPrice,
      maintenanceFee, securityDeposit,
    } = req.body;

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
      } else {
        updateData.category = category;
      }
    }

    if (brand !== undefined) {
      if (typeof brand !== 'string' || !brand.trim()) {
        errors.push('brand cannot be empty');
      } else {
        updateData.brand = brand.trim();
      }
    }

    if (model !== undefined) {
      if (typeof model !== 'string' || !model.trim()) {
        errors.push('model cannot be empty');
      } else {
        updateData.model = model.trim();
      }
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      } else {
        updateData.status = status;
      }
    }

    // If specs are being updated, validate against the
    // target category (either the new category or existing one)
    if (specs !== undefined) {
      const targetCategory = updateData.category || existing.category;
      errors.push(...validateSpecs(targetCategory, specs));
      if (errors.length === 0) {
        updateData.specs = specs;
      }
    }

    // Price fields — only validate if provided
    const priceFields = { dailyPrice, weeklyPrice, monthlyPrice, maintenanceFee, securityDeposit };
    for (const [name, value] of Object.entries(priceFields)) {
      if (value !== undefined) {
        if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
          errors.push(`${name} must be a non-negative number`);
        } else {
          updateData[name] = value;
        }
      }
    }

    if (errors.length > 0) {
      throw new ApiError(422, 'Validation failed', errors);
    }

    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'No valid fields provided for update');
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Invalidate vehicle search cache — updated data should reflect
    await invalidateVehicleCache();

    return res.status(200).json(
      new ApiResponse(200, vehicle, 'Vehicle updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/v1/vehicles/:id ──────────────────────────
// Deletes a vehicle belonging to the authenticated store owner.
// Same ownership check pattern as PATCH.

const deleteVehicle = async (req, res, next) => {
  try {
    // Ownership check
    const existing = await prisma.vehicle.findFirst({
      where: {
        id: req.params.id,
        storeId: req.store.id,
      },
    });

    if (!existing) {
      throw new ApiError(404, 'Vehicle not found or you do not have permission to delete it');
    }

    await prisma.vehicle.delete({
      where: { id: req.params.id },
    });

    // Invalidate vehicle search cache — deleted vehicle should disappear
    await invalidateVehicleCache();

    return res.status(200).json(
      new ApiResponse(200, null, 'Vehicle deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};

// ── GET /api/v1/stores/my-store/vehicles ─────────────────
// Returns all vehicles belonging to the store owner's store.
// Requires: requireAuth → requireRole('STORE_OWNER') → requireStore
// so req.store is already set.
//
// Unlike GET /api/v1/vehicles (public, defaults to AVAILABLE),
// this returns ALL statuses so the owner can manage MAINTENANCE vehicles too.
//
// Query params:
//   ?category=CAR      — optional filter
//   ?status=AVAILABLE  — optional filter (no default — shows all)
//   ?page=1&limit=10   — pagination

const getStoreVehicles = async (req, res, next) => {
  try {
    const { category, status, page = 1, limit = 10 } = req.query;

    // ── Build WHERE clause ─────────────────────────────
    const where = { storeId: req.store.id };

    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }
    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }

    // ── Pagination ─────────────────────────────────────
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicle.count({ where }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        vehicles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      }, 'Store vehicles fetched successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  getStoreVehicles,
};
