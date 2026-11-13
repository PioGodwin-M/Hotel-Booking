import mongoose from "mongoose";
import Booking from "../models/Booking.js";

/**
 * Aggregates owner metrics and recent bookings across specified hotels.
 *
 * Mandatory safeguards:
 * - Empty hotelIds returns zero metrics immediately without database scan.
 * - Revenue is calculated ONLY from bookings with status "CONFIRMED".
 * - Multi-currency revenue is never summed into a single number.
 * - Bounded query limits recent bookings to top 20 documents.
 */
export const getOwnerDashboardMetrics = async (hotelIds = []) => {
  // Safeguard: If no hotels are owned, return zero metrics without querying
  if (!Array.isArray(hotelIds) || hotelIds.length === 0) {
    return {
      totalBookings: 0,
      totalRevenue: 0,
      currency: "INR",
      revenueByCurrency: {},
      statusBreakdown: {},
      bookings: [],
    };
  }

  // Convert valid hotel string IDs to ObjectIds
  const validHotelObjectIds = hotelIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (validHotelObjectIds.length === 0) {
    return {
      totalBookings: 0,
      totalRevenue: 0,
      currency: "INR",
      revenueByCurrency: {},
      statusBreakdown: {},
      bookings: [],
    };
  }

  const [aggregationResult] = await Booking.aggregate([
    {
      $match: {
        hotelId: { $in: validHotelObjectIds },
      },
    },
    {
      $facet: {
        // 1. Total gross bookings across all recorded statuses
        totalBookingsCount: [
          { $count: "count" },
        ],

        // 2. Confirmed revenue grouped strictly by currency
        confirmedRevenue: [
          { $match: { status: "CONFIRMED" } },
          {
            $group: {
              _id: { $ifNull: ["$priceSnapshot.currency", "INR"] },
              total: { $sum: "$priceSnapshot.totalAmount" },
            },
          },
        ],

        // 3. Operational status breakdown
        statusCounts: [
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ],

        // 4. Bounded recent bookings query (top 20 documents)
        recentBookings: [
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: 20 },
          {
            $project: {
              _id: 1,
              hotelId: 1,
              roomCategoryId: 1,
              checkIn: 1,
              checkOut: 1,
              numberOfRooms: 1,
              numberOfGuests: 1,
              priceSnapshot: 1,
              status: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
  ]);

  const totalBookings = aggregationResult?.totalBookingsCount?.[0]?.count || 0;

  // Build authoritative revenueByCurrency map
  const revenueByCurrency = {};
  if (Array.isArray(aggregationResult?.confirmedRevenue)) {
    for (const entry of aggregationResult.confirmedRevenue) {
      if (entry._id) {
        revenueByCurrency[entry._id] = entry.total;
      }
    }
  }

  // Strict currency handling:
  // - 0 currencies: 0 revenue in INR
  // - 1 currency: return numeric totalRevenue and currency
  // - Multiple currencies: never sum them; totalRevenue is null and currency is "MULTI"
  const distinctCurrencies = Object.keys(revenueByCurrency);
  let totalRevenue = 0;
  let currency = "INR";

  if (distinctCurrencies.length === 1) {
    currency = distinctCurrencies[0];
    totalRevenue = revenueByCurrency[currency];
  } else if (distinctCurrencies.length > 1) {
    currency = "MULTI";
    totalRevenue = null; // Do NOT sum cross-currency amounts
  }

  // Build status breakdown map
  const statusBreakdown = {};
  if (Array.isArray(aggregationResult?.statusCounts)) {
    for (const entry of aggregationResult.statusCounts) {
      if (entry._id) {
        statusBreakdown[entry._id] = entry.count;
      }
    }
  }

  // Format recent bookings with backwards-compatible helper fields
  const formattedBookings = (aggregationResult?.recentBookings || []).map((b) => ({
    _id: b._id,
    hotelId: b.hotelId,
    roomCategoryId: b.roomCategoryId,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    numberOfRooms: b.numberOfRooms,
    numberOfGuests: b.numberOfGuests,
    priceSnapshot: b.priceSnapshot,
    totalAmount: b.priceSnapshot?.totalAmount ?? 0,
    status: b.status,
    isPaid: b.status === "CONFIRMED",
    createdAt: b.createdAt,
  }));

  return {
    totalBookings,
    totalRevenue,
    currency,
    revenueByCurrency,
    statusBreakdown,
    bookings: formattedBookings,
  };
};
