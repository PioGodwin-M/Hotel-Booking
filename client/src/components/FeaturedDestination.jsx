import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useAppContext } from "../context/AppContext";
import { SafeImage } from "./ui";

// High-quality distinct imagery fallbacks for known destinations
const CITY_IMAGE_FALLBACKS = {
  goa: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
  jaipur: "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=600&q=80",
  udaipur: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=600&q=80",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
  shimla: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80",
  kyoto: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
  chennai: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80",
  mumbai: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=600&q=80",
  manali: "https://images.unsplash.com/photo-1586375300773-8384e3e4916f?auto=format&fit=crop&w=600&q=80",
};

export const FeaturedDestination = () => {
  const shouldReduceMotion = useReducedMotion();
  const { rooms } = useAppContext();

  // Compute dynamic destination cards strictly from actual data in the catalog
  const destinations = useMemo(() => {
    if (!Array.isArray(rooms) || rooms.length === 0) return [];

    const cityMap = new Map();
    for (const r of rooms) {
      const city = r?.hotel?.city;
      if (!city) continue;
      const normalized = city.trim();
      const existing = cityMap.get(normalized) || {
        name: normalized,
        count: 0,
        availableImages: [],
      };
      existing.count += 1;
      if (Array.isArray(r.images)) {
        for (const img of r.images) {
          if (img && !existing.availableImages.includes(img)) {
            existing.availableImages.push(img);
          }
        }
      }
      cityMap.set(normalized, existing);
    }

    const usedImages = new Set();
    const cityList = Array.from(cityMap.values());

    return cityList.map((d) => {
      // Pick an image not yet used by another destination
      let selectedImage = d.availableImages.find((img) => !usedImages.has(img));

      if (!selectedImage) {
        selectedImage =
          CITY_IMAGE_FALLBACKS[d.name.toLowerCase()] ||
          "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80";
      }

      usedImages.add(selectedImage);

      return {
        name: d.name,
        count: d.count,
        image: selectedImage,
      };
    });
  }, [rooms]);

  if (destinations.length === 0) return null;

  // Sizing rule: 1-2 tiles: 2 columns; 3 tiles: 3 columns; 4+ tiles: 4 columns
  const activeDestinations = destinations.slice(0, 4);
  const count = activeDestinations.length;
  const gridLayout =
    count <= 2
      ? "grid-cols-2"
      : count === 3
      ? "grid-cols-2 lg:grid-cols-3"
      : "grid-cols-2 lg:grid-cols-4";

  return (
    <section className="page-container text-left">
      {/* Heading only */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
          Popular destinations
        </h2>

        <Link
          to="/rooms"
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] rounded"
        >
          <span>All stays</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Sized grid with no empty slot at end */}
      <div className={`grid ${gridLayout} gap-3 sm:gap-5`}>
        {activeDestinations.map((dest) => (
          <motion.div
            key={dest.name}
            whileHover={
              shouldReduceMotion
                ? undefined
                : { y: -3, transition: { duration: 0.15 } }
            }
            className="group relative rounded-[12px] overflow-hidden aspect-[3/4] cursor-pointer shadow-2xs hover:shadow-md transition-shadow bg-stone-200"
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

              <div className="absolute bottom-0 inset-x-0 p-3 sm:p-5 flex items-end justify-between text-white">
                <div>
                  <h3 className="text-base sm:text-xl font-bold mt-0.5 leading-tight">
                    {dest.name}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-stone-300 mt-0.5">
                    {dest.count} {dest.count === 1 ? "stay" : "stays"} available
                  </p>
                </div>

                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white group-hover:bg-white group-hover:text-[#0b1220] transition-colors shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default FeaturedDestination;
