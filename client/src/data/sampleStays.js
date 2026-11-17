/**
 * Sample Stays Dataset (Development Only)
 * Used when VITE_USE_SAMPLE_DATA=true in development environment.
 * All records use explicitly fake stable IDs prefixed with 'sample-' to prevent collisions.
 * In production, this module is never loaded and no sample records exist.
 *
 * Requirements (Round 4d #5):
 * At least 10 distinct sample stays across at least 4 cities, each with its own photo
 * (no two stays sharing a photo) and a unique name.
 */

export const SAMPLE_STAYS = [
  {
    _id: "sample-1",
    roomType: "Luxury Suite",
    pricePerNight: 4200,
    amenities: ["Free Wifi", "Swimming Pool", "Free Breakfast", "Air Conditioning"],
    images: [
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
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
      location: {
        publicCoordinates: { lat: 15.5173, lng: 73.7635 },
        locationPrecision: "exact",
        approximateRadiusMeters: null,
      },
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
      location: {
        publicCoordinates: { lat: 26.9054, lng: 75.7891 },
        locationPrecision: "exact",
        approximateRadiusMeters: null,
      },
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
      location: {
        publicCoordinates: { lat: 24.5764, lng: 73.6806 },
        locationPrecision: "exact",
        approximateRadiusMeters: null,
      },
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
      area: "Bandra West",
      location: {
        publicCoordinates: { lat: 19.0596, lng: 72.8295 },
        locationPrecision: "approximate",
        approximateRadiusMeters: 500,
      },
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
      area: "Old Manali",
      location: {
        publicCoordinates: { lat: 32.253, lng: 77.175 },
        locationPrecision: "approximate",
        approximateRadiusMeters: 500,
      },
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
      location: {
        publicCoordinates: { lat: 25.0805, lng: 55.1403 },
        locationPrecision: "exact",
        approximateRadiusMeters: null,
      },
    },
    createdAt: "2024-04-20T12:00:00.000Z",
  },
  {
    _id: "sample-7",
    roomType: "Colonial Valley Room",
    pricePerNight: 3900,
    amenities: ["Free Wifi", "Mountain View", "Fireplace", "Balcony"],
    images: [
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.8,
    reviewsCount: 33,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-7",
      name: "Shimla Colonial Cottage",
      city: "Shimla",
      address: "The Ridge, Shimla",
      location: {
        publicCoordinates: { lat: 31.1048, lng: 77.1734 },
        locationPrecision: "exact",
        approximateRadiusMeters: null,
      },
    },
    createdAt: "2024-05-10T11:00:00.000Z",
  },
  {
    _id: "sample-8",
    roomType: "Oceanfront Deluxe Suite",
    pricePerNight: 4600,
    amenities: ["Free Wifi", "Swimming Pool", "Balcony", "Free Breakfast"],
    images: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.9,
    reviewsCount: 47,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-8",
      name: "Marina Bay Luxury Villa",
      city: "Chennai",
      address: "East Coast Road, Chennai",
      area: "East Coast Road",
      location: {
        publicCoordinates: { lat: 12.9249, lng: 80.2522 },
        locationPrecision: "approximate",
        approximateRadiusMeters: 500,
      },
    },
    createdAt: "2024-05-22T15:00:00.000Z",
  },
  {
    _id: "sample-9",
    roomType: "Sunset Ocean Room",
    pricePerNight: 5100,
    amenities: ["Free Wifi", "Swimming Pool", "Bar", "Ocean View"],
    images: [
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.8,
    reviewsCount: 36,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-9",
      name: "Vagator Cliffside Boutique",
      city: "Goa",
      address: "Vagator Beach Road, Goa",
      location: {
        publicCoordinates: { lat: 15.5997, lng: 73.7383 },
        locationPrecision: "exact",
        approximateRadiusMeters: null,
      },
    },
    createdAt: "2024-06-01T08:00:00.000Z",
  },
  {
    _id: "sample-10",
    roomType: "Courtyard Garden Suite",
    pricePerNight: 3100,
    amenities: ["Free Wifi", "Free Breakfast", "Courtyard", "Room Service"],
    images: [
      "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.7,
    reviewsCount: 28,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-10",
      name: "Amber Fort View Haveli",
      city: "Jaipur",
      address: "Amer Road, Jaipur",
    },
    createdAt: "2024-06-15T10:00:00.000Z",
  },
  {
    _id: "sample-11",
    roomType: "Pinecrest Alpine Room",
    pricePerNight: 4400,
    amenities: ["Free Wifi", "Mountain View", "Heater", "Breakfast Included"],
    images: [
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.8,
    reviewsCount: 39,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-11",
      name: "Mall Road Cedar Lodge",
      city: "Shimla",
      address: "Mall Road, Shimla",
    },
    createdAt: "2024-07-02T12:00:00.000Z",
  },
  {
    _id: "sample-12",
    roomType: "Royal Garden Deluxe",
    pricePerNight: 4900,
    amenities: ["Free Wifi", "Swimming Pool", "Spa", "Restaurant"],
    images: [
      "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.9,
    reviewsCount: 58,
    isAvailable: true,
    isSample: true,
    hotel: {
      _id: "hotel-sample-12",
      name: "Alwar House Garden Retreat",
      city: "Udaipur",
      address: "Fateh Sagar, Udaipur",
    },
    createdAt: "2024-07-20T14:30:00.000Z",
  },
];

/**
 * Generates 100 sample stays distributed across cities for stress testing
 * marker clustering (Round 4c requirement 5.1).
 */
export function generateSampleStays(count = 100) {
  const cities = [
    { name: "Goa", baseLat: 15.4989, baseLng: 73.8278 },
    { name: "Mumbai", baseLat: 19.076, baseLng: 72.8777 },
    { name: "Jaipur", baseLat: 26.9124, baseLng: 75.7873 },
    { name: "Udaipur", baseLat: 24.5854, baseLng: 73.7125 },
    { name: "Shimla", baseLat: 31.1048, baseLng: 77.1734 },
    { name: "Bengaluru", baseLat: 12.9716, baseLng: 77.5946 },
    { name: "Delhi", baseLat: 28.6139, baseLng: 77.209 },
  ];
  const types = ["Single Bed", "Double Bed", "Luxury Room", "Family Suite"];
  const list = [];
  for (let i = 1; i <= count; i++) {
    const city = cities[i % cities.length];
    const latOffset = (((i * 17) % 100) - 50) * 0.003;
    const lngOffset = (((i * 31) % 100) - 50) * 0.003;
    const price = 1500 + ((i * 370) % 12000);
    list.push({
      _id: `sample-gen-${i}`,
      roomType: types[i % types.length],
      pricePerNight: price,
      amenities: ["Free Wifi", "Room Service", "Free Breakfast"],
      images: [
        SAMPLE_STAYS[i % SAMPLE_STAYS.length]?.images[0] ||
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
      ],
      rating: Number((4.5 + (i % 5) * 0.1).toFixed(1)),
      reviewsCount: 15 + i * 3,
      isAvailable: true,
      isSample: true,
      hotel: {
        _id: `hotel-gen-${i}`,
        name: `${city.name} Heritage Stay #${i}`,
        city: city.name,
        address: `${city.name} Main Road, Unit ${i}`,
        location: {
          publicCoordinates: {
            lat: Number((city.baseLat + latOffset).toFixed(6)),
            lng: Number((city.baseLng + lngOffset).toFixed(6)),
          },
          locationPrecision: i % 4 === 0 ? "approximate" : "exact",
          approximateRadiusMeters: i % 4 === 0 ? 500 : null,
        },
      },
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    });
  }
  return list;
}

