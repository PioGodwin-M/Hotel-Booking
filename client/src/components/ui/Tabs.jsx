import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";

export const Tabs = ({
  tabs = [],
  activeTab,
  onChange,
  className,
  variant = "pill", // pill | underline
}) => {
  const shouldReduceMotion = useReducedMotion();
  const isPill = variant === "pill";

  return (
    <div
      role="tablist"
      className={cn(
        isPill
          ? "inline-flex items-center gap-1 p-1 rounded-xl bg-[#f0ede6]/80 dark:bg-white/5 border border-[#e7e5e0] dark:border-white/10"
          : "inline-flex items-center gap-6 border-b border-gray-200 dark:border-gray-800 pb-0",
        className
      )}
    >
      {tabs.map((tab) => {
        const id = typeof tab === "object" ? tab.id : tab;
        const label = typeof tab === "object" ? tab.label : tab;
        const icon = typeof tab === "object" ? tab.icon : null;
        const count = typeof tab === "object" ? tab.count : null;
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={cn(
              "relative text-xs md:text-sm font-medium tracking-normal transition-colors duration-150 z-10 flex items-center gap-2 cursor-pointer select-none",
              isPill
                ? "px-3.5 py-1.5 rounded-lg"
                : "pb-2 px-1 text-sm",
              isActive
                ? "text-[#0b1220] dark:text-[#faf8f5] font-semibold"
                : "text-[#0b1220]/60 dark:text-[#faf8f5]/60 hover:text-[#0b1220] dark:hover:text-[#faf8f5]"
            )}
          >
            {isActive && (
              isPill ? (
                <motion.div
                  layoutId={shouldReduceMotion ? undefined : "activeTabIndicator"}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute inset-0 bg-white dark:bg-[#151d30] rounded-lg shadow-2xs -z-10 border border-[#e7e5e0]/60 dark:border-white/10"
                />
              ) : (
                <motion.div
                  layoutId={shouldReduceMotion ? undefined : "activeTabUnderline"}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0b1220] dark:bg-white z-0"
                />
              )
            )}
            {icon && <span className="shrink-0">{icon}</span>}
            <span>
              {label}
              {count !== null && count !== undefined && ` (${count})`}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
