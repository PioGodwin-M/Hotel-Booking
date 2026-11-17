import React from "react";
import { cn } from "../../lib/utils";

/**
 * Shared StatusText component.
 * Replaces tinted pill badges with plain colored text (no background, no border, no dot).
 * Verified to meet WCAG AA contrast (>= 4.5:1) on both light and dark backgrounds.
 */
export const StatusText = ({
  status = "neutral",
  children,
  className,
  as = "span",
  ...props
}) => {
  const normalized = String(status).toLowerCase();

  let colorClass = "text-gray-600 dark:text-gray-400"; // default grey

  if (normalized === "confirmed" || normalized === "success") {
    colorClass = "text-emerald-800 dark:text-emerald-400 font-medium";
  } else if (
    normalized === "held" ||
    normalized === "pending" ||
    normalized === "payment_pending" ||
    normalized === "warning"
  ) {
    colorClass = "text-amber-800 dark:text-amber-400 font-medium";
  } else if (
    normalized === "cancelled" ||
    normalized === "expired" ||
    normalized === "inactive"
  ) {
    colorClass = "text-gray-600 dark:text-gray-400 font-medium";
  } else if (
    normalized === "failed" ||
    normalized === "payment_failed" ||
    normalized === "danger"
  ) {
    colorClass = "text-rose-700 dark:text-rose-400 font-medium";
  }

  return React.createElement(
    as,
    {
      className: cn("text-xs sm:text-sm", colorClass, className),
      ...props,
    },
    children
  );
};

export default StatusText;
