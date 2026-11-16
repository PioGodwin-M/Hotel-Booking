import React, { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * SafeImage displays an image with:
 * 1. Smooth loading skeleton
 * 2. Graceful fallback on error (neutral gradient with label so alt text is never shown on a broken grey box)
 */
export const SafeImage = ({
  src,
  alt = "",
  className = "",
  containerClassName = "",
  fallbackLabel = "",
  loading = "lazy",
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={cn(
          "w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-stone-200 via-stone-100 to-stone-200 dark:from-stone-800 dark:via-stone-850 dark:to-stone-900 text-stone-600 dark:text-stone-300 select-none",
          containerClassName
        )}
      >
        <ImageOff className="w-5 h-5 text-stone-400 dark:text-stone-500 mb-1 shrink-0" />
        {fallbackLabel && (
          <span className="text-xs font-semibold truncate max-w-full px-2">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden w-full h-full", containerClassName)}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-stone-200 dark:bg-stone-800 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          !isLoaded ? "opacity-0" : "opacity-100",
          className
        )}
        {...props}
      />
    </div>
  );
};

export default SafeImage;
