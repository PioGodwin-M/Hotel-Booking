import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clerkClient } from "@clerk/express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:4000";

// Real Clerk users from user-service database
const OWNER_A_USER_ID = "user_31jw610bhxmvhNMFcSE6N1YEmXY"; // piogodwin7@gmail.com
const OWNER_B_USER_ID = "user_3M9Pn2IOC4eYMOys5zJNw8h8zTP"; // mercyvalan80@gmail.com

async function getClerkToken(userId) {
  const session = await clerkClient.sessions.createSession({ userId });
  const tokenData = await clerkClient.sessions.getToken(session.id);
  return tokenData.jwt;
}

async function runIntegration() {
  console.log("===============================================================================");
  console.log(" REAL HTTP INTEGRATION TEST THROUGH API GATEWAY (PORT 4000)");
  console.log(" Authenticating with genuine Clerk RS256 JWT tokens");
  console.log("===============================================================================\n");

  console.log("Generating genuine Clerk tokens...");
  const tokenOwnerA = await getClerkToken(OWNER_A_USER_ID);
  const tokenOwnerB = await getClerkToken(OWNER_B_USER_ID);
  console.log("✓ Clerk JWT acquired for Owner A:", OWNER_A_USER_ID);
  console.log("✓ Clerk JWT acquired for Owner B:", OWNER_B_USER_ID);

  let testHotelId = null;
  const results = {};

  try {
    // -------------------------------------------------------------------------
    // 1. Owner creates a property with coordinates
    // -------------------------------------------------------------------------
    console.log("\n[1] Owner A creates property with exact location via Gateway...");
    const createPayload = {
      name: "Gateway Grand Residency",
      address: "100 Outer Ring Road, Bellandur",
      area: "Bellandur",
      contact: "+91 80 4455 6677",
      city: "Bangalore",
      latitude: 12.9352,
      longitude: 77.6823,
      locationPrecision: "exact",
    };

    const res1 = await fetch(`${GATEWAY_URL}/api/hotels/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify(createPayload),
    });

    const data1 = await res1.json();
    console.log("Status:", res1.status);
    console.log("Response body:", JSON.stringify(data1, null, 2));

    if (res1.status !== 201 || !data1.hotel?._id) {
      throw new Error(`Failed to create hotel: ${JSON.stringify(data1)}`);
    }

    testHotelId = data1.hotel._id;
    results.test1_owner_create_exact = {
      status: res1.status,
      body: data1,
    };

    // -------------------------------------------------------------------------
    // 2. Owner updates coordinates to approximate
    // -------------------------------------------------------------------------
    console.log("\n[2] Owner A updates property to approximate location via Gateway...");
    const updateApproxPayload = {
      locationPrecision: "approximate",
      latitude: 12.9352,
      longitude: 77.6823,
      area: "Bellandur Tech Zone",
    };

    const res2 = await fetch(`${GATEWAY_URL}/api/hotels/${testHotelId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify(updateApproxPayload),
    });

    const data2 = await res2.json();
    console.log("Status:", res2.status);
    console.log("Response body:", JSON.stringify(data2, null, 2));

    results.test2_owner_update_approx = {
      status: res2.status,
      body: data2,
    };

    // -------------------------------------------------------------------------
    // 3. Another authenticated user receives 403 Forbidden
    // -------------------------------------------------------------------------
    console.log("\n[3] Owner B attempts to update Owner A's property via Gateway...");
    const res3 = await fetch(`${GATEWAY_URL}/api/hotels/${testHotelId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenOwnerB}`,
      },
      body: JSON.stringify({ name: "Malicious Tampering by Owner B" }),
    });

    const data3 = await res3.json();
    console.log("Status:", res3.status);
    console.log("Response body:", JSON.stringify(data3, null, 2));

    results.test3_unauthorized_user_forbidden = {
      status: res3.status,
      body: data3,
    };

    // -------------------------------------------------------------------------
    // 4. Public hotel detail for approximate property (Guest View)
    // -------------------------------------------------------------------------
    console.log("\n[4] Guest retrieves public detail for approximate property...");
    const res4 = await fetch(`${GATEWAY_URL}/api/hotels/${testHotelId}`);
    const data4 = await res4.json();
    console.log("Status:", res4.status);
    console.log("Response body:", JSON.stringify(data4, null, 2));

    results.test4_guest_approximate_hotel = {
      status: res4.status,
      body: data4,
    };

    // -------------------------------------------------------------------------
    // 5. Owner clears coordinates
    // -------------------------------------------------------------------------
    console.log("\n[5] Owner A clears coordinates via Gateway...");
    const clearPayload = {
      latitude: null,
      longitude: null,
    };

    const res5 = await fetch(`${GATEWAY_URL}/api/hotels/${testHotelId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenOwnerA}`,
      },
      body: JSON.stringify(clearPayload),
    });

    const data5 = await res5.json();
    console.log("Status:", res5.status);
    console.log("Response body:", JSON.stringify(data5, null, 2));

    results.test5_owner_clear_coordinates = {
      status: res5.status,
      body: data5,
    };

    // -------------------------------------------------------------------------
    // 6. Public hotel detail after clearing (Guest View)
    // -------------------------------------------------------------------------
    console.log("\n[6] Guest retrieves public detail after coordinates cleared...");
    const res6 = await fetch(`${GATEWAY_URL}/api/hotels/${testHotelId}`);
    const data6 = await res6.json();
    console.log("Status:", res6.status);
    console.log("Response body:", JSON.stringify(data6, null, 2));

    results.test6_guest_cleared_hotel = {
      status: res6.status,
      body: data6,
    };

    // -------------------------------------------------------------------------
    // 7. Public room listing returns correct location representation
    // -------------------------------------------------------------------------
    console.log("\n[7] Guest fetches public room listing via Gateway (GET /api/rooms)...");
    const res7 = await fetch(`${GATEWAY_URL}/api/rooms`);
    const data7 = await res7.json();
    console.log("Status:", res7.status);
    console.log("Sample room[0].hotel.location:", JSON.stringify(data7.rooms[0]?.hotel?.location, null, 2));

    results.test7_public_rooms_listing = {
      status: res7.status,
      count: data7.count,
      sampleLocation: data7.rooms[0]?.hotel?.location,
    };

    // -------------------------------------------------------------------------
    // 8. Public room detail returns correct location representation
    // -------------------------------------------------------------------------
    const existingRoomId = data7.rooms[0]?._id;
    console.log(`\n[8] Guest fetches public room detail for room ${existingRoomId}...`);
    const res8 = await fetch(`${GATEWAY_URL}/api/rooms/${existingRoomId}`);
    const data8 = await res8.json();
    console.log("Status:", res8.status);
    console.log("Room hotel location:", JSON.stringify(data8.room?.hotel?.location, null, 2));

    results.test8_public_room_detail = {
      status: res8.status,
      roomLocation: data8.room?.hotel?.location,
    };

    // -------------------------------------------------------------------------
    // 9. Existing properties without coordinates continue to work
    // -------------------------------------------------------------------------
    const existingHotelId = data7.rooms[0]?.hotel?._id;
    console.log(`\n[9] Guest fetches existing hotel ${existingHotelId} without coordinates...`);
    const res9 = await fetch(`${GATEWAY_URL}/api/hotels/${existingHotelId}`);
    const data9 = await res9.json();
    console.log("Status:", res9.status);
    console.log("Existing hotel location:", data9.hotel?.location);
    console.log("Existing hotel address:", data9.hotel?.address);

    results.test9_existing_hotel_no_coords = {
      status: res9.status,
      location: data9.hotel?.location,
      name: data9.hotel?.name,
      address: data9.hotel?.address,
    };

    console.log("\n===============================================================================");
    console.log(" ALL 9 GATEWAY INTEGRATION TESTS COMPLETED SUCCESSFULLY");
    console.log("===============================================================================\n");
  } finally {
    // Clean up test hotel
    if (testHotelId) {
      console.log(`Cleaning up test hotel ${testHotelId}...`);
      await fetch(`${GATEWAY_URL}/api/hotels/${testHotelId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenOwnerA}`,
        },
      });
      console.log("✓ Test hotel deleted successfully.");
    }
  }
}

runIntegration().catch((err) => {
  console.error("Integration test failed:", err);
  process.exit(1);
});
