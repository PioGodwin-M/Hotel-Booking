/**
 * Validates coordinate and location precision input for hotel creation and update.
 * Rules:
 * - Both latitude and longitude present or both null.
 * - Finite numbers; latitude -90..90, longitude -180..180.
 * - Reject strings, NaN, Infinity.
 * - locationPrecision: "exact" | "approximate", default "exact".
 */
export function validateLocationInput(body) {
  const { latitude, longitude, locationPrecision } = body;

  // 1. If neither coordinate is provided in the payload, return valid (no change requested)
  if (latitude === undefined && longitude === undefined) {
    if (locationPrecision !== undefined) {
      if (!["exact", "approximate"].includes(locationPrecision)) {
        return {
          valid: false,
          error: "locationPrecision must be 'exact' or 'approximate'",
        };
      }
      return { valid: true, data: { locationPrecision } };
    }
    return { valid: true, data: {} };
  }

  // 2. If one is null/undefined while the other is provided
  if (
    (latitude === null && longitude !== null) ||
    (latitude !== null && longitude === null) ||
    (latitude === undefined && longitude !== undefined) ||
    (latitude !== undefined && longitude === undefined)
  ) {
    return {
      valid: false,
      error: "Both latitude and longitude must be provided together, or both must be null",
    };
  }

  // 3. Both are null -> clearing coordinates
  if (latitude === null && longitude === null) {
    const data = {
      latitude: null,
      longitude: null,
    };
    if (locationPrecision !== undefined) {
      if (!["exact", "approximate"].includes(locationPrecision)) {
        return {
          valid: false,
          error: "locationPrecision must be 'exact' or 'approximate'",
        };
      }
      data.locationPrecision = locationPrecision;
    }
    return { valid: true, data };
  }

  // 4. Both are provided -> must be valid numbers
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return {
      valid: false,
      error: "Latitude and longitude must be numbers, not strings or other types",
    };
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      valid: false,
      error: "Latitude and longitude must be finite numbers (NaN and Infinity are rejected)",
    };
  }

  if (latitude < -90 || latitude > 90) {
    return {
      valid: false,
      error: "Latitude must be between -90 and 90 degrees",
    };
  }

  if (longitude < -180 || longitude > 180) {
    return {
      valid: false,
      error: "Longitude must be between -180 and 180 degrees",
    };
  }

  const precision = locationPrecision !== undefined ? locationPrecision : "exact";
  if (!["exact", "approximate"].includes(precision)) {
    return {
      valid: false,
      error: "locationPrecision must be 'exact' or 'approximate'",
    };
  }

  return {
    valid: true,
    data: {
      latitude,
      longitude,
      locationPrecision: precision,
    },
  };
}
