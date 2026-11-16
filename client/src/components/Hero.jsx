import React, { useState, useRef } from "react";
import { Search, MapPin } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cities } from "../assets/assets";
import { useAppContext } from "../context/AppContext";
import { Button } from "./ui/Button";
import { DateRangePicker, GuestsStepper } from "./ui";

export const Hero = () => {
  const { navigate, setSearchedCities } = useAppContext();
  const shouldReduceMotion = useReducedMotion();
  const searchBarRef = useRef(null);

  // Date calculation helpers
  const toLocalDateString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const minCheckIn = toLocalDateString(today);

  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [dateError, setDateError] = useState("");

  const onSearch = (e) => {
    e.preventDefault();

    if (checkIn && checkIn < minCheckIn) {
      setDateError("Check-in date cannot be in the past");
      return;
    }

    if (checkIn && checkOut && checkOut <= checkIn) {
      setDateError("Check-out date must be strictly after check-in date");
      return;
    }

    if (destination.trim()) {
      setSearchedCities((prevCities = []) => {
        const updated = [
          destination.trim(),
          ...prevCities.filter(
            (c) => c.toLowerCase() !== destination.trim().toLowerCase()
          ),
        ];
        return updated.slice(0, 5);
      });
    }

    const params = new URLSearchParams();
    if (destination.trim()) params.set("destination", destination.trim());
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", String(guests));

    navigate(`/rooms?${params.toString()}`);
  };

  return (
    <section
      className="hero-section relative flex flex-col justify-end bg-[#0b1220] overflow-hidden"
      style={{
        height: typeof window !== "undefined" && window.innerWidth < 640 ? "auto" : "clamp(390px, calc(100svh - var(--recommended-block-height, 350px) - 50px), 590px)",
        minHeight: typeof window !== "undefined" && window.innerWidth < 640 ? "0" : "390px",
      }}
    >
      {/* Background Image: brighter photo with daytime lighting */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-100 overflow-hidden pointer-events-none"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=85")',
        }}
      >
        {/* Soft gradient overlay behind text only on desktop, full gentle gradient on mobile */}
        <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0b1220]/85 via-[#0b1220]/60 to-black/25" />
      </div>

      {/* Hero Content: strictly aligned to page-container */}
      <div className="page-container relative z-10 flex flex-col items-start text-left pt-16 sm:pt-0 pb-4 sm:pb-7">
        {/* Headline */}
        <motion.h1
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-[1.15] max-w-2xl"
        >
          Find your next stay
        </motion.h1>

        {/* Subhead with truthful, honest pricing copy */}
        <motion.p
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-2 sm:mt-2.5 text-sm sm:text-base md:text-lg text-stone-200 max-w-xl font-normal leading-relaxed"
        >
          Browse hotel rooms and vacation stays. See the full price before you pay, reserve your room, and pay to confirm.
        </motion.p>

        {/* Search Capsule */}
        <motion.form
          ref={searchBarRef}
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          onSubmit={onSearch}
          className="mt-4 sm:mt-6 w-full max-w-4xl bg-white dark:bg-[#151d30] rounded-2xl p-3 sm:p-3.5 shadow-xl border border-[#e7e5e0] dark:border-white/10 text-[#0b1220] dark:text-[#faf8f5] flex flex-col md:flex-row items-stretch md:items-center gap-2.5"
        >
          {/* Destination */}
          <div className="flex-1 px-3.5 py-2 border-b md:border-b-0 md:border-r border-[#e7e5e0] dark:border-white/10 text-left">
            <label
              htmlFor="hero-destination"
              className="flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-300"
            >
              <MapPin className="w-3.5 h-3.5 text-stone-400" />
              Where are you going?
            </label>
            <input
              id="hero-destination"
              type="text"
              list="destination-list"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="City, area or hotel"
              className="w-full mt-1 bg-transparent text-sm font-semibold text-[#0b1220] dark:text-[#faf8f5] placeholder:text-stone-400 dark:placeholder:text-stone-500 placeholder:font-normal focus:outline-none truncate"
            />
            <datalist id="destination-list">
              {cities.map((c, i) => (
                <option key={i} value={c} />
              ))}
            </datalist>
          </div>

          {/* Dates (Range Picker) */}
          <div className="px-3.5 py-2 border-b md:border-b-0 md:border-r border-[#e7e5e0] dark:border-white/10 text-left min-w-[200px]">
            <p className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-0.5">
              Dates
            </p>
            <DateRangePicker
              anchorRef={searchBarRef}
              startDate={checkIn}
              endDate={checkOut}
              minDate={minCheckIn}
              onChange={({ startDate, endDate }) => {
                setCheckIn(startDate);
                setCheckOut(endDate);
                setDateError("");
              }}
            />
          </div>

          {/* Guests (Stepper) */}
          <div className="px-3.5 py-2 text-left min-w-[150px]">
            <p className="text-xs font-medium text-stone-600 dark:text-stone-300 mb-0.5">
              Guests
            </p>
            <GuestsStepper
              value={guests}
              onChange={setGuests}
              min={1}
              max={10}
            />
          </div>

          {/* Search CTA */}
          <div className="pt-1 md:pt-0">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full md:w-auto h-full px-6 py-3 font-medium shrink-0"
              leftIcon={<Search className="w-4 h-4" />}
            >
              Search
            </Button>
          </div>
        </motion.form>

        {dateError && (
          <p className="mt-3 text-xs text-rose-300 font-medium bg-rose-950/70 px-3 py-1 rounded-md border border-rose-800/40">
            {dateError}
          </p>
        )}
      </div>
    </section>
  );
};

export default Hero;
