const getCatalogUrl = () => process.env.CATALOG_SERVICE_URL;
const getInternalSecret = () => process.env.INTERNAL_SERVICE_SECRET;

export const getRoomPricing = async (roomCategoryId) => {
  const CATALOG_SERVICE_URL = getCatalogUrl();
  const INTERNAL_SERVICE_SECRET = getInternalSecret();

  if (!CATALOG_SERVICE_URL || !INTERNAL_SERVICE_SECRET) {
    const error = new Error("Catalog Service configuration is missing");
    error.code = "CATALOG_SERVICE_UNAVAILABLE";
    throw error;
  }

  const baseUrl = CATALOG_SERVICE_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/internal/rooms/${encodeURIComponent(roomCategoryId)}/pricing`;

  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-internal-service-key": INTERNAL_SERVICE_SECRET,
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch (cause) {
    const error = new Error("Could not communicate with Catalog Service");
    error.code = "CATALOG_SERVICE_UNAVAILABLE";
    error.cause = cause;
    throw error;
  }

  let result;

  try {
    result = await response.json();
  } catch {
    const error = new Error("Catalog Service returned an invalid response");
    error.code = "CATALOG_SERVICE_ERROR";
    throw error;
  }

  if (response.status === 404) {
    const error = new Error("Room category is not available");
    error.code = "ROOM_CATEGORY_NOT_AVAILABLE";
    throw error;
  }

  if (!response.ok) {
    const error = new Error("Catalog Service request failed");
    error.code =
      response.status >= 500
        ? "CATALOG_SERVICE_UNAVAILABLE"
        : "CATALOG_SERVICE_ERROR";
    throw error;
  }

  const pricing = result?.data;

  if (
    !pricing ||
    typeof pricing.roomCategoryId !== "string" ||
    typeof pricing.hotelId !== "string" ||
    typeof pricing.pricePerNight !== "number" ||
    !Number.isFinite(pricing.pricePerNight) ||
    pricing.pricePerNight < 0 ||
    typeof pricing.currency !== "string"
  ) {
    const error = new Error("Catalog Service returned incomplete pricing data");
    error.code = "CATALOG_SERVICE_ERROR";
    throw error;
  }

  return pricing;
};

export const getOwnerHotelIds = async (ownerId) => {
  const CATALOG_SERVICE_URL = getCatalogUrl();
  const INTERNAL_SERVICE_SECRET = getInternalSecret();

  if (!CATALOG_SERVICE_URL || !INTERNAL_SERVICE_SECRET) {
    const error = new Error("Catalog Service configuration is missing");
    error.code = "CATALOG_SERVICE_UNAVAILABLE";
    throw error;
  }

  if (!ownerId || typeof ownerId !== "string" || !ownerId.trim()) {
    const error = new Error("Owner ID is required");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  const baseUrl = CATALOG_SERVICE_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/internal/hotels/owner/${encodeURIComponent(ownerId.trim())}`;

  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-internal-service-key": INTERNAL_SERVICE_SECRET,
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch (cause) {
    const error = new Error("Could not communicate with Catalog Service");
    error.code = "CATALOG_SERVICE_UNAVAILABLE";
    error.cause = cause;
    throw error;
  }

  let result;

  try {
    result = await response.json();
  } catch {
    const error = new Error("Catalog Service returned an invalid response");
    error.code = "CATALOG_SERVICE_ERROR";
    throw error;
  }

  if (!response.ok) {
    const error = new Error("Catalog Service request failed");
    error.code =
      response.status >= 500
        ? "CATALOG_SERVICE_UNAVAILABLE"
        : "CATALOG_SERVICE_ERROR";
    throw error;
  }

  if (!result || !result.success || !Array.isArray(result.hotelIds)) {
    const error = new Error("Catalog Service returned incomplete owner hotel data");
    error.code = "CATALOG_SERVICE_ERROR";
    throw error;
  }

  return result.hotelIds;
};
