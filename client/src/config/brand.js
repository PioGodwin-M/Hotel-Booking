/**
 * Centralized Brand Configuration
 * Modifying this single file propagates brand updates across the entire application:
 * logo, favicon, page titles, receipts, toasts, Clerk appearance, and metadata.
 */

export const BRAND_PREFIX = "PGM";
export const BRAND_SUFFIX = "Stays";
export const BRAND_INITIAL = "P";
export const BRAND_NAME = `${BRAND_PREFIX} ${BRAND_SUFFIX}`;

export const BRAND_TAGLINE = "Find your next stay";
export const BRAND_SUBTITLE = "Compare rooms, see the full price upfront and book in minutes.";
export const BRAND_COPYRIGHT = `© ${new Date().getFullYear()} ${BRAND_NAME}`;

/**
 * Backend-authoritative booking hold duration.
 * Verified from services/booking-service/src/services/bookingService.js (HOLD_DURATION_MS = 10 * 60 * 1000).
 */
export const HOLD_DURATION_MINUTES = 10;
export const HOLD_DURATION_TEXT = `${HOLD_DURATION_MINUTES} minutes`;

export default {
  BRAND_PREFIX,
  BRAND_SUFFIX,
  BRAND_INITIAL,
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_SUBTITLE,
  BRAND_COPYRIGHT,
  HOLD_DURATION_MINUTES,
  HOLD_DURATION_TEXT,
};
