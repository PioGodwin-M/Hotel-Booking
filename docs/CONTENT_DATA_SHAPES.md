# Content Data Shapes & Microservice Endpoints Specification

This document details the exact JSON data contracts and REST endpoints required to implement backend services for the client-side data layer (`useOffers`, `useTripIdeas`, `useGuestReviews`, and `useSubscribe`). The frontend UI components consume these exact shapes.

---

## 1. Promotional Offers API

### Endpoint
`GET /api/offers` (or configured via `VITE_OFFERS_ENDPOINT`)

### Description
Returns active promotional discounts, seasonal campaigns, and voucher codes.

### Response Status
`200 OK`

### JSON Response Body
```json
[
  {
    "id": "offer-monsoon-15",
    "code": "MONSOON15",
    "discount": "15% off",
    "title": "Monsoon getaway offer",
    "condition": "Valid on bookings of 2 nights or more",
    "validUntil": "30 Nov 2026",
    "image": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
    "filterUrl": "/rooms?offer=monsoon15"
  },
  {
    "id": "offer-early-bird-20",
    "code": "EARLYBIRD20",
    "discount": "20% off",
    "title": "Advance booking discount",
    "condition": "Book at least 14 days before check-in",
    "validUntil": "31 Dec 2026",
    "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
    "filterUrl": "/rooms?offer=earlybird20"
  }
]
```

### Field Definitions
- `id` (string, required): Unique identifier for the offer.
- `code` (string, required): Promo code string that the user copies.
- `discount` (string, required): Human-readable badge text (e.g. `"15% off"` or `"₹500 off"`). Must be sentence case / lowercase 'off'.
- `title` (string, required): Short promo title.
- `condition` (string, required): Single-line eligibility criteria.
- `validUntil` (string, required): Expiry date formatted as `"DD Mon YYYY"` (e.g. `"30 Nov 2026"`).
- `image` (string, required): High-resolution imagery representing the deal.
- `filterUrl` (string, optional): Target route opening `/rooms` with preselected filter parameters.

---

## 2. Trip Ideas API

### Endpoint
`GET /api/trip-ideas` (or configured via `VITE_TRIP_IDEAS_ENDPOINT`)

### Description
Returns curated travel themes, weekend getaway concepts, and destination highlights.

### Response Status
`200 OK`

### JSON Response Body
```json
[
  {
    "id": "trip-hills",
    "title": "Weekend in the hills",
    "description": "Pine-covered mountain trails, crisp air, and quiet valley views",
    "duration": "2-3 nights",
    "defaultStartingPrice": 4200,
    "filterCity": "Shimla",
    "filterAmenity": "Mountain View",
    "filterUrl": "/rooms?destination=Shimla",
    "image": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80"
  },
  {
    "id": "trip-coastal",
    "title": "Coastal break by the water",
    "description": "Warm ocean breezes, fresh seafood, and relaxed beachside stays",
    "duration": "2-4 nights",
    "defaultStartingPrice": 3500,
    "filterCity": "Chennai",
    "filterAmenity": "Balcony",
    "filterUrl": "/rooms?destination=Chennai",
    "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80"
  }
]
```

### Field Definitions
- `id` (string, required): Unique identifier for the trip idea.
- `title` (string, required): Primary headline (e.g. `"Weekend in the hills"`).
- `description` (string, required): Single descriptive sentence.
- `duration` (string, required): Typical stay length (e.g. `"2-3 nights"`).
- `defaultStartingPrice` (number, optional): Fallback price in INR when real inventory is loading.
- `filterCity` (string, optional): City filter used to compute the cheapest live stay.
- `filterAmenity` (string, optional): Amenity filter used as secondary price lookup.
- `filterUrl` (string, required): URL query path to execute search on click.
- `image` (string, required): 16:10 aspect ratio photograph.

---

## 3. Verified Guest Reviews API

### Endpoint
`GET /api/reviews?limit=10` (or configured via `VITE_REVIEWS_ENDPOINT`)

### Description
Returns aggregate ratings breakdown and recent verified guest feedback.

### Query Parameters
- `limit` (number, optional, default: 10): Maximum review records returned.
- `hotelId` (string, optional): Filter reviews by property ID.

### Response Status
`200 OK`

### JSON Response Body
```json
{
  "summary": {
    "averageRating": 4.8,
    "totalReviews": 24,
    "starCounts": {
      "5": 19,
      "4": 4,
      "3": 1,
      "2": 0,
      "1": 0
    }
  },
  "reviews": [
    {
      "id": "rev-101",
      "authorName": "Rahul",
      "authorInitial": "S.",
      "authorCity": "Bangalore",
      "stayName": "Grand Palace Hotel",
      "roomId": "67a8409e5306e902b4129fe5",
      "monthYear": "October 2026",
      "rating": 5.0,
      "comment": "The room was spotless and check-in took less than three minutes. Breakfast was fresh, and the mountain view from the balcony made our morning coffee memorable. We will definitely come back on our next trip.",
      "stayedWithUs": true
    },
    {
      "id": "rev-102",
      "authorName": "Priya",
      "authorInitial": "P.",
      "authorCity": "Mumbai",
      "stayName": "Shimla Pine Retreat",
      "roomId": "67a8409e5306e902b4129fe6",
      "monthYear": "September 2026",
      "rating": 4.8,
      "comment": "Accurate photos and no unexpected charges at the hotel. Hot water was reliable even in the chilly evenings, and the staff helped arrange a local driver. Transparent pricing made booking simple.",
      "stayedWithUs": true
    }
  ]
}
```

### Field Definitions
- `summary.averageRating` (number, required): Aggregate score between 1.0 and 5.0.
- `summary.totalReviews` (number, required): Total number of recorded reviews.
- `summary.starCounts` (object, required): Count of reviews for each star level (1 to 5).
- `reviews[].id` (string, required): Unique review identifier.
- `reviews[].authorName` (string, required): First name of the reviewer.
- `reviews[].authorInitial` (string, required): Surname initial (e.g. `"S."`).
- `reviews[].authorCity` (string, required): Reviewer's origin city.
- `reviews[].stayName` (string, required): Name of the hotel or stay reviewed.
- `reviews[].roomId` (string, optional): ID of the room for internal link routing.
- `reviews[].monthYear` (string, required): Stay date (e.g. `"October 2026"`).
- `reviews[].rating` (number, required): Rating awarded (1 to 5).
- `reviews[].comment` (string, required): Guest feedback text.
- `reviews[].stayedWithUs` (boolean, required): Flag indicating if the review was tied to a confirmed booking in the database.

---

## 4. Newsletter Subscription API

### Endpoint
`POST /api/newsletter` (or configured via `VITE_NEWSLETTER_ENDPOINT`)

### Description
Subscribes a customer's email address to receive curated stay ideas, seasonal discounts, and platform updates.

### Request Headers
- `Content-Type: application/json`

### JSON Request Body
```json
{
  "email": "traveler@example.com"
}
```

### Success Response (`200 OK` or `201 Created`)
```json
{
  "success": true,
  "message": "You're subscribed."
}
```

### Error Response (`400 Bad Request`)
```json
{
  "success": false,
  "message": "Please enter a valid email address."
}
```

### Error Response (`409 Conflict`)
```json
{
  "success": true,
  "message": "You're already subscribed."
}
```
