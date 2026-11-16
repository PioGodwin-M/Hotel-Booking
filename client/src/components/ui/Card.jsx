import React, { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";

export const Card = forwardRef(
  (
    {
      className,
      variant = "default", // default | flat | bordered
      hoverable = false,
      children,
      ...props
    },
    ref
  ) => {
    const shouldReduceMotion = useReducedMotion();

    const variants = {
      default:
        "bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 shadow-2xs",
      glass:
        "bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 shadow-2xs",
      flat:
        "bg-[#faf9f6] dark:bg-[#151d30]/50 border-0",
      bordered:
        "bg-transparent border border-[#e7e5e0] dark:border-white/15",
    };

    if (hoverable) {
      return (
        <motion.div
          ref={ref}
          whileHover={
            shouldReduceMotion
              ? undefined
              : { y: -2, transition: { duration: 0.15, ease: "easeOut" } }
          }
          className={cn(
            "rounded-xl transition-shadow duration-200 hover:shadow-md overflow-hidden",
            variants[variant] || variants.default,
            className
          )}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl overflow-hidden",
          variants[variant] || variants.default,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader = ({ className, ...props }) => (
  <div className={cn("p-5 pb-2 flex flex-col space-y-1.5", className)} {...props} />
);

export const CardTitle = ({ className, ...props }) => (
  <h3
    className={cn(
      "font-sans text-lg md:text-xl font-semibold tracking-tight text-[#0b1220] dark:text-[#faf8f5]",
      className
    )}
    {...props}
  />
);

export const CardDescription = ({ className, ...props }) => (
  <p
    className={cn("text-xs md:text-sm text-[#0b1220]/65 dark:text-[#faf8f5]/65", className)}
    {...props}
  />
);

export const CardContent = ({ className, ...props }) => (
  <div className={cn("p-5 pt-2", className)} {...props} />
);

export const CardFooter = ({ className, ...props }) => (
  <div
    className={cn("p-5 pt-0 flex items-center justify-between", className)}
    {...props}
  />
);

export default Card;
