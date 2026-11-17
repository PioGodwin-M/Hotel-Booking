import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart, Star, MapPin } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { assets } from "../assets/assets";
import { useWishlist } from "../context/WishlistContext";
import { formatINR } from "../lib/formatters";
import { SHOW_SAMPLE_DATA_LABELS } from "../data/mock";
import { SafeImage } from "./ui";
import { cn } from "../lib/utils";

export const RoomCard = ({
  room,
  layout = "grid", // "grid" | "list" | "compact"
  index = 0,
  className,
}) => {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const shouldReduceMotion = useReducedMotion();
  const location = useLocation();

  if (!room) return null;

  const roomId = room._id;
  const wishlisted = isWishlisted(roomId);
  const cardImage = room.images?.[0] || assets.roomImg1;

  const rawName = room.hotel?.name || "Comfortable Stay";
  const isSample = Boolean(
    room.isSample ||
    room._id?.startsWith("sample-") ||
    /^\[sample\]/i.test(rawName)
  );
  // Strip [Sample] prefix so stay name gets the full width
  const hotelName = rawName.replace(/^\[Sample\]\s*/i, "").trim();
  const hotelCity = room.hotel?.city || "";
  
  // Show area and city only (never full street address)
  const formatAreaCity = (addr, city) => {
    if (!addr && !city) return "Location on request";
    if (city && !addr) return city;
    // Strip street numbers and prefixes if present
    const parts = (addr || "")
      .split(",")
      .map((s) => s.trim().replace(/^\d+[\s\w]*\b(road|rd|street|st|lane|ave|nagar|block|sector)?\s*/i, ""))
      .filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
    }
    if (city) {
      const area = parts[0] || "";
      if (area && area.toLowerCase() !== city.toLowerCase()) {
        return `${area}, ${city}`;
      }
      return city;
    }
    return parts[0] || addr;
  };
  const locationLabel = formatAreaCity(room.hotel?.address, hotelCity);

  const price = room.pricePerNight ?? 0;
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];
  const hasRealRating = typeof room.rating === "number" && room.rating > 0;
  const rating = hasRealRating ? room.rating : null;
  const reviewsCount = typeof room.reviewsCount === "number" && room.reviewsCount > 0 ? room.reviewsCount : null;

  // "New" label: ONLY for stays created within the last 30 days (use createdAt if exists); otherwise show nothing
  const isNewStay = (() => {
    if (!room.createdAt) return false;
    const createdDate = new Date(room.createdAt);
    if (isNaN(createdDate.getTime())) return false;
    const diffDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30;
  })();

  // Compute stay price according to selected dates
  const searchParams = new URLSearchParams(location.search);
  const checkInParam = searchParams.get("checkIn");
  const checkOutParam = searchParams.get("checkOut");
  let priceText = `${formatINR(price)} / night`;
  if (checkInParam && checkOutParam) {
    const diffDays = Math.max(1, Math.round((new Date(checkOutParam) - new Date(checkInParam)) / (1000 * 60 * 60 * 24)));
    if (!isNaN(diffDays)) {
      priceText = `${formatINR(price * diffDays)} for ${diffDays} night${diffDays > 1 ? "s" : ""}`;
    }
  }

  const handleWishlistClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(room);
  };

  const isList = layout === "list";
  const isCompact = layout === "compact";

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: isCompact ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.25) }}
      className={cn("h-full", className)}
    >
      <Link
        to={`/rooms/${roomId}`}
        onClick={() => window.scrollTo(0, 0)}
        className={cn(
          "group relative h-full transition-all duration-200 block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white",
          isCompact
            ? "bg-transparent border-0 shadow-none hover:shadow-none p-0 rounded-[14px]"
            : isList
            ? "rounded-xl bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 overflow-hidden shadow-2xs hover:shadow-md sm:flex sm:flex-row sm:items-stretch"
            : "rounded-xl bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 overflow-hidden shadow-2xs hover:shadow-md flex flex-col"
        )}
      >
        {/* Photo Container */}
        <div
          className={cn(
            "relative overflow-hidden bg-stone-100 dark:bg-white/5 shrink-0",
            isCompact
              ? "w-full aspect-[4/3] rounded-[14px]"
              : isList
              ? "w-full sm:w-2/5 aspect-[4/3] sm:aspect-auto sm:min-h-[200px]"
              : "w-full aspect-[4/3]"
          )}
        >
          <SafeImage
            src={cardImage}
            alt={hotelName}
            fallbackLabel={hotelName}
            loading="lazy"
            className="w-full h-full object-cover [@media(hover:hover)]:group-hover:scale-105 transition-transform duration-300 ease-out"
          />

          {/* Sample Badge: top-left of photo (sentence case, 12px, normal sans font, 90% white bg) */}
          {isSample && SHOW_SAMPLE_DATA_LABELS && (
            <div className="absolute top-2 left-2 z-10">
              <span className="px-2 py-0.5 rounded-[5px] text-xs font-normal bg-white/90 dark:bg-[#0b1220]/90 text-stone-800 dark:text-stone-200 shadow-xs">
                Sample
              </span>
            </div>
          )}

          {/* Wishlist Button: top-right of photo (44px tap target) */}
          <button
            type="button"
            onClick={handleWishlistClick}
            aria-label={wishlisted ? "Remove from saved stays" : "Save to wishlist"}
            className={cn(
              "absolute z-10 w-11 h-11 rounded-full bg-white/95 dark:bg-[#0b1220]/90 text-stone-700 dark:text-stone-200 shadow-sm flex items-center justify-center transition-transform [@media(hover:hover)]:hover:scale-110 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white",
              isCompact ? "top-1.5 right-1.5" : "top-2 right-2"
            )}
          >
            <Heart
              className={cn(
                "transition-colors w-4 h-4",
                wishlisted
                  ? "fill-rose-600 text-rose-600"
                  : "text-stone-700 dark:text-stone-200"
              )}
            />
          </button>
        </div>

        {/* Card Content */}
        {isCompact ? (
          /* Home Compact Card: Exactly 3 lines, no border, text directly on page */
          <div className="pt-2 text-left space-y-0.5">
            {/* Line 1: Stay name (16px/600, 1 line, full name in title) with rating on right */}
            <div className="flex items-center justify-between gap-1.5">
              <h3
                className="text-base font-semibold text-[#0b1220] dark:text-[#faf8f5] leading-snug truncate group-hover:underline underline-offset-2 transition-colors"
                title={hotelName}
              >
                {hotelName}
              </h3>

              {hasRealRating ? (
                <div className="flex items-center gap-1 text-xs font-semibold text-stone-800 dark:text-stone-200 shrink-0">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span className="tabular-nums">{rating.toFixed(1)}</span>
                </div>
              ) : isNewStay ? (
                <span className="text-xs font-normal text-stone-500 dark:text-stone-400 shrink-0">
                  New
                </span>
              ) : null}
            </div>

            {/* Line 2: Area and city */}
            <div className="text-sm text-stone-500 dark:text-stone-400 truncate">
              {locationLabel}
            </div>

            {/* Line 3: Price */}
            <div className="text-sm font-semibold text-[#0b1220] dark:text-[#faf8f5] tabular-nums whitespace-nowrap pt-0.5">
              {priceText}
            </div>
          </div>
        ) : (
          /* Stays Page Card: Grid or List layout with amenities and full details */
          <div
            className={cn(
              "flex flex-col justify-between flex-1",
              isList ? "p-4 md:p-5 sm:w-3/5 gap-3" : "p-4 md:p-5 gap-3"
            )}
          >
            <div className="space-y-1.5">
              {/* Header: Hotel Name & Rating */}
              <div className="flex items-center justify-between gap-1.5">
                <h3
                  className="text-base font-semibold text-[#0b1220] dark:text-[#faf8f5] leading-snug line-clamp-2 group-hover:underline underline-offset-2 transition-colors"
                  title={hotelName}
                >
                  {hotelName}
                </h3>

                {hasRealRating ? (
                  <div className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[5px] bg-[#f0ede6] dark:bg-white/10 text-stone-800 dark:text-stone-200 shrink-0">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span className="tabular-nums">{rating.toFixed(1)}</span>
                    {reviewsCount !== null && (
                      <span className="text-stone-500 dark:text-stone-400 font-normal tabular-nums">
                        ({reviewsCount})
                      </span>
                    )}
                  </div>
                ) : isNewStay ? (
                  <span className="text-xs font-medium text-stone-500 dark:text-stone-400 shrink-0">
                    New
                  </span>
                ) : null}
              </div>

              {/* Location */}
              <div className="flex items-center gap-1 text-xs text-stone-600 dark:text-stone-400 truncate">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                <span className="truncate">{locationLabel}</span>
              </div>

              {/* Amenities */}
              {amenities.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 overflow-hidden whitespace-nowrap pt-0.5">
                  <span className="truncate">
                    {amenities.slice(0, 3).join(" • ")}
                  </span>
                  {amenities.length > 3 && (
                    <span className="text-[11px] text-stone-400 dark:text-stone-500 font-medium tabular-nums shrink-0">
                      +{amenities.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Price & Taxes Footer */}
            <div className="border-t border-[#e7e5e0] dark:border-white/10 mt-auto pt-3">
              <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="font-bold text-[#0b1220] dark:text-[#faf8f5] tabular-nums tracking-tight whitespace-nowrap text-lg md:text-xl">
                  {formatINR(price)}
                </span>
                <span className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-normal whitespace-nowrap">
                  / night
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 mt-0.5 text-[11px]">
                <span>Taxes included</span>
              </div>
            </div>
          </div>
        )}
      </Link>
    </motion.div>
  );
};

export default RoomCard;
