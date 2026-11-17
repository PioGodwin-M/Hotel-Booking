/**
 * Sample Content Repository for Design Review & Preview Mode
 *
 * IMPORTANT:
 * - This content is ONLY returned by hooks when VITE_USE_SAMPLE_DATA === 'true'.
 * - In production default (VITE_USE_SAMPLE_DATA !== 'true'), hooks return empty arrays
 *   and sections are cleanly removed from the DOM.
 * - Every item carries `isSample: true`.
 */

export const SAMPLE_OFFERS = [
  {
    id: "offer-monsoon-15",
    isSample: true,
    code: "MONSOON15",
    discount: "15% off",
    title: "Monsoon getaway offer",
    condition: "Valid on bookings of 2 nights or more",
    validUntil: "30 Nov 2026",
    image:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
    filterUrl: "/rooms",
  },
  {
    id: "offer-early-bird-20",
    isSample: true,
    code: "EARLYBIRD20",
    discount: "20% off",
    title: "Advance booking discount",
    condition: "Book at least 14 days before check-in",
    validUntil: "31 Dec 2026",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
    filterUrl: "/rooms",
  },
  {
    id: "offer-weekend-10",
    isSample: true,
    code: "WEEKEND10",
    discount: "10% off",
    title: "Weekend escape discount",
    condition: "Applies to Friday through Sunday check-ins",
    validUntil: "15 Jan 2027",
    image:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
    filterUrl: "/rooms",
  },
];

export const SAMPLE_TRIP_IDEAS = [
  {
    id: "trip-hills",
    isSample: true,
    title: "Weekend in the hills",
    description: "Pine-covered mountain trails, crisp air, and quiet valley views",
    duration: "2-3 nights",
    defaultStartingPrice: 4200,
    filterCity: "Shimla",
    filterAmenity: "Mountain View",
    filterUrl: "/rooms?destination=Shimla",
    image:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "trip-coastal",
    isSample: true,
    title: "Coastal break by the water",
    description: "Warm ocean breezes, fresh seafood, and relaxed beachside stays",
    duration: "2-4 nights",
    defaultStartingPrice: 3500,
    filterCity: "Chennai",
    filterAmenity: "Balcony",
    filterUrl: "/rooms?destination=Chennai",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "trip-heritage",
    isSample: true,
    title: "Historic city walk",
    description: "Quiet courtyards, traditional architecture, and vibrant local markets",
    duration: "2-3 nights",
    defaultStartingPrice: 2800,
    filterCity: "Kyoto",
    filterAmenity: "Free WiFi",
    filterUrl: "/rooms?destination=Kyoto",
    image:
      "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "trip-pool",
    isSample: true,
    title: "Peaceful pool staycation",
    description: "Spacious family suites with afternoon swims and quiet gardens",
    duration: "1-2 nights",
    defaultStartingPrice: 4800,
    filterAmenity: "Pool",
    filterUrl: "/rooms?amenity=Pool",
    image:
      "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=900&q=80",
  },
];

export const SAMPLE_REVIEWS_DATA = {
  isSample: true,
  summary: {
    averageRating: 4.8,
    totalReviews: 24,
    starCounts: {
      5: 19,
      4: 4,
      3: 1,
      2: 0,
      1: 0,
    },
  },
  reviews: [
    {
      id: "rev-s1",
      isSample: true,
      authorName: "Rahul",
      authorInitial: "S.",
      authorCity: "Bangalore",
      stayName: "Grand Palace Hotel",
      roomId: "67a8409e5306e902b4129fe5", // Links to actual room if exists
      monthYear: "October 2026",
      rating: 5,
      comment:
        "The room was spotless and check-in took less than three minutes. Breakfast was fresh, and the mountain view from the balcony made our morning coffee memorable. We will definitely come back on our next trip.",
      stayedWithUs: true,
    },
    {
      id: "rev-s2",
      isSample: true,
      authorName: "Priya",
      authorInitial: "P.",
      authorCity: "Mumbai",
      stayName: "Shimla Pine Retreat",
      roomId: "67a8409e5306e902b4129fe6",
      monthYear: "September 2026",
      rating: 5,
      comment:
        "Accurate photos and no unexpected charges at the hotel. Hot water was reliable even in the chilly evenings, and the staff helped arrange a local driver. Transparent pricing made booking simple.",
      stayedWithUs: true,
    },
    {
      id: "rev-s3",
      isSample: true,
      authorName: "Arjun",
      authorInitial: "K.",
      authorCity: "Delhi",
      stayName: "Oceanfront Residency",
      roomId: "67a8409e5306e902b4129fe7",
      monthYear: "August 2026",
      rating: 4.8,
      comment:
        "Quiet stay within walking distance to the beach. Fast Wi-Fi throughout the property made working remotely effortless. The 10-minute hold while paying was really reassuring.",
      stayedWithUs: true,
    },
    {
      id: "rev-s4",
      isSample: true,
      authorName: "Sneha",
      authorInitial: "M.",
      authorCity: "Pune",
      stayName: "Heritage Garden Villa",
      roomId: "67a8409e5306e902b4129fe8",
      monthYear: "July 2026",
      rating: 5,
      comment:
        "Our family booked two adjoining rooms. Everything matched the description on PGM Stays perfectly. Clean linens, polite housekeeping, and peaceful nights.",
      stayedWithUs: true,
    },
  ],
};
