import React from "react";
import { Link } from "react-router-dom";
import { Heart, Star, MapPin } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { assets } from "../assets/assets";
import { useWishlist } from "../context/WishlistContext";
import { formatINR } from "../lib/formatters";
import { SHOW_SAMPLE_DATA_LABELS } from "../data/mock";
import { SafeImage, Badge } from "./ui";
import { cn } from "../lib/utils";

export const RoomCard = ({
  room,
  layout = "grid", // "grid" | "list" | "compact"
  index = 0,
  className,
}) => {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const shouldReduceMotion = useReducedMotion();

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
  
  // Show area and city only (not full street address)
  const formatAreaCity = (addr, city) => {
    if (!addr && !city) return "Location available on booking";
    if (addr) {
      const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
      }
      if (city && !addr.toLowerCase().includes(city.toLowerCase())) {
        return `${addr}, ${city}`;
      }
      return addr;
    }
    return city;
  };
  const locationLabel = formatAreaCity(room.hotel?.address, hotelCity);

  const price = room.pricePerNight ?? 0;
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];
  const hasRealRating = typeof room.rating === "number" && room.rating > 0;
  const rating = hasRealRating ? room.rating : null;
  const reviewsCount = typeof room.reviewsCount === "number" && room.reviewsCount > 0 ? room.reviewsCount : null;

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
          "group relative h-full rounded-xl bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white",
          isList ? "sm:flex sm:flex-row sm:items-stretch" : "flex flex-col",
          isCompact && "max-h-[340px]"
        )}
      >
        {/* Photo Container */}
        <div
          className={cn(
            "relative overflow-hidden bg-stone-100 dark:bg-white/5 shrink-0",
            isList
              ? "w-full sm:w-2/5 aspect-[4/3] sm:aspect-auto sm:min-h-[200px]"
              : isCompact
              ? "w-full aspect-video"
              : "w-full aspect-[4/3]"
          )}
        >
          <SafeImage
            src={cardImage}
            alt={hotelName}
            fallbackLabel={hotelName}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
          />

          {/* Sample Badge: top-left of photo */}
          {isSample && SHOW_SAMPLE_DATA_LABELS && (
            <div className={cn("absolute z-10", isCompact ? "top-2 left-2" : "top-3 left-3")}>
              <span className="px-2 py-0.5 rounded-[5px] text-[10px] font-semibold uppercase tracking-wider bg-black/65 text-white backdrop-blur-xs border border-white/20 shadow-xs">
                Sample
              </span>
            </div>
          )}

          {/* Wishlist Button: top-right of photo */}
          <button
            type="button"
            onClick={handleWishlistClick}
            aria-label={wishlisted ? "Remove from saved stays" : "Save to wishlist"}
            className={cn(
              "absolute z-10 rounded-full bg-white/95 dark:bg-[#0b1220]/90 text-stone-700 dark:text-stone-200 shadow-sm flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white",
              isCompact ? "top-2 right-2 w-8 h-8" : "top-3 right-3 w-10 h-10"
            )}
          >
            <Heart
              className={cn(
                "transition-colors",
                isCompact ? "w-3.5 h-3.5" : "w-4 h-4",
                wishlisted
                  ? "fill-rose-600 text-rose-600"
                  : "text-stone-700 dark:text-stone-200"
              )}
            />
          </button>
        </div>

        {/* Card Content */}
        <div
          className={cn(
            "flex flex-col justify-between flex-1",
            isList ? "p-4 md:p-5 sm:w-3/5 gap-3" : isCompact ? "p-2.5 sm:p-3 gap-1.5" : "p-4 md:p-5 gap-3"
          )}
        >
          <div className={cn("space-y-1", isCompact ? "space-y-0.5" : "space-y-1.5")}>
            {/* Header: Hotel Name (one line on Home) & Rating */}
            <div className="flex items-center justify-between gap-1.5">
              <h3
                className={cn(
                  "font-semibold text-[#0b1220] dark:text-[#faf8f5] leading-snug group-hover:underline underline-offset-2 transition-colors",
                  isCompact ? "text-sm truncate" : "text-base line-clamp-2"
                )}
                title={hotelName}
              >
                {hotelName}
              </h3>

              {!hasRealRating ? (
                <span className="text-xs font-medium text-stone-500 dark:text-stone-400 shrink-0">
                  New
                </span>
              ) : (
                <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-[5px] bg-[#f0ede6] dark:bg-white/10 text-stone-800 dark:text-stone-200 shrink-0">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span className="tabular-nums">{rating.toFixed(1)}</span>
                  {reviewsCount !== null && (
                    <span className="text-stone-500 dark:text-stone-400 font-normal tabular-nums">
                      ({reviewsCount})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Location (Area & City only) */}
            <div className="flex items-center gap-1 text-xs text-stone-600 dark:text-stone-400 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-stone-400" />
              <span className="truncate">{locationLabel}</span>
            </div>

            {/* Amenities: ONE single plain line, max 3 + remaining count */}
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

          {/* Price & Taxes Footer: single line, no wrapping */}
          <div className={cn("border-t border-[#e7e5e0] dark:border-white/10 mt-auto", isCompact ? "pt-1.5" : "pt-3")}>
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className={cn(
                "font-bold text-[#0b1220] dark:text-[#faf8f5] tabular-nums tracking-tight whitespace-nowrap",
                isCompact ? "text-base sm:text-lg" : "text-lg md:text-xl"
              )}>
                {formatINR(price)}
              </span>
              <span className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-normal whitespace-nowrap">
                / night
              </span>
            </div>

            <div className={cn("flex items-center gap-1.5 text-stone-500 dark:text-stone-400", isCompact ? "mt-0.5 text-[10px]" : "mt-0.5 text-[11px]")}>
              <span>Taxes included</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default RoomCard;
