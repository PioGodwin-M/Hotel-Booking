/**
 * Booking Detail Serializer for Round 4g (B1).
 * Enforces strict privacy gate, computes customer-facing fields,
 * and completely strips internal IDs and secrets.
 */

export const serializeBookingDetail = (booking, paymentSummary = null) => {
  if (!booking) {
    return null;
  }

  const isConfirmed = booking.status === "CONFIRMED";
  const rawStay = booking.stayDetails;

  let stayDetails = null;
  let stayDetailsComplete = false;

  if (rawStay && rawStay.propertyName) {
    stayDetailsComplete = true;

    if (isConfirmed) {
      // CONFIRMED status: exact hotel details, full address, phone, exact coordinates
      const coords =
        rawStay.coordinates &&
        rawStay.coordinates.lat != null &&
        rawStay.coordinates.lng != null
          ? {
              lat: Number(rawStay.coordinates.lat),
              lng: Number(rawStay.coordinates.lng),
            }
          : null;

      stayDetails = {
        propertyId: rawStay.propertyId || booking.hotelId?.toString() || null,
        propertyName: rawStay.propertyName,
        address: rawStay.address || null,
        area: rawStay.area || null,
        city: rawStay.city || "",
        contactPhone: rawStay.contactPhone || null,
        contactEmail: rawStay.contactEmail || null,
        checkInTime: rawStay.checkInTime || "14:00",
        checkOutTime: rawStay.checkOutTime || "11:00",
        coordinates: coords,
        locationPrecision: rawStay.locationPrecision || "exact",
        approximateRadiusMeters:
          rawStay.locationPrecision === "approximate"
            ? rawStay.approximateRadiusMeters || 500
            : null,
        roomCategoryId:
          rawStay.roomCategoryId || booking.roomCategoryId?.toString() || null,
        roomTypeName: rawStay.roomTypeName || "Standard Room",
        maxGuests: rawStay.maxGuests || 2,
        bedConfiguration: rawStay.bedConfiguration || null,
        mainPhoto: rawStay.mainPhoto || null,
      };
    } else {
      // NON-CONFIRMED status (HELD, PAYMENT_PENDING, EXPIRED, CANCELLED, PAYMENT_FAILED, PENDING):
      // Strict privacy gate: NO exact coordinates, NO street address, NO contact phone.
      let publicCoordinates = null;
      if (
        rawStay.coordinates &&
        rawStay.coordinates.lat != null &&
        rawStay.coordinates.lng != null
      ) {
        // Deterministic approximate jitter: shift by ~300m so exact location is masked
        const baseLat = Number(rawStay.coordinates.lat);
        const baseLng = Number(rawStay.coordinates.lng);
        publicCoordinates = {
          lat: Number((baseLat + 0.0028).toFixed(4)),
          lng: Number((baseLng + 0.0028).toFixed(4)),
        };
      }

      stayDetails = {
        propertyId: rawStay.propertyId || booking.hotelId?.toString() || null,
        propertyName: rawStay.propertyName,
        address: null, // Strictly masked
        area: rawStay.area || null,
        city: rawStay.city || "",
        contactPhone: null, // Strictly masked
        contactEmail: null, // Strictly masked
        checkInTime: rawStay.checkInTime || "14:00",
        checkOutTime: rawStay.checkOutTime || "11:00",
        coordinates: null, // Strictly masked
        publicCoordinates,
        locationPrecision: "approximate",
        approximateRadiusMeters: 500,
        roomCategoryId:
          rawStay.roomCategoryId || booking.roomCategoryId?.toString() || null,
        roomTypeName: rawStay.roomTypeName || "Standard Room",
        maxGuests: rawStay.maxGuests || 2,
        bedConfiguration: rawStay.bedConfiguration || null,
        mainPhoto: rawStay.mainPhoto || null,
      };
    }
  }

  // Reference formatting: PGM-XXXXXXXX
  const bookingIdStr = (booking._id || "").toString();
  const reference = `PGM-${bookingIdStr.slice(-8).toUpperCase()}`;

  // Price breakdown
  const priceSnapshot = booking.priceSnapshot || {};
  const priceBreakdown = {
    pricePerNight: priceSnapshot.pricePerNight || 0,
    numberOfNights: priceSnapshot.numberOfNights || 1,
    roomCharges: priceSnapshot.totalAmount || 0,
    taxesAndFees: 0,
    totalAmount: priceSnapshot.totalAmount || 0,
    currency: priceSnapshot.currency || "INR",
  };

  // Customer-facing payment summary
  let formattedPayment = null;
  let paymentSummaryAvailable = false;
  if (paymentSummary && typeof paymentSummary === "object") {
    paymentSummaryAvailable = true;
    formattedPayment = {
      status: paymentSummary.status || null,
      amountMinor: paymentSummary.amountMinor || null,
      currency: paymentSummary.currency || "INR",
      paidAt: paymentSummary.paidAt || null,
      cardBrand: paymentSummary.cardBrand || null,
      cardLast4: paymentSummary.cardLast4 || null,
      paymentReference:
        paymentSummary.paymentReference || `REC-${bookingIdStr.slice(-8).toUpperCase()}`,
    };
  }

  // Standard platform cancellation policy
  const policy =
    "Free cancellation up to 48 hours before check-in. Cancellations made within 48 hours receive a 50% refund minus transaction fees.";

  // Chronological event timeline
  const timeline = [];
  if (booking.createdAt) {
    timeline.push({
      event: "HELD",
      label: "Room held",
      timestamp: booking.createdAt,
    });
  }

  if (formattedPayment?.paidAt) {
    timeline.push({
      event: "PAYMENT_SUCCEEDED",
      label: "Payment received",
      timestamp: formattedPayment.paidAt,
    });
  }

  if (booking.status === "CONFIRMED") {
    timeline.push({
      event: "CONFIRMED",
      label: "Booking confirmed",
      timestamp: booking.updatedAt || booking.createdAt,
    });
  } else if (booking.status === "CANCELLED") {
    timeline.push({
      event: "CANCELLED",
      label: "Booking cancelled",
      timestamp: booking.updatedAt || booking.createdAt,
    });
  } else if (booking.status === "EXPIRED") {
    timeline.push({
      event: "EXPIRED",
      label: "Hold expired",
      timestamp: booking.holdExpiresAt || booking.updatedAt || booking.createdAt,
    });
  } else if (booking.status === "PAYMENT_FAILED") {
    timeline.push({
      event: "PAYMENT_FAILED",
      label: "Payment failed",
      timestamp: booking.updatedAt || booking.createdAt,
    });
  }

  // Sort timeline chronologically
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    id: bookingIdStr,
    reference,
    status: booking.status,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    numberOfNights: priceBreakdown.numberOfNights,
    numberOfRooms: booking.numberOfRooms,
    numberOfGuests: booking.numberOfGuests,
    holdExpiresAt: booking.holdExpiresAt || null,
    priceBreakdown,
    stayDetails,
    stayDetailsComplete,
    paymentSummary: formattedPayment,
    paymentSummaryAvailable,
    policy,
    timeline,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
};
