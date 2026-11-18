import mongoose from "mongoose";
import { strict as assert } from "node:assert";

process.env.BOOKING_SERVICE_URL = "http://localhost:4003";
process.env.CATALOG_SERVICE_URL = "http://localhost:4002";
process.env.PAYMENT_SERVICE_URL = "http://localhost:4004";
process.env.API_GATEWAY_URL = "http://localhost:4000";
process.env.INTERNAL_SERVICE_SECRET = "123fhg5637$vjvksdmrivshvr74%373^@$!gfheinc67";
process.env.PAYMENT_SERVICE_SECRET = "uhk23&fd34%$@^uyb%fDSFSRG43!564243@4635uyvdcsbuy47t3286t4376fgdwvvdyg28136389134625$$@^wFJB%27DB8VCB";

const MONGO_URI = "mongodb+srv://piogodwin7:piogodwin2007@cluster0.fqbb8.mongodb.net";

console.log("=================================================");
console.log("  ROUND 4G: STAGE 1 BACKEND VERIFICATION SUITE   ");
console.log("=================================================");

async function runTests() {
  let passed = 0;
  let total = 0;

  const test = async (name, fn) => {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(err);
    }
  };

  // Connect default mongoose connection for Booking & RoomInventory models
  await mongoose.connect(`${MONGO_URI}/hotel_booking`);

  // Secondary connections for Catalog & Payment DBs
  const catalogConn = await mongoose.createConnection(`${MONGO_URI}/hotel_catalog`).asPromise();
  const paymentConn = await mongoose.createConnection(`${MONGO_URI}/hotel_payment`).asPromise();

  const Hotel = catalogConn.model("Hotel", new mongoose.Schema({}, { strict: false }));
  const Room = catalogConn.model("Room", new mongoose.Schema({}, { strict: false }));
  const Payment = paymentConn.model("Payment", new mongoose.Schema({}, { strict: false }));

  // Import booking service models using default mongoose connection
  const { default: Booking } = await import("./src/models/Booking.js");
  const { default: RoomInventory } = await import("./src/models/RoomInventory.js");

  // Pick a real hotel with coordinates and an active room
  const hotelsWithCoords = await Hotel.find({ latitude: { $ne: null } }).lean();
  let testHotel = null;
  let testRoom = null;

  for (const h of hotelsWithCoords) {
    const room = await Room.findOne({ hotel: h._id, isActive: true }).lean();
    if (room) {
      testHotel = h;
      testRoom = room;
      break;
    }
  }

  // Fallback if none found: take any active room and ensure its hotel has coords
  if (!testHotel || !testRoom) {
    testRoom = await Room.findOne({ isActive: true }).lean();
    assert(testRoom, "Must have an active room in catalog");
    testHotel = await Hotel.findById(testRoom.hotel).lean();
    if (!testHotel.latitude) {
      await Hotel.updateOne(
        { _id: testHotel._id },
        { $set: { latitude: 18.922, longitude: 72.8347, locationPrecision: "exact" } }
      );
      testHotel.latitude = 18.922;
      testHotel.longitude = 72.8347;
      testHotel.locationPrecision = "exact";
    }
  }

  // Ensure RoomInventory exists in hotel_booking
  let roomInv = await RoomInventory.findOne({
    roomCategoryId: testRoom._id,
    hotelId: testHotel._id,
  });
  if (!roomInv) {
    await RoomInventory.create({
      roomCategoryId: testRoom._id,
      hotelId: testHotel._id,
      totalUnits: 10,
      isActive: true,
    });
  }

  const ownerUserId = "user_test_owner_round4g_" + Date.now();
  const otherUserId = "user_test_intruder_round4g_" + Date.now();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Internal Catalog Snapshot endpoint (B3)
    // -------------------------------------------------------------------------
    await test("1. Catalog Service internal snapshot endpoint requires authentication", async () => {
      // Without key -> 401
      const resUnauth = await fetch(
        `${process.env.CATALOG_SERVICE_URL}/internal/properties/${testHotel._id}/booking-snapshot?roomId=${testRoom._id}`
      );
      assert.equal(resUnauth.status, 401, "Expected 401 without x-internal-service-key");

      // With invalid key -> 401
      const resBad = await fetch(
        `${process.env.CATALOG_SERVICE_URL}/internal/properties/${testHotel._id}/booking-snapshot?roomId=${testRoom._id}`,
        { headers: { "x-internal-service-key": "invalid-secret" } }
      );
      assert.equal(resBad.status, 401, "Expected 401 with bad x-internal-service-key");

      // With valid key -> 200 and full snapshot data
      const resAuth = await fetch(
        `${process.env.CATALOG_SERVICE_URL}/internal/properties/${testHotel._id}/booking-snapshot?roomId=${testRoom._id}`,
        { headers: { "x-internal-service-key": process.env.INTERNAL_SERVICE_SECRET } }
      );
      assert.equal(resAuth.status, 200, "Expected 200 with valid key");
      const json = await resAuth.json();
      assert.equal(json.success, true);
      assert.equal(json.data.propertyName, testHotel.name);
      assert.equal(json.data.address, testHotel.address);
      assert.ok(json.data.coordinates !== null, "Expected coordinates to not be null");
      assert.ok(typeof json.data.coordinates.lat === "number", "Expected coordinates.lat to be a number");
      assert.ok(typeof json.data.coordinates.lng === "number", "Expected coordinates.lng to be a number");
    });

    // -------------------------------------------------------------------------
    // TEST 2: Internal Payment Summary endpoint (B5)
    // -------------------------------------------------------------------------
    await test("2. Payment Service internal summary endpoint requires authentication & returns customer-safe data", async () => {
      const dummyBookingId = new mongoose.Types.ObjectId();

      // Create a test payment record
      await Payment.create({
        paymentId: `pay_test_${Date.now()}`,
        bookingId: dummyBookingId,
        userId: ownerUserId,
        amountMinor: 2500000,
        currency: "INR",
        provider: "STRIPE",
        stripePaymentIntentId: `pi_test_secret_${Date.now()}`,
        status: "SUCCEEDED",
        paidAt: new Date(),
        cardBrand: "visa",
        cardLast4: "4242",
        paymentReference: `REC-${dummyBookingId.toString().slice(-8).toUpperCase()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Without key -> 401
      const resUnauth = await fetch(
        `${process.env.PAYMENT_SERVICE_URL}/internal/payments/booking/${dummyBookingId}/summary`
      );
      assert.equal(resUnauth.status, 401, "Expected 401 without x-payment-service-key");

      // With valid key -> 200
      const resAuth = await fetch(
        `${process.env.PAYMENT_SERVICE_URL}/internal/payments/booking/${dummyBookingId}/summary`,
        { headers: { "x-payment-service-key": process.env.PAYMENT_SERVICE_SECRET } }
      );
      assert.equal(resAuth.status, 200);
      const json = await resAuth.json();
      assert.equal(json.success, true);
      assert.equal(json.data.cardBrand, "visa");
      assert.equal(json.data.cardLast4, "4242");
      assert.equal(json.data.amountMinor, 2500000);
      // Verify no stripePaymentIntentId leaked in summary!
      assert.strictEqual(json.data.stripePaymentIntentId, undefined);

      // Clean up
      await Payment.deleteOne({ bookingId: dummyBookingId });
    });

    // -------------------------------------------------------------------------
    // TEST 3: Gateway isolation - /internal routes are unreachable via API Gateway
    // -------------------------------------------------------------------------
    await test("3. API Gateway isolates internal endpoints (returns 404)", async () => {
      const resGateway1 = await fetch(
        `${process.env.API_GATEWAY_URL}/internal/properties/${testHotel._id}/booking-snapshot`,
        { headers: { "x-internal-service-key": process.env.INTERNAL_SERVICE_SECRET } }
      );
      assert.equal(resGateway1.status, 404, "Gateway must return 404 for /internal/*");

      const resGateway2 = await fetch(
        `${process.env.API_GATEWAY_URL}/api/hotels/internal/properties/${testHotel._id}/booking-snapshot`,
        { headers: { "x-internal-service-key": process.env.INTERNAL_SERVICE_SECRET } }
      );
      assert.equal(resGateway2.status, 404, "Gateway must return 404 for rewritten internal paths");
    });

    // -------------------------------------------------------------------------
    // TEST 4: Serializer privacy gate - CONFIRMED vs HELD / NON-CONFIRMED
    // -------------------------------------------------------------------------
    await test("4. Privacy Gate: CONFIRMED reveals exact coordinates & address; HELD strictly masks them", async () => {
      const { serializeBookingDetail } = await import("./src/serializers/bookingDetailSerializer.js");

      const rawSnapshot = {
        propertyId: testHotel._id.toString(),
        propertyName: testHotel.name,
        address: "123 Top Secret Street, Exact Suite 404",
        area: "Marine Drive",
        city: "Mumbai",
        contactPhone: "+91 9999988888",
        contactEmail: "secret@hotel.com",
        checkInTime: "14:00",
        checkOutTime: "11:00",
        coordinates: { lat: 18.9220, lng: 72.8347 },
        locationPrecision: "exact",
        roomTypeName: "Deluxe Suite",
        maxGuests: 2,
        mainPhoto: "https://example.com/photo.jpg",
      };

      // 4A: CONFIRMED booking
      const confirmedBooking = {
        _id: new mongoose.Types.ObjectId(),
        userId: ownerUserId,
        hotelId: testHotel._id,
        roomCategoryId: testRoom._id,
        checkIn: new Date("2026-12-01"),
        checkOut: new Date("2026-12-03"),
        numberOfRooms: 1,
        numberOfGuests: 2,
        priceSnapshot: {
          pricePerNight: 5000,
          numberOfNights: 2,
          totalAmount: 10000,
          currency: "INR",
        },
        status: "CONFIRMED",
        stayDetails: rawSnapshot,
        createdAt: new Date("2026-11-01T10:00:00Z"),
        updatedAt: new Date("2026-11-01T10:05:00Z"),
      };

      const paymentSummary = {
        status: "SUCCEEDED",
        amountMinor: 1000000,
        currency: "INR",
        paidAt: new Date("2026-11-01T10:04:00Z"),
        cardBrand: "mastercard",
        cardLast4: "5555",
        paymentReference: "REC-TEST1234",
      };

      const serializedConfirmed = serializeBookingDetail(confirmedBooking, paymentSummary);

      assert.equal(serializedConfirmed.status, "CONFIRMED");
      assert.equal(serializedConfirmed.stayDetails.address, "123 Top Secret Street, Exact Suite 404");
      assert.equal(serializedConfirmed.stayDetails.contactPhone, "+91 9999988888");
      assert.deepEqual(serializedConfirmed.stayDetails.coordinates, { lat: 18.9220, lng: 72.8347 });
      assert.equal(serializedConfirmed.stayDetailsComplete, true);
      assert.equal(serializedConfirmed.paymentSummaryAvailable, true);
      assert.equal(serializedConfirmed.paymentSummary.cardLast4, "5555");
      assert.equal(serializedConfirmed.timeline.length, 3); // HELD, PAYMENT_SUCCEEDED, CONFIRMED
      assert.strictEqual(serializedConfirmed.paymentId, undefined);
      assert.strictEqual(serializedConfirmed.idempotencyKey, undefined);

      // 4B: HELD booking (privacy gate MUST mask exact coordinates & address & contact)
      const heldBooking = {
        ...confirmedBooking,
        _id: new mongoose.Types.ObjectId(),
        status: "HELD",
        holdExpiresAt: new Date(Date.now() + 600000),
      };

      const serializedHeld = serializeBookingDetail(heldBooking, null);

      assert.equal(serializedHeld.status, "HELD");
      assert.strictEqual(serializedHeld.stayDetails.address, null, "Street address must be strictly null for HELD");
      assert.strictEqual(serializedHeld.stayDetails.contactPhone, null, "Contact phone must be strictly null for HELD");
      assert.strictEqual(serializedHeld.stayDetails.coordinates, null, "Exact coordinates must be strictly null for HELD");
      assert.ok(serializedHeld.stayDetails.publicCoordinates !== null, "Public approximate coordinates should exist");
      assert.notDeepEqual(serializedHeld.stayDetails.publicCoordinates, { lat: 18.9220, lng: 72.8347 });
      assert.equal(serializedHeld.stayDetails.locationPrecision, "approximate");
      assert.equal(serializedHeld.stayDetails.approximateRadiusMeters, 500);

      // 4C: CANCELLED / EXPIRED booking (also strictly masked)
      const expiredBooking = {
        ...confirmedBooking,
        _id: new mongoose.Types.ObjectId(),
        status: "EXPIRED",
      };
      const serializedExpired = serializeBookingDetail(expiredBooking, null);
      assert.strictEqual(serializedExpired.stayDetails.address, null);
      assert.strictEqual(serializedExpired.stayDetails.coordinates, null);
      assert.strictEqual(serializedExpired.stayDetails.contactPhone, null);
    });

    // -------------------------------------------------------------------------
    // TEST 5: Lazy snapshot fill for existing confirmed bookings (B4)
    // -------------------------------------------------------------------------
    await test("5. Lazy snapshot fill for existing CONFIRMED booking without stayDetails", async () => {
      const { getBookingById } = await import("./src/services/bookingQueryService.js");

      // Insert an old booking directly into MongoDB with stayDetails: undefined/null
      const oldBookingDoc = await Booking.create({
        userId: ownerUserId,
        hotelId: testHotel._id,
        roomCategoryId: testRoom._id,
        checkIn: new Date("2026-12-10"),
        checkOut: new Date("2026-12-12"),
        numberOfRooms: 1,
        numberOfGuests: 2,
        priceSnapshot: {
          pricePerNight: 4000,
          numberOfNights: 2,
          totalAmount: 8000,
          currency: "INR",
        },
        status: "CONFIRMED",
        idempotencyKey: `idemp_${Date.now()}`,
        requestFingerprint: "fingerprint_old_test",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Query through getBookingById
      const result = await getBookingById({
        bookingId: oldBookingDoc._id.toString(),
        userId: ownerUserId,
      });

      assert.equal(result.id, oldBookingDoc._id.toString());
      assert.equal(result.status, "CONFIRMED");
      assert.ok(result.stayDetails !== null, "stayDetails should be lazily populated");
      assert.equal(result.stayDetails.propertyName, testHotel.name);
      assert.equal(result.stayDetailsComplete, true);

      // Verify that MongoDB was updated with stayDetails
      const updatedInDb = await Booking.findById(oldBookingDoc._id).lean();
      assert.ok(updatedInDb.stayDetails !== null, "MongoDB document must now have stayDetails saved");
      assert.equal(updatedInDb.stayDetails.propertyName, testHotel.name);

      // Clean up
      await Booking.deleteOne({ _id: oldBookingDoc._id });
    });

    // -------------------------------------------------------------------------
    // TEST 6: Ownership enforcement (B1)
    // -------------------------------------------------------------------------
    await test("6. Ownership enforcement: non-owner gets 404 (does not leak existence)", async () => {
      const { getBookingById } = await import("./src/services/bookingQueryService.js");

      const privateBooking = await Booking.create({
        userId: ownerUserId,
        hotelId: testHotel._id,
        roomCategoryId: testRoom._id,
        checkIn: new Date("2026-12-15"),
        checkOut: new Date("2026-12-16"),
        numberOfRooms: 1,
        numberOfGuests: 1,
        priceSnapshot: {
          pricePerNight: 3000,
          numberOfNights: 1,
          totalAmount: 3000,
          currency: "INR",
        },
        status: "CONFIRMED",
        idempotencyKey: `idemp_${Date.now()}`,
        requestFingerprint: "fingerprint_private_test",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      let errorThrown = null;
      try {
        await getBookingById({
          bookingId: privateBooking._id.toString(),
          userId: otherUserId, // Intruder user
        });
      } catch (err) {
        errorThrown = err;
      }

      assert.ok(errorThrown !== null, "Expected error to be thrown for non-owner");
      assert.equal(errorThrown.code, "BOOKING_NOT_FOUND");
      assert.equal(errorThrown.message, "Booking not found");

      // Clean up
      await Booking.deleteOne({ _id: privateBooking._id });
    });

    // -------------------------------------------------------------------------
    // TEST 7: Best-effort failure isolation (Catalog or Payment down)
    // -------------------------------------------------------------------------
    await test("7. Best-effort resilience: payment summary failure does not crash booking detail retrieval", async () => {
      const { getBookingById } = await import("./src/services/bookingQueryService.js");

      // Booking with no payment record
      const noPaymentBooking = await Booking.create({
        userId: ownerUserId,
        hotelId: testHotel._id,
        roomCategoryId: testRoom._id,
        checkIn: new Date("2026-12-20"),
        checkOut: new Date("2026-12-21"),
        numberOfRooms: 1,
        numberOfGuests: 2,
        priceSnapshot: {
          pricePerNight: 6000,
          numberOfNights: 1,
          totalAmount: 6000,
          currency: "INR",
        },
        status: "HELD",
        idempotencyKey: `idemp_${Date.now()}`,
        requestFingerprint: "fingerprint_nopay_test",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await getBookingById({
        bookingId: noPaymentBooking._id.toString(),
        userId: ownerUserId,
      });

      assert.equal(result.id, noPaymentBooking._id.toString());
      assert.strictEqual(result.paymentSummary, null);
      assert.equal(result.paymentSummaryAvailable, false);
      assert.ok(result.stayDetails !== null);

      // Clean up
      await Booking.deleteOne({ _id: noPaymentBooking._id });
    });

    // -------------------------------------------------------------------------
    // TEST 8: Hold creation captures stayDetails snapshot (B2)
    // -------------------------------------------------------------------------
    await test("8. createBooking captures stayDetails snapshot at hold creation", async () => {
      const { createBooking } = await import("./src/services/bookingService.js");

      const checkIn = new Date(Date.now() + 86400000 * 10);
      const checkOut = new Date(Date.now() + 86400000 * 12);

      const booking = await createBooking({
        userId: ownerUserId,
        hotelId: testHotel._id.toString(),
        roomCategoryId: testRoom._id.toString(),
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        numberOfRooms: 1,
        numberOfGuests: 2,
        idempotencyKey: `idemp_hold_${Date.now()}`,
      });

      assert.equal(booking.status, "HELD");
      assert.ok(booking.stayDetails !== null, "stayDetails snapshot should be captured on created booking");
      assert.equal(booking.stayDetails.propertyName, testHotel.name);
      assert.equal(booking.stayDetails.city, testHotel.city);

      // Clean up
      await Booking.deleteOne({ _id: booking._id });
    });

  } finally {
    await mongoose.disconnect();
    await catalogConn.close();
    await paymentConn.close();
  }

  console.log("=================================================");
  console.log(`  SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log("=================================================");
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("FATAL TEST ERROR:", err);
  process.exit(1);
});
