import { clerkClient } from "@clerk/express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:4000";
const OWNER_USER_ID = "user_31jw610bhxmvhNMFcSE6N1YEmXY";

async function audit() {
  console.log("Generating Clerk session token for audit...");
  const session = await clerkClient.sessions.createSession({ userId: OWNER_USER_ID });
  const tokenData = await clerkClient.sessions.getToken(session.id);
  const token = tokenData.jwt;

  let hotelId = null;
  let roomId = null;

  try {
    // 1. Create an approximate hotel with sensitive street address and exact coordinates
    const hotelPayload = {
      name: "Privacy Audit Sanctuary",
      address: "42 Confidential Penthouse, Secret Lane",
      area: "Old Forest Hills",
      contact: "+91 9123456789",
      city: "Manali",
      latitude: 32.2396,
      longitude: 77.1887,
      locationPrecision: "approximate",
    };

    const createHotelRes = await fetch(`${GATEWAY_URL}/api/hotels/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(hotelPayload),
    });
    const hotelData = await createHotelRes.json();
    hotelId = hotelData.hotel._id;
    console.log("✓ Created test hotel with approximate location:", hotelId);

    // 2. Create a room under this hotel
    const roomPayload = {
      hotelId,
      roomType: "Pine View Suite",
      pricePerNight: 9500,
      totalUnits: 3,
      amenities: ["Free Wifi", "Mountain View"],
      images: ["https://images.unsplash.com/photo-1590490360182-c33d57733427"],
    };

    const createRoomRes = await fetch(`${GATEWAY_URL}/api/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(roomPayload),
    });
    const roomData = await createRoomRes.json();
    roomId = roomData.room._id;
    console.log("✓ Created test room under hotel:", roomId);

    // 3. Test Public Endpoints for Privacy
    console.log("\n--- Testing Public Endpoint 1: GET /api/hotels/:hotelId (Public Hotel Detail) ---");
    const pubHotelRes = await fetch(`${GATEWAY_URL}/api/hotels/${hotelId}`);
    const pubHotelData = await pubHotelRes.json();
    console.log("Status:", pubHotelRes.status);
    console.log("Response:", JSON.stringify(pubHotelData, null, 2));

    console.log("\n--- Testing Public Endpoint 2: GET /api/rooms (Public Room Listing) ---");
    const pubRoomsRes = await fetch(`${GATEWAY_URL}/api/rooms`);
    const pubRoomsData = await pubRoomsRes.json();
    const matchedRoom = pubRoomsData.rooms.find((r) => r._id === roomId);
    console.log("Status:", pubRoomsRes.status);
    console.log("Matched room in listing:", JSON.stringify(matchedRoom, null, 2));

    console.log("\n--- Testing Public Endpoint 3: GET /api/rooms/:roomId (Public Room Detail) ---");
    const pubRoomDetailRes = await fetch(`${GATEWAY_URL}/api/rooms/${roomId}`);
    const pubRoomDetailData = await pubRoomDetailRes.json();
    console.log("Status:", pubRoomDetailRes.status);
    console.log("Response:", JSON.stringify(pubRoomDetailData, null, 2));

    // Privacy Assertions
    const targets = [
      { name: "Public Hotel Detail", data: pubHotelData.hotel },
      { name: "Public Room List Item (Hotel)", data: matchedRoom.hotel },
      { name: "Public Room Detail (Hotel)", data: pubRoomDetailData.room.hotel },
    ];

    console.log("\n--- PRIVACY AUDIT VERIFICATION ---");
    for (const t of targets) {
      console.log(`Checking ${t.name}...`);
      const rawString = JSON.stringify(t.data);

      const leaksStreet =
        rawString.includes("42 Confidential Penthouse") || rawString.includes("Secret Lane");
      const leaksExactLat = rawString.includes("32.2396");
      const leaksExactLng = rawString.includes("77.1887");
      const leaksOwnerCoords = rawString.includes('"coordinates"');

      if (leaksStreet) console.error(`  FAIL: Leaked street address in ${t.name}`);
      else console.log(`  ✓ Street address not present (address is '${t.data.address}')`);

      if (leaksExactLat || leaksExactLng) console.error(`  FAIL: Leaked exact coordinates in ${t.name}`);
      else console.log(`  ✓ Exact coordinates not present`);

      if (leaksOwnerCoords) console.error(`  FAIL: Leaked owner 'coordinates' property in ${t.name}`);
      else console.log(`  ✓ Owner 'coordinates' property not present (only 'publicCoordinates')`);

      console.log(`  ✓ Public coordinates:`, t.data.location?.publicCoordinates);
      console.log(`  ✓ Radius:`, t.data.location?.approximateRadiusMeters);
      console.log(`  ✓ Precision:`, t.data.location?.locationPrecision);
    }
  } finally {
    if (hotelId) {
      console.log("\nCleaning up test hotel and room...");
      await fetch(`${GATEWAY_URL}/api/hotels/${hotelId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("✓ Cleanup finished.");
    }
  }
}

audit().catch(console.error);
