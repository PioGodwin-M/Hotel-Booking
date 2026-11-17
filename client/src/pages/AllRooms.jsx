import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LayoutGrid,
  List,
  SlidersHorizontal,
  X,
  Search,
  Heart,
  RotateCcw,
  Check,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAppContext } from "../context/AppContext";
import { useWishlist } from "../context/WishlistContext";
import { RoomCard } from "../components/RoomCard";
import { RoomCardSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { DateRangePicker, GuestsStepper } from "../components/ui";
import { formatINR } from "../lib/formatters";
import { usePageTitle } from "../hooks/usePageTitle";
import { cn } from "../lib/utils";

const ROOM_TYPES = [
  "Single Bed",
  "Double Bed",
  "Luxury Room",
  "Family Suite",
];

const PRICE_TIERS = [
  { label: "Under ₹3,000", min: 0, max: 3000 },
  { label: "₹3,000 to ₹7,000", min: 3000, max: 7000 },
  { label: "₹7,000 to ₹15,000", min: 7000, max: 15000 },
  { label: "₹15,000 & above", min: 15000, max: Infinity },
];

const AMENITIES_LIST = [
  "Free Wifi",
  "Free Breakfast",
  "Room Service",
  "Swimming Pool",
  "Mountain View",
  "Spa",
];

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
];

export const AllRooms = () => {
  usePageTitle(
    "All Stays",
    "Browse rooms, hotels, and holiday stays across top destinations."
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const { rooms, loadingRooms, roomsError, fetchRooms } = useAppContext();
  const { isWishlisted, wishlistCount } = useWishlist();
  const shouldReduceMotion = useReducedMotion();

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Esc key and scroll lock for mobile filters modal
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") setMobileFiltersOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileFiltersOpen]);

  // Read state strictly from URL search params
  const destination = searchParams.get("destination") || "";
  const sort = searchParams.get("sort") || "recommended";
  const view = searchParams.get("view") || "grid"; // "grid" | "list"
  const onlyWishlist = searchParams.get("wishlist") === "true";
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const guests = searchParams.get("guests") ? Number(searchParams.get("guests")) : 2;
  const selectedTypes = useMemo(() => {
    const raw = searchParams.get("types");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);
  const selectedAmenities = useMemo(() => {
    const raw = searchParams.get("amenities");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);
  const minPrice = searchParams.get("minPrice")
    ? Number(searchParams.get("minPrice"))
    : null;
  const maxPrice = searchParams.get("maxPrice")
    ? Number(searchParams.get("maxPrice"))
    : null;

  // Helper to update search params
  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) {
        next.delete(key);
      } else if (Array.isArray(val)) {
        next.set(key, val.join(","));
      } else {
        next.set(key, String(val));
      }
    });
    setSearchParams(next, { replace: true });
  };

  const toggleType = (type) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    updateParams({ types: next });
  };

  const toggleAmenity = (amenity) => {
    const next = selectedAmenities.includes(amenity)
      ? selectedAmenities.filter((a) => a !== amenity)
      : [...selectedAmenities, amenity];
    updateParams({ amenities: next });
  };

  const setPriceTier = (min, max) => {
    if (minPrice === min && maxPrice === max) {
      updateParams({ minPrice: null, maxPrice: null });
    } else {
      updateParams({ minPrice: min, maxPrice: max === Infinity ? null : max });
    }
  };

  const clearAllFilters = () => {
    const next = new URLSearchParams();
    if (view !== "grid") next.set("view", view);
    setSearchParams(next, { replace: true });
  };

  const hasActiveFilters =
    Boolean(destination) ||
    onlyWishlist ||
    selectedTypes.length > 0 ||
    selectedAmenities.length > 0 ||
    minPrice !== null ||
    maxPrice !== null;

  // Filter & sort rooms
  const filteredRooms = useMemo(() => {
    if (!Array.isArray(rooms)) return [];

    return rooms
      .filter((room) => {
        // Destination filter (city, address, hotel name)
        if (destination) {
          const q = destination.toLowerCase();
          const matchCity = room.hotel?.city?.toLowerCase().includes(q);
          const matchAddr = room.hotel?.address?.toLowerCase().includes(q);
          const matchName = room.hotel?.name?.toLowerCase().includes(q);
          if (!matchCity && !matchAddr && !matchName) return false;
        }

        // Wishlist filter
        if (onlyWishlist && !isWishlisted(room._id)) {
          return false;
        }

        // Room Type filter
        if (selectedTypes.length > 0 && !selectedTypes.includes(room.roomType)) {
          return false;
        }

        // Price filter
        const price = Number(room.pricePerNight) || 0;
        if (minPrice !== null && price < minPrice) return false;
        if (maxPrice !== null && price > maxPrice) return false;

        // Amenities filter
        if (selectedAmenities.length > 0) {
          const roomAmenities = Array.isArray(room.amenities)
            ? room.amenities
            : [];
          const hasAll = selectedAmenities.every((a) =>
            roomAmenities.includes(a)
          );
          if (!hasAll) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const priceA = Number(a.pricePerNight) || 0;
        const priceB = Number(b.pricePerNight) || 0;
        if (sort === "price-asc") return priceA - priceB;
        if (sort === "price-desc") return priceB - priceA;
        if (sort === "newest")
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        return 0;
      });
  }, [
    rooms,
    destination,
    onlyWishlist,
    selectedTypes,
    selectedAmenities,
    minPrice,
    maxPrice,
    sort,
    isWishlisted,
  ]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Filter Sidebar Content (used in both desktop sticky and mobile bottom-sheet)
  const FilterContent = (
    <div className="space-y-6 text-left">
      {/* Search by location */}
      <div>
        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
          Destination or hotel
        </label>
        <div className="relative">
          <input
            type="text"
            value={destination}
            onChange={(e) => updateParams({ destination: e.target.value })}
            placeholder="Search city, area or hotel"
            className="w-full pl-9 pr-8 py-2 text-xs rounded-[10px] bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 text-[#0b1220] dark:text-[#faf8f5] focus:outline-none focus:border-[#0b1220]"
          />
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
          {destination && (
            <button
              onClick={() => updateParams({ destination: "" })}
              className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dates Filter - Stacked to guarantee zero text truncation */}
      <div>
        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
          Dates
        </label>
        <DateRangePicker
          startDate={checkIn}
          endDate={checkOut}
          onChange={({ startDate, endDate }) => {
            updateParams({ checkIn: startDate || null, checkOut: endDate || null });
          }}
          compact={true}
          stacked={true}
        />
      </div>

      {/* Guests Filter */}
      <div>
        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
          Guests
        </label>
        <div className="p-2 rounded-lg border border-stone-200 dark:border-white/10">
          <GuestsStepper
            value={guests}
            onChange={(g) => updateParams({ guests: g === 2 ? null : g })}
            min={1}
            max={10}
          />
        </div>
      </div>

      {/* Saved Wishlist Toggle */}
      <div className="p-3 rounded-xl bg-stone-50 dark:bg-white/5 border border-[#e7e5e0] dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-600" />
          <span className="text-xs font-semibold text-[#0b1220] dark:text-[#faf8f5]">
            Saved stays only
          </span>
        </div>
        <input
          type="checkbox"
          checked={onlyWishlist}
          onChange={(e) => updateParams({ wishlist: e.target.checked ? "true" : null })}
          className="w-4 h-4 rounded text-[#0b1220] accent-[#0b1220] cursor-pointer"
        />
      </div>

      {/* Price Tiers as Radio Chips */}
      <div>
        <h3 className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
          Price per night
        </h3>
        <div className="space-y-1.5">
          {PRICE_TIERS.map((tier) => {
            const isSelected =
              minPrice === tier.min &&
              (tier.max === Infinity ? maxPrice === null : maxPrice === tier.max);
            return (
              <label
                key={tier.label}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer transition-colors",
                  isSelected
                    ? "border-[#0b1220] bg-[#0b1220]/5 dark:border-white dark:bg-white/10 text-[#0b1220] dark:text-white font-semibold"
                    : "border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/5 text-stone-700 dark:text-stone-300"
                )}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="price-tier"
                    checked={isSelected}
                    onChange={() => setPriceTier(tier.min, tier.max)}
                    className="w-3.5 h-3.5 text-[#0b1220] accent-[#0b1220] cursor-pointer"
                  />
                  <span>{tier.label}</span>
                </div>
              </label>
            );
          })}
        </div>

        {/* Custom Min / Max */}
        <div className="mt-3 pt-3 border-t border-stone-200 dark:border-white/10 space-y-2">
          <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
            Custom range (₹)
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={minPrice ?? ""}
              onChange={(e) =>
                updateParams({ minPrice: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-white/10 bg-transparent text-[#0b1220] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#0b1220]"
            />
            <span className="text-xs text-stone-400">–</span>
            <input
              type="number"
              placeholder="Max"
              value={maxPrice ?? ""}
              onChange={(e) =>
                updateParams({ maxPrice: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-white/10 bg-transparent text-[#0b1220] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#0b1220]"
            />
          </div>
        </div>
      </div>

      {/* Room Types */}
      <div>
        <h3 className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
          Room type
        </h3>
        <div className="space-y-1.5">
          {ROOM_TYPES.map((type) => {
            const checked = selectedTypes.includes(type);
            return (
              <label
                key={type}
                className="flex items-center gap-2.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleType(type)}
                  className="w-4 h-4 rounded text-[#0b1220] accent-[#0b1220] cursor-pointer"
                />
                <span>{type}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Amenities */}
      <div>
        <h3 className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
          Amenities
        </h3>
        <div className="space-y-1.5">
          {AMENITIES_LIST.map((amenity) => {
            const checked = selectedAmenities.includes(amenity);
            return (
              <label
                key={amenity}
                className="flex items-center gap-2.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAmenity(amenity)}
                  className="w-4 h-4 rounded text-[#0b1220] accent-[#0b1220] cursor-pointer"
                />
                <span>{amenity}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Reset Action */}
      {hasActiveFilters && (
        <Button
          variant="secondary"
          size="sm"
          onClick={clearAllFilters}
          className="w-full text-xs"
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
        >
          Reset all filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="pt-24 md:pt-28 pb-20 page-container">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#e7e5e0] dark:border-white/10 text-left">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            All stays
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Browse rooms, hotels, and holiday stays.
          </p>
        </div>
      </div>

      {/* Sticky Top Bar on Mobile & Desktop: 44px Filters and Sort (Part 2 #3) */}
      <div className="sticky top-[56px] z-30 bg-white/95 dark:bg-[#0b1220]/95 backdrop-blur-md py-3 px-3 sm:px-4 border-b border-[#e7e5e0] dark:border-white/10 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          {/* Mobile Filter Button (44px tall) */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden inline-flex items-center justify-center gap-2 h-11 min-h-[44px] px-4 rounded-xl border border-[#e7e5e0] dark:border-white/15 text-sm font-semibold text-[#0b1220] dark:text-[#faf8f5] bg-white dark:bg-[#151d30] shadow-2xs active:bg-stone-50 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-[#0b1220] dark:bg-white" />
            )}
          </button>

          {/* Sort Dropdown (44px tall) */}
          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            aria-label="Sort stays"
            className="h-11 min-h-[44px] text-sm font-medium px-3.5 py-2 rounded-xl border border-[#e7e5e0] dark:border-white/15 bg-white dark:bg-[#151d30] text-[#0b1220] dark:text-[#faf8f5] focus:outline-none focus:border-[#0b1220] cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode (Grid vs List) */}
        <div className="inline-flex items-center h-11 p-1 rounded-xl bg-stone-100 dark:bg-white/10 border border-[#e7e5e0] dark:border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => updateParams({ view: "grid" })}
            aria-label="Grid view"
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer",
              view === "grid"
                ? "bg-white dark:bg-[#151d30] text-[#0b1220] dark:text-[#faf8f5] shadow-2xs"
                : "text-stone-400 hover:text-stone-700"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => updateParams({ view: "list" })}
            aria-label="List view"
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer",
              view === "list"
                ? "bg-white dark:bg-[#151d30] text-[#0b1220] dark:text-[#faf8f5] shadow-2xs"
                : "text-stone-400 hover:text-stone-700"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="mt-6 flex items-start gap-8 text-left">
        {/* Desktop Sticky Sidebar (280px wide to prevent clipped date strings) */}
        <aside className="hidden lg:block w-[280px] lg:w-[280px] shrink-0 sticky top-24 self-start bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#e7e5e0] dark:border-white/10">
            <h2 className="text-base font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              Filters
            </h2>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-stone-500 hover:text-rose-600"
              >
                Reset
              </button>
            )}
          </div>
          {FilterContent}
        </aside>

        {/* Rooms Listing Column */}
        <section className="flex-1 w-full min-w-0" aria-label="Available listings">
          {/* Active Filter Chips placed inside results column */}
          {hasActiveFilters && (
            <div className="pb-3 mb-4 flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-[#e7e5e0] dark:border-white/10 whitespace-nowrap">
              <span className="text-xs font-medium text-stone-500 mr-1 shrink-0">
                Active filters:
              </span>

              {destination && (
                <Badge variant="neutral" size="sm" className="gap-1">
                  <span>Location: {destination}</span>
                  <button
                    onClick={() => updateParams({ destination: "" })}
                    className="hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}

              {onlyWishlist && (
                <Badge variant="neutral" size="sm" className="gap-1">
                  <span>Saved Stays ({wishlistCount})</span>
                  <button
                    onClick={() => updateParams({ wishlist: null })}
                    className="hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}

              {selectedTypes.map((type) => (
                <Badge key={type} variant="neutral" size="sm" className="gap-1">
                  <span>{type}</span>
                  <button
                    onClick={() => toggleType(type)}
                    className="hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}

              {selectedAmenities.map((amenity) => (
                <Badge key={amenity} variant="neutral" size="sm" className="gap-1">
                  <span>{amenity}</span>
                  <button
                    onClick={() => toggleAmenity(amenity)}
                    className="hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}

              {(minPrice !== null || maxPrice !== null) && (
                <Badge variant="neutral" size="sm" className="gap-1">
                  <span>
                    {formatINR(minPrice ?? 0)} – {maxPrice !== null ? formatINR(maxPrice) : "+"}
                  </span>
                  <button
                    onClick={() => updateParams({ minPrice: null, maxPrice: null })}
                    className="hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}

              <button
                onClick={clearAllFilters}
                className="text-xs text-stone-700 dark:text-stone-300 font-semibold hover:underline ml-1 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Result Count */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs sm:text-sm font-medium text-stone-600 dark:text-stone-400">
              Showing{" "}
              <span className="font-bold text-[#0b1220] dark:text-[#faf8f5]">
                {filteredRooms.length}
              </span>{" "}
              {filteredRooms.length === 1 ? "stay" : "stays"}
            </p>
          </div>

          {loadingRooms ? (
            <div
              className={cn(
                "grid gap-5",
                view === "list"
                  ? "grid-cols-1"
                  : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
              )}
            >
              {[...Array(6)].map((_, i) => (
                <RoomCardSkeleton key={i} />
              ))}
            </div>
          ) : roomsError && rooms.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="w-6 h-6 text-stone-700 dark:text-stone-300" />}
              title="We can't load stays right now"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => fetchRooms()}
              className="my-8"
            />
          ) : filteredRooms.length === 0 ? (
            onlyWishlist ? (
              <EmptyState
                icon={<Heart className="w-6 h-6 text-rose-500" />}
                title="No saved stays yet"
                description="Tap the heart icon on any hotel card to save your favourite stays here."
                actionLabel="Explore all stays"
                onAction={() => updateParams({ wishlist: null })}
                className="my-8"
              />
            ) : (
              <EmptyState
                title="No stays match your criteria"
                description="Try adjusting your filters or clearing your search keywords to see more rooms."
                actionLabel="Clear all filters"
                onAction={clearAllFilters}
                className="my-8"
              />
            )
          ) : (
            <div
              className={cn(
                "grid gap-5",
                view === "list"
                  ? "grid-cols-1"
                  : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
              )}
            >
              {filteredRooms.map((room, idx) => (
                <RoomCard
                  key={room._id}
                  room={room}
                  layout={view}
                  index={idx}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Mobile Filters Bottom-Sheet / Modal */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileFiltersOpen(false)}
              className="fixed inset-0 bg-[#0b1220]/70"
              aria-hidden="true"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-filters-title"
              initial={
                shouldReduceMotion ? { opacity: 0 } : { y: "100%" }
              }
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-h-[85vh] bg-white dark:bg-[#151d30] rounded-t-2xl border-t border-[#e7e5e0] dark:border-white/10 p-5 overflow-y-auto shadow-xl z-10 flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#e7e5e0] dark:border-white/10">
                <h2
                  id="mobile-filters-title"
                  className="text-base font-bold text-[#0b1220] dark:text-[#faf8f5]"
                >
                  Filter stays
                </h2>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label="Close filters"
                  className="p-1 rounded-lg text-stone-500 hover:text-stone-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                {FilterContent}
              </div>

              <div className="pt-3 mt-3 border-t border-[#e7e5e0] dark:border-white/10 flex gap-2.5">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={clearAllFilters}
                  className="flex-1"
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="flex-1"
                >
                  Show {filteredRooms.length} Stays
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AllRooms;
