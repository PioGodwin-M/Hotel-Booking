import React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = {
  confirmed:
    "bg-emerald-50 text-[#065f46] dark:bg-emerald-950/40 dark:text-[#6ee7b7]",
  success:
    "bg-emerald-50 text-[#065f46] dark:bg-emerald-950/40 dark:text-[#6ee7b7]",
  pending:
    "bg-amber-50 text-[#854d0e] dark:bg-amber-950/40 dark:text-[#fde047]",
  held:
    "bg-sky-50 text-[#075985] dark:bg-sky-950/40 dark:text-[#7dd3fc]",
  cancelled:
    "bg-rose-50 text-[#9f1239] dark:bg-rose-950/40 dark:text-[#fda4af]",
  failed:
    "bg-rose-50 text-[#9f1239] dark:bg-rose-950/40 dark:text-[#fda4af]",
  gold:
    "bg-amber-50 text-[#785412] dark:bg-amber-950/30 dark:text-[#fde047]",
  champagne:
    "bg-amber-50 text-[#785412] dark:bg-amber-950/30 dark:text-[#fde047]",
  obsidian:
    "bg-[#0b1220] text-white dark:bg-white dark:text-[#0b1220]",
  neutral:
    "bg-[#f0ede6] text-[#334155] dark:bg-white/10 dark:text-[#e2e8f0]",
  outline:
    "border border-[#e7e5e0] text-[#0b1220] dark:text-[#faf8f5] dark:border-white/15 bg-transparent",
};

const badgeSizes = {
  sm: "text-[11px] px-2 py-0.5 rounded-[5px] font-medium tracking-normal",
  md: "text-xs px-2.5 py-1 rounded-[6px] font-medium tracking-normal",
  lg: "text-sm px-3 py-1.5 rounded-[6px] font-medium tracking-normal",
};

export const Badge = ({
  children,
  variant = "neutral",
  size = "md",
  icon,
  dot = false,
  className,
  ...props
}) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 select-none transition-colors",
        badgeVariants[variant] || badgeVariants.neutral,
        badgeSizes[size] || badgeSizes.md,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            variant === "confirmed" || variant === "success"
              ? "bg-[#059669] dark:bg-[#34d399]"
              : variant === "pending"
              ? "bg-[#d97706] dark:bg-[#fbbf24]"
              : variant === "held"
              ? "bg-[#0284c7] dark:bg-[#38bdf8]"
              : variant === "cancelled" || variant === "failed"
              ? "bg-[#e11d48] dark:bg-[#f43f5e]"
              : "bg-current"
          )}
        />
      )}
      {icon && <span aria-hidden="true" className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export default Badge;
