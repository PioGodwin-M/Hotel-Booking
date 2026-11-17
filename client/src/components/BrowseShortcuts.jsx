import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { SafeImage } from "./ui";

export const BrowseShortcuts = () => {
  const { rooms } = useAppContext();

  // Compute matching counts and active tiles dynamically from real stays catalog
  const tiles = useMemo(() => {
    if (!Array.isArray(rooms) || rooms.length === 0) return [];

    const candidates = [
      {
        id: "under-3k",
        title: "Under ₹3,000 a night",
        url: "/rooms?maxPrice=3000",
        image:
          "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80",
        count: rooms.filter(
          (r) => typeof r.pricePerNight === "number" && r.pricePerNight <= 3000
        ).length,
      },
      {
        id: "family-stays",
        title: "Stays for 4+ guests",
        url: "/rooms?guests=4",
        image:
          "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=600&q=80",
        count: rooms.filter((r) => {
          const maxG = r.maxGuests || 2;
          return maxG >= 4;
        }).length,
      },
      {
        id: "pool-stays",
        title: "With a pool",
        url: "/rooms?amenity=Pool",
        image:
          "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=600&q=80",
        count: rooms.filter((r) =>
          Array.isArray(r.amenities)
            ? r.amenities.some((a) => /pool/i.test(a))
            : false
        ).length,
      },
      {
        id: "mountain-stays",
        title: "Mountain view",
        url: "/rooms?amenity=Mountain%20View",
        image:
          "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80",
        count: rooms.filter((r) => {
          const hasAmenity =
            Array.isArray(r.amenities) &&
            r.amenities.some((a) => /mountain|hill|balcony/i.test(a));
          const isHillCity = /shimla|manali/i.test(r?.hotel?.city || "");
          return hasAmenity || isHillCity;
        }).length,
      },
      {
        id: "wifi-stays",
        title: "Fast Wi-Fi for work",
        url: "/rooms?amenity=Free%20WiFi",
        image:
          "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80",
        count: rooms.filter((r) =>
          Array.isArray(r.amenities)
            ? r.amenities.some((a) => /wifi/i.test(a))
            : false
        ).length,
      },
    ];

    // Strictly filter out any tile that would yield 0 matching results
    return candidates.filter((tile) => tile.count > 0).slice(0, 4);
  }, [rooms]);

  if (tiles.length === 0) return null;

  return (
    <section className="page-container py-6 sm:py-8 text-left">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            Find a stay that fits
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            Browse stays tailored to your budget and travel style.
          </p>
        </div>

        <Link
          to="/rooms"
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] rounded"
        >
          <span>All filters</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {tiles.map((tile) => (
          <Link
            key={tile.id}
            to={tile.url}
            className="group relative flex flex-col justify-end aspect-[4/3] rounded-[12px] overflow-hidden border border-[#e7e5e0] dark:border-white/10 shadow-2xs hover:shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220]"
          >
            {/* Background Image */}
            <div className="absolute inset-0 bg-stone-900/30 group-hover:bg-stone-900/20 transition-colors z-10" />
            <SafeImage
              src={tile.image}
              alt={tile.title}
              fallbackLabel={tile.title}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
            />

            {/* Gradient Overlay for 4.5:1 text contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent z-15" />

            {/* Text details */}
            <div className="relative z-20 p-3 sm:p-4 text-white">
              <h3 className="text-sm sm:text-base font-semibold leading-snug group-hover:underline underline-offset-2">
                {tile.title}
              </h3>
              <p className="text-xs text-stone-300 mt-0.5 tabular-nums">
                {tile.count} {tile.count === 1 ? "stay" : "stays"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default BrowseShortcuts;
