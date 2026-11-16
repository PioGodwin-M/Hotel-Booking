import React from "react";
import { Minus, Plus, Users } from "lucide-react";
import { cn } from "../../lib/utils";

export const GuestsStepper = ({
  value = 2,
  onChange,
  min = 1,
  max = 10,
  className = "",
}) => {
  const handleDecrement = (e) => {
    e.preventDefault();
    if (value > min) {
      onChange?.(value - 1);
    }
  };

  const handleIncrement = (e) => {
    e.preventDefault();
    if (value < max) {
      onChange?.(value + 1);
    }
  };

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2 min-w-0">
        <Users className="w-4 h-4 text-stone-400 shrink-0" />
        <span className="text-xs sm:text-sm font-semibold text-[#0b1220] dark:text-[#faf8f5] truncate">
          {value} {value === 1 ? "Guest" : "Guests"}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          aria-label="Decrease guest count"
          className="w-7 h-7 rounded-md border border-stone-200 dark:border-white/10 flex items-center justify-center text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0b1220]"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <span className="w-6 text-center text-xs font-bold text-[#0b1220] dark:text-[#faf8f5] tabular-nums select-none">
          {value}
        </span>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          aria-label="Increase guest count"
          className="w-7 h-7 rounded-md border border-stone-200 dark:border-white/10 flex items-center justify-center text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0b1220]"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default GuestsStepper;
