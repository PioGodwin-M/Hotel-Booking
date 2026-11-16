import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-lg",
  showCloseButton = true,
  closeOnBackdropClick = true,
  className,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Esc key & Focus Trap
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Initial focus on first interactive element or close button
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, 50);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus?.();
      }
    };
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            className="fixed inset-0 bg-[#0b1220]/70"
            aria-hidden="true"
          />

          {/* Modal Card */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-dialog-title" : undefined}
            aria-describedby={description ? "modal-dialog-desc" : undefined}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.98, y: 8 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.98, y: 8 }
            }
            transition={{
              duration: 0.2,
              ease: "easeOut",
            }}
            className={cn(
              "relative w-full rounded-2xl bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 shadow-xl z-10 overflow-hidden my-8 focus:outline-none",
              maxWidth,
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between p-6 pb-4 border-b border-[#e7e5e0] dark:border-white/10">
                <div>
                  {title && (
                    <h3
                      id="modal-dialog-title"
                      className="font-sans text-lg md:text-xl font-semibold tracking-tight text-[#0b1220] dark:text-[#faf8f5]"
                    >
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p
                      id="modal-dialog-desc"
                      className="mt-1 text-xs md:text-sm text-[#0b1220]/70 dark:text-[#faf8f5]/70"
                    >
                      {description}
                    </p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-[#0b1220]/60 hover:text-[#0b1220] dark:text-[#faf8f5]/60 dark:hover:text-[#faf8f5] hover:bg-[#efece6]/60 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white"
                    aria-label="Close dialog"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
