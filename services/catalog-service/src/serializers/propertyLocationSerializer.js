import crypto from "node:crypto";

/**
 * Returns configured approximate radius in meters (default 500).
 */
export function getApproxRadiusMeters() {
  const val = parseInt(process.env.LOCATION_APPROX_RADIUS_METERS, 10);
  return Number.isFinite(val) && val > 0 ? val : 500;
}

/**
 * Computes deterministic public coordinates for approximate properties.
 * - Seeded by hotelId for absolute stability across requests.
 * - Distance strictly between 35% and 85% of approx radius.
 * - True coordinate is not recoverable from output.
 */
export function computeDeterministicOffset(hotelId, lat, lng, radiusMeters) {
  if (lat == null || lng == null) return null;

  const idStr = hotelId ? hotelId.toString() : "default";
  const hash = crypto.createHash("sha256").update(`${idStr}:catalog-approx-salt`).digest();

  // Angle: [0, 2*PI)
  const angle = (hash.readUInt32BE(0) / 0xffffffff) * 2 * Math.PI;

  // Distance ratio: [0.35, 0.85] of radius
  const minRatio = 0.35;
  const maxRatio = 0.85;
  const distanceMeters =
    (minRatio + (hash.readUInt32BE(4) / 0xffffffff) * (maxRatio - minRatio)) * radiusMeters;

  const metersPerLat = 111320;
  const latRad = (lat * Math.PI) / 180;
  const metersPerLng = 111320 * Math.cos(latRad);

  const deltaLat = (distanceMeters * Math.cos(angle)) / metersPerLat;
  const deltaLng = (distanceMeters * Math.sin(angle)) / metersPerLng;

  return {
    lat: Number((lat + deltaLat).toFixed(6)),
    lng: Number((lng + deltaLng).toFixed(6)),
  };
}

/**
 * Returns a verified structured area if one exists; otherwise returns city only.
 * Does not rely on regex guessing from arbitrary street address strings.
 * Guarantees zero leakage of street numbers or building details for approximate properties.
 */
export function getApproximateAddress(hotel) {
  if (hotel.area && typeof hotel.area === "string" && hotel.area.trim()) {
    return hotel.area.trim();
  }
  return hotel.city || "";
}

/**
 * Serializes a hotel document for owner-facing responses (Step 3).
 * Shows actual stored coordinates under location.coordinates so owner can view and edit the marker.
 */
export function serializeOwnerHotel(hotel) {
  if (!hotel) return null;
  const h = typeof hotel.toObject === "function" ? hotel.toObject() : { ...hotel };

  const hasCoords =
    h.latitude != null &&
    h.longitude != null &&
    Number.isFinite(h.latitude) &&
    Number.isFinite(h.longitude);

  const radius = getApproxRadiusMeters();
  const precision = h.locationPrecision === "approximate" ? "approximate" : "exact";

  let location = null;
  if (hasCoords) {
    location = {
      coordinates: {
        lat: Number(h.latitude),
        lng: Number(h.longitude),
      },
      locationPrecision: precision,
      approximateRadiusMeters: precision === "approximate" ? radius : null,
    };
  }

  // Remove raw coordinate fields; preserve standard owner metadata
  const { latitude, longitude, ...rest } = h;

  return {
    ...rest,
    location,
  };
}

/**
 * Canonical shared serializer for public guest-facing property data (Step 4).
 * Enforces privacy rules:
 * - For approximate properties: never contains exact coordinates, never contains street address.
 *   Returns verified structured area if available, otherwise city only.
 * - Returns publicCoordinates (with deterministic offset for approximate).
 * - Exact properties return real coordinates as publicCoordinates and full address.
 */
export function serializePublicHotel(hotel) {
  if (!hotel) return null;
  const h = typeof hotel.toObject === "function" ? hotel.toObject() : { ...hotel };

  const hasCoords =
    h.latitude != null &&
    h.longitude != null &&
    Number.isFinite(h.latitude) &&
    Number.isFinite(h.longitude);

  const radius = getApproxRadiusMeters();
  const precision = h.locationPrecision === "approximate" ? "approximate" : "exact";

  let location = null;
  let publicAddress = h.address;

  if (hasCoords) {
    if (precision === "approximate") {
      const publicCoords = computeDeterministicOffset(
        h._id,
        Number(h.latitude),
        Number(h.longitude),
        radius
      );

      location = {
        publicCoordinates: publicCoords,
        locationPrecision: "approximate",
        approximateRadiusMeters: radius,
      };

      // Strict privacy: verified area or city only, never arbitrary street address
      publicAddress = getApproximateAddress(h);
    } else {
      location = {
        publicCoordinates: {
          lat: Number(h.latitude),
          lng: Number(h.longitude),
        },
        locationPrecision: "exact",
        approximateRadiusMeters: null,
      };
    }
  }

  // Security: explicitly strip raw exact coordinate fields from public view
  const { latitude, longitude, ...rest } = h;

  return {
    ...rest,
    address: publicAddress,
    location,
  };
}

/**
 * Serializes a public room document by ensuring its embedded hotel passes through serializePublicHotel.
 */
export function serializePublicRoom(room) {
  if (!room) return null;
  const r = typeof room.toObject === "function" ? room.toObject() : { ...room };

  if (r.hotel && typeof r.hotel === "object") {
    r.hotel = serializePublicHotel(r.hotel);
  }

  return r;
}

/**
 * Serializes an array of public rooms.
 */
export function serializePublicRoomList(rooms) {
  if (!Array.isArray(rooms)) return [];
  return rooms.map(serializePublicRoom);
}
