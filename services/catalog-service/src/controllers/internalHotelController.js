import Hotel from "../models/Hotel.js";

/**
 * GET /internal/hotels/owner/:ownerId
 * Internal endpoint for inter-service communication (e.g. Booking Service).
 * Returns array of hotel IDs owned by the given ownerId.
 * Includes both ACTIVE and INACTIVE hotels to preserve historical metrics.
 * Excludes only hotels explicitly marked DELETING.
 */
export const getOwnerHotelsInternal = async (req, res, next) => {
  try {
    const { ownerId } = req.params;

    if (!ownerId || typeof ownerId !== "string" || !ownerId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Owner ID is required",
      });
    }

    const hotels = await Hotel.find({
      owner: ownerId.trim(),
      status: { $ne: "DELETING" },
    })
      .select("_id")
      .lean();

    const hotelIds = hotels.map((h) => h._id.toString());

    return res.status(200).json({
      success: true,
      hotelIds,
    });
  } catch (error) {
    next(error);
  }
};
