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

export const HotelCard = ({ room, index = 0, className }) => {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const shouldReduceMotion = useReducedMotion();

  if (!room) return null;

  const roomId = room._id;
  const wishlisted = isWishlisted(roomId);
  const cardImage = room.images?.[0] || assets.roomImg1;

  const rawName = room.hotel?.name || "Comfortable Stay";
  const isSample = Boolean(
    SHOW_SAMPLE_DATA_LABELS && (
      room.isSample ||
      room._id?.startsWith("sample-") ||
      /^\[sample\]/i.test(rawName)
    )
  );
  // Strip [Sample] prefix so stay name gets full width
  const hotelName = rawName.replace(/^\[Sample\]\s*/i, "").trim();
  const hotelCity = room.hotel?.city || "";
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
  const hotelAddress = formatAreaCity(room.hotel?.address, hotelCity);
  const price = room.pricePerNight ?? 0;
  const isNewStay = (() => {
    if (!room.createdAt) return false;
    const createdDate = new Date(room.createdAt);
    if (isNaN(createdDate.getTime())) return false;
    const diffDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30;
  })();
  const hasRealRating = typeof room.rating === "number" && room.rating > 0;
  const rating = hasRealRating ? room.rating : null;
  const reviewsCount = typeof room.reviewsCount === "number" && room.reviewsCount > 0 ? room.reviewsCount : null;

  const handleWishlistClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(room);
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.2) }}
      className={cn("h-full", className)}
    >
      <Link
        to={`/rooms/${roomId}`}
        onClick={() => window.scrollTo(0, 0)}
        className="group relative h-full rounded-xl bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white"
      >
        {/* Photo Container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100 dark:bg-white/5 shrink-0">
          <SafeImage
            src={cardImage}
            alt={hotelName}
            fallbackLabel={hotelName}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
          />

          {/* Wishlist Button */}
          <button
            type="button"
            onClick={handleWishlistClick}
            aria-label={wishlisted ? "Remove from saved stays" : "Save to wishlist"}
            className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/95 dark:bg-[#0b1220]/90 text-stone-700 dark:text-stone-200 shadow-sm flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white"
          >
            <Heart
              className={cn(
                "w-4 h-4 transition-colors",
                wishlisted
                  ? "fill-rose-600 text-rose-600"
                  : "text-stone-700 dark:text-stone-200"
              )}
            />
          </button>
        </div>

        {/* Card Content */}
        <div className="p-4 md:p-5 flex flex-col justify-between flex-1 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3
                  className="text-base font-semibold text-[#0b1220] dark:text-[#faf8f5] line-clamp-2 leading-snug group-hover:text-[#0b1220] dark:group-hover:text-white group-hover:underline underline-offset-2 transition-colors truncate"
                  title={hotelName}
                >
                  {hotelName}
                </h3>
                {isSample && SHOW_SAMPLE_DATA_LABELS && (
                  <Badge variant="neutral" size="sm" className="shrink-0 text-[10px]">
                    Sample
                  </Badge>
                )}
              </div>

              {hasRealRating ? (
                <div className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[6px] bg-[#f0ede6] dark:bg-white/10 text-stone-800 dark:text-stone-200 shrink-0">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span className="tabular-nums">{rating.toFixed(1)}</span>
                  {reviewsCount !== null && (
                    <span className="text-stone-500 dark:text-stone-400 font-normal tabular-nums">
                      ({reviewsCount})
                    </span>
                  )}
                </div>
              ) : isNewStay ? (
                <div className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[6px] bg-[#f0ede6] dark:bg-white/10 text-stone-800 dark:text-stone-200 shrink-0">
                  <span>New</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-1 text-xs text-stone-600 dark:text-stone-400 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-stone-400" />
              <span className="truncate">{hotelAddress}</span>
            </div>
          </div>

          {/* Price & Taxes Footer */}
          <div className="pt-3 border-t border-[#e7e5e0] dark:border-white/10 mt-auto">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-lg md:text-xl font-bold text-[#0b1220] dark:text-[#faf8f5] tabular-nums tracking-tight whitespace-nowrap">
                {formatINR(price)}
              </span>
              <span className="text-xs md:text-sm text-stone-500 dark:text-stone-400 font-normal whitespace-nowrap">
                / night
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
              <span>Taxes included</span>
              {SHOW_SAMPLE_DATA_LABELS && (
                <span className="text-[11px] font-normal text-stone-400 dark:text-stone-500">
                  • Sample
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default HotelCard;
