import React, { useEffect, useState, useRef, useMemo } from "react";
import { ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { RoomCard } from "./RoomCard";
import { RoomCardSkeleton } from "./ui/Skeleton";
import { Button } from "./ui/Button";

export const RecommendedHotels = () => {
  const { rooms, loadingRooms, searchedCities, fetchRooms, roomsError, isServerUnreachable } =
    useAppContext();
  const [recommended, setRecommended] = useState([]);
  const sectionRef = useRef(null);
  const headerRef = useRef(null);

  // Measure ONLY the first row's block height so the hero first view remains unchanged
  useEffect(() => {
    if (!sectionRef.current) return;

    const updateHeight = () => {
      if (!sectionRef.current) return;
      const headerEl = sectionRef.current.querySelector("[data-recommended-header]");
      const firstCardEl = sectionRef.current.querySelector("[data-recommended-card]");

      if (headerEl && firstCardEl) {
        const headerHeight = headerEl.offsetHeight || 36;
        const cardHeight = firstCardEl.offsetHeight || 260;
        // Total first-row height including spacing
        const firstRowBlockHeight = Math.round(headerHeight + cardHeight + 16);
        document.documentElement.style.setProperty(
          "--recommended-block-height",
          `${firstRowBlockHeight}px`
        );
      } else {
        const rect = sectionRef.current.getBoundingClientRect();
        const cappedHeight = Math.min(300, Math.round(rect.height || 280));
        document.documentElement.style.setProperty(
          "--recommended-block-height",
          `${cappedHeight}px`
        );
      }
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [loadingRooms, recommended]);

  // Ranking Rule:
  // 1. If user searched specific cities, prioritize matching stays.
  // 2. Rank stays by highest guest rating (rating descending), then review count descending.
  // 3. Slice up to 8 stays for desktop 4x2 grid (no duplicates, no filler).
  const isRanked = useMemo(() => {
    return Array.isArray(rooms) && rooms.some((r) => typeof r.rating === "number" && r.rating > 0);
  }, [rooms]);

  useEffect(() => {
    if (!Array.isArray(rooms)) {
      setRecommended([]);
      return;
    }

    let source = [...rooms];

    if (searchedCities && searchedCities.length > 0) {
      const filtered = rooms.filter((room) => {
        const city = room?.hotel?.city || "";
        return searchedCities.some(
          (searched) => searched.toLowerCase() === city.toLowerCase()
        );
      });
      if (filtered.length > 0) {
        source = filtered;
      }
    }

    // Sort by rating desc, then reviewsCount desc
    const sorted = source.sort((a, b) => {
      const rA = typeof a.rating === "number" ? a.rating : 0;
      const rB = typeof b.rating === "number" ? b.rating : 0;
      if (rB !== rA) return rB - rA;
      const cA = typeof a.reviewsCount === "number" ? a.reviewsCount : 0;
      const cB = typeof b.reviewsCount === "number" ? b.reviewsCount : 0;
      return cB - cA;
    });

    // Up to 8 stays (4 columns x 2 rows on desktop)
    setRecommended(sorted.slice(0, 8));
  }, [rooms, searchedCities]);

  const hasError =
    !loadingRooms && (roomsError || isServerUnreachable || recommended.length === 0);

  // Label by ranking rule
  const sectionTitle = isRanked ? "Recommended stays" : "Stays you may like";

  return (
    <section
      id="recommended-stays"
      ref={sectionRef}
      className="page-container text-left"
    >
      {/* Recommended Header */}
      <div
        ref={headerRef}
        data-recommended-header="true"
        className="flex items-center justify-between mb-3 sm:mb-4"
      >
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            {sectionTitle}
          </h2>
          {isRanked && (
            <span className="hidden sm:inline text-xs text-stone-500 dark:text-stone-400 font-normal">
              Curated by guest rating
            </span>
          )}
        </div>

        <Link
          to="/rooms"
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] rounded"
        >
          <span>View all stays</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Recommended Content */}
      {loadingRooms ? (
        <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-x-6 sm:gap-y-8 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 snap-x snap-mandatory scrollbar-none">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              data-recommended-card="true"
              className="w-[82vw] sm:w-auto min-w-[82vw] sm:min-w-0 snap-start shrink-0 sm:shrink h-[260px]"
            >
              <RoomCardSkeleton compact />
            </div>
          ))}
        </div>
      ) : hasError ? (
        <div className="h-[260px] w-full rounded-xl bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 p-6 flex flex-col items-center justify-center text-center shadow-2xs">
          <div className="text-gray-400 dark:text-gray-500 mb-2 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-[#0b1220] dark:text-[#faf8f5]">
            Unable to load stays
          </h3>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 max-w-sm">
            Could not connect to the stays catalog. Please check your connection or try again.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchRooms()}
            className="mt-4 gap-1.5"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Retry
          </Button>
        </div>
      ) : (
        /* Mobile: 1 swipeable row (1.2 cards / 82vw snap). Desktop: 4 columns x 2 rows (24px col gap, 32px row gap) */
        <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-x-6 sm:gap-y-8 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 snap-x snap-mandatory scrollbar-none">
          {recommended.map((room, index) => (
            <div
              key={room._id}
              data-recommended-card="true"
              className="w-[82vw] sm:w-auto min-w-[82vw] sm:min-w-0 snap-start shrink-0 sm:shrink min-h-[260px]"
            >
              <RoomCard room={room} index={index} layout="compact" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default RecommendedHotels;
