import { NOMINATIM_GEOCODER_URL } from "../config/map";

export const CITY_COORDINATES = {
  Delhi: { lat: 28.6139, lng: 77.209 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Dubai: { lat: 25.2048, lng: 55.2708 },
  Singapore: { lat: 1.3521, lng: 103.8198 },
  "New York": { lat: 40.7128, lng: -74.006 },
  London: { lat: 51.5074, lng: -0.1278 },
  Goa: { lat: 15.2993, lng: 74.124 },
};

/**
 * Validates coordinate pair.
 * Must be finite numbers within standard WGS84 bounds.
 */
export function isValidCoordinate(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Reads public coordinates for guest-facing views (Home, Stays list/map, Room Details, My bookings).
 * Strict rule: Reads ONLY location.publicCoordinates, never location.coordinates.
 *
 * @param {object} stay Room or stay object
 * @returns {{ lat: number, lng: number } | null}
 */
export function getPublicCoordinates(stay) {
  if (!stay) return null;
  const hotel = stay.hotel || stay;
  const location = hotel.location;

  if (!location || typeof location !== "object") return null;

  const publicCoords = location.publicCoordinates;
  if (!publicCoords || typeof publicCoords !== "object") return null;

  const lat = Number(publicCoords.lat);
  const lng = Number(publicCoords.lng);

  if (!isValidCoordinate(lat, lng)) return null;

  return { lat, lng };
}

/**
 * Reads owner coordinates for owner management views only (Register, Edit property).
 * Strict rule: Reads ONLY location.coordinates, never location.publicCoordinates.
 *
 * @param {object} property Hotel/property document
 * @returns {{ lat: number, lng: number } | null}
 */
export function getOwnerCoordinates(property) {
  if (!property) return null;
  const location = property.location;

  if (!location || typeof location !== "object") return null;

  const coords = location.coordinates;
  if (!coords || typeof coords !== "object") return null;

  const lat = Number(coords.lat);
  const lng = Number(coords.lng);

  if (!isValidCoordinate(lat, lng)) return null;

  return { lat, lng };
}

/**
 * Builds Google Maps search URL.
 * Used for "Open in Maps" links.
 */
export function getGoogleMapsSearchUrl({ lat, lng, address }) {
  if (isValidCoordinate(lat, lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (address && typeof address === "string" && address.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
  }
  return null;
}

/**
 * Builds Google Maps directions URL using destination parameter.
 * Strict rule: Never uses search URL for directions.
 */
export function getGoogleMapsDirectionsUrl({ lat, lng, address }) {
  if (isValidCoordinate(lat, lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address && typeof address === "string" && address.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`;
  }
  return null;
}

// Session cache for geocoder queries
const geocodeCache = new Map();
let lastGeocodeTimestamp = 0;

/**
 * Performs forward geocoding via Nominatim with rate-limiting and session caching.
 * Follows OpenStreetMap usage policy (at most 1 request per second, explicit user action).
 *
 * @param {string} query Search address
 * @returns {Promise<Array<{ displayName: string, lat: number, lng: number }>>}
 */
export async function searchAddress(query) {
  if (!query || typeof query !== "string" || !query.trim()) {
    return [];
  }

  const cleanQuery = query.trim();
  if (geocodeCache.has(cleanQuery)) {
    return geocodeCache.get(cleanQuery);
  }

  // Rate limiting: at least 1,000ms between consecutive network requests
  const now = Date.now();
  const timeSinceLast = now - lastGeocodeTimestamp;
  if (timeSinceLast < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - timeSinceLast));
  }
  lastGeocodeTimestamp = Date.now();

  try {
    const url = new URL(NOMINATIM_GEOCODER_URL);
    url.searchParams.set("q", cleanQuery);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn("Geocoder response not ok:", res.status);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const parsed = data
      .map((item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (!isValidCoordinate(lat, lng)) return null;
        return {
          displayName: item.display_name,
          lat,
          lng,
        };
      })
      .filter(Boolean);

    geocodeCache.set(cleanQuery, parsed);
    return parsed;
  } catch (err) {
    console.error("Geocoder fetch error:", err.message);
    return [];
  }
}
