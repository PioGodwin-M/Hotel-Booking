import React from "react";
import toast from "react-hot-toast";
import { X, AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * Standardized error toast:
 * - Sentence case explaining what happened and what to do next
 * - Accessible with role="alert"
 * - Close button (X)
 * - Auto-dismiss after 6s or until dismissed
 * - Optional inline "Try again" action
 * - Deduplicated by ID
 */
export const showErrorToast = (message, { id, onRetry, duration = 6000 } = {}) => {
  return toast.custom(
    (t) => (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0b1220] text-white border border-rose-500/40 shadow-xl max-w-md w-full animate-in fade-in slide-in-from-top-2 text-xs select-none"
      >
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-normal text-stone-200 leading-snug">{message}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              onRetry();
            }}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] shrink-0 transition-colors cursor-pointer"
          >
            Try again
          </button>
        )}
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          aria-label="Dismiss message"
          className="p-1 rounded-md text-stone-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ),
    {
      id: id || message,
      duration,
    }
  );
};

/**
 * Standardized success toast:
 * - Auto-dismiss after 3.5s
 * - role="status"
 */
export const showSuccessToast = (message, { id, duration = 3500 } = {}) => {
  return toast.custom(
    (t) => (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#0b1220] text-white border border-emerald-500/40 shadow-xl text-xs select-none"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="font-medium text-stone-200">{message}</span>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          aria-label="Dismiss message"
          className="p-1 rounded-md text-stone-400 hover:text-white hover:bg-white/10 transition-colors ml-2 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    ),
    {
      id: id || message,
      duration,
    }
  );
};

export default {
  error: showErrorToast,
  success: showSuccessToast,
};
