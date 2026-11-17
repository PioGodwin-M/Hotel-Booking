/**
 * Map Configuration
 *
 * Configurable tile provider and attribution.
 * Default is OpenStreetMap standard tiles.
 * Supports overriding via VITE_MAP_TILE_URL for production providers (MapTiler, Stadia, etc.).
 */
export const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const MAP_TILE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_MAP_TILE_URL) || DEFAULT_TILE_URL;

export const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

export const MAP_MAX_ZOOM = 19;
export const DEFAULT_ZOOM = 15;
export const DEFAULT_CENTER = [20.5937, 78.9629]; // India geographic center fallback

export const NOMINATIM_GEOCODER_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_GEOCODER_URL) ||
  "https://nominatim.openstreetmap.org/search";
