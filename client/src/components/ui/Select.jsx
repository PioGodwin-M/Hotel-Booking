import React, { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export const Select = forwardRef(
  (
    {
      className,
      label,
      error,
      helperText,
      options = [],
      placeholder,
      children,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : generatedId);
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    const describedBy = error ? errorId : helperText ? helperId : undefined;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs md:text-sm font-medium text-[#0b1220] dark:text-[#faf8f5]"
          >
            {label}
            {required && <span className="text-rose-600 dark:text-rose-400 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            aria-required={required ? "true" : undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={cn(
              "w-full min-h-[44px] appearance-none rounded-[10px] bg-white dark:bg-[#151d30] text-[#0b1220] dark:text-[#faf8f5] border border-[#e7e5e0] dark:border-white/10 px-3.5 py-2.5 pr-10 text-sm transition-colors duration-150 focus:outline-none focus:border-[#0b1220] focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus:border-white dark:focus-visible:ring-white focus-visible:ring-offset-2 disabled:opacity-50 disabled:bg-[#efece6]/50 dark:disabled:bg-white/5 disabled:cursor-not-allowed cursor-pointer",
              error && "border-rose-600 focus:border-rose-600 focus-visible:ring-rose-600",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.length > 0
              ? options.map((opt) => (
                  <option
                    key={typeof opt === "object" ? opt.value : opt}
                    value={typeof opt === "object" ? opt.value : opt}
                  >
                    {typeof opt === "object" ? opt.label : opt}
                  </option>
                ))
              : children}
          </select>
          <div
            aria-hidden="true"
            className="absolute right-3.5 pointer-events-none text-[#0b1220]/50 dark:text-[#faf8f5]/50"
          >
            <ChevronDown className="w-4 h-4" />
          </div>
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

Select.displayName = "Select";
export default Select;
