/**
 * ============================================================================
 * SAMPLE DATA REPOSITORY
 * ============================================================================
 * NOTICE: The following sample datasets represent placeholder augmentations for
 * attributes not yet provided by the microservices:
 * 1. MOCK_REVIEWS: Sample guest reviews
 * 2. MOCK_RATINGS_BREAKDOWN: Category rating breakdown
 * 3. MOCK_HOST_PROFILES: Host profile and response metrics
 * 4. MOCK_TESTIMONIALS: Traveler testimonials
 * 5. MOCK_EXCLUSIVE_OFFERS: Special discounts and seasonal deals
 * 6. MOCK_POPULAR_DESTINATIONS: Popular travel destinations
 * ============================================================================
 */

/**
 * Master toggle to display "Sample" badges on placeholder components.
 * Set to false so the UI displays cleanly without placeholder badges.
 */
export const SHOW_SAMPLE_DATA_LABELS = false;

export const MOCK_REVIEWS = [
  {
    id: "rev-1",
    author: "Rahul Sharma",
    location: "Bangalore",
    date: "October 2024",
    rating: 5.0,
    headline: "Spotless room and very helpful staff",
    comment:
      "We stayed here for 3 nights with family. The check-in was very smooth, rooms were clean and spacious, and breakfast had good vegetarian options. Would definitely recommend to anyone visiting.",
    verifiedStay: true,
  },
  {
    id: "rev-2",
    author: "Priya Patel",
    location: "Mumbai",
    date: "September 2024",
    rating: 4.8,
    headline: "Great location and peaceful atmosphere",
    comment:
      "Very quiet location, close to popular tourist spots. The bed was comfortable and hot water was available all day. The host was quick to answer any questions we had.",
    verifiedStay: true,
  },
  {
    id: "rev-3",
    author: "Ananya Verma",
    location: "Delhi",
    date: "August 2024",
    rating: 4.9,
    headline: "Excellent value for money",
    comment:
      "Everything matched the photos on the website. High-speed Wi-Fi worked great for work calls, and the room was cleaned every morning. Very happy with our stay.",
    verifiedStay: true,
  },
];

export const MOCK_RATINGS_BREAKDOWN = {
  overall: 4.9,
  totalReviews: 86,
  categories: [
    { name: "Cleanliness", score: 4.9 },
    { name: "Accuracy", score: 4.9 },
    { name: "Communication", score: 5.0 },
    { name: "Location", score: 4.8 },
    { name: "Check-in", score: 5.0 },
    { name: "Value for money", score: 4.8 },
  ],
};

export const MOCK_HOST_PROFILES = {
  default: {
    name: "Rajesh Kumar",
    role: "Property Host",
    isSuperhost: true,
    rating: 4.9,
    reviewsCount: 142,
    responseTime: "Within 15 minutes",
    responseRate: "100%",
    yearsHosting: 5,
    bio: "Hi! I enjoy hosting travelers and helping them explore the city. My team and I are here to ensure your stay is comfortable, clean, and hassle-free.",
    languages: ["English", "Hindi"],
  },
};

export const MOCK_TESTIMONIALS = [
  {
    id: "test-1",
    name: "Rohit & Meera Sen",
    location: "Kolkata, India",
    rating: 5,
    title: "Wonderful weekend trip",
    quote:
      "Booking was super quick, and the room was ready when we arrived early. Clean linen, good air conditioning, and friendly staff. Made our family vacation completely stress-free.",
  },
  {
    id: "test-2",
    name: "Vikram Malhotra",
    location: "Pune, India",
    rating: 5,
    title: "Best hotel booking experience",
    quote:
      "Clear pricing with taxes included upfront—no surprise charges at checkout. The instant confirmation and 10-minute hold window gave us peace of mind.",
  },
  {
    id: "test-3",
    name: "Neha Joshi",
    location: "Hyderabad, India",
    rating: 5,
    title: "Reliable and high quality",
    quote:
      "I travel often for business and this platform has become my go-to. What you see in the pictures is exactly what you get when you walk into the room.",
  },
  {
    id: "test-4",
    name: "Karan Desai",
    location: "Ahmedabad, India",
    rating: 5,
    title: "Great customer support",
    quote:
      "I had to adjust my check-in time and the host responded within minutes. Smooth payment with card, instant receipt download, and a great stay overall.",
  },
];

export const MOCK_EXCLUSIVE_OFFERS = [
  {
    _id: "offer-1",
    title: "Weekend Getaway Deal",
    description: "Get 25% off on stays of 3 nights or more. Includes free breakfast every morning.",
    priceOff: 25,
    expiryDate: "Valid till Nov 30, 2026",
    code: "WEEKEND25",
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
    tag: "Limited Offer",
  },
  {
    _id: "offer-2",
    title: "Beachside Holiday Special",
    description: "Enjoy 30% off on premium beach villas in Goa with complimentary airport transfer.",
    priceOff: 30,
    expiryDate: "Valid till Dec 15, 2026",
    code: "BEACH30",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
    tag: "Popular Deal",
  },
  {
    _id: "offer-3",
    title: "Hill Station Summer Offer",
    description: "Save 20% on mountain cottages with free guided nature walks and tea tasting.",
    priceOff: 20,
    expiryDate: "Valid till Jan 10, 2027",
    code: "HILLS20",
    image: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1200&q=80",
    tag: "Special Discount",
  },
];

export const MOCK_POPULAR_DESTINATIONS = [
  { name: "Goa", country: "India", count: 48, image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80" },
  { name: "Jaipur", country: "India", count: 32, image: "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=600&q=80" },
  { name: "Udaipur", country: "India", count: 24, image: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=600&q=80" },
  { name: "Dubai", country: "UAE", count: 36, image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80" },
];
