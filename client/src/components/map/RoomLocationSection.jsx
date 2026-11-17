import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { MapPin, Navigation, ExternalLink, X, Maximize2, Info } from "lucide-react";
import {
  getPublicCoordinates,
  getGoogleMapsSearchUrl,
  getGoogleMapsDirectionsUrl,
} from "../../lib/geo";

// Lazy load PropertyMap to isolate Leaflet and ensure zero impact on initial bundle
const PropertyMap = lazy(() => import("./PropertyMap"));

export const RoomLocationSection = ({ room, isSampleMode = false }) => {
  const hotel = room?.hotel || {};
  const locationData = hotel?.location;
  const publicCoords = getPublicCoordinates(room);

  const precision = locationData?.locationPrecision || "exact";
  const isApproximate = precision === "approximate";
  const radiusMeters = locationData?.approximateRadiusMeters || 500;

  // Address determination:
  // Approximate properties NEVER display street address; they show area & city only.
  const displayAddress = isApproximate
    ? hotel?.area
      ? `${hotel.area}, ${hotel.city || ""}`.replace(/^,\s*|,\s*$/g, "")
      : hotel?.city || ""
    : hotel?.address || hotel?.city || "";

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const sectionRef = useRef(null);
  const openButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  // IntersectionObserver to defer map loading until near viewport
  useEffect(() => {
    if (!sectionRef.current || isNearViewport) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [isNearViewport]);

  // Esc key & body scroll lock for mobile full-screen sheet
  useEffect(() => {
    if (!mobileSheetOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus close button on open
    closeButtonRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMobileSheetOpen(false);
        openButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileSheetOpen]);

  // If no coordinates and no address text, hide the section entirely
  if (!publicCoords && !displayAddress) {
    return null;
  }

  const searchUrl = getGoogleMapsSearchUrl({
    lat: publicCoords?.lat,
    lng: publicCoords?.lng,
    address: displayAddress,
  });

  const directionsUrl = getGoogleMapsDirectionsUrl({
    lat: publicCoords?.lat,
    lng: publicCoords?.lng,
    address: displayAddress,
  });

  const stayTitle = room?.roomType
    ? `${hotel?.name || "Stay"} - ${room.roomType}`
    : hotel?.name || "Stay";

  return (
    <section
      ref={sectionRef}
      className="py-10 border-t border-stone-200 dark:border-white/10"
      aria-labelledby="location-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h2
            id="location-heading"
            className="text-xl sm:text-2xl font-semibold text-[#0b1220] dark:text-[#faf8f5]"
          >
            Where you'll stay
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-stone-500" />
            <span>{displayAddress}</span>
            {isSampleMode && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 ml-1">
                Sample location
              </span>
            )}
          </p>
        </div>

        {isApproximate && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-white/10 text-xs text-stone-600 dark:text-stone-400">
            <Info className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <span>Approximate area. The exact address isn't shown publicly.</span>
          </div>
        )}
      </div>

      {/* When NO valid coordinates exist: Hide map frame, show clean address & Google Maps link */}
      {!publicCoords ? (
        <div className="p-6 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50/50 dark:bg-stone-900/50">
          <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
            {displayAddress}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            Map coordinates are not available for this property yet.
          </p>
          {searchUrl && (
            <div className="mt-4">
              <a
                href={searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0b1220] text-white hover:bg-stone-800 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                Open in Google Maps
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
              </a>
            </div>
          )}
        </div>
      ) : (
        /* Coordinates exist: Render desktop 2-column layout and mobile preview */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Address details & Navigation links */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-stone-900 space-y-3">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-stone-400">
                  {isApproximate ? "General Area" : "Location"}
                </span>
                <p className="text-base font-semibold text-[#0b1220] dark:text-[#faf8f5] mt-0.5">
                  {displayAddress}
                </p>
              </div>

              {isApproximate ? (
                <p className="text-xs text-stone-500 leading-relaxed">
                  To protect host privacy, the map indicates the surrounding neighbourhood within{" "}
                  {radiusMeters} metres.
                </p>
              ) : (
                <p className="text-xs text-stone-500 leading-relaxed">
                  Exact location confirmed. Directions can be launched directly in your preferred navigation app.
                </p>
              )}

              <div className="pt-2 flex flex-wrap gap-2.5">
                {searchUrl && (
                  <a
                    href={searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0b1220] text-white hover:bg-stone-800 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Open in Maps
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                )}

                {directionsUrl && (
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Get directions
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Desktop Map (380px) & Mobile Preview (200px) */}
          <div className="lg:col-span-7">
            {/* Desktop Map (Visible on sm and up) */}
            <div className="hidden sm:block">
              {isNearViewport ? (
                <Suspense
                  fallback={
                    <div className="w-full h-[380px] rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-white/10 flex items-center justify-center text-xs text-stone-400 animate-pulse">
                      Loading map...
                    </div>
                  }
                >
                  <PropertyMap
                    height="380px"
                    circle={
                      isApproximate
                        ? {
                            lat: publicCoords.lat,
                            lng: publicCoords.lng,
                            radiusMeters,
                          }
                        : null
                    }
                    markers={
                      !isApproximate
                        ? [
                            {
                              id: hotel?._id || room?._id || "stay-marker",
                              lat: publicCoords.lat,
                              lng: publicCoords.lng,
                              title: stayTitle,
                            },
                          ]
                        : []
                    }
                    accessibleName={`Map showing location of ${stayTitle}`}
                    addressText={displayAddress}
                  />
                </Suspense>
              ) : (
                <div className="w-full h-[380px] rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-white/10" />
              )}
            </div>

            {/* Mobile Map Preview (200px tall with "View larger map" button) */}
            <div className="block sm:hidden relative rounded-xl overflow-hidden border border-stone-200 dark:border-white/10">
              {isNearViewport ? (
                <Suspense
                  fallback={
                    <div className="w-full h-[200px] bg-stone-100 dark:bg-stone-900 flex items-center justify-center text-xs text-stone-400">
                      Loading preview...
                    </div>
                  }
                >
                  <PropertyMap
                    height="200px"
                    interactive={false}
                    circle={
                      isApproximate
                        ? {
                            lat: publicCoords.lat,
                            lng: publicCoords.lng,
                            radiusMeters,
                          }
                        : null
                    }
                    markers={
                      !isApproximate
                        ? [
                            {
                              id: hotel?._id || "mobile-preview-marker",
                              lat: publicCoords.lat,
                              lng: publicCoords.lng,
                              title: stayTitle,
                            },
                          ]
                        : []
                    }
                    showControls={false}
                    accessibleName={`Preview map showing ${stayTitle}`}
                    addressText={displayAddress}
                  />
                </Suspense>
              ) : (
                <div className="w-full h-[200px] bg-stone-100 dark:bg-stone-900" />
              )}

              <button
                ref={openButtonRef}
                type="button"
                onClick={() => setMobileSheetOpen(true)}
                className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#0b1220] text-white rounded-lg shadow-md hover:bg-stone-800 transition-colors"
                aria-label="View larger map in full screen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                View larger map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Full-Screen Sheet Modal */}
      {mobileSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-map-title"
          className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-stone-950 animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-white/10 shrink-0">
            <div>
              <h3
                id="mobile-map-title"
                className="text-base font-semibold text-[#0b1220] dark:text-[#faf8f5]"
              >
                {stayTitle}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">{displayAddress}</p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => {
                setMobileSheetOpen(false);
                openButtonRef.current?.focus();
              }}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b1220]"
              aria-label="Close full-screen map"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Interactive Map */}
          <div className="flex-1 w-full relative">
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center text-xs text-stone-400">
                  Loading map...
                </div>
              }
            >
              <PropertyMap
                height="100%"
                circle={
                  isApproximate
                    ? {
                        lat: publicCoords?.lat,
                        lng: publicCoords?.lng,
                        radiusMeters,
                      }
                    : null
                }
                markers={
                  !isApproximate && publicCoords
                    ? [
                        {
                          id: "sheet-marker",
                          lat: publicCoords.lat,
                          lng: publicCoords.lng,
                          title: stayTitle,
                        },
                      ]
                    : []
                }
                accessibleName={`Full-screen map for ${stayTitle}`}
                addressText={displayAddress}
              />
            </Suspense>
          </div>

          {/* Footer Bar */}
          <div className="p-4 border-t border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-900 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-stone-500 truncate max-w-[50%]">
              {isApproximate ? "Approximate area" : "Exact location"}
            </span>
            <div className="flex gap-2">
              {searchUrl && (
                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#0b1220] text-white rounded-lg hover:bg-stone-800 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Open in Maps
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default RoomLocationSection;
