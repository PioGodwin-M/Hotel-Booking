import React from "react";
import { Link } from "react-router-dom";
import { BRAND_PREFIX, BRAND_SUFFIX, BRAND_INITIAL, BRAND_NAME } from "../config/brand";
import { cn } from "../lib/utils";

/**
 * Reusable PGM Stays Logo Component
 * - Pure SVG & Inter font wordmark (no external image dependencies)
 * - Scalable from 24px to 40px height
 * - Supports tone="auto|light|dark" (and legacy variant/isLight props)
 *   - "dark": for dark surfaces (hero before scroll, footer, dark sidebar).
 *             Mark: pure white square with ink "P".
 *             Wordmark: pure white text (18.5:1 contrast).
 *   - "light": for light surfaces.
 *             Mark: ink square with white "P".
 *             Wordmark: ink text #0B1220 (in dark-mode: white text).
 * - Fully accessible with focus rings and proper aria-label.
 */
export const Logo = ({
  tone = "auto", // 'auto' | 'light' | 'dark'
  variant, // backwards compatibility
  isLight, // backwards compatibility
  size = "md", // 'sm' (24px) | 'md' (28px) | 'lg' (36px)
  asLink = true,
  className = "",
}) => {
  const isDarkSurface =
    tone === "dark" ||
    variant === "dark" ||
    isLight === true;

  const sizeStyles = {
    sm: {
      box: "w-6 h-6 text-sm rounded-[6px]",
      text: "text-base",
      gap: "gap-1.5",
    },
    md: {
      box: "w-7 h-7 text-base rounded-[8px]",
      text: "text-lg",
      gap: "gap-2",
    },
    lg: {
      box: "w-9 h-9 text-lg rounded-[10px]",
      text: "text-xl",
      gap: "gap-2.5",
    },
  }[size] || sizeStyles.md;

  const content = (
    <span
      className={cn(
        "inline-flex items-center select-none tracking-tight",
        sizeStyles.gap,
        className
      )}
    >
      {/* 28px square mark with bold initial letter */}
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center font-bold font-sans transition-colors shrink-0 shadow-2xs",
          sizeStyles.box,
          isDarkSurface
            ? "bg-white text-[#0B1220]"
            : "bg-[#0B1220] text-white dark:bg-white dark:text-[#0B1220]"
        )}
        style={{ letterSpacing: "-0.02em" }}
      >
        {BRAND_INITIAL}
      </span>

      {/* Brand Wordmark: Inter 700 + Inter 400 */}
      <span
        className={cn(
          "font-sans transition-colors flex items-baseline leading-none font-semibold",
          sizeStyles.text,
          isDarkSurface
            ? "text-white"
            : "text-[#0B1220] dark:text-white"
        )}
      >
        <span className="font-bold tracking-tight">{BRAND_PREFIX}</span>
        <span className="ml-1 font-normal opacity-90">{BRAND_SUFFIX}</span>
      </span>
    </span>
  );

  if (!asLink) {
    return content;
  }

  return (
    <Link
      to="/"
      aria-label={`${BRAND_NAME} home`}
      className={cn(
        "inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-transform active:scale-[0.98]",
        isDarkSurface
          ? "focus-visible:ring-white focus-visible:ring-offset-[#0B1220]"
          : "focus-visible:ring-[#0B1220] dark:focus-visible:ring-white focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0B1220]"
      )}
    >
      {content}
    </Link>
  );
};

export default Logo;
