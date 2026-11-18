# Round 4g: Booking Details Page — Stage 0 Audit Report

**Date:** 2026-11-17  
**Author:** Antigravity Team  
**Scope:** Stage 0 Audit (Strictly read-only investigation, architectural analysis, gap assessment, and API design prior to coding)

---

## 1. Existing Booking API Analysis

### 1.1 Overview
The Booking Service currently exposes two customer-facing query endpoints in `services/booking-service/src/routes/bookingRoutes.js` handled by `bookingQueryController.js` and `bookingQueryService.js`:
- `GET /api/bookings` — Paginated list of bookings owned by the authenticated Clerk user (`userId`).
- `GET /api/bookings/:bookingId` — Single booking lookup owned by the authenticated Clerk user (`userId`).

### 1.2 Data Stored in `Booking` Document
The MongoDB `Booking` collection stores the following schema:
```javascript
{
  _id: ObjectId,
  userId: String,               // Clerk user ID (e.g. "user_3M9Pn2IOC4eYMOys5zJNw8h8zTP")
  hotelId: ObjectId,            // Reference to Hotel document in Catalog Service
  roomCategoryId: ObjectId,     // Reference to Room document in Catalog Service
  checkIn: Date,                // Normalized check-in date
  checkOut: Date,               // Normalized check-out date
  numberOfRooms: Number,        // Number of rooms booked (min: 1)
  numberOfGuests: Number,       // Number of guests (min: 1)
  priceSnapshot: {
    pricePerNight: Number,      // In Rupees (e.g. 12500)
    numberOfNights: Number,     // Integer night count
    totalAmount: Number,        // In Rupees (e.g. 12500)
    currency: String            // "INR"
  },
  status: String,               // Enum: PENDING, HELD, PAYMENT_PENDING, CONFIRMED, CANCELLED, EXPIRED, PAYMENT_FAILED
  holdExpiresAt: Date | null,   // Hold expiration timestamp (10 minutes from creation)
  idempotencyKey: String,       // UUID
  requestFingerprint: String,   // SHA-256 hash
  paymentId: String | null,     // Internal payment ID (e.g. "pay_6003123...")
  paymentAttemptCount: Number,  // Default: 1
  createdAt: Date,
  updatedAt: Date
}
```

### 1.3 What is Returned Today
Currently, both `GET /api/bookings` and `GET /api/bookings/:bookingId` return the raw MongoDB document as a lean object with no stay snapshot or payment metadata:
- **Stay information:** Only raw ObjectIds (`hotelId`, `roomCategoryId`). The booking document stores NO hotel name, NO address, NO city, NO room type name, NO amenities, and NO photos.
- **Reference:** The server returns `_id`. The client formats `PGM-XXXXXXXX` using `formatBookingReference(booking._id)`.
- **Payment information:** Only `paymentId` string (internal identifier) and `priceSnapshot`. No card brand, last 4 digits, or receipt number.
- **Timeline:** Not provided. Only `createdAt`, `updatedAt`, and `holdExpiresAt` exist.
- **Cancellation policy:** Not returned.

### 1.4 Real JSON Examples from Database

#### Example 1: CONFIRMED Booking
```json
{
  "_id": "6afb30d9bda9c0cdaca03151",
  "userId": "user_3M9Pn2IOC4eYMOys5zJNw8h8zTP",
  "hotelId": "6af930f5fb028382df103197",
  "roomCategoryId": "6af9e340fb028382df10319a",
  "checkIn": "2026-11-17T00:00:00.000Z",
  "checkOut": "2026-11-18T00:00:00.000Z",
  "numberOfRooms": 1,
  "numberOfGuests": 2,
  "priceSnapshot": {
    "pricePerNight": 12500,
    "numberOfNights": 1,
    "totalAmount": 12500,
    "currency": "INR"
  },
  "status": "CONFIRMED",
  "holdExpiresAt": null,
  "idempotencyKey": "282e96e0-74ed-4a9d-9f22-13aea8eb90d1",
  "requestFingerprint": "2b0eb0ba7c2d8e3e5fcc9d644f566b54782b1e9990fb4254cf9b87b28811ea00",
  "paymentId": "pay_6003123c5a67b7d705fa92adc2b71d8126b300d6f620b4263c69272df49279fb",
  "paymentAttemptCount": 1,
  "createdAt": "2026-11-16T16:35:37.740Z",
  "updatedAt": "2026-11-16T16:38:11.058Z",
  "__v": 0
}
```

#### Example 2: HELD / Pending Booking (During active 10-minute hold)
```json
{
  "_id": "6afb41a2bda9c0cdaca03180",
  "userId": "user_3M9Pn2IOC4eYMOys5zJNw8h8zTP",
  "hotelId": "6af930f5fb028382df103197",
  "roomCategoryId": "6af9e340fb028382df10319a",
  "checkIn": "2026-11-20T00:00:00.000Z",
  "checkOut": "2026-11-22T00:00:00.000Z",
  "numberOfRooms": 1,
  "numberOfGuests": 2,
  "priceSnapshot": {
    "pricePerNight": 12500,
    "numberOfNights": 2,
    "totalAmount": 25000,
    "currency": "INR"
  },
  "status": "HELD",
  "holdExpiresAt": "2026-11-17T22:04:14.000Z",
  "idempotencyKey": "d1478129-e58e-49b2-a40a-b33383842188",
  "requestFingerprint": "2b0eb0ba7c2d8e3e5fcc9d644f566b54782b1e9990fb4254cf9b87b28811ea00",
  "paymentId": null,
  "paymentAttemptCount": 1,
  "createdAt": "2026-11-17T21:54:14.000Z",
  "updatedAt": "2026-11-17T21:54:14.000Z",
  "__v": 0
}
```

#### Example 3: EXPIRED Booking (Hold timed out without payment)
```json
{
  "_id": "6afb272600ddfe54ab70a226",
  "userId": "user_3M9Pn2IOC4eYMOys5zJNw8h8zTP",
  "hotelId": "6af930f5fb028382df103197",
  "roomCategoryId": "6af9e340fb028382df10319a",
  "checkIn": "2026-11-17T00:00:00.000Z",
  "checkOut": "2026-11-18T00:00:00.000Z",
  "numberOfRooms": 1,
  "numberOfGuests": 2,
  "priceSnapshot": {
    "pricePerNight": 12500,
    "numberOfNights": 1,
    "totalAmount": 12500,
    "currency": "INR"
  },
  "status": "EXPIRED",
  "holdExpiresAt": "2026-11-16T16:04:14.787Z",
  "idempotencyKey": "37368dc8-b41b-4e1a-9fe1-0dfcabf9446d",
  "requestFingerprint": "2b0eb0ba7c2d8e3e5fcc9d644f566b54782b1e9990fb4254cf9b87b28811ea00",
  "paymentId": "pay_7ef063a402392087f21312f6237a68261ad3248a084b7c7d4ecc09055a0e4f39",
  "paymentAttemptCount": 1,
  "createdAt": "2026-11-16T15:54:14.919Z",
  "updatedAt": "2026-11-16T16:30:52.259Z",
  "__v": 0
}
```

---

## 2. Service-to-Service Communication & Gateway Security

### 2.1 How Booking Service Gets Property & Room Data at Hold Time
- In `services/booking-service/src/services/bookingService.js`:
  Before entering the MongoDB hold transaction, it calls `getRoomPricing(roomCategoryId)` implemented in `catalogClient.js`.
- It executes:
  `GET http://localhost:4002/internal/rooms/:roomCategoryId/pricing`
- **Authentication**:
  Header: `x-internal-service-key: process.env.INTERNAL_SERVICE_SECRET`.
  Catalog Service verifies this using `timingSafeEqual` in `authenticateInternalService` (`services/catalog-service/src/middleware/internalServiceAuth.js`).

### 2.2 How Gateway Routes Requests
In `services/api-gateway/src/routes/proxyRoutes.js`:
- `/api/users` &rarr; `http://localhost:4001/api/users`
- `/api/hotels` &rarr; `http://localhost:4002/api/hotels`
- `/api/rooms` &rarr; `http://localhost:4002/api/rooms`
- `/api/bookings` &rarr; `http://localhost:4003/api/bookings`
- `/api/payments` &rarr; `http://localhost:4004/api/payments`
- `/api/webhooks/stripe` &rarr; `http://localhost:4004/api/webhooks/stripe`

### 2.3 Guaranteeing `/internal` Routes Are Never Exposed via Gateway
1. **Root Mounting**: In `catalog-service` and `booking-service`, internal routes are mounted at root `/internal/...` (not `/api/internal/...`).
2. **Gateway Route Whitelist**: The API Gateway only mounts `/api/*` and `/health`. Any client request to `/internal/...` hits the gateway 404 handler immediately.
3. **Path Rewriting**: In `proxyRoutes.js`, the proxy prepends `/api/hotels`, `/api/rooms`, etc. A client request to `/api/hotels/internal` rewrites to `/api/hotels/internal` on the catalog service, which does not exist (returns 404).
4. **Header Stripping**: The gateway must strip any incoming `x-internal-service-key` from external client requests so clients cannot spoof inter-service credentials.

---

## 3. Catalog Service Data Inventory

### 3.1 Hotel Model (`services/catalog-service/src/models/Hotel.js`)
- `name`: String (e.g. "Heritage Palace")
- `address`: String (full street address, e.g. "42 Marine Drive, Near Nariman Point")
- `contact`: String (phone number, e.g. "+91 9876543210")
- `city`: String (e.g. "Mumbai")
- `area`: String | null (e.g. "Marine Drive")
- `latitude`: Number (-90 to 90) | null
- `longitude`: Number (-180 to 180) | null
- `locationPrecision`: `'exact' | 'approximate'` (default: `'exact'`)
- `owner`: String (Clerk user ID)
- *Check-in / check-out times:* Currently NOT stored on `Hotel` model. Standard platform defaults apply: Check-in from 2:00 PM (14:00), Check-out until 11:00 AM (11:00).
- *Email:* Currently NOT stored as a separate field on `Hotel` (the `contact` field stores the primary phone number; owner email is in Clerk/User service).

### 3.2 Room Model (`services/catalog-service/src/models/Room.js`)
- `hotel`: ObjectId reference to `Hotel`
- `roomType`: String (e.g. "Deluxe Ocean Suite")
- `pricePerNight`: Number
- `amenities`: Array of Strings
- `images`: Array of URL Strings (main photo is `images[0]`)
- `totalUnits`: Number
- `isActive`: Boolean
- *Occupancy / Beds:* Currently NOT separate numeric columns on `Room`. The booking hold stores `numberOfGuests`; bed configuration is described in amenities or inferred.

### 3.3 Owner Contract vs. Public Contract
- **Owner Contract (`serializeOwnerHotel`)**:
  - `location.coordinates`: Exact `{ lat, lng }`
  - `address`: Full street address
  - `contact`: Phone number
- **Public Contract (`serializePublicHotel`)**:
  - `location.publicCoordinates`: Exact coords if `locationPrecision === 'exact'`; if `'approximate'`, deterministically jittered within a 500m radius (`location.approximateRadiusMeters: 500`).
  - `address`: Full street address for exact; strictly `area` or `city` only for approximate (zero street address leak).
  - `contact`: Omitted.

---

## 4. Payment Service Data Inventory

### 4.1 Payment Model (`services/payment-service/src/models/Payment.js`)
Stores:
- `paymentId`: String (unique internal payment identifier, e.g. `pay_600312...`)
- `bookingId`: ObjectId (references `Booking._id`)
- `userId`: String (Clerk user ID)
- `amountMinor`: Number (in paise, safe integer)
- `currency`: String ("INR")
- `provider`: "STRIPE"
- `stripePaymentIntentId`: String (e.g. `pi_3QS...`)
- `status`: String (`CREATED`, `REQUIRES_ACTION`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUND_PENDING`, `REFUNDED`)
- `paidAt`: Date | null (recorded when `payment_intent.succeeded` webhook arrives)
- `metadata`: Mixed

### 4.2 Card Brand, Last 4, and Payment Reference Status
- `cardBrand` and `cardLast4` are NOT currently persisted on the `Payment` document.
- Customer-facing payment reference: Currently, `paymentId` is an internal token. In the client, `ReceiptModal` formats a receipt number as `REC-${(booking._id).slice(-8).toUpperCase()}`.
- **How to read card details from Stripe**:
  When a payment succeeds, Stripe's PaymentIntent object has `charges.data[0].payment_method_details.card` or `payment_method.card` with `brand` (e.g. "visa") and `last4` (e.g. "4242").
- **Caching Strategy**:
  When `GET /internal/payments/booking/:bookingId/summary` is queried:
  1. If `Payment` record has `cardBrand` and `cardLast4` stored in a new optional subdocument or metadata, return immediately from MongoDB.
  2. If missing and `stripePaymentIntentId` exists, retrieve from Stripe with `expand: ['latest_charge', 'payment_method']`, update the `Payment` document in MongoDB, and return the summary.
  3. If Stripe is unreachable, return available fields (`status`, `amountMinor`, `currency`, `paidAt`) with `paymentSummaryAvailable: true`, or `null` if no payment record exists.

---

## 5. Existing Receipt View in `MyBookings.jsx`

In `client/src/components/ReceiptModal.jsx`:
- Displayed when a user clicks "Download receipt" on a CONFIRMED booking card.
- **Data used**:
  - `receiptNumber`: `REC-${(booking._id || "").slice(-8).toUpperCase()}`
  - `hotelName`: `booking.hotel?.name` or fallback matched from `AppContext.rooms`
  - `hotelAddress`: `booking.hotel?.address` or fallback matched from `AppContext.rooms`
  - `roomType`: `booking.roomType` or `booking.room?.roomType`
  - `checkIn`, `checkOut`, `nights`, `guestCount`
  - `totalAmount`: `booking.priceSnapshot.totalAmount` formatted with `formatINR`
  - `user`: Guest name and email from Clerk `useAppContext().user`
- Has a "Print / Save Receipt" button triggering `window.print()`.

---

## 6. Gap Analysis & Architecture Plan

### 6.1 Gaps Identified
1. **No Stay Snapshot on Booking (B2)**:
   The `Booking` schema only holds `hotelId` and `roomCategoryId`. If a hotel or room changes its name, photo, or coordinates later, the booking loses historical accuracy.
2. **Missing Internal Snapshot Endpoint in Catalog Service (B3)**:
   Catalog Service has `/internal/rooms/:id/pricing` and `/internal/hotels/owner/:id`, but lacks `GET /internal/properties/:propertyId/booking-snapshot?roomId=:roomId` returning full property metadata, exact coordinates, and room details.
3. **No Booking Detail Serializer (B1)**:
   `getBookingById` in `bookingQueryService.js` returns raw Mongoose lean document without `reference`, `stayDetails`, `paymentSummary`, `policy`, `timeline`, and without enforcing privacy rules for non-confirmed bookings.
4. **No Internal Payment Summary Endpoint (B5)**:
   Payment Service has `GET /internal/payments/:paymentId/status`, but no endpoint returning customer-safe `paymentSummary` by `bookingId`.
5. **No Dedicated Route `/bookings/:bookingId` (F1)**:
   The frontend currently only has `/my-bookings`.

---

### 6.2 Planned API Contracts

#### A. Internal Catalog Snapshot Endpoint (B3)
`GET /internal/properties/:propertyId/booking-snapshot?roomId=:roomId`
- **Headers:** `x-internal-service-key: <INTERNAL_SERVICE_SECRET>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "propertyId": "6af930f5fb028382df103197",
    "propertyName": "Heritage Palace Resort",
    "address": "42 Marine Drive, Near Nariman Point",
    "area": "Marine Drive",
    "city": "Mumbai",
    "contactPhone": "+91 9876543210",
    "contactEmail": null,
    "checkInTime": "14:00",
    "checkOutTime": "11:00",
    "coordinates": {
      "lat": 18.9220,
      "lng": 72.8347
    },
    "locationPrecision": "exact",
    "roomCategoryId": "6af9e340fb028382df10319a",
    "roomTypeName": "Deluxe Ocean Suite",
    "maxGuests": 3,
    "bedConfiguration": null,
    "mainPhoto": "https://images.unsplash.com/photo-1566073771259-6a8506099945"
  }
}
```

#### B. Internal Payment Summary Endpoint (B5)
`GET /internal/payments/booking/:bookingId/summary`
- **Headers:** `x-internal-service-key: <INTERNAL_SERVICE_SECRET>`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "SUCCEEDED",
    "amountMinor": 1250000,
    "currency": "INR",
    "paidAt": "2026-11-16T16:38:11.058Z",
    "cardBrand": "visa",
    "cardLast4": "4242",
    "paymentReference": "REC-ACA03151"
  }
}
```

#### C. Public Booking Detail Endpoint (B1)
`GET /api/bookings/:bookingId`
- **Authentication:** Clerk Bearer Token (must match `booking.userId`)
- **Access Control:** Returns 404 for another user's booking.
- **Response Shape (CONFIRMED):**
```json
{
  "success": true,
  "booking": {
    "id": "6afb30d9bda9c0cdaca03151",
    "reference": "PGM-ACA03151",
    "status": "CONFIRMED",
    "checkIn": "2026-11-17T00:00:00.000Z",
    "checkOut": "2026-11-18T00:00:00.000Z",
    "numberOfNights": 1,
    "numberOfRooms": 1,
    "numberOfGuests": 2,
    "priceBreakdown": {
      "pricePerNight": 12500,
      "numberOfNights": 1,
      "roomCharges": 12500,
      "taxesAndFees": 0,
      "totalAmount": 12500,
      "currency": "INR"
    },
    "stayDetails": {
      "propertyName": "Heritage Palace Resort",
      "address": "42 Marine Drive, Near Nariman Point",
      "area": "Marine Drive",
      "city": "Mumbai",
      "contactPhone": "+91 9876543210",
      "contactEmail": null,
      "checkInTime": "14:00",
      "checkOutTime": "11:00",
      "coordinates": {
        "lat": 18.9220,
        "lng": 72.8347
      },
      "locationPrecision": "exact",
      "roomTypeName": "Deluxe Ocean Suite",
      "maxGuests": 3,
      "mainPhoto": "https://images.unsplash.com/photo-1566073771259-6a8506099945"
    },
    "stayDetailsComplete": true,
    "paymentSummary": {
      "status": "SUCCEEDED",
      "amountMinor": 1250000,
      "currency": "INR",
      "paidAt": "2026-11-16T16:38:11.058Z",
      "cardBrand": "visa",
      "cardLast4": "4242",
      "paymentReference": "REC-ACA03151"
    },
    "paymentSummaryAvailable": true,
    "policy": "Free cancellation up to 48 hours before check-in. Cancellations made within 48 hours receive a 50% refund minus transaction fees.",
    "timeline": [
      {
        "event": "HELD",
        "label": "Room held",
        "timestamp": "2026-11-16T16:35:37.740Z"
      },
      {
        "event": "PAYMENT_SUCCEEDED",
        "label": "Payment received",
        "timestamp": "2026-11-16T16:38:11.058Z"
      },
      {
        "event": "CONFIRMED",
        "label": "Booking confirmed",
        "timestamp": "2026-11-16T16:38:11.058Z"
      }
    ],
    "createdAt": "2026-11-16T16:35:37.740Z",
    "updatedAt": "2026-11-16T16:38:11.058Z"
  }
}
```

- **Response Shape (HELD / Pending / Non-Confirmed Privacy Guard)**:
```json
{
  "success": true,
  "booking": {
    "id": "6afb41a2bda9c0cdaca03180",
    "reference": "PGM-ACA03180",
    "status": "HELD",
    "holdExpiresAt": "2026-11-17T22:04:14.000Z",
    "stayDetails": {
      "propertyName": "Heritage Palace Resort",
      "address": null,
      "area": "Marine Drive",
      "city": "Mumbai",
      "contactPhone": null,
      "contactEmail": null,
      "checkInTime": "14:00",
      "checkOutTime": "11:00",
      "coordinates": null,
      "publicCoordinates": {
        "lat": 18.9250,
        "lng": 72.8370
      },
      "locationPrecision": "approximate",
      "approximateRadiusMeters": 500,
      "roomTypeName": "Deluxe Ocean Suite",
      "maxGuests": 3,
      "mainPhoto": "https://images.unsplash.com/photo-1566073771259-6a8506099945"
    },
    "paymentSummary": null,
    "paymentSummaryAvailable": false,
    ...
  }
}
```

---

### 6.3 Migration and Rollback Plan

1. **Schema Migration**:
   - In `Booking.js`: Add optional subdocument `stayDetails`:
     `propertyName`, `address`, `area`, `city`, `contactPhone`, `contactEmail`, `checkInTime`, `checkOutTime`, `roomTypeName`, `maxGuests`, `bedConfiguration`, `mainPhoto`, `coordinates: { lat, lng }`, `locationPrecision`.
   - In `Payment.js`: Add optional subdocument `paymentDetails`:
     `cardBrand`, `cardLast4`, `receiptNumber`.
   - All fields are purely optional with default values.
2. **Backward Compatibility**:
   Existing bookings without `stayDetails` continue working. When `GET /api/bookings/:id` is called on an existing CONFIRMED booking, `stayDetails` is fetched once and cached lazily (Section B4).
3. **Rollback**:
   Because changes are additive, rolling back code removes serializer additions and ignores new MongoDB fields without requiring data drops or table locks.

---

### 6.4 Risk Analysis and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Catalog Service down at hold creation** | Hold creation could fail | Capture is strictly **best-effort**. If the internal call fails, hold is created normally with `stayDetails: null`. |
| **Catalog Service down on booking details page** | Booking page fails to load | Page falls back to public catalog data or degraded notice (`stayDetailsComplete: false`). |
| **Payment Service down on booking details page** | Booking page fails to load | Booking service returns `paymentSummary: null, paymentSummaryAvailable: false`. Only the payment block shows a retry message; stay details and map still render. |
| **Approximate property leaks exact coordinates** | Privacy breach | Enforced at the serializer level: `coordinates`, `contactPhone`, and street `address` are nullified unless `status === "CONFIRMED"` AND the caller is the verified owner of the booking. |
| **Internal routes accessed externally** | Unauthorized data access | Gateway routes only `/api/*`. `/internal/*` routes return 404 from gateway and require `x-internal-service-key` header with constant-time equality check. |

---

## 7. Audit Conclusion & Next Steps

All technical prerequisites, existing contracts, and architectural integration points for **Round 4g** have been investigated and documented.
No code changes have been made in Stage 0.

Awaiting user approval to proceed to **Stage 1 (Backend Implementation)**.
