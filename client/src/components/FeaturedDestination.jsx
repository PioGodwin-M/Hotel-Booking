import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { MOCK_POPULAR_DESTINATIONS } from "../data/mock";
import { SafeImage } from "./ui";

export const FeaturedDestination = () => {
  const shouldReduceMotion = useReducedMotion();
  const destinations = MOCK_POPULAR_DESTINATIONS;

  return (
    <section className="py-16 md:py-20 bg-[#faf9f6] dark:bg-[#151d30]/30 border-t border-[#e7e5e0] dark:border-white/10 text-left">
      <div className="page-container">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            Popular destinations
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            Explore top holiday spots and city destinations with comfortable stays.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {destinations.map((dest) => (
            <motion.div
              key={dest.name}
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : { y: -3, transition: { duration: 0.15 } }
              }
              className="group relative rounded-xl overflow-hidden aspect-[3/4] cursor-pointer shadow-2xs hover:shadow-md transition-shadow bg-stone-200"
            >
              <Link
                to={`/rooms?destination=${encodeURIComponent(dest.name)}`}
                className="block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <SafeImage
                  src={dest.image}
                  alt={dest.name}
                  fallbackLabel={dest.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                <div className="absolute bottom-0 inset-x-0 p-5 flex items-end justify-between text-white">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-300">
                      {dest.country}
                    </p>
                    <h3 className="text-xl font-bold mt-0.5">
                      {dest.name}
                    </h3>
                    <p className="text-xs text-stone-300 mt-0.5">
                      {dest.count} stays available
                    </p>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white group-hover:bg-white group-hover:text-[#0b1220] transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedDestination;
