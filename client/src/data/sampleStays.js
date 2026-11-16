/**
 * Sample Stays Dataset (Development Only)
 * Used when VITE_USE_SAMPLE_DATA=true in development environment.
 * All records use explicitly fake stable IDs prefixed with 'sample-' to prevent collisions.
 * In production, this module is never loaded and no sample records exist.
 */

export const SAMPLE_STAYS = [
  {
    _id: "sample-1",
    roomType: "Luxury Suite",
    pricePerNight: 4200,
    amenities: ["Free Wifi", "Swimming Pool", "Free Breakfast", "Air Conditioning"],
    images: [
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.9,
    reviewsCount: 52,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-1",
      name: "Goa Beachfront Resort",
      city: "Goa",
      address: "Candolim Beach Road, Goa",
    },
    createdAt: "2024-01-15T10:00:00.000Z",
  },
  {
    _id: "sample-2",
    roomType: "Heritage Double Room",
    pricePerNight: 3500,
    amenities: ["Free Wifi", "Mountain View", "Room Service", "Breakfast Included"],
    images: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.8,
    reviewsCount: 38,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-2",
      name: "Jaipur Palace Heritage",
      city: "Jaipur",
      address: "Civil Lines, Jaipur",
    },
    createdAt: "2024-02-10T11:00:00.000Z",
  },
  {
    _id: "sample-3",
    roomType: "Lakeview Executive Room",
    pricePerNight: 5800,
    amenities: ["Free Wifi", "Swimming Pool", "Spa", "Balcony"],
    images: [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.9,
    reviewsCount: 64,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-3",
      name: "Udaipur Lake Palace Hotel",
      city: "Udaipur",
      address: "Lake Pichola, Udaipur",
    },
    createdAt: "2024-03-01T09:30:00.000Z",
  },
  {
    _id: "sample-4",
    roomType: "Single Bed Business Room",
    pricePerNight: 2400,
    amenities: ["Free Wifi", "Work Desk", "Air Conditioning", "Coffee Maker"],
    images: [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.7,
    reviewsCount: 29,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-4",
      name: "Bandra Central Suites",
      city: "Mumbai",
      address: "Bandra West, Mumbai",
    },
    createdAt: "2024-03-15T14:00:00.000Z",
  },
  {
    _id: "sample-5",
    roomType: "Family Suite",
    pricePerNight: 6200,
    amenities: ["Free Wifi", "Mountain View", "Fireplace", "Breakfast Included"],
    images: [
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.8,
    reviewsCount: 41,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-5",
      name: "Pine Valley Resort",
      city: "Manali",
      address: "Old Manali, Himachal Pradesh",
    },
    createdAt: "2024-04-05T08:00:00.000Z",
  },
  {
    _id: "sample-6",
    roomType: "Skyline Deluxe Room",
    pricePerNight: 8900,
    amenities: ["Free Wifi", "Swimming Pool", "Gym", "Airport Transfer"],
    images: [
      "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.9,
    reviewsCount: 75,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-6",
      name: "Downtown View Marina",
      city: "Dubai",
      address: "Dubai Marina, Dubai",
    },
    createdAt: "2024-04-20T12:00:00.000Z",
  },
];
