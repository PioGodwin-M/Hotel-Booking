/**
 * Formats a raw MongoDB booking ObjectId into a customer-friendly reference.
 * Example: '6afb272600ddfe54ab70a226' -> 'PGM-AB70A226'
 * Always deterministic and derivable from the real ID.
 */
export const formatBookingReference = (id) => {
  if (!id) return "";
  const raw = typeof id === "object" ? id?._id || String(id) : String(id);
  const clean = raw.replace(/[^a-zA-Z0-9]/g, "");
  const suffix = clean.slice(-8).toUpperCase();
  return `PGM-${suffix}`;
};

export default formatBookingReference;
