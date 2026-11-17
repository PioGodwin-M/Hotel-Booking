import React from "react";
import { Search } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

export const EmptyState = ({
  icon,
  title = "No results found",
  description = "We couldn't find anything matching your search criteria. Try adjusting your filters.",
  actionLabel,
  onAction,
  secondaryAction,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-xl bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 shadow-2xs max-w-md mx-auto",
        className
      )}
    >
      <div className="text-gray-400 dark:text-gray-500 mb-3 flex items-center justify-center">
        {icon || <Search className="w-8 h-8 stroke-[1.5]" aria-hidden="true" />}
      </div>
      <h3 className="font-sans text-lg md:text-xl font-semibold text-[#0b1220] dark:text-[#faf8f5] mb-1.5">
        {title}
      </h3>
      <p className="text-xs md:text-sm text-[#0b1220]/65 dark:text-[#faf8f5]/65 max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {actionLabel && onAction && (
          <Button variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
        {secondaryAction}
      </div>
    </div>
  );
};

export default EmptyState;
