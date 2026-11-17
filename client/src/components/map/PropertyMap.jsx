import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MAP_TILE_URL,
  MAP_ATTRIBUTION,
  MAP_MAX_ZOOM,
  DEFAULT_ZOOM,
  DEFAULT_CENTER,
} from "../../config/map";
import { formatINR } from "../../lib/formatters";
import { getGoogleMapsSearchUrl } from "../../lib/geo";
import { RotateCcw, Plus, Minus, MapPin, AlertCircle } from "lucide-react";

// Fix default Leaflet icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href,
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).href,
});

let clusterModulePromise = null;
async function loadClusterModule() {
  if (typeof window === "undefined") return null;
  window.L = L;
  if (!clusterModulePromise) {
    clusterModulePromise = Promise.all([
      import("leaflet.markercluster"),
      import("leaflet.markercluster/dist/MarkerCluster.css"),
      import("leaflet.markercluster/dist/MarkerCluster.Default.css"),
    ]);
  }
  await clusterModulePromise;
  return L.markerClusterGroup;
}

function createClusterIcon(cluster) {
  const count = cluster.getChildCount();
  const html = `
    <div 
      class="flex items-center justify-center w-10 h-10 rounded-full bg-[#0b1220] text-white font-bold text-xs shadow-lg border-2 border-white hover:scale-105 transition-transform cursor-pointer"
      tabindex="0"
      role="button"
      aria-label="${count} stays, zoom in"
    >
      ${count}
    </div>
  `;
  return L.divIcon({
    html,
    className: "custom-cluster-marker",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function createPopupContent(preview, id) {
  if (!preview) return "";
  const title = preview.title || "Stay";
  const roomType = preview.roomType ? `<p class="text-[11px] text-stone-500 mt-0.5">${preview.roomType}</p>` : "";
  const city = preview.city ? `<span class="text-[11px] text-stone-500">${preview.city}</span>` : "";
  const price = preview.price ? `${formatINR(preview.price)} <span class="text-[10px] text-stone-500 font-normal">/ night</span>` : "";
  const image = preview.image ? `
    <div class="w-full h-24 mb-2 overflow-hidden rounded-lg bg-stone-100">
      <img src="${preview.image}" alt="${title}" class="w-full h-full object-cover" />
    </div>
  ` : "";

  return `
    <div class="p-1 min-w-[200px] max-w-[240px] text-left">
      ${image}
      <h4 class="text-xs font-bold text-[#0b1220] dark:text-[#faf8f5] leading-snug line-clamp-1">${title}</h4>
      ${roomType}
      ${city}
      <div class="mt-2 pt-2 border-t border-stone-100 dark:border-white/10 flex items-center justify-between">
        <span class="text-xs font-bold text-[#0b1220] dark:text-[#faf8f5]">${price}</span>
        <a href="/rooms/${id}" class="text-[11px] font-semibold text-[#0b1220] dark:text-[#faf8f5] underline hover:text-stone-600">View stay</a>
      </div>
    </div>
  `;
}

/**
 * Creates custom HTML divIcon for markers.
 */
function createCustomMarkerIcon({ isSelected, price, title, isDraggable }) {
  if (price !== undefined && price !== null) {
    // Price Marker (for Stays page)
    const formattedPrice = formatINR(price);
    const bgClass = isSelected
      ? "bg-white text-[#0b1220] ring-2 ring-[#0b1220] scale-105 z-30"
      : "bg-[#0b1220] text-white hover:bg-stone-800 z-10";

    const html = `
      <div 
        class="inline-flex items-center justify-center px-2 py-1 rounded-[8px] text-xs font-semibold shadow-md border border-white/20 transition-all cursor-pointer whitespace-nowrap select-none ${bgClass}"
        tabindex="0"
        role="button"
        aria-label="${title ? `${title}, ${formattedPrice}` : formattedPrice}"
      >
        ${formattedPrice}
      </div>
    `;
    return L.divIcon({
      html,
      className: "custom-price-marker",
      iconSize: [60, 28],
      iconAnchor: [30, 14],
    });
  }

  // Ink Glyph Marker (for Room Details & Single Property)
  const pulseRing = isDraggable
    ? `<div class="absolute -inset-1 rounded-full bg-[#0b1220]/20 animate-ping"></div>`
    : "";

  const html = `
    <div 
      class="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#0b1220] text-white shadow-lg border-2 border-white transition-transform hover:scale-110 cursor-pointer"
      tabindex="0"
      role="button"
      aria-label="${title || "Property Location"}"
    >
      ${pulseRing}
      <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-ink-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

export const PropertyMap = ({
  markers = [],
  selectedId = null,
  height = "380px",
  interactive = true,
  onMarkerClick,
  onBoundsChange,
  circle = null, // { lat, lng, radiusMeters, precision }
  accessibleName = "Property Location Map",
  addressText = "",
  className = "",
  center = null,
  zoom = null,
  showControls = true,
  draggableMarker = null, // { lat, lng, onDragEnd }
  onMapClick = null,
}) => {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletMarkersRef = useRef(new Map());
  const markerGroupRef = useRef(null);
  const clusterGroupRef = useRef(null);
  const circleLayerRef = useRef(null);
  const draggableLayerRef = useRef(null);
  const initialViewRef = useRef(null);

  const [tileError, setTileError] = useState(false);
  const [touchHintVisible, setTouchHintVisible] = useState(false);
  const touchTimerRef = useRef(null);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Detect reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    let initialCenter = center || DEFAULT_CENTER;
    let initialZoom = zoom || (markers.length > 0 || circle ? 14 : DEFAULT_ZOOM);

    if (!center && markers.length === 1 && markers[0].lat && markers[0].lng) {
      initialCenter = [markers[0].lat, markers[0].lng];
    } else if (!center && circle?.lat && circle?.lng) {
      initialCenter = [circle.lat, circle.lng];
    }

    initialViewRef.current = { center: initialCenter, zoom: initialZoom };

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: false, // We render custom 44px accessible touch controls
      attributionControl: true,
      scrollWheelZoom: false, // Turned off until user clicks/focuses map
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
    });

    // Add Tile Layer with error tracking
    const tileLayer = L.tileLayer(MAP_TILE_URL, {
      attribution: MAP_ATTRIBUTION,
      maxZoom: MAP_MAX_ZOOM,
    });

    tileLayer.on("tileerror", () => {
      // Graceful offline fallback: if tiles fail to load
      setTileError(true);
    });

    tileLayer.addTo(map);

    // Click map to enable scrollWheelZoom and notify onMapClick
    map.on("click", (e) => {
      if (interactive && !map.scrollWheelZoom.enabled()) {
        map.scrollWheelZoom.enable();
      }
      if (onMapClickRef.current && e.latlng) {
        onMapClickRef.current({
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        });
      }
    });

    // Mobile touch interaction hint (two-finger pan reminder)
    if (interactive && typeof window !== "undefined" && "ontouchstart" in window) {
      const container = containerRef.current;
      const handleTouch = (e) => {
        if (e.touches && e.touches.length === 1) {
          setTouchHintVisible(true);
          clearTimeout(touchTimerRef.current);
          touchTimerRef.current = setTimeout(() => {
            setTouchHintVisible(false);
          }, 2000);
        } else {
          setTouchHintVisible(false);
        }
      };
      container?.addEventListener("touchstart", handleTouch, { passive: true });
    }

    // Bounds change listener for "Search this area"
    if (onBoundsChange) {
      map.on("moveend", () => {
        const bounds = map.getBounds();
        onBoundsChange({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        });
      });
    }

    mapInstanceRef.current = map;

    return () => {
      clearTimeout(touchTimerRef.current);
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronize Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let isCurrent = true;

    // Clear existing marker layers
    if (markerGroupRef.current) {
      markerGroupRef.current.remove();
      markerGroupRef.current = null;
      clusterGroupRef.current = null;
    }
    leafletMarkersRef.current.clear();

    const validMarkers = markers.filter(
      (m) =>
        m.lat != null &&
        m.lng != null &&
        Number.isFinite(m.lat) &&
        Number.isFinite(m.lng)
    );

    const setupMarkers = async () => {
      const isClustered = validMarkers.length > 30;
      let group;

      if (isClustered) {
        const markerClusterGroup = await loadClusterModule();
        if (!isCurrent || !mapInstanceRef.current) return;
        group = markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 50,
          iconCreateFunction: createClusterIcon,
          spiderfyOnMaxZoom: true,
          zoomToBoundsOnClick: true,
        });
        clusterGroupRef.current = group;
      } else {
        group = L.featureGroup();
      }

      validMarkers.forEach((m) => {
        const isSelected = selectedId != null && m.id === selectedId;
        const icon = createCustomMarkerIcon({
          isSelected,
          price: m.price,
          title: m.title || m.name,
        });

        const marker = L.marker([m.lat, m.lng], {
          icon,
          interactive: Boolean(onMarkerClick || m.price !== undefined || m.preview),
          keyboard: true,
          zIndexOffset: isSelected ? 1000 : 0,
        });

        if (m.preview) {
          const popupContent = createPopupContent(m.preview, m.id);
          marker.bindPopup(popupContent, {
            maxWidth: 260,
            className: "custom-property-popup",
            closeButton: true,
          });
        }

        marker.on("click", () => {
          if (onMarkerClick) {
            onMarkerClick(m.id);
          }
          if (m.preview && !marker.isPopupOpen()) {
            marker.openPopup();
          }
        });

        group.addLayer(marker);
        leafletMarkersRef.current.set(m.id, marker);
      });

      if (!isCurrent) return;
      group.addTo(map);
      markerGroupRef.current = group;

      // Fit bounds if multiple markers and no explicit center is supplied
      if (!center && validMarkers.length > 1) {
        const bounds = L.latLngBounds(validMarkers.map((m) => [m.lat, m.lng]));
        map.fitBounds(bounds, {
          padding: [40, 40],
          maxZoom: 16,
          animate: !prefersReducedMotion,
        });
      } else if (validMarkers.length === 1 && !center && !circle) {
        map.setView([validMarkers[0].lat, validMarkers[0].lng], 15, {
          animate: !prefersReducedMotion,
        });
      }

      // If selectedId is already chosen, ensure it's unclustered & highlighted
      if (selectedId && leafletMarkersRef.current.has(selectedId)) {
        const selectedMarker = leafletMarkersRef.current.get(selectedId);
        if (clusterGroupRef.current) {
          clusterGroupRef.current.zoomToShowLayer(selectedMarker, () => {});
        }
      }
    };

    setupMarkers();

    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, center, circle, onMarkerClick, prefersReducedMotion]);

  // Fast marker selection highlight update
  useEffect(() => {
    if (!leafletMarkersRef.current) return;
    leafletMarkersRef.current.forEach((marker, id) => {
      const isSelected = selectedId != null && id === selectedId;
      const m = markers.find((item) => item.id === id);
      if (m) {
        const icon = createCustomMarkerIcon({
          isSelected,
          price: m.price,
          title: m.title || m.name,
        });
        marker.setIcon(icon);
        marker.setZIndexOffset(isSelected ? 1000 : 0);
      }
    });

    if (selectedId && leafletMarkersRef.current.has(selectedId)) {
      const selectedMarker = leafletMarkersRef.current.get(selectedId);
      if (clusterGroupRef.current) {
        clusterGroupRef.current.zoomToShowLayer(selectedMarker, () => {});
      }
    }
  }, [selectedId, markers]);

  // Synchronize Circle (for Approximate Location Stays)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (circleLayerRef.current) {
      circleLayerRef.current.remove();
      circleLayerRef.current = null;
    }

    if (circle?.lat != null && circle?.lng != null) {
      const radius = circle.radiusMeters || 500;
      const circleLayer = L.circle([circle.lat, circle.lng], {
        radius,
        color: "#0b1220",
        weight: 1.5,
        dashArray: "5, 5",
        fillColor: "#0b1220",
        fillOpacity: 0.08,
      }).addTo(map);

      circleLayerRef.current = circleLayer;

      map.setView([circle.lat, circle.lng], 14, {
        animate: !prefersReducedMotion,
      });
    }
  }, [circle, prefersReducedMotion]);

  const onDragEndRef = useRef(draggableMarker?.onDragEnd);
  useEffect(() => {
    onDragEndRef.current = draggableMarker?.onDragEnd;
  }, [draggableMarker?.onDragEnd]);

  // Synchronize Draggable Marker (for Owner Location Picker)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const lat = draggableMarker?.lat;
    const lng = draggableMarker?.lng;

    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (draggableLayerRef.current) {
        draggableLayerRef.current.remove();
        draggableLayerRef.current = null;
      }
      return;
    }

    if (draggableLayerRef.current) {
      const currentPos = draggableLayerRef.current.getLatLng();
      const diffLat = Math.abs(currentPos.lat - lat);
      const diffLng = Math.abs(currentPos.lng - lng);
      if (diffLat > 0.000001 || diffLng > 0.000001) {
        draggableLayerRef.current.setLatLng([lat, lng]);
        map.setView([lat, lng], map.getZoom() || 15, {
          animate: !prefersReducedMotion,
        });
      }
      return;
    }

    const icon = createCustomMarkerIcon({
      isSelected: true,
      isDraggable: true,
      title: "Drag to adjust location",
    });

    const marker = L.marker([lat, lng], {
      icon,
      draggable: true,
      autoPan: true,
    }).addTo(map);

    marker.on("dragend", (e) => {
      const newLatLng = e.target.getLatLng();
      if (onDragEndRef.current) {
        onDragEndRef.current({
          lat: Number(newLatLng.lat.toFixed(6)),
          lng: Number(newLatLng.lng.toFixed(6)),
        });
      }
    });

    draggableLayerRef.current = marker;

    map.setView([lat, lng], 15, {
      animate: !prefersReducedMotion,
    });
  }, [draggableMarker?.lat, draggableMarker?.lng, prefersReducedMotion]);

  // Controls Handlers
  const handleZoomIn = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.zoomIn(1, { animate: !prefersReducedMotion });
  };

  const handleZoomOut = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.zoomOut(1, { animate: !prefersReducedMotion });
  };

  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (!map || !initialViewRef.current) return;
    map.setView(
      initialViewRef.current.center,
      initialViewRef.current.zoom,
      { animate: !prefersReducedMotion }
    );
  };

  const searchUrl = useMemo(() => {
    const firstMarker = markers[0];
    const coords = circle || firstMarker || draggableMarker;
    return getGoogleMapsSearchUrl({
      lat: coords?.lat,
      lng: coords?.lng,
      address: addressText,
    });
  }, [markers, circle, draggableMarker, addressText]);

  return (
    <div
      className={`relative w-full overflow-hidden bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-white/10 rounded-xl ${className}`}
      style={{ height }}
      role="region"
      aria-label={accessibleName}
    >
      {/* Fallback Display if tile loading fails */}
      {tileError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300">
          <AlertCircle className="w-8 h-8 text-stone-400 mb-2" />
          <p className="text-sm font-semibold">Map could not load</p>
          <p className="text-xs text-stone-500 mt-1 max-w-sm">
            {addressText || "Coordinates unavailable or network offline."}
          </p>
          {searchUrl && (
            <a
              href={searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#0b1220] text-white rounded-lg hover:bg-stone-800 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              Open in Google Maps
            </a>
          )}
        </div>
      )}

      {/* Two-finger pan hint on touch devices */}
      {touchHintVisible && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3.5 py-1.5 rounded-full bg-[#0b1220]/90 text-white text-xs font-medium shadow-md animate-fade-in backdrop-blur-sm">
          Use two fingers to move the map
        </div>
      )}

      {/* Map Container */}
      <div ref={containerRef} className="w-full h-full z-10 focus:outline-none" tabIndex={0} />

      {/* Custom Accessible Controls (Min 44px target on touch) */}
      {showControls && interactive && (
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 bg-white dark:bg-stone-900 p-1 rounded-lg shadow-md border border-stone-200 dark:border-white/10">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-10 h-10 min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] sm:w-9 sm:h-9 flex items-center justify-center rounded text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b1220] transition-colors"
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>
          <div className="h-px bg-stone-200 dark:bg-white/10 mx-1" />
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-10 h-10 min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] sm:w-9 sm:h-9 flex items-center justify-center rounded text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b1220] transition-colors"
            aria-label="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="h-px bg-stone-200 dark:bg-white/10 mx-1" />
          <button
            type="button"
            onClick={handleResetView}
            className="w-10 h-10 min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] sm:w-9 sm:h-9 flex items-center justify-center rounded text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b1220] transition-colors"
            aria-label="Reset map view"
            title="Reset map view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default PropertyMap;
