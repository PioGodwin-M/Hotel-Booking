import React from "react";
import { cn } from "../../lib/utils";

export const Skeleton = ({ className, variant = "rect", ...props }) => {
  return (
    <div
      className={cn(
        "animate-pulse bg-[#efece6] dark:bg-white/10 rounded-lg",
        variant === "circle" && "rounded-full",
        variant === "text" && "h-4 rounded-[4px]",
        className
      )}
      {...props}
    />
  );
};

export const RoomCardSkeleton = ({ compact = false }) => {
  return (
    <div className={cn(
      "rounded-xl overflow-hidden bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 shadow-2xs h-full flex flex-col justify-between",
      compact ? "p-3 space-y-2.5" : "p-3 space-y-3"
    )}>
      <Skeleton className={cn(
        "w-full rounded-lg shrink-0",
        compact ? "aspect-video" : "aspect-[4/3]"
      )} />
      <div className="px-1 pb-1 space-y-2 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 sm:h-5 w-2/3" />
            <Skeleton className="h-4 sm:h-5 w-10 rounded-[6px]" />
          </div>
          <Skeleton className="h-3.5 w-1/2" />
          {compact && <Skeleton className="h-3 w-3/4" />}
        </div>
        <div className="pt-2 border-t border-[#e7e5e0] dark:border-white/10">
          <Skeleton className="h-5 sm:h-6 w-28" />
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
