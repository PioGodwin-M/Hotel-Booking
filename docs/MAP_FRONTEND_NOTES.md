# Frontend Map Architecture & Inspection Notes (Round 4c Stage 0)

## 1. Executive Summary & Privacy Audit

Before implementing any frontend code, an empirical privacy inspection was executed against the running microservices via the API Gateway (`http://localhost:4000`).

### Empirical Privacy Audit Results
A test property was registered with sensitive address data and approximate precision:
- **Raw Stored Address**: `"42 Confidential Penthouse, Secret Lane"`
- **Raw Stored Area**: `"Old Forest Hills"`
- **Raw Stored Coordinates**: `lat: 32.2396, lng: 77.1887`
- **Location Precision**: `"approximate"`

Each public endpoint used by the frontend was queried through the API Gateway:
1. **Public Hotel Detail** (`GET /api/hotels/:hotelId`):
   - Address returned: `"Old Forest Hills"` (Street name and penthouse details are **completely absent**).
   - Coordinates returned: `location.publicCoordinates = { lat: 32.239328, lng: 77.186397 }` (Deterministic pseudo-random offset within 500m).
   - Raw `latitude`, `longitude`, and owner `coordinates` properties: **Zero leakage** (stripped by server serializer).
2. **Public Room Listing** (`GET /api/rooms`):
   - Populated `hotel.address`: `"Old Forest Hills"` (Street address strictly absent).
   - Populated `hotel.location.publicCoordinates`: `{ lat: 32.239328, lng: 77.186397 }`.
   - Raw exact coordinates: **Zero leakage**.
3. **Public Room Detail** (`GET /api/rooms/:roomId`):
   - Populated `hotel.address`: `"Old Forest Hills"`.
   - Populated `hotel.location.publicCoordinates`: `{ lat: 32.239328, lng: 77.186397 }`.
   - Raw exact coordinates: **Zero leakage**.

**Conclusion**: Privacy invariants hold unconditionally across every public endpoint. No leaks detected.

---

## 2. Actual API Response Shapes Received by Frontend

### A. Public Responses (`GET /api/hotels/:id`, `GET /api/rooms`, `GET /api/rooms/:id`)

#### 1. Exact-Location Property
```json
{
  "_id": "6afc468fc44cdf55a7c52115",
  "name": "Gateway Grand Residency",
  "address": "100 Outer Ring Road, Bellandur",
  "area": "Bellandur",
  "city": "Bangalore",
  "location": {
    "publicCoordinates": { "lat": 12.9352, "lng": 77.6823 },
    "locationPrecision": "exact",
    "approximateRadiusMeters": null
  }
}
```

#### 2. Approximate-Location Property
```json
{
  "_id": "6afc48cb948d71b5b6916c54",
  "name": "Privacy Audit Sanctuary",
  "address": "Old Forest Hills",
  "area": "Old Forest Hills",
  "city": "Manali",
  "location": {
    "publicCoordinates": { "lat": 32.239328, "lng": 77.186397 },
    "locationPrecision": "approximate",
    "approximateRadiusMeters": 500
  }
}
```

#### 3. Property Without Coordinates (Older or Unset)
```json
{
  "_id": "6af930f5fb028382df103197",
  "name": "Himalayan Pine Lodge Shimla",
  "address": "Mall Road Upper Ridge, Shimla",
  "city": "Shimla",
  "location": null
}
```

### B. Owner Responses (`GET /api/hotels/owner`, `POST /api/hotels`, `PUT /api/hotels/:id`)
Exposes the actual stored coordinates under `location.coordinates` so the owner can position and edit the marker:
```json
{
  "_id": "6afc468fc44cdf55a7c52115",
  "name": "Gateway Grand Residency",
  "address": "100 Outer Ring Road, Bellandur",
  "area": "Bellandur Tech Zone",
  "city": "Bangalore",
  "location": {
    "coordinates": { "lat": 12.9352, "lng": 77.6823 },
    "locationPrecision": "approximate",
    "approximateRadiusMeters": 500
  }
}
```

---

## 3. Pages and Components Involved

| Page / Component | Path | Role in Round 4c |
|---|---|---|
| **Room Details** | `client/src/pages/RoomDetails.jsx` | Add "Where you'll stay" section between Amenities (line 879) and Reviews (line 907). Desktop: 380px map, address, Open in Maps & Get Directions. Mobile (390px): 200px preview with "View larger map" opening accessible full-screen sheet with focus trap, ESC, body scroll lock. |
| **All Stays (Catalog)** | `client/src/pages/AllRooms.jsx` | Add third view toggle ("Map") alongside Grid and List (`?view=map`). Desktop: 55% card list, 45% sticky map with price markers. Mobile: full-screen map with bottom swipe sheet. Client-side "Search this area" button filtering loaded stays by bounds. |
| **Register Property** | `client/src/components/HotelReg.jsx` | Enhance Step 2 ("Location & address"): address search, interactive map with draggable marker, read-only lat/lng, "Use my current location", "Clear location", choice: exact vs approximate, structured area input. |
| **Edit Property (Owner)** | `client/src/components/EditPropertyModal.jsx` *(New)* | Modal opened from Owner Dashboard and List Room when an owner clicks "Add location" or "Edit property". Saves via `PUT /api/hotels/:hotelId`. |
| **Owner Dashboard** | `client/src/pages/hotelOwner/Dashboard.jsx` | Show quiet notice for properties missing coordinates: "Add your location so guests can see your property on the map" with an "Add location" button. |
| **Property Map Wrapper** | `client/src/components/map/PropertyMap.jsx` *(New)* | Reusable, lazy-loaded (`React.lazy`) Leaflet map wrapper. Custom ink marker, price markers, accessibility region, reduced motion support, tile failure fallback. |
| **Geo Utilities** | `client/src/lib/geo.js` *(New)* | Strict reader separation: `getPublicCoordinates(stay)` (reads `location.publicCoordinates`) vs `getOwnerCoordinates(property)` (reads `location.coordinates`). Address search wrapper `searchAddress(query)` with session caching. |

---

## 4. Owner Form & Request Code Inspection

- **Registration (`HotelReg.jsx`)**:
  - Uses `authApi.post("/api/hotels/", payload)`.
  - Currently sends `{ name, address, city, contact, email, images }`.
  - Will be enhanced in Step 2 to include `{ latitude, longitude, locationPrecision, area }`.
- **Property Update (`PUT /api/hotels/:hotelId`)**:
  - Validated in Stage 0: `catalog-service` supports `PUT /api/hotels/:hotelId`.
  - Accepts optional `{ name, address, contact, city, area, latitude, longitude, locationPrecision }`.
  - Clearing coordinates: `{ latitude: null, longitude: null }`.

---

## 5. Routing & State Preservation

- Stays page: preserves all URL search parameters (`searchParams`):
  - View mode is persisted in URL: `?view=map` (alongside `?search=...`, `?roomType=...`, `?price=...`, `?sort=...`).
  - Switching between grid, list, and map retains existing query parameters.
- Room Details: deep-linkable `/rooms/:id`.
- Owner portal: `/owner` (Dashboard), `/owner/list-room` (Room list).

---

## 6. Dependencies & Map Library Strategy

- **Existing packages**: `react` 19.1.0, `react-dom` 19.1.0, `vite` 6.3.5, `tailwindcss` 4.1.7, `lucide-react`, `framer-motion` 14, `clsx`, `tailwind-merge`.
- **Map Library Plan**:
  - Install `leaflet`.
  - Wrap Leaflet directly in `PropertyMap.jsx` using `useRef` and standard DOM lifecycle (or React-Leaflet v5 if verified with React 19). Wrapping Leaflet directly ensures 100% clean bundle isolation, zero React 19 peer-dependency conflicts, exact control over tile error boundaries, custom marker DOMs, touch handling, and keyboard accessibility.
  - Fix Vite Leaflet marker icon asset resolution.
  - Tile config: `src/config/map.js` reading `VITE_MAP_TILE_URL` with default OpenStreetMap attribution.
  - Dynamic import via `React.lazy` ensures Leaflet (~140KB) is strictly excluded from the initial main bundle and loaded only on pages rendering a map.

---

## 7. Shared Components to Reuse

- `SafeImage` (`client/src/components/ui/SafeImage.jsx`) for card image rendering.
- `RoomCard` (`client/src/components/RoomCard.jsx`) for list and map preview cards.
- `formatINR` (`client/src/lib/formatters.js`) for price formatting on markers.
- `Button`, `Input`, `Select`, `Badge`, `Skeleton` (`client/src/components/ui/`).
- Standard container classes: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
- Toast notifications (`react-hot-toast`).
- Style tokens: Inter font, ink primary buttons (`#0B1220`), hairline borders (`border-stone-200 / border-white/10`), 12px card radius, 10px button radius.

---

## 8. Stage 0 Verification Status

- [x] Full inspection of frontend pages, components, and routing completed.
- [x] Empirical privacy audit against running API Gateway verified on all public endpoints: **Zero leakage of street address or exact coordinates**.
- [x] Real API response contracts documented for exact, approximate, and null location stays.
- [x] Owner form and update API endpoints verified.
- [x] Zero lines of frontend or backend code modified during Stage 0.
- [x] **Execution stopped for user confirmation prior to Stage 1.**
