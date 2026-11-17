import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

import Hotel from "./src/models/Hotel.js";
import hotelRoutes from "./src/routes/hotelRoutes.js";
import roomRoutes from "./src/routes/roomRoutes.js";

async function runHttpExamples() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME || "hotel_catalog" });

  const app = express();
  app.use(express.json());

  // Test middleware simulating Clerk auth
  let currentAuthUser = "user_owner_demo_1";
  const clerkAuthBrand = Symbol.for("@clerk/express.auth");

  app.use((req, res, next) => {
    const fn = () => ({
      tokenType: "session_token",
      userId: currentAuthUser,
      isAuthenticated: true,
    });
    fn[clerkAuthBrand] = true;
    req.auth = fn;
    next();
  });

  app.use("/api/hotels", hotelRoutes);
  app.use("/api/rooms", roomRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const examples = {};

  try {
    // -----------------------------------------------------------------
    // 1. Owner creating an exact location
    // -----------------------------------------------------------------
    currentAuthUser = "owner_test_123";
    const createExactReq = {
      name: "The Grand Heritage",
      address: "12 Lake Palace Road, Mall Area",
      contact: "+91 9876543210",
      city: "Udaipur",
      latitude: 24.5764,
      longitude: 73.6806,
      locationPrecision: "exact",
    };

    const res1 = await fetch(`${baseUrl}/api/hotels/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createExactReq),
    });
    const data1 = await res1.json();
    if (!data1.hotel) {
      console.error("res1 status:", res1.status, "data1:", data1);
    }
    const hotelId = data1.hotel._id;

    examples.scenario1_owner_exact = {
      description: "1. Owner creating a hotel with exact location",
      request: {
        method: "POST",
        path: "/api/hotels/",
        body: createExactReq,
      },
      response: {
        status: res1.status,
        body: data1,
      },
    };

    // -----------------------------------------------------------------
    // 2. Owner updating to an approximate location
    // -----------------------------------------------------------------
    const updateApproxReq = {
      locationPrecision: "approximate",
      latitude: 24.5764,
      longitude: 73.6806,
    };

    const res2 = await fetch(`${baseUrl}/api/hotels/${hotelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateApproxReq),
    });
    const data2 = await res2.json();

    examples.scenario2_owner_approximate = {
      description: "2. Owner updating to an approximate location (shows stored coordinates to owner)",
      request: {
        method: "PUT",
        path: `/api/hotels/${hotelId}`,
        body: updateApproxReq,
      },
      response: {
        status: res2.status,
        body: data2,
      },
    };

    // -----------------------------------------------------------------
    // 3. Guest receiving an exact location
    // -----------------------------------------------------------------
    // Switch to exact first to test guest receiving exact location
    await fetch(`${baseUrl}/api/hotels/${hotelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationPrecision: "exact", latitude: 24.5764, longitude: 73.6806 }),
    });

    const res3 = await fetch(`${baseUrl}/api/hotels/${hotelId}`);
    const data3 = await res3.json();

    examples.scenario3_guest_exact = {
      description: "3. Guest receiving an exact location (real coordinates as publicCoordinates, full address)",
      request: {
        method: "GET",
        path: `/api/hotels/${hotelId}`,
      },
      response: {
        status: res3.status,
        body: data3,
      },
    };

    // -----------------------------------------------------------------
    // 4. Guest receiving an approximate location
    // -----------------------------------------------------------------
    // Switch to approximate
    await fetch(`${baseUrl}/api/hotels/${hotelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationPrecision: "approximate", latitude: 24.5764, longitude: 73.6806 }),
    });

    const res4 = await fetch(`${baseUrl}/api/hotels/${hotelId}`);
    const data4 = await res4.json();

    examples.scenario4_guest_approximate = {
      description: "4. Guest receiving an approximate location (street address masked, publicCoordinates offset)",
      request: {
        method: "GET",
        path: `/api/hotels/${hotelId}`,
      },
      response: {
        status: res4.status,
        body: data4,
      },
    };

    // -----------------------------------------------------------------
    // 5. Guest receiving a null location
    // -----------------------------------------------------------------
    // Clear location
    const clearReq = {
      latitude: null,
      longitude: null,
    };

    const resClear = await fetch(`${baseUrl}/api/hotels/${hotelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clearReq),
    });
    const dataClear = await resClear.json();

    const res5 = await fetch(`${baseUrl}/api/hotels/${hotelId}`);
    const data5 = await res5.json();

    examples.scenario5_guest_null = {
      description: "5. Guest receiving a null location (location is null)",
      request: {
        method: "GET",
        path: `/api/hotels/${hotelId}`,
      },
      response: {
        status: res5.status,
        body: data5,
      },
    };

    // -----------------------------------------------------------------
    // 6. Owner clearing the location
    // -----------------------------------------------------------------
    examples.scenario6_owner_cleared = {
      description: "6. Owner clearing the location (null for both coordinates)",
      request: {
        method: "PUT",
        path: `/api/hotels/${hotelId}`,
        body: clearReq,
      },
      response: {
        status: resClear.status,
        body: dataClear,
      },
    };

    // -----------------------------------------------------------------
    // 7. Owner security check: Unauthorized owner cannot update property
    // -----------------------------------------------------------------
    currentAuthUser = "unauthorized_owner_hacker";
    const res7 = await fetch(`${baseUrl}/api/hotels/${hotelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked Hotel" }),
    });
    const data7 = await res7.json();

    examples.scenario7_unauthorized_owner = {
      description: "7. Owner authorization: an owner cannot set location of another owner's property",
      request: {
        method: "PUT",
        path: `/api/hotels/${hotelId}`,
        body: { name: "Hacked Hotel" },
      },
      response: {
        status: res7.status,
        body: data7,
      },
    };

    // Clean up test hotel
    await Hotel.findByIdAndDelete(hotelId);

    console.log(JSON.stringify(examples, null, 2));
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runHttpExamples().catch((err) => {
  console.error("HTTP test failed:", err);
  process.exit(1);
});
