import React, { useEffect, useState, useRef } from "react";
import { ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { RoomCard } from "./RoomCard";
import { RoomCardSkeleton } from "./ui/Skeleton";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

export const RecommendedHotels = () => {
  const { rooms, loadingRooms, searchedCities, fetchRooms, roomsError, isServerUnreachable } = useAppContext();
  const [recommended, setRecommended] = useState([]);
  const sectionRef = useRef(null);

  // Measure real height of Recommended stays block and expose as CSS variable
  useEffect(() => {
    if (!sectionRef.current) return;
    const updateHeight = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const height = Math.round(rect.height);
      if (height > 0) {
        document.documentElement.style.setProperty("--recommended-block-height", `${height}px`);
      }
    };

    updateHeight();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.round(
          entry.borderBoxSize?.[0]?.blockSize || entry.contentRect?.height || 0
        );
        if (height > 0) {
          document.documentElement.style.setProperty("--recommended-block-height", `${height}px`);
        }
      }
    });

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [loadingRooms, recommended]);

  useEffect(() => {
    if (!Array.isArray(rooms)) {
      setRecommended([]);
      return;
    }

    if (!searchedCities || searchedCities.length === 0) {
      setRecommended(rooms);
    } else {
      const filtered = rooms.filter((room) => {
        const city = room?.hotel?.city || "";
        return searchedCities.some(
          (searched) => searched.toLowerCase() === city.toLowerCase()
        );
      });
      setRecommended(filtered.length > 0 ? filtered : rooms);
    }
  }, [rooms, searchedCities]);

  const hasError = !loadingRooms && (roomsError || isServerUnreachable || recommended.length === 0);

  return (
    <section
      id="recommended-stays"
      ref={sectionRef}
      className="page-container pt-2.5 pb-6 sm:pt-3.5 sm:pb-8 text-left"
    >
      <div className="flex items-center justify-between mb-2 sm:mb-2.5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            Recommended stays
          </h2>
        </div>

        <Link
          to="/rooms"
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] rounded"
        >
          <span>View all stays</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loadingRooms ? (
        <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              data-recommended-skeleton="true"
              className={cn(
                "min-w-[78vw] sm:min-w-0 snap-start shrink-0 sm:shrink h-[328px]",
                i === 2 && "sm:hidden md:block",
                i === 3 && "sm:hidden md:hidden lg:block"
              )}
            >
              <RoomCardSkeleton compact />
            </div>
          ))}
        </div>
      ) : hasError ? (
        <div className="h-[328px] w-full rounded-xl bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 p-6 flex flex-col items-center justify-center text-center shadow-2xs">
          <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-white/5 flex items-center justify-center text-stone-600 dark:text-stone-300 mb-3">
            <AlertCircle className="w-5 h-5 text-stone-500" />
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-[#0b1220] dark:text-[#faf8f5]">
            Unable to load recommendations
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
        <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {recommended.slice(0, 4).map((room, index) => (
            <div
              key={room._id}
              data-recommended-card="true"
              className={cn(
                "min-w-[78vw] sm:min-w-0 snap-start shrink-0 sm:shrink h-[328px]",
                index === 2 && "sm:hidden md:block",
                index === 3 && "sm:hidden md:hidden lg:block"
              )}
            >
              <RoomCard key={room._id} room={room} index={index} layout="compact" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default RecommendedHotels;
