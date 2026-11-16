/**
 * Centralized formatting utilities for PGM Stays.
 * Standardizes currency, date, and numbers across the application.
 */

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Format an amount in Indian Rupees (e.g. ₹25,000).
 * Safe against strings, undefined, null, and NaN. Returns '—' if not finite.
 */
export const formatINR = (amount) => {
  const n = Number(amount);
  return Number.isFinite(n) ? formatter.format(n) : '—';
};

/**
 * Explicitly converts an amount in paise (Stripe amountMinor) to rupees.
 * E.g. 5000000 paise -> 50000 rupees.
 */
export const paiseToRupees = (paise) => {
  const n = Number(paise);
  return Number.isFinite(n) ? n / 100 : 0;
};

/**
 * Format price per night in a single non-wrapping baseline string.
 */
export const formatPricePerNight = (amount) => {
  const formatted = formatINR(amount);
  return formatted === '—' ? '—' : `${formatted} / night`;
};

/**
 * Format a date string to a human-readable friendly format (e.g. "Sat, 22 Nov").
 */
export const formatShortDate = (dateVal) => {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

/**
 * Format a date range cleanly (e.g. "Sat, 22 Nov – Mon, 24 Nov 2026").
 */
export const formatDateRange = (checkIn, checkOut) => {
  if (!checkIn) return "";
  const dIn = new Date(checkIn);
  if (isNaN(dIn.getTime())) return `${checkIn} – ${checkOut || ""}`;

  if (!checkOut) {
    return dIn.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const dOut = new Date(checkOut);
  if (isNaN(dOut.getTime())) return `${checkIn} – ${checkOut}`;

  const sameYear = dIn.getFullYear() === dOut.getFullYear();

  const startStr = dIn.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });

  const endStr = dOut.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `${startStr} – ${endStr}`;
};
