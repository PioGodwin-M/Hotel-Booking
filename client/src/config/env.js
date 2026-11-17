/**
 * Environment & Feature Flag Configuration
 */

export const USE_SAMPLE_DATA =
  import.meta.env.VITE_USE_SAMPLE_DATA === "true" ||
  import.meta.env.VITE_USE_SAMPLE_DATA === true;

// Startup warning in production builds if sample data mode is inadvertently left active
if (typeof window !== "undefined" && import.meta.env.PROD && USE_SAMPLE_DATA) {
  console.warn(
    "[PGM Stays Warning] VITE_USE_SAMPLE_DATA is enabled in a production build! " +
      "Ensure this is disabled in live deployments so customers never view sample reviews, offers, or prices."
  );
}

export default {
  USE_SAMPLE_DATA,
};
