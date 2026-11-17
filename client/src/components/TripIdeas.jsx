import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTripIdeas } from "../hooks/useTripIdeas";
import { formatINR } from "../lib/formatters";
import { SafeImage } from "./ui";

export const TripIdeas = () => {
  const { data: tripIdeas, isLoading, isSample } = useTripIdeas();

  // If loading or no trip ideas available, do not render (no empty frame, no gap)
  if (isLoading || !tripIdeas || tripIdeas.length === 0) {
    return null;
  }

  return (
    <section className="page-container text-left">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            Trip ideas
          </h2>
          {isSample && (
            <span className="text-xs text-stone-500 dark:text-stone-400 font-normal">
              Sample
            </span>
          )}
        </div>

        <Link
          to="/rooms"
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] rounded"
        >
          <span>Explore all</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Grid on desktop (up to 4 cols), horizontal swipeable carousel on mobile */}
      <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 overflow-x-auto md:overflow-visible pb-2 md:pb-0 snap-x snap-mandatory scrollbar-none">
        {tripIdeas.map((idea) => (
          <Link
            key={idea.id}
            to={idea.filterUrl || "/rooms"}
            className="group flex flex-col justify-between w-[82vw] md:w-auto min-w-[82vw] md:min-w-0 snap-start shrink-0 md:shrink rounded-[12px] bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220]"
          >
            {/* 16:10 Photo Banner */}
            <div className="relative aspect-[16/10] overflow-hidden bg-stone-100 dark:bg-white/5">
              <SafeImage
                src={idea.image}
                alt={idea.title}
                fallbackLabel={idea.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
              />
            </div>

            {/* Content Details */}
            <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                  <span>{idea.duration}</span>
                  {idea.filterCity && <span>{idea.filterCity}</span>}
                </div>

                <h3 className="text-base font-semibold text-[#0b1220] dark:text-[#faf8f5] leading-snug group-hover:underline underline-offset-2">
                  {idea.title}
                </h3>

                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed">
                  {idea.description}
                </p>
              </div>

              {/* Price line */}
              <div className="pt-2 border-t border-[#f0ede6] dark:border-white/10 flex items-baseline justify-between">
                <span className="text-xs text-stone-500 dark:text-stone-400 font-normal">
                  From
                </span>
                <span className="text-sm font-semibold text-[#0b1220] dark:text-[#faf8f5] tabular-nums">
                  {formatINR(idea.startingPrice)} / night
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default TripIdeas;
