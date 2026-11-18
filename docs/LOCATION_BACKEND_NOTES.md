# Property Location Backend Inspection Notes (Round 4c Backend)

## 1. Actual Property Schema & Database Type
- **Database System**: MongoDB Atlas (database: `hotel_catalog`), accessed via Mongoose 8.x in `services/catalog-service`.
- **Property Entity**: `Hotel` (`services/catalog-service/src/models/Hotel.js`).
- **Current Fields**:
  - `name`: `String` (required, trimmed)
  - `address`: `String` (required, trimmed)
  - `contact`: `String` (required, trimmed)
  - `owner`: `String` (required, trimmed, indexed `owner_1`)
  - `city`: `String` (required, trimmed, indexed `city_1`)
  - `status`: `String` enum `["ACTIVE", "INACTIVE", "DELETING"]` (default `"ACTIVE"`, indexed `status_1`)
  - `roomRevision`: `Number` (default `0`)
  - `timestamps`: `true` (`createdAt`, `updatedAt`)

## 2. Owner Endpoints for Creating and Updating Properties
- **Create Property**:
  - `POST /api/hotels/` handled by `registerHotel` in `src/controllers/hotelController.js`.
  - Authenticated via Clerk (`authenticate` middleware extracts `req.user.id`).
  - Currently accepts `{ name, address, contact, city }`.
- **List Owner Properties**:
  - `GET /api/hotels/owner` handled by `getOwnerHotels` in `src/controllers/hotelController.js`.
  - Returns `{ success: true, count, hotels: [...] }` matching `{ owner: req.user.id }`.
- **Update Property Status**:
  - `PATCH /api/hotels/:hotelId/status` handled by `updateHotelStatus` in `src/controllers/hotelLifecycleController.js`.
- **General Property Update (Existing Gap)**:
  - There is currently **no** general property update endpoint in `hotelRoutes.js` (only status transition and delete exist).
  - An owner update endpoint `PUT /api/hotels/:hotelId` will be added to accept `name`, `address`, `contact`, `city`, `latitude`, `longitude`, and `locationPrecision`, verifying property ownership against `req.user.id`.

## 3. How Rooms Reference Properties
- **Room Entity**: `Room` (`services/catalog-service/src/models/Room.js`).
- **Reference**:
  ```javascript
  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hotel",
    required: true,
  }
  ```
- **Existing Index**: `roomSchema.index({ hotel: 1, isActive: 1 })`.
- When querying rooms, `roomController.js` populates the parent hotel via `.populate("hotel", "_id name address contact city status")`.

## 4. Location-like Fields & Coordinate Deduplication
- Existing location fields:
  - `Hotel.address`: String holding street/area address (e.g. `"1 Okitayama Washimine, Kita Ward"` or `"MG Road"`).
  - `Hotel.city`: String holding the city name (e.g. `"Kyoto"`, `"Chennai"`).
- **Coordinate Deduplication Check**:
  - There are currently **no** `latitude`, `longitude`, `location`, or GeoJSON fields in `Hotel` or `Room`.
  - No coordinates exist anywhere in the catalog database.
  - Therefore, we are not duplicating any existing coordinate field.

## 5. List and Detail Endpoints Used by Frontend
- **Public Room/Stay Discovery**:
  - `GET /api/rooms` (`getPublicRooms` in `src/controllers/roomController.js`). Supports query param `?city=...`.
  - Populates `hotel` on each room.
- **Public Room Detail**:
  - `GET /api/rooms/:roomId` (`getPublicRoomById` in `src/controllers/roomController.js`).
  - Populates `hotel`.
- **Public Hotel Detail**:
  - `GET /api/hotels/:hotelId` will be added as a public endpoint so map cards or property-level views can retrieve hotel metadata directly.
- **Owner Room Management**:
  - `GET /api/rooms/hotel/:hotelId` (`getHotelRooms`).
  - `POST /api/rooms` (`createRoom`).
  - `PUT /api/rooms/:roomId` (`updateRoom`).

## 6. API Gateway Routing
- In `services/api-gateway/src/routes/proxyRoutes.js`:
  ```javascript
  router.use("/hotels", createServiceProxy(services.catalog, "/api/hotels"));
  router.use("/rooms", createServiceProxy(services.catalog, "/api/rooms"));
  ```
- The API Gateway (port 4000) transparently proxies all `/api/hotels/*` and `/api/rooms/*` requests to `catalog-service` (port 4002).
- No new route mapping in the API Gateway is needed because wildcard proxying for `/api/hotels` and `/api/rooms` is already configured.

## 7. Existing Indexes & Geospatial Index Decision
- Existing indexes on `hotels`:
  - `_id_`: Primary key.
  - `owner_1`: Fast lookup for owner hotel listings.
  - `city_1`: Filter for city-based queries.
  - `status_1`: Filter for active hotels.
- **Index Decision**:
  - Current queries filter on `status` and `city`.
  - A MongoDB `2dsphere` index requires a GeoJSON Point object (`{ type: "Point", coordinates: [lng, lat] }`) and fails or behaves unpredictably if documents contain null coordinates without sparse indexing.
  - Because bounding-box geospatial searches (`$geoWithin` / `$near`) are deferred to a subsequent map search milestone, a sparse compound 2d index or sparse 2dsphere index can be added if needed; we will add a sparse compound index `{ latitude: 1, longitude: 1 }` to support bounding queries without overhead.
