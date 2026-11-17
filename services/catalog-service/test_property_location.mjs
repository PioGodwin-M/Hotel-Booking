import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

import Hotel from "./src/models/Hotel.js";
import Room from "./src/models/Room.js";
import { validateLocationInput } from "./src/utils/locationValidator.js";
import {
  serializeOwnerHotel,
  serializePublicHotel,
  serializePublicRoom,
  serializePublicRoomList,
  computeDeterministicOffset,
  getApproximateAddress,
  getApproxRadiusMeters,
} from "./src/serializers/propertyLocationSerializer.js";

// Haversine distance in meters
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

async function runTests() {
  console.log("\n=======================================================");
  console.log(" CATALOG SERVICE PROPERTY LOCATION TEST SUITE (ROUND 4C)");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL: ${name}`);
      console.error(`        ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL: ${name}`);
      console.error(`        ${err.message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // SECTION 1: VALIDATION TESTS
  // ----------------------------------------------------
  console.log("--- 1. Coordinate & Precision Input Validation ---");

  test("Accepts valid exact coordinates", () => {
    const res = validateLocationInput({
      latitude: 11.0168,
      longitude: 76.9558,
      locationPrecision: "exact",
    });
    assert.equal(res.valid, true);
    assert.equal(res.data.latitude, 11.0168);
    assert.equal(res.data.longitude, 76.9558);
    assert.equal(res.data.locationPrecision, "exact");
  });

  test("Accepts valid approximate coordinates (default precision)", () => {
    const res = validateLocationInput({
      latitude: 28.6139,
      longitude: 77.209,
    });
    assert.equal(res.valid, true);
    assert.equal(res.data.locationPrecision, "exact"); // defaults to exact
  });

  test("Accepts locationPrecision = 'approximate'", () => {
    const res = validateLocationInput({
      latitude: 28.6139,
      longitude: 77.209,
      locationPrecision: "approximate",
    });
    assert.equal(res.valid, true);
    assert.equal(res.data.locationPrecision, "approximate");
  });

  test("Accepts null coordinates for clearing", () => {
    const res = validateLocationInput({
      latitude: null,
      longitude: null,
    });
    assert.equal(res.valid, true);
    assert.equal(res.data.latitude, null);
    assert.equal(res.data.longitude, null);
  });

  test("Rejects string coordinates", () => {
    const res = validateLocationInput({
      latitude: "11.0168",
      longitude: 76.9558,
    });
    assert.equal(res.valid, false);
    assert.match(res.error, /must be numbers/i);
  });

  test("Rejects NaN and Infinity coordinates", () => {
    const resNaN = validateLocationInput({
      latitude: NaN,
      longitude: 76.9558,
    });
    assert.equal(resNaN.valid, false);
    assert.match(resNaN.error, /finite numbers/i);

    const resInf = validateLocationInput({
      latitude: 11.0168,
      longitude: Infinity,
    });
    assert.equal(resInf.valid, false);
    assert.match(resInf.error, /finite numbers/i);
  });

  test("Rejects latitude out of range (> 90 or < -90)", () => {
    const resHigh = validateLocationInput({ latitude: 91.5, longitude: 0 });
    assert.equal(resHigh.valid, false);
    assert.match(resHigh.error, /between -90 and 90/i);

    const resLow = validateLocationInput({ latitude: -90.1, longitude: 0 });
    assert.equal(resLow.valid, false);
    assert.match(resLow.error, /between -90 and 90/i);
  });

  test("Rejects longitude out of range (> 180 or < -180)", () => {
    const resHigh = validateLocationInput({ latitude: 0, longitude: 180.5 });
    assert.equal(resHigh.valid, false);
    assert.match(resHigh.error, /between -180 and 180/i);

    const resLow = validateLocationInput({ latitude: 0, longitude: -181 });
    assert.equal(resLow.valid, false);
    assert.match(resLow.error, /between -180 and 180/i);
  });

  test("Rejects when only latitude is provided", () => {
    const res = validateLocationInput({ latitude: 11.0168 });
    assert.equal(res.valid, false);
    assert.match(res.error, /provided together/i);
  });

  test("Rejects when only longitude is provided", () => {
    const res = validateLocationInput({ longitude: 76.9558 });
    assert.equal(res.valid, false);
    assert.match(res.error, /provided together/i);
  });

  test("Rejects when one coordinate is null and the other is a number", () => {
    const res = validateLocationInput({ latitude: 11.0168, longitude: null });
    assert.equal(res.valid, false);
    assert.match(res.error, /provided together/i);
  });

  test("Rejects invalid locationPrecision values", () => {
    const res = validateLocationInput({
      latitude: 11.0168,
      longitude: 76.9558,
      locationPrecision: "super_precise",
    });
    assert.equal(res.valid, false);
    assert.match(res.error, /locationPrecision must be/i);
  });

  // ----------------------------------------------------
  // SECTION 2: PRIVACY & DETERMINISTIC OFFSET
  // ----------------------------------------------------
  console.log("\n--- 2. Privacy & Deterministic Offset Calculations ---");

  test("Deterministic offset produces identical coordinates across multiple invocations for the same ID", () => {
    const testId = new mongoose.Types.ObjectId().toString();
    const lat = 11.0168;
    const lng = 76.9558;
    const radius = 500;

    const offset1 = computeDeterministicOffset(testId, lat, lng, radius);
    const offset2 = computeDeterministicOffset(testId, lat, lng, radius);
    const offset3 = computeDeterministicOffset(testId, lat, lng, radius);

    assert.deepEqual(offset1, offset2);
    assert.deepEqual(offset2, offset3);
  });

  test("Deterministic offset differs from exact coordinates but remains strictly within stated radius", () => {
    const testId = new mongoose.Types.ObjectId().toString();
    const exactLat = 11.0168;
    const exactLng = 76.9558;
    const radius = 500;

    const publicCoords = computeDeterministicOffset(testId, exactLat, exactLng, radius);

    // Must not be identical to exact
    assert.notEqual(publicCoords.lat, exactLat);
    assert.notEqual(publicCoords.lng, exactLng);

    // Distance must be <= radius
    const dist = haversineDistanceMeters(exactLat, exactLng, publicCoords.lat, publicCoords.lng);
    assert.ok(
      dist <= radius,
      `Calculated distance ${dist.toFixed(1)}m exceeds radius ${radius}m`
    );
    assert.ok(
      dist >= radius * 0.3,
      `Calculated distance ${dist.toFixed(1)}m is too close to center (min 30% expected)`
    );
  });

  test("Address privacy returns structured area if present, otherwise city only (zero street address leak)", () => {
    // 1. With structured area
    const addrWithArea = getApproximateAddress({
      address: "1 Okitayama Washimine, Kita Ward",
      area: "Kita Ward",
      city: "Kyoto",
    });
    assert.equal(addrWithArea, "Kita Ward");

    // 2. Without structured area -> city only
    const addrWithoutArea = getApproximateAddress({
      address: "42 Ocean View Road, Marine Drive, Mumbai",
      area: null,
      city: "Mumbai",
    });
    assert.equal(addrWithoutArea, "Mumbai");
    assert.ok(!addrWithoutArea.includes("Ocean View"));

    // 3. Simple address -> city only
    const addrSimple = getApproximateAddress({
      address: "MG Road",
      city: "Chennai",
    });
    assert.equal(addrSimple, "Chennai");
  });

  // ----------------------------------------------------
  // SECTION 3: SHARED SERIALIZERS
  // ----------------------------------------------------
  console.log("\n--- 3. Canonical Serializer Output Contracts ---");

  test("Public serializer for EXACT property returns real coordinates and full address", () => {
    const raw = {
      _id: new mongoose.Types.ObjectId(),
      name: "Heritage Villa",
      address: "12 Palm Grove, Fort Kochi",
      city: "Kochi",
      latitude: 9.9656,
      longitude: 76.2421,
      locationPrecision: "exact",
    };

    const pub = serializePublicHotel(raw);

    assert.equal(pub.location.locationPrecision, "exact");
    assert.equal(pub.location.approximateRadiusMeters, null);
    assert.deepEqual(pub.location.publicCoordinates, { lat: 9.9656, lng: 76.2421 });
    assert.equal(pub.address, "12 Palm Grove, Fort Kochi"); // full address kept for exact
    assert.equal(pub.latitude, undefined); // raw exact coords stripped
    assert.equal(pub.longitude, undefined);
  });

  test("Public serializer for APPROXIMATE property masks address and coordinates", () => {
    // Case A: Structured area provided
    const rawWithArea = {
      _id: new mongoose.Types.ObjectId(),
      name: "Misty Mountain",
      address: "5 Upper Ridge Road, Old Manali",
      area: "Old Manali",
      city: "Manali",
      latitude: 32.253,
      longitude: 77.175,
      locationPrecision: "approximate",
    };

    const pubWithArea = serializePublicHotel(rawWithArea);

    assert.equal(pubWithArea.location.locationPrecision, "approximate");
    assert.equal(pubWithArea.location.approximateRadiusMeters, 500);
    assert.notEqual(pubWithArea.location.publicCoordinates.lat, 32.253);
    assert.notEqual(pubWithArea.location.publicCoordinates.lng, 77.175);
    assert.equal(pubWithArea.latitude, undefined);
    assert.equal(pubWithArea.longitude, undefined);
    assert.equal(pubWithArea.address, "Old Manali");
    assert.ok(!pubWithArea.address.includes("5 Upper Ridge Road"));

    // Case B: No structured area -> falls back to city only (never leaks street address)
    const rawWithoutArea = {
      _id: new mongoose.Types.ObjectId(),
      name: "Valley View",
      address: "14 Pine Trail, Manali",
      area: null,
      city: "Manali",
      latitude: 32.253,
      longitude: 77.175,
      locationPrecision: "approximate",
    };

    const pubWithoutArea = serializePublicHotel(rawWithoutArea);
    assert.equal(pubWithoutArea.address, "Manali");
    assert.ok(!pubWithoutArea.address.includes("Pine Trail"));
  });

  test("Public serializer for property without coordinates returns location: null", () => {
    const raw = {
      _id: new mongoose.Types.ObjectId(),
      name: "Classic Stay",
      address: "Station Road",
      city: "Jaipur",
      latitude: null,
      longitude: null,
      locationPrecision: "exact",
    };

    const pub = serializePublicHotel(raw);

    assert.equal(pub.location, null);
    assert.equal(pub.address, "Station Road");
    assert.equal(pub.latitude, undefined);
    assert.equal(pub.longitude, undefined);
  });

  test("Owner serializer returns ACTUAL coordinates for both exact and approximate", () => {
    const rawApprox = {
      _id: new mongoose.Types.ObjectId(),
      name: "Hideaway Cottage",
      address: "10 Hill View Lane, Ooty",
      city: "Ooty",
      latitude: 11.4102,
      longitude: 76.695,
      locationPrecision: "approximate",
    };

    const ownerRes = serializeOwnerHotel(rawApprox);

    assert.equal(ownerRes.location.locationPrecision, "approximate");
    assert.equal(ownerRes.location.approximateRadiusMeters, 500);
    // Owner MUST see the exact stored coordinates to edit the marker!
    assert.deepEqual(ownerRes.location.coordinates, { lat: 11.4102, lng: 76.695 });
    // Owner sees full address
    assert.equal(ownerRes.address, "10 Hill View Lane, Ooty");
  });

  test("serializePublicRoom and serializePublicRoomList enforce hotel privacy", () => {
    const room = {
      _id: new mongoose.Types.ObjectId(),
      roomType: "Deluxe Suite",
      pricePerNight: 8500,
      hotel: {
        _id: new mongoose.Types.ObjectId(),
        name: "Lake Palace",
        address: "7 Lakeside Road, Udaipur",
        city: "Udaipur",
        latitude: 24.5764,
        longitude: 73.6806,
        locationPrecision: "approximate",
      },
    };

    const serialized = serializePublicRoom(room);
    assert.ok(serialized.hotel.location);
    assert.equal(serialized.hotel.location.locationPrecision, "approximate");
    assert.equal(serialized.hotel.location.approximateRadiusMeters, 500);
    assert.equal(serialized.hotel.latitude, undefined);
    assert.equal(serialized.hotel.longitude, undefined);
    assert.equal(serialized.hotel.address, "Udaipur");

    const list = serializePublicRoomList([room]);
    assert.equal(list.length, 1);
    assert.equal(list[0].hotel.location.locationPrecision, "approximate");
  });

  // ----------------------------------------------------
  // SECTION 4: DATABASE & ENDPOINT INTEGRATION
  // ----------------------------------------------------
  console.log("\n--- 4. Database & Endpoint Lifecycle Integration ---");

  await testAsync("End-to-End Hotel Location Lifecycle (Create, Update, Query, Clear)", async () => {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME || "hotel_catalog" });

    const ownerA = "test_owner_integration_A";
    const ownerB = "test_owner_integration_B";

    // 1. Create Hotel with Exact Location as Owner A
    const created = await Hotel.create({
      name: "Integration Test Hotel",
      address: "100 Test Avenue, Electronic City",
      area: "Electronic City",
      contact: "+91 9999999999",
      city: "Bangalore",
      owner: ownerA,
      latitude: 12.8452,
      longitude: 77.6602,
      locationPrecision: "exact",
    });

    const ownerView1 = serializeOwnerHotel(created);
    assert.equal(ownerView1.location.locationPrecision, "exact");
    assert.deepEqual(ownerView1.location.coordinates, { lat: 12.8452, lng: 77.6602 });

    // 2. Public view of exact hotel
    const publicView1 = serializePublicHotel(created);
    assert.equal(publicView1.location.locationPrecision, "exact");
    assert.deepEqual(publicView1.location.publicCoordinates, { lat: 12.8452, lng: 77.6602 });
    assert.equal(publicView1.address, "100 Test Avenue, Electronic City");

    // 3. Update Hotel to Approximate Location as Owner A
    const updatedApprox = await Hotel.findByIdAndUpdate(
      created._id,
      {
        $set: {
          latitude: 12.8452,
          longitude: 77.6602,
          locationPrecision: "approximate",
        },
      },
      { new: true }
    );

    const ownerView2 = serializeOwnerHotel(updatedApprox);
    assert.equal(ownerView2.location.locationPrecision, "approximate");
    assert.equal(ownerView2.location.approximateRadiusMeters, 500);
    assert.deepEqual(ownerView2.location.coordinates, { lat: 12.8452, lng: 77.6602 });

    // Public view of approximate hotel
    const publicView2 = serializePublicHotel(updatedApprox);
    assert.equal(publicView2.location.locationPrecision, "approximate");
    assert.equal(publicView2.location.approximateRadiusMeters, 500);
    assert.notEqual(publicView2.location.publicCoordinates.lat, 12.8452);
    assert.notEqual(publicView2.location.publicCoordinates.lng, 77.6602);
    assert.equal(publicView2.address, "Electronic City"); // street stripped

    // 4. Clear location (null coords)
    const cleared = await Hotel.findByIdAndUpdate(
      created._id,
      {
        $set: {
          latitude: null,
          longitude: null,
        },
      },
      { new: true }
    );

    const ownerView3 = serializeOwnerHotel(cleared);
    assert.equal(ownerView3.location, null);

    const publicView3 = serializePublicHotel(cleared);
    assert.equal(publicView3.location, null);

    // Clean up
    await Hotel.findByIdAndDelete(created._id);
    await mongoose.disconnect();
  });

  console.log("\n=======================================================");
  console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});
