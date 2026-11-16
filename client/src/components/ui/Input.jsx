import React, { forwardRef, useId } from "react";
import { cn } from "../../lib/utils";

export const Input = forwardRef(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : generatedId);
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const describedBy = error ? errorId : helperText ? helperId : undefined;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs md:text-sm font-medium text-[#0b1220] dark:text-[#faf8f5]"
          >
            {label}
            {required && <span className="text-rose-600 dark:text-rose-400 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div
              aria-hidden="true"
              className="absolute left-3.5 flex items-center pointer-events-none text-[#0b1220]/50 dark:text-[#faf8f5]/50"
            >
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            required={required}
            aria-required={required ? "true" : undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={cn(
              "w-full min-h-[44px] rounded-[10px] bg-white dark:bg-[#151d30] text-[#0b1220] dark:text-[#faf8f5] border border-[#e7e5e0] dark:border-white/10 px-3.5 py-2.5 text-sm transition-colors duration-150 placeholder:text-[#0b1220]/40 dark:placeholder:text-[#faf8f5]/40 focus:outline-none focus:border-[#0b1220] focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus:border-white dark:focus-visible:ring-white focus-visible:ring-offset-2 disabled:opacity-50 disabled:bg-[#efece6]/50 dark:disabled:bg-white/5 disabled:cursor-not-allowed",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-rose-600 focus:border-rose-600 focus-visible:ring-rose-600",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div
              aria-hidden="true"
              className="absolute right-3.5 flex items-center text-[#0b1220]/50 dark:text-[#faf8f5]/50"
            >
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1"
          >
            {error}
          </p>
        ) : helperText ? (
          <p
            id={helperId}
            className="text-xs text-[#0b1220]/60 dark:text-[#faf8f5]/60 mt-1"
          >
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
