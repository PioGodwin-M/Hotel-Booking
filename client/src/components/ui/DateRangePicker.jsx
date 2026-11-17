import React, { useState, useEffect, useRef } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  FloatingPortal,
} from "@floating-ui/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { formatShortDate } from "../../lib/formatters";
import { cn } from "../../lib/utils";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const toDateString = (year, month, day) => {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
};

const formatAriaDate = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const DateRangePicker = ({
  startDate = "",
  endDate = "",
  onChange,
  minDate = "",
  className = "",
  compact = false,
  singleMonth = false,
  stacked = false,
  anchorRef = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const effectiveMin = minDate || todayStr;

  // Initial month view
  const initialDate = startDate ? new Date(startDate) : today;
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Screen size detection
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = screenWidth < 640;
  const isDesktop = screenWidth >= 1024 && !singleMonth && !compact;

  // Floating UI configuration with fixed strategy to match portal coords
  const { refs, floatingStyles } = useFloating({
    open: isOpen && !isMobile,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(12),
      flip({
        fallbackPlacements: ["top-start"],
        padding: { top: 88, bottom: 16, left: 16, right: 16 },
      }),
      shift({
        padding: { top: 88, bottom: 16, left: 16, right: 16 },
      }),
      size({
        padding: { top: 88, bottom: 16, left: 16, right: 16 },
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(260, Math.min(460, availableHeight))}px`,
          });
        },
      }),
    ],
  });

  // Attach Floating UI reference to anchorRef if provided, otherwise triggerRef
  useEffect(() => {
    if (isOpen) {
      if (anchorRef?.current) {
        refs.setReference(anchorRef.current);
      } else if (triggerRef.current) {
        refs.setReference(triggerRef.current);
      }
    }
  }, [isOpen, anchorRef, refs]);

  // Escape key closes popover and returns focus to trigger
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e) => {
      const target = e.target;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (anchorRef?.current && anchorRef.current.contains(target)) {
        if (target.closest('button[aria-label="Select dates"]')) return;
      }
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen, anchorRef]);

  const prevMonth = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDateClick = (dateStr) => {
    if (dateStr < effectiveMin) return;

    if (!startDate || (startDate && endDate)) {
      onChange?.({ startDate: dateStr, endDate: "" });
    } else if (startDate && !endDate) {
      if (dateStr < startDate) {
        onChange?.({ startDate: dateStr, endDate: "" });
      } else if (dateStr === startDate) {
        const [y, m, d] = dateStr.split("-").map(Number);
        const nextDay = new Date(y, m - 1, d + 1);
        const nextStr = toDateString(
          nextDay.getFullYear(),
          nextDay.getMonth(),
          nextDay.getDate()
        );
        onChange?.({ startDate: dateStr, endDate: nextStr });
        setIsOpen(false);
        triggerRef.current?.focus();
      } else {
        onChange?.({ startDate, endDate: dateStr });
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
  };

  const handleDayKeyDown = (e, dateStr) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) {
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleDateClick(dateStr);
      return;
    }

    e.preventDefault();
    const [y, m, d] = dateStr.split("-").map(Number);
    let targetDate = new Date(y, m - 1, d);

    if (e.key === "ArrowLeft") targetDate.setDate(targetDate.getDate() - 1);
    else if (e.key === "ArrowRight") targetDate.setDate(targetDate.getDate() + 1);
    else if (e.key === "ArrowUp") targetDate.setDate(targetDate.getDate() - 7);
    else if (e.key === "ArrowDown") targetDate.setDate(targetDate.getDate() + 7);

    const targetStr = toDateString(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );

    const targetBtn = popoverRef.current?.querySelector(`button[data-date="${targetStr}"]`);
    if (targetBtn) {
      targetBtn.focus();
    } else {
      if (targetDate.getMonth() !== viewMonth) {
        setViewYear(targetDate.getFullYear());
        setViewMonth(targetDate.getMonth());
        setTimeout(() => {
          const btn = popoverRef.current?.querySelector(`button[data-date="${targetStr}"]`);
          btn?.focus();
        }, 50);
      }
    }
  };

  const buildMonthDays = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(toDateString(year, month, d));
    }
    return days;
  };

  let nextMonthYear = viewYear;
  let nextMonthIndex = viewMonth + 1;
  if (nextMonthIndex > 11) {
    nextMonthIndex = 0;
    nextMonthYear += 1;
  }

  const daysMonth1 = buildMonthDays(viewYear, viewMonth);
  const daysMonth2 = buildMonthDays(nextMonthYear, nextMonthIndex);

  const hasRange = startDate && endDate;
  const nightsCount = hasRange
    ? Math.max(
        0,
        Math.round(
          (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const renderCalendarMonth = (year, month, days, showPrev, showNext, isTouch = false) => {
    const cellClass = isTouch ? "w-11 h-11 text-sm" : "w-10 h-10 text-sm";

    return (
      <div className={cn("select-none", isTouch ? "w-full max-w-[340px]" : "w-[304px]")}>
        {/* Month Header */}
        <div className="relative flex items-center justify-between pb-3.5 mb-1">
          {showPrev ? (
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-8 h-8" />
          )}

          <h3 className="text-[15px] font-semibold text-[#0b1220] dark:text-[#faf8f5] text-center">
            {MONTH_NAMES[month]} {year}
          </h3>

          {showNext ? (
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-8 h-8" />
          )}
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-stone-400 dark:text-stone-500 pb-1">
          {DAYS_OF_WEEK.map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>

        {/* Days grid: 40x40 day cells, 4px row gap */}
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((dateStr, idx) => {
            if (!dateStr) {
              return <div key={`empty-${idx}`} className={cellClass} />;
            }

            const isPast = dateStr < effectiveMin;
            const isToday = dateStr === todayStr;
            const isStart = dateStr === startDate;
            const isEnd = dateStr === endDate;
            const isInRange = hasRange && dateStr > startDate && dateStr < endDate;

            return (
              <div
                key={dateStr}
                className={cn(
                  "relative flex items-center justify-center",
                  cellClass,
                  isInRange && "bg-[#f4f2ee] dark:bg-white/10",
                  isStart && hasRange && "bg-gradient-to-r from-transparent 50% to-[#f4f2ee] dark:to-white/10 50%",
                  isEnd && hasRange && "bg-gradient-to-l from-transparent 50% to-[#f4f2ee] dark:to-white/10 50%"
                )}
              >
                <button
                  type="button"
                  disabled={isPast}
                  onClick={() => handleDateClick(dateStr)}
                  onKeyDown={(e) => handleDayKeyDown(e, dateStr)}
                  data-date={dateStr}
                  aria-label={formatAriaDate(dateStr)}
                  className={cn(
                    "w-full h-full rounded-full flex items-center justify-center font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white z-10",
                    isPast && "text-stone-300 dark:text-stone-600 cursor-not-allowed pointer-events-none hover:bg-transparent",
                    isToday && !isStart && !isEnd && "ring-1 ring-stone-400 dark:ring-stone-500 ring-offset-1",
                    !isPast && !isStart && !isEnd && !isInRange && "hover:bg-stone-100 dark:hover:bg-white/10 text-[#0b1220] dark:text-[#faf8f5]",
                    isInRange && "text-[#0b1220] dark:text-[#faf8f5] rounded-none hover:bg-stone-200/60 dark:hover:bg-white/15",
                    (isStart || isEnd) && "bg-[#0b1220] text-white dark:bg-white dark:text-[#0b1220] font-semibold rounded-full shadow-xs"
                  )}
                >
                  {Number(dateStr.slice(-2))}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleTriggerClick = () => {
    if (!isOpen) {
      if (anchorRef?.current) {
        refs.setReference(anchorRef.current);
      } else if (triggerRef.current) {
        refs.setReference(triggerRef.current);
      }
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={cn("relative", className)}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        aria-expanded={isOpen}
        aria-label="Select dates"
        className={cn(
          "w-full text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white",
          compact
            ? "flex items-center justify-between p-2.5 rounded-lg border border-stone-200 dark:border-white/10 hover:border-stone-400 dark:hover:border-white/20 text-xs cursor-pointer"
            : "flex items-center gap-2 cursor-pointer"
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CalendarIcon className="w-4 h-4 text-stone-400 shrink-0" />
          {stacked ? (
            <div className="flex-1 flex flex-col gap-0.5 text-xs font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 dark:text-stone-400 font-normal">Check-in:</span>
                <span>{startDate ? formatShortDate(startDate) : "Add date"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500 dark:text-stone-400 font-normal">Check-out:</span>
                <span>{endDate ? formatShortDate(endDate) : "Add date"}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#0b1220] dark:text-[#faf8f5] truncate">
              <span>{startDate ? formatShortDate(startDate) : "Add check-in"}</span>
              <span className="text-stone-400 font-normal">→</span>
              <span>{endDate ? formatShortDate(endDate) : "Add check-out"}</span>
            </div>
          )}
        </div>
      </button>

      {/* Popover / Drawer in Portal */}
      <AnimatePresence>
        {isOpen && (
          <FloatingPortal>
            {isMobile ? (
              /* Mobile Bottom Sheet Drawer */
              <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
                {/* Backdrop */}
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 bg-black/60"
                  onClick={() => {
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                  aria-hidden="true"
                />

                {/* Sheet Content */}
                <motion.div
                  ref={popoverRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Select dates"
                  initial={shouldReduceMotion ? undefined : { y: "100%" }}
                  animate={{ y: 0 }}
                  exit={shouldReduceMotion ? undefined : { y: "100%" }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="relative z-10 w-full bg-white dark:bg-[#151d30] rounded-t-[20px] p-5 pb-7 shadow-2xl border-t border-stone-200 dark:border-white/10 max-h-[85vh] overflow-y-auto flex flex-col items-center"
                >
                  <div className="w-full flex items-center justify-between pb-3">
                    <div className="w-10 h-1 bg-stone-300 dark:bg-stone-600 rounded-full mx-auto -mr-6" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        triggerRef.current?.focus();
                      }}
                      aria-label="Close date picker"
                      className="p-1.5 rounded-full text-stone-400 hover:text-stone-800 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {renderCalendarMonth(viewYear, viewMonth, daysMonth1, true, true, true)}

                  {/* Footer */}
                  <div className="w-full max-w-[340px] mt-4 pt-3.5 border-t border-stone-100 dark:border-white/10 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => onChange?.({ startDate: "", endDate: "" })}
                      className="text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white font-medium cursor-pointer"
                    >
                      Clear dates
                    </button>
                    {nightsCount > 0 && (
                      <span className="font-semibold text-stone-700 dark:text-stone-300">
                        {nightsCount} {nightsCount === 1 ? "night" : "nights"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        triggerRef.current?.focus();
                      }}
                      className="px-4 py-2 rounded-lg bg-[#0b1220] text-white dark:bg-white dark:text-[#0b1220] font-semibold text-xs cursor-pointer shadow-xs"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              </div>
            ) : (
              /* Desktop / Tablet Floating Popover */
              <div
                ref={(el) => {
                  popoverRef.current = el;
                  refs.setFloating(el);
                }}
                style={{
                  ...floatingStyles,
                  zIndex: 9999,
                }}
                role="dialog"
                aria-modal="true"
                aria-label="Select dates"
              >
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className={cn(
                    "p-5 rounded-[14px] bg-white dark:bg-[#151d30] border border-stone-200 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)] max-h-[calc(100vh-104px)] overflow-y-auto",
                    isDesktop ? "w-[672px]" : "w-[344px]"
                  )}
                >
                  {isDesktop ? (
                    /* 2 Months Side by Side (<= 700px width total) */
                    <div className="flex items-start justify-between gap-6">
                      {renderCalendarMonth(
                        viewYear,
                        viewMonth,
                        daysMonth1,
                        true,
                        false,
                        false
                      )}
                      {renderCalendarMonth(
                        nextMonthYear,
                        nextMonthIndex,
                        daysMonth2,
                        false,
                        true,
                        false
                      )}
                    </div>
                  ) : (
                    /* 1 Month on Tablet (640px - 1023px) or Single Month Mode */
                    renderCalendarMonth(
                      viewYear,
                      viewMonth,
                      daysMonth1,
                      true,
                      true,
                      false
                    )
                  )}

                  {/* Footer: Clear dates | Summary | Done */}
                  <div className="mt-4 pt-3.5 border-t border-stone-100 dark:border-white/10 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => onChange?.({ startDate: "", endDate: "" })}
                      className="text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white font-medium cursor-pointer transition-colors"
                    >
                      Clear dates
                    </button>

                    <div className="font-semibold text-stone-700 dark:text-stone-300">
                      {nightsCount > 0 ? (
                        <span>
                          {nightsCount} {nightsCount === 1 ? "night" : "nights"}
                        </span>
                      ) : (
                        <span className="text-stone-400 font-normal">Select dates</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        triggerRef.current?.focus();
                      }}
                      className="px-4 py-1.5 rounded-lg bg-[#0b1220] text-white dark:bg-white dark:text-[#0b1220] font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </FloatingPortal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DateRangePicker;

