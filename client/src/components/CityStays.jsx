import React, { useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { RoomCard } from "./RoomCard";

export const CityStays = () => {
  const { rooms, loadingRooms } = useAppContext();

  // Find up to 3 cities with at least 3 stays
  const citySections = useMemo(() => {
    if (!Array.isArray(rooms) || rooms.length === 0) return [];
    const cityMap = {};
    for (const r of rooms) {
      const city = r?.hotel?.city;
      if (!city) continue;
      if (!cityMap[city]) cityMap[city] = [];
      cityMap[city].push(r);
    }

    return Object.entries(cityMap)
      .filter(([, stays]) => stays.length >= 3)
      .slice(0, 3)
      .map(([city, stays]) => ({ city, stays }));
  }, [rooms]);

  if (loadingRooms || citySections.length === 0) return null;

  return (
    <section className="page-container py-6 sm:py-8 text-left space-y-8">
      {citySections.map(({ city, stays }) => (
        <CityStayRow key={city} city={city} stays={stays} />
      ))}
    </section>
  );
};

const CityStayRow = ({ city, stays }) => {
  const carouselRef = useRef(null);

  const scrollCarousel = (direction) => {
    if (!carouselRef.current) return;
    const amount = carouselRef.current.clientWidth * 0.75;
    carouselRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            Stays in {city}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {stays.length > 4 && (
            <div className="hidden md:flex items-center gap-1.5 mr-2">
              <button
                type="button"
                onClick={() => scrollCarousel("left")}
                aria-label={`Previous stays in ${city}`}
                className="w-8 h-8 rounded-full border border-stone-200 dark:border-white/10 bg-white/90 dark:bg-[#151d30]/90 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollCarousel("right")}
                aria-label={`Next stays in ${city}`}
                className="w-8 h-8 rounded-full border border-stone-200 dark:border-white/10 bg-white/90 dark:bg-[#151d30]/90 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <Link
            to={`/rooms?destination=${encodeURIComponent(city)}`}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] rounded"
          >
            <span>View all in {city}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div
        ref={carouselRef}
        className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 sm:pb-0 snap-x snap-mandatory scrollbar-none"
      >
        {stays.map((room, index) => (
          <div
            key={room._id}
            className="w-[82vw] sm:w-[calc((100%-60px)/4)] min-w-[82vw] sm:min-w-[260px] max-w-[320px] snap-start shrink-0 min-h-[260px]"
          >
            <RoomCard room={room} index={index} layout="compact" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CityStays;
