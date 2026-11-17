import React from "react";
import { RoomCard } from "../components/RoomCard";
import { usePageTitle } from "../hooks/usePageTitle";

const STRESS_ROOM = {
  _id: "stress-test-room-60chars",
  hotel: {
    name: "The Grand Royal Palace & Heritage Wellness Sanctuary Resort of India",
    address: "Palace Road, Near Lake Pichola, Udaipur, Rajasthan",
    city: "Udaipur",
  },
  pricePerNight: 12500000, // ₹1,25,00,000 (1 crore 25 lakh)
  roomType: "Royal Presidential Heritage Suite",
  amenities: [
    "Free high-speed Wi-Fi",
    "Private heated infinity pool",
    "Luxury Ayurveda spa & wellness",
    "24/7 dedicated butler service",
    "Panoramic lake & palace view",
    "Gourmet buffet breakfast",
    "Chauffeur airport transfer",
    "Modern fitness & yoga studio",
  ],
  rating: 4.9,
  reviewsCount: 128,
  // Missing image (tests default placeholder fallback)
  images: [],
};

export const CardStressTest = () => {
  usePageTitle("RoomCard Stress Test");

  const widths = [260, 320, 360, 420];

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-[#0B1220] py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="text-left border-b border-[#E7E5E0] dark:border-white/10 pb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B1220] dark:text-[#FAF8F5]">
            RoomCard Responsive Stress Test
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Testing extreme layout constraints: 68-char hotel name, ₹1,25,00,000 price, 8 amenities, broken image fallback, at 260px, 320px, 360px, and 420px container widths.
          </p>
        </div>

        {/* Grid of containers at exact fixed widths */}
        <div className="flex flex-wrap items-start gap-8 justify-start">
          {widths.map((w) => (
            <div
              key={w}
              id={`stress-container-${w}`}
              className="flex flex-col gap-2 shrink-0 bg-white/50 dark:bg-white/5 p-4 rounded-xl border border-dashed border-stone-300 dark:border-stone-700"
              style={{ width: `${w + 32}px` }}
            >
              <div className="flex items-center justify-between text-xs font-mono font-semibold text-stone-700 dark:text-stone-300 px-1">
                <span>Container: {w}px</span>
                <span className="text-[11px] text-stone-500 font-normal">width: {w}px</span>
              </div>
              <div style={{ width: `${w}px` }}>
                <RoomCard room={STRESS_ROOM} layout="grid" index={0} />
              </div>
            </div>
          ))}
        </div>

        {/* Also stress-test List view */}
        <div className="pt-8 border-t border-[#E7E5E0] dark:border-white/10">
          <h2 className="text-xl font-bold text-[#0B1220] dark:text-[#FAF8F5] mb-4 text-left">
            List View Variant (Responsive Stack)
          </h2>
          <div className="space-y-6">
            <div className="max-w-3xl bg-white/50 dark:bg-white/5 p-4 rounded-xl border border-dashed border-stone-300 dark:border-stone-700">
              <span className="text-xs font-mono font-semibold block text-left mb-2 text-stone-700 dark:text-stone-300">
                Desktop List (768px container)
              </span>
              <RoomCard room={STRESS_ROOM} layout="list" index={0} />
            </div>

            <div
              id="stress-container-list-mobile"
              className="bg-white/50 dark:bg-white/5 p-4 rounded-xl border border-dashed border-stone-300 dark:border-stone-700"
              style={{ width: "352px" }}
            >
              <span className="text-xs font-mono font-semibold block text-left mb-2 text-stone-700 dark:text-stone-300">
                Mobile List (320px container - auto stacks)
              </span>
              <div style={{ width: "320px" }}>
                <RoomCard room={STRESS_ROOM} layout="list" index={0} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardStressTest;
