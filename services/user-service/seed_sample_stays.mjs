import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../catalog-service/.env' });
dotenv.config({ path: '../booking-service/.env' });
dotenv.config({ path: '../../client/.env' });

import { clerkClient } from '@clerk/express';

// Refuse to run unless in development
const nodeEnv = process.env.NODE_ENV || 'development';
if (nodeEnv !== 'development') {
  console.error(`Refusing to run seed script: NODE_ENV is '${nodeEnv}', expected 'development'`);
  process.exit(1);
}

const API_BASE = 'http://localhost:4000';

const SAMPLE_STAYS = [
  {
    hotel: {
      name: "[Sample] Goa Beachfront Resort",
      city: "Goa",
      address: "Calangute Beach Road, North Goa",
      contact: "+91 832 245 6789",
    },
    room: {
      roomType: "Beachside Deluxe Room",
      pricePerNight: 4200,
      totalUnits: 6,
      amenities: ["Free Wifi", "Swimming Pool", "Free Breakfast", "Room Service"],
      images: [
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
  {
    hotel: {
      name: "[Sample] Heritage Haveli Jaipur",
      city: "Jaipur",
      address: "Amer Road, Old City, Jaipur",
      contact: "+91 141 234 5678",
    },
    room: {
      roomType: "Royal Heritage Suite",
      pricePerNight: 7800,
      totalUnits: 4,
      amenities: ["Free Wifi", "Room Service", "Free Breakfast"],
      images: [
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
  {
    hotel: {
      name: "[Sample] City Center Hotel Mumbai",
      city: "Mumbai",
      address: "Bandra Kurla Complex, Bandra East, Mumbai",
      contact: "+91 22 6678 9012",
    },
    room: {
      roomType: "Executive Business Room",
      pricePerNight: 5500,
      totalUnits: 8,
      amenities: ["Free Wifi", "Free Breakfast", "Room Service"],
      images: [
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
  {
    hotel: {
      name: "[Sample] Lake Palace View Udaipur",
      city: "Udaipur",
      address: "Lake Pichola Promenade, Udaipur",
      contact: "+91 294 256 7890",
    },
    room: {
      roomType: "Lake View Premium Suite",
      pricePerNight: 16500,
      totalUnits: 3,
      amenities: ["Free Wifi", "Swimming Pool", "Spa", "Mountain View", "Room Service"],
      images: [
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
  {
    hotel: {
      name: "[Sample] Palm Jumeirah Resort Dubai",
      city: "Dubai",
      address: "Crescent Road, The Palm, Dubai",
      contact: "+971 4 426 2000",
    },
    room: {
      roomType: "Grand Palm Luxury Room",
      pricePerNight: 42000,
      totalUnits: 5,
      amenities: ["Swimming Pool", "Spa", "Room Service", "Free Wifi", "Free Breakfast"],
      images: [
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
  {
    hotel: {
      name: "[Sample] Ubud Rainforest Retreat Bali",
      city: "Bali",
      address: "Jalan Raya Sayan, Ubud, Bali",
      contact: "+62 361 977 577",
    },
    room: {
      roomType: "Rainforest Pool Villa",
      pricePerNight: 21000,
      totalUnits: 4,
      amenities: ["Swimming Pool", "Spa", "Mountain View", "Free Breakfast", "Free Wifi"],
      images: [
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
  {
    hotel: {
      name: "[Sample] Backwater Villa Kochi",
      city: "Kochi",
      address: "Vembanad Lakefront, Kochi",
      contact: "+91 484 266 8900",
    },
    room: {
      roomType: "Backwater Cottage",
      pricePerNight: 3400,
      totalUnits: 5,
      amenities: ["Free Wifi", "Free Breakfast", "Room Service"],
      images: [
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
  {
    hotel: {
      name: "[Sample] Himalayan Pine Lodge Shimla",
      city: "Shimla",
      address: "Mall Road Upper Ridge, Shimla",
      contact: "+91 177 280 4567",
    },
    room: {
      roomType: "Cozy Pine View Room",
      pricePerNight: 1800,
      totalUnits: 6,
      amenities: ["Mountain View", "Free Wifi", "Room Service"],
      images: [
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
];

async function seed() {
  console.log("=== Seed Sample Stays (Dev Only) ===");
  console.log(`Environment: ${nodeEnv}`);

  // Authenticate user via Clerk
  const userId = 'user_31jw610bhxmvhNMFcSE6N1YEmXY';
  console.log(`Authenticating user '${userId}' with Clerk...`);
  const session = await clerkClient.sessions.createSession({ userId });
  const tokenData = await clerkClient.sessions.getToken(session.id);
  const jwt = tokenData.jwt;

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`,
  };

  console.log(`Authenticated. Seeding ${SAMPLE_STAYS.length} sample stays...`);

  for (let i = 0; i < SAMPLE_STAYS.length; i++) {
    const item = SAMPLE_STAYS[i];
    console.log(`\n[${i + 1}/${SAMPLE_STAYS.length}] Registering property: ${item.hotel.name}...`);

    // 1. Register Hotel
    const hotelRes = await fetch(`${API_BASE}/api/hotels/`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(item.hotel),
    });

    const hotelData = await hotelRes.json();
    if (!hotelRes.ok || !hotelData.success) {
      console.error(`  ✕ Hotel registration failed: ${JSON.stringify(hotelData)}`);
      continue;
    }

    const hotelId = hotelData.hotel?._id || hotelData.data?._id;
    console.log(`  ✓ Hotel registered with ID: ${hotelId}`);

    // 2. Add Room Category
    console.log(`  Adding room category: ${item.room.roomType} (₹${item.room.pricePerNight}/night)...`);
    const roomPayload = {
      ...item.room,
      hotelId,
    };

    const roomRes = await fetch(`${API_BASE}/api/rooms/`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(roomPayload),
    });

    const roomData = await roomRes.json();
    if (!roomRes.ok || !roomData.success) {
      console.error(`  ✕ Room category creation failed: ${JSON.stringify(roomData)}`);
      continue;
    }

    console.log(`  ✓ Room category added with ID: ${roomData.room?._id || roomData.data?._id}`);
  }

  console.log("\n=== Seeding Completed Successfully! ===");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
