import React, { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const buttonVariants = {
  // Primary: solid ink with 10px radius
  primary:
    "bg-[#0b1220] hover:bg-[#1a233a] active:bg-[#070b14] text-white dark:bg-white dark:text-[#0b1220] dark:hover:bg-[#f1f5f9] font-medium shadow-sm",
  dark:
    "bg-[#0b1220] hover:bg-[#1a233a] active:bg-[#070b14] text-white dark:bg-white dark:text-[#0b1220] dark:hover:bg-[#f1f5f9] font-medium shadow-sm",
  // Gold mapped to primary for backward-compat without vibe-coded gradients
  gold:
    "bg-[#0b1220] hover:bg-[#1a233a] active:bg-[#070b14] text-white dark:bg-white dark:text-[#0b1220] dark:hover:bg-[#f1f5f9] font-medium shadow-sm",
  // Secondary / outline: white/surface with 1px hairline border
  secondary:
    "bg-white hover:bg-[#f8f7f5] text-[#0b1220] border border-[#e7e5e0] dark:bg-[#151d30] dark:text-[#faf8f5] dark:border-white/15 dark:hover:bg-white/10 font-medium shadow-2xs",
  outline:
    "bg-white hover:bg-[#f8f7f5] text-[#0b1220] border border-[#e7e5e0] dark:bg-[#151d30] dark:text-[#faf8f5] dark:border-white/15 dark:hover:bg-white/10 font-medium shadow-2xs",
  ghost:
    "bg-transparent hover:bg-[#efece6]/60 dark:hover:bg-white/5 text-[#0b1220] dark:text-[#faf8f5]",
  danger:
    "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-900/50 font-medium",
  subtle:
    "bg-[#efece6] hover:bg-[#e2ddd4] text-[#0b1220] dark:bg-white/10 dark:hover:bg-white/15 dark:text-[#faf8f5]",
};

const buttonSizes = {
  sm: "text-xs px-3.5 py-1.5 min-h-[36px] rounded-[10px] gap-1.5",
  md: "text-sm px-4 py-2.5 min-h-[44px] rounded-[10px] gap-2",
  lg: "text-base px-6 py-3 min-h-[48px] rounded-[10px] gap-2.5",
  icon: "p-2.5 min-h-[44px] min-w-[44px] rounded-[10px] items-center justify-center",
};

export const Button = forwardRef(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const shouldReduceMotion = useReducedMotion();
    const isDisabled = disabled || isLoading;

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={isDisabled}
        whileTap={shouldReduceMotion || isDisabled ? undefined : { scale: 0.98 }}
        whileHover={shouldReduceMotion || isDisabled ? undefined : { scale: 1.01 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className={cn(
          "inline-flex items-center justify-center font-sans select-none tracking-normal transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-white dark:focus-visible:ring-offset-[#0b1220] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed cursor-pointer",
          buttonVariants[variant] || buttonVariants.primary,
          buttonSizes[size] || buttonSizes.md,
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span aria-hidden="true" className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span aria-hidden="true" className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
export default Button;
