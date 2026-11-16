import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Lock, ShieldCheck, CreditCard, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { getStripe } from "../lib/stripeClient";
import { authApi } from "../lib/apiClient";
import { Button } from "./ui/Button";
import { formatINR, paiseToRupees } from "../lib/formatters";
import { cn } from "../lib/utils";

const PaymentModal = ({
  clientSecret,
  amountMinor,
  bookingId,
  onSuccess,
  onPending,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [confirmingStage, setConfirmingStage] = useState(null); // null | 'confirming'
  const [errorMessage, setErrorMessage] = useState("");
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const paymentElementRef = useRef(null);
  const paymentMountRef = useRef(null);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  const numericAmount = paiseToRupees(amountMinor);
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
  const isKeyPlaceholder =
    !publishableKey || publishableKey.includes("REPLACE_WITH_YOUR");

  // Esc key to close (unless processing)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !processing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, processing]);

  // Scroll lock & Focus trap
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus first interactive element
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, 100);

    return () => {
      document.body.style.overflow = originalOverflow;
      clearTimeout(timer);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus?.();
      }
    };
  }, []);

  // Initialize Stripe Elements
  useEffect(() => {
    let isMounted = true;

    const initStripe = async () => {
      if (isKeyPlaceholder) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const stripe = await getStripe();
        if (!isMounted) return;
        stripeRef.current = stripe;

        if (!stripe || !clientSecret) {
          throw new Error("Stripe client or payment secret unavailable");
        }

        const selfHostedFontUrl = `${window.location.origin}/fonts/inter.woff2`;

        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#0B1220",
              colorBackground: "#ffffff",
              colorText: "#0B1220",
              colorDanger: "#e11d48",
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              borderRadius: "10px",
              spacingUnit: "4px",
            },
            rules: {
              ".Input": {
                borderColor: "#E5E7EB",
                boxShadow: "none",
                padding: "12px",
                fontSize: "14px",
              },
              ".Input:focus": {
                borderColor: "#0B1220",
                boxShadow: "0 0 0 2px rgba(11, 18, 32, 0.15)",
              },
              ".Label": {
                fontWeight: "500",
                fontSize: "12px",
                color: "#374151",
                marginBottom: "4px",
              },
            },
          },
          fonts: [
            {
              family: "Inter",
              src: `url("${selfHostedFontUrl}") format("woff2")`,
              weight: "400 700",
            },
            {
              cssSrc:
                "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
            },
          ],
        });
        elementsRef.current = elements;

        const paymentElement = elements.create("payment");
        paymentElementRef.current = paymentElement;

        const container = paymentMountRef.current || document.getElementById("stripe-payment-element-mount");
        if (container) {
          container.innerHTML = "";
          paymentElement.mount(container);
          paymentElement.on("ready", () => {
            if (isMounted) setLoading(false);
          });
          paymentElement.on("change", (event) => {
            if (event.error) {
              setErrorMessage(event.error.message);
            } else {
              setErrorMessage("");
            }
          });
        }
      } catch (err) {
        console.error("Stripe initialization failed:", err);
        if (isMounted) {
          setErrorMessage(err.message || "Unable to load payment processor");
          setLoading(false);
        }
      }
    };

    initStripe();

    return () => {
      isMounted = false;
      if (paymentElementRef.current) {
        try {
          paymentElementRef.current.destroy();
        } catch {
          // cleanup
        }
      }
    };
  }, [clientSecret, isKeyPlaceholder]);

  // Bounded polling helper for authoritative backend booking confirmation
  const pollBookingConfirmation = async (targetBookingId) => {
    const rawId = typeof targetBookingId === "object" ? targetBookingId?._id : targetBookingId;
    const cleanId = String(rawId || "");
    const delays = [600, 1000, 1500, 2000, 2500];
    let latestBooking = null;

    for (let attempt = 0; attempt < delays.length; attempt++) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
      try {
        const res = await authApi.get(`/api/bookings/${cleanId}`);
        if (res.data?.success && res.data?.booking) {
          latestBooking = res.data.booking;
          if (latestBooking.status === "CONFIRMED") {
            return { status: "CONFIRMED", booking: latestBooking };
          }
          if (
            latestBooking.status === "PAYMENT_FAILED" ||
            latestBooking.status === "EXPIRED"
          ) {
            return { status: latestBooking.status, booking: latestBooking };
          }
        }
      } catch {
        // Transient network error during polling; continue next attempt
      }
    }

    return {
      status: latestBooking?.status || "PAYMENT_PENDING",
      booking: latestBooking,
    };
  };

  // Handle Payment Submit
  const handlePay = async (e) => {
    e.preventDefault();
    if (processing || loading || confirmingStage) return; // Guard double-submit

    if (isKeyPlaceholder) {
      toast(
        "Stripe publishable key is not configured in .env. To complete live cards, set VITE_STRIPE_PUBLISHABLE_KEY.",
        { icon: "⚠️" }
      );
      return;
    }

    if (!stripeRef.current || !elementsRef.current) {
      toast.error("Payment form is not ready yet");
      return;
    }

    setProcessing(true);
    setErrorMessage("");

    try {
      const { error, paymentIntent } = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (error) {
        setErrorMessage(error.message || "Payment failed");
        toast.error(error.message || "Payment failed");
      } else if (
        paymentIntent &&
        (paymentIntent.status === "succeeded" ||
          paymentIntent.status === "processing")
      ) {
        setConfirmingStage("confirming");
        const outcome = await pollBookingConfirmation(bookingId);

        if (outcome.status === "CONFIRMED") {
          toast.success("Payment confirmed! Your stay is booked.", {
            duration: 4000,
          });
          if (onSuccess) onSuccess(outcome.booking);
        } else if (
          outcome.status === "PAYMENT_FAILED" ||
          outcome.status === "EXPIRED"
        ) {
          toast.error(
            `Booking could not be confirmed: status is ${outcome.status}`
          );
          if (onPending) onPending(outcome.booking);
          onClose();
        } else {
          // Bounded window elapsed and status is still pending (e.g. queue delay)
          toast(
            "Payment submitted! Your reservation confirmation is processing. We'll update your booking status shortly.",
            { icon: "⏳", duration: 5000 }
          );
          if (onPending) onPending(outcome.booking);
          onClose();
        }
      } else {
        toast("Payment submitted for processing. Updating booking...", {
          icon: "ℹ️",
        });
        if (onPending) onPending(null);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err.message || "An error occurred during payment");
      toast.error(err.message || "Payment failed");
    } finally {
      setProcessing(false);
      setConfirmingStage(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={processing ? undefined : onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        initial={
          shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={
          shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }
        }
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl z-10 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="payment-dialog-title"
                className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100"
              >
                Complete payment
              </h3>
              <p className="text-[11px] text-gray-500 font-mono">
                Booking ID: {typeof bookingId === "object" ? (bookingId?._id || String(bookingId)) : String(bookingId || "")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Due Card */}
        <div className="px-5 pt-4 pb-1">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  Total amount due
                </p>
                <p className="text-[11px] text-gray-400">
                  Taxes and fees included
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {formatINR(numericAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Placeholder Warning if needed */}
        {isKeyPlaceholder && (
          <div className="mx-5 my-2 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-semibold">Stripe key not configured</p>
              <p className="mt-0.5 text-[11px] opacity-90">
                Configure <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code> in client .env to enable the payment card form.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handlePay} className="p-5 pt-2 space-y-4">
          <div className="relative min-h-[180px]">
            {/* Loading state rendered as absolute overlay so React never manipulates Stripe's internal DOM */}
            {loading && !isKeyPlaceholder && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 text-xs text-gray-500 bg-white dark:bg-gray-900">
                <Loader2 className="w-5 h-5 animate-spin text-gray-700 dark:text-gray-300" />
                <span>Loading secure payment form...</span>
              </div>
            )}

            {/* Mount container MUST remain in DOM and have zero React children */}
            <div
              id="stripe-payment-element-mount"
              ref={paymentMountRef}
              className="min-h-[180px] py-2"
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {confirmingStage === "confirming" && (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <div className="leading-relaxed">
                <p className="font-semibold">Payment approved by Stripe</p>
                <p className="text-[11px] opacity-90">Verifying authoritative booking confirmation with hotel...</p>
              </div>
            </div>
          )}

          {/* Guarantee pill */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted with Stripe &middot; Confirmed upon payment</span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={processing || Boolean(confirmingStage)}
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={loading || processing || Boolean(confirmingStage)}
              isLoading={processing || Boolean(confirmingStage)}
              loadingText={confirmingStage === "confirming" ? "Confirming with hotel..." : "Processing..."}
              className="flex-1"
            >
              Pay {formatINR(numericAmount)}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default PaymentModal;
