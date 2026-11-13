import { getAuth } from "@clerk/express";

import { getOwnerHotelIds } from "../services/catalogClient.js";
import { getOwnerDashboardMetrics } from "../services/ownerDashboardService.js";

/**
 * GET /api/bookings/owner
 * Owner dashboard aggregation endpoint.
 *
 * Derives owner identity exclusively from authenticated Clerk session (getAuth(req).userId).
 * Never accepts ownerId from frontend request parameters.
 */
export const getOwnerDashboardController = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Look up hotel IDs historically owned by this authenticated user
    let hotelIds = [];
    try {
      hotelIds = await getOwnerHotelIds(userId);
    } catch (catalogError) {
      if (catalogError.code === "CATALOG_SERVICE_UNAVAILABLE") {
        return res.status(503).json({
          success: false,
          message: "Hotel catalog service is temporarily unavailable",
        });
      }
      throw catalogError;
    }

    // Execute scoped MongoDB aggregation
    const metrics = await getOwnerDashboardMetrics(hotelIds);

    return res.status(200).json({
      success: true,
      ...metrics,
    });
  } catch (error) {
    next(error);
  }
};
