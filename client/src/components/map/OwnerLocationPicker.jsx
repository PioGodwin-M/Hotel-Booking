import React, { useState, useEffect, useCallback, useId } from "react";
import {
  Search,
  Crosshair,
  MapPin,
  X,
  Maximize2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { PropertyMap } from "./PropertyMap";
import { searchAddress, isValidCoordinate, CITY_COORDINATES } from "../../lib/geo";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";

export const OwnerLocationPicker = ({
  latitude = null,
  longitude = null,
  locationPrecision = "exact",
  area = "",
  city = "",
  address = "",
  onChange,
}) => {
  const searchInputId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchFeedback, setSearchFeedback] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  // Manual coordinate input accordion & fields
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualError, setManualError] = useState("");

  // Fullscreen mobile map sheet
  const [isFullScreen, setIsFullScreen] = useState(false);

  const hasCoordinates =
    latitude != null &&
    longitude != null &&
    isValidCoordinate(Number(latitude), Number(longitude));

  const parsedLat = hasCoordinates ? Number(latitude) : null;
  const parsedLng = hasCoordinates ? Number(longitude) : null;

  // Derive initial map center: property coords > city coordinates > default center
  const mapCenter = hasCoordinates
    ? [parsedLat, parsedLng]
    : (city && CITY_COORDINATES[city]
        ? [CITY_COORDINATES[city].lat, CITY_COORDINATES[city].lng]
        : null);

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback(
    ({ lat, lng }) => {
      if (isValidCoordinate(lat, lng)) {
        onChange?.({
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          locationPrecision,
          area,
        });
      }
    },
    [locationPrecision, area, onChange]
  );

  // Handle click on map to position marker
  const handleMapClick = useCallback(
    ({ lat, lng }) => {
      if (isValidCoordinate(lat, lng)) {
        onChange?.({
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          locationPrecision,
          area,
        });
      }
    },
    [locationPrecision, area, onChange]
  );

  // Perform geocode search via searchAddress()
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim() || (address && city ? `${address}, ${city}` : address || city);
    if (!query) {
      setSearchFeedback("Please enter an address, neighbourhood, or landmark to search.");
      return;
    }

    setIsSearching(true);
    setSearchFeedback(null);
    setSearchResults([]);

    try {
      const results = await searchAddress(query);
      if (results && results.length > 0) {
        setSearchResults(results);
      } else {
        setSearchFeedback(
          "No locations found. Try entering a nearby landmark or city, or drag the marker on the map."
        );
      }
    } catch {
      setSearchFeedback("Search request could not be completed. You can drag the map pin or enter coordinates manually.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result) => {
    if (isValidCoordinate(result.lat, result.lng)) {
      onChange?.({
        latitude: Number(result.lat.toFixed(6)),
        longitude: Number(result.lng.toFixed(6)),
        locationPrecision,
        area: area || result.displayName.split(",")[0].trim(),
      });
      setSearchResults([]);
      setSearchFeedback(null);
    }
  };

  // Browser Geolocation
  const handleUseCurrentLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        if (isValidCoordinate(lat, lng)) {
          onChange?.({
            latitude: lat,
            longitude: lng,
            locationPrecision,
            area,
          });
          toast.success("Location set from your current position.");
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          // PERMISSION_DENIED
          toast.error("Location access denied. Please search or pick a location on the map.");
        } else if (err.code === 2) {
          // POSITION_UNAVAILABLE
          toast.error("Current location is unavailable.");
        } else if (err.code === 3) {
          // TIMEOUT
          toast.error("Location request timed out. Please try again or search.");
        } else {
          toast.error("Could not obtain your current location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Clear location
  const handleClearLocation = () => {
    onChange?.({
      latitude: null,
      longitude: null,
      locationPrecision: "exact",
      area: "",
    });
    setManualLat("");
    setManualLng("");
    setManualError("");
    setSearchResults([]);
    setSearchFeedback(null);
  };

  // Apply manual coordinate inputs
  const handleApplyManualCoordinates = (e) => {
    e.preventDefault();
    setManualError("");
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || isNaN(lng) || !isValidCoordinate(lat, lng)) {
      setManualError("Please enter valid coordinates (-90 to 90 for latitude, -180 to 180 for longitude).");
      return;
    }

    onChange?.({
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      locationPrecision,
      area,
    });
    setShowManualEntry(false);
    toast.success("Coordinates updated successfully.");
  };

  // Full-screen mobile sheet body scroll lock & Escape handler
  useEffect(() => {
    if (isFullScreen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          setIsFullScreen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = prev;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isFullScreen]);

  return (
    <div className="space-y-4">
      {/* Search Bar & Action Buttons */}
      <div className="space-y-2">
        <label
          htmlFor={searchInputId}
          className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
        >
          Search address or landmark
        </label>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={address || city ? `e.g. ${address || city}` : "e.g. Connaught Place, New Delhi"}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-[10px] bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-[#0b1220] dark:focus:border-white transition-colors"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={isSearching}
              className="rounded-[10px] text-xs font-semibold shrink-0"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              leftIcon={
                isLocating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Crosshair className="w-3.5 h-3.5" />
                )
              }
              className="rounded-[10px] text-xs font-semibold shrink-0"
              title="Use current location"
            >
              {isLocating ? "Locating..." : "Use my current location"}
            </Button>
          </div>
        </form>

        <p className="text-[10px] text-stone-400">
          Search powered by OpenStreetMap Nominatim. Click the map or drag the pin to refine.
        </p>
      </div>

      {/* Search Feedback Message */}
      {searchFeedback && (
        <div
          role="status"
          className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>{searchFeedback}</span>
        </div>
      )}

      {/* Search Results Dropdown List */}
      {searchResults.length > 0 && (
        <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-stone-900 shadow-sm divide-y divide-stone-100 dark:divide-white/5 overflow-hidden">
          <div className="px-3 py-2 bg-stone-50 dark:bg-stone-800/40 text-[11px] font-semibold text-stone-600 dark:text-stone-400">
            Select matching location:
          </div>
          {searchResults.map((result, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSearchResult(result)}
              className="w-full text-left px-3.5 py-2.5 text-xs text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 truncate">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                <span className="truncate">{result.displayName}</span>
              </div>
              <span className="text-[10px] font-mono text-stone-400 shrink-0">
                {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Interactive Map Container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
            Property pin location
          </span>
          <button
            type="button"
            onClick={() => setIsFullScreen(true)}
            className="sm:hidden inline-flex items-center gap-1 text-xs font-semibold text-[#0b1220] dark:text-stone-200 hover:underline"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Pick on map
          </button>
        </div>

        <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-white/10">
          <PropertyMap
            height="240px"
            center={mapCenter}
            zoom={hasCoordinates ? 15 : 12}
            draggableMarker={
              hasCoordinates
                ? {
                    lat: parsedLat,
                    lng: parsedLng,
                    onDragEnd: handleMarkerDragEnd,
                  }
                : null
            }
            onMapClick={handleMapClick}
            accessibleName="Property location map picker"
            className="w-full sm:!h-[280px]"
          />
        </div>

        <p className="text-[11px] text-stone-500">
          Click anywhere on the map to set location, or drag the pin to fine-tune.
        </p>
      </div>

      {/* Read-Only Coordinate Status & Clear Button */}
      <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <span className="text-stone-500 mr-1.5">Latitude:</span>
            <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
              {hasCoordinates ? parsedLat.toFixed(6) : "Not set"}
            </span>
          </div>
          <div>
            <span className="text-stone-500 mr-1.5">Longitude:</span>
            <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
              {hasCoordinates ? parsedLng.toFixed(6) : "Not set"}
            </span>
          </div>
        </div>

        {hasCoordinates && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleClearLocation}
            leftIcon={<X className="w-3.5 h-3.5" />}
            className="rounded-[10px] text-xs font-semibold py-1 h-auto"
          >
            Clear location
          </Button>
        )}
      </div>

      {/* Manual Coordinate Entry Accordion */}
      <div className="border border-stone-200 dark:border-white/10 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowManualEntry(!showManualEntry)}
          className="w-full flex items-center justify-between p-3 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors"
        >
          <span>Enter coordinates manually</span>
          {showManualEntry ? (
            <ChevronUp className="w-4 h-4 text-stone-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-stone-400" />
          )}
        </button>

        {showManualEntry && (
          <form
            onSubmit={handleApplyManualCoordinates}
            className="p-3 pt-0 space-y-3 bg-stone-50/50 dark:bg-stone-800/20 border-t border-stone-200 dark:border-white/5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Input
                label="Latitude (-90 to 90)"
                placeholder="e.g. 28.6139"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
              />
              <Input
                label="Longitude (-180 to 180)"
                placeholder="e.g. 77.2090"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
              />
            </div>

            {manualError && (
              <p className="text-xs text-rose-500">{manualError}</p>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                variant="primary"
                className="rounded-[10px] text-xs font-semibold"
              >
                Set coordinates
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Exact vs Approximate Choice */}
      <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-white/10">
        <label className="block text-xs font-semibold text-stone-900 dark:text-stone-100">
          Location privacy on public listings
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option: Exact */}
          <label
            className={cn(
              "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
              locationPrecision === "exact"
                ? "border-[#0b1220] dark:border-white bg-stone-50 dark:bg-stone-800/60 shadow-xs"
                : "border-stone-200 dark:border-white/10 hover:border-stone-400"
            )}
          >
            <input
              type="radio"
              name="locationPrecision"
              value="exact"
              checked={locationPrecision === "exact"}
              onChange={() =>
                onChange?.({
                  latitude,
                  longitude,
                  locationPrecision: "exact",
                  area,
                })
              }
              className="mt-0.5 text-[#0b1220] focus:ring-0"
            />
            <div className="space-y-1">
              <span className="block text-xs font-bold text-stone-900 dark:text-stone-100">
                Show exact location
              </span>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Pin will show your property's exact location on the map.
              </p>
            </div>
          </label>

          {/* Option: Approximate */}
          <label
            className={cn(
              "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
              locationPrecision === "approximate"
                ? "border-[#0b1220] dark:border-white bg-stone-50 dark:bg-stone-800/60 shadow-xs"
                : "border-stone-200 dark:border-white/10 hover:border-stone-400"
            )}
          >
            <input
              type="radio"
              name="locationPrecision"
              value="approximate"
              checked={locationPrecision === "approximate"}
              onChange={() =>
                onChange?.({
                  latitude,
                  longitude,
                  locationPrecision: "approximate",
                  area,
                })
              }
              className="mt-0.5 text-[#0b1220] focus:ring-0"
            />
            <div className="space-y-1">
              <span className="block text-xs font-bold text-stone-900 dark:text-stone-100">
                Show approximate area only
              </span>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Guests see the general area on the map. The exact location and street address are not shown publicly.
              </p>
            </div>
          </label>
        </div>

        {/* Optional Area/Neighbourhood name when approximate is selected */}
        {locationPrecision === "approximate" && (
          <div className="space-y-1.5 pt-1">
            <Input
              label="Area or neighbourhood name (optional)"
              placeholder="e.g. Indiranagar, Connaught Place, Baga"
              value={area || ""}
              onChange={(e) =>
                onChange?.({
                  latitude,
                  longitude,
                  locationPrecision,
                  area: e.target.value,
                })
              }
            />
            <p className="text-[11px] text-stone-400">
              Helps guests identify the general neighbourhood without displaying your exact street address.
            </p>
          </div>
        )}
      </div>

      {/* Mobile Full-Screen Map Picker Sheet */}
      {isFullScreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pick location on map"
          className="fixed inset-0 z-50 bg-white dark:bg-stone-900 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Pick location on map
              </h3>
              <p className="text-[11px] text-stone-500">
                Tap anywhere or drag pin to position
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFullScreen(false)}
              className="p-2 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
              aria-label="Close full-screen map picker"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Map in full screen */}
          <div className="flex-1 relative">
            <PropertyMap
              height="100%"
              center={mapCenter}
              zoom={hasCoordinates ? 16 : 13}
              draggableMarker={
                hasCoordinates
                  ? {
                      lat: parsedLat,
                      lng: parsedLng,
                      onDragEnd: handleMarkerDragEnd,
                    }
                  : null
              }
              onMapClick={handleMapClick}
              accessibleName="Full screen property location map picker"
              className="w-full h-full rounded-none border-0"
            />
          </div>

          {/* Footer action bar */}
          <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between gap-3">
            <div className="text-xs truncate font-mono text-stone-600 dark:text-stone-300">
              {hasCoordinates
                ? `${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)}`
                : "No location selected"}
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setIsFullScreen(false)}
              className="rounded-[10px] text-xs font-semibold px-5"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerLocationPicker;