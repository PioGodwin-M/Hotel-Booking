import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  X,
  Copy,
  Check,
  CreditCard,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  MapPin,
  Calendar,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { getStripe } from "../lib/stripeClient";
import { authApi } from "../lib/apiClient";
import { Button } from "./ui/Button";
import { SafeImage } from "./ui/SafeImage";
import { formatINR, paiseToRupees } from "../lib/formatters";
import { formatBookingReference } from "../lib/bookingReference";
import { useHoldCountdown } from "../hooks/useHoldCountdown";
import { BUSINESS_CONFIG } from "../config/business";
import { GuestDetailsBlock } from "./GuestDetailsBlock";
import {
  recordPaymentAttempt,
  PAYMENT_ATTEMPT_STATES,
} from "../lib/bookingStatus";

export const PaymentModal = ({
  booking,
  room,
  clientSecret: initialClientSecret,
  amountMinor: initialAmountMinor,
  bookingId: rawBookingId,
  onPending,
  onClose,
  onViewReceipt,
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  // Extract booking identifiers and amounts
  const resolvedBookingId = useMemo(() => {
    if (booking?._id) return String(booking._id);
    if (rawBookingId) {
      return typeof rawBookingId === "object"
        ? String(rawBookingId._id || rawBookingId)
        : String(rawBookingId);
    }
    return "";
  }, [booking, rawBookingId]);

  const friendlyReference = useMemo(
    () => formatBookingReference(resolvedBookingId),
    [resolvedBookingId]
  );

  const [clientSecret, setClientSecret] = useState(initialClientSecret || "");
  const [loadingSecret, setLoadingSecret] = useState(!initialClientSecret);
  const [stripeMounted, setStripeMounted] = useState(false);
  const [stripeInitError, setStripeInitError] = useState("");

  const [processing, setProcessing] = useState(false);
  const [paymentStage, setPaymentStage] = useState("idle"); // 'idle' | 'processing' | 'confirming' | 'slow_confirming' | 'confirmed' | 'failed'
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmedBookingData, setConfirmedBookingData] = useState(null);

  // Mobile summary collapse toggle
  const [mobileSummaryExpanded, setMobileSummaryExpanded] = useState(false);

  // Visual Viewport tracking for mobile keyboard accessibility
  const [viewportHeight, setViewportHeight] = useState(null);

  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const paymentElementRef = useRef(null);
  const paymentMountRef = useRef(null);
  const modalRef = useRef(null);
  const confirmationTimerRef = useRef(null);

  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
  const isKeyPlaceholder =
    !publishableKey || publishableKey.includes("REPLACE_WITH_YOUR");

  // Hold countdown hook
  const {
    formatted: countdownFormatted,
    isUrgent: countdownUrgent,
    isExpired: holdExpired,
    expiryTimeFormatted,
  } = useHoldCountdown(booking, () => {
    // On countdown expire: refetch booking to sync authoritative server state
    if (resolvedBookingId) {
      authApi.get(`/api/bookings/${resolvedBookingId}`).catch(() => {});
    }
  });

  // Calculate pricing breakdown
  const totalAmountNumber = useMemo(() => {
    if (initialAmountMinor) return paiseToRupees(initialAmountMinor);
    if (booking?.priceSnapshot?.totalAmount) return booking.priceSnapshot.totalAmount;
    if (booking?.totalPrice) return booking.totalPrice;
    return 0;
  }, [initialAmountMinor, booking]);

  const nightlyRate = useMemo(() => {
    if (booking?.priceSnapshot?.pricePerNight) return booking.priceSnapshot.pricePerNight;
    if (room?.pricePerNight) return room.pricePerNight;
    return null;
  }, [booking, room]);

  const numberOfNights = useMemo(() => {
    if (booking?.priceSnapshot?.numberOfNights) return booking.priceSnapshot.numberOfNights;
    if (booking?.checkIn && booking?.checkOut) {
      const diff = new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime();
      return Math.max(1, Math.round(diff / (24 * 60 * 60 * 1000)));
    }
    return 1;
  }, [booking]);

  const calculatedBaseRate = nightlyRate ? nightlyRate * numberOfNights : null;
  const calculatedTaxes = calculatedBaseRate && totalAmountNumber > calculatedBaseRate
    ? totalAmountNumber - calculatedBaseRate
    : null;

  // Stay information details
  const stayName =
    room?.hotel?.name ||
    booking?.hotel?.name ||
    (typeof booking?.hotel === "string" ? "Hotel Stay" : "Hotel Stay");

  const rawAddress =
    room?.hotel?.address ||
    booking?.hotel?.address ||
    room?.hotel?.city ||
    booking?.hotel?.city ||
    "";

  // Display area and city only (not entire street line)
  const stayAreaAndCity = useMemo(() => {
    if (!rawAddress) return "";
    const parts = rawAddress.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 2) return rawAddress;
    return parts.slice(-2).join(", ");
  }, [rawAddress]);

  const stayRoomType =
    room?.roomType || booking?.room?.roomType || "Standard Room";

  const stayImage =
    room?.images?.[0] || booking?.room?.images?.[0] || "/assets/roomImg1.png";

  const checkInDateFormatted = useMemo(() => {
    const raw = booking?.checkIn || booking?.checkInDate;
    if (!raw) return "";
    try {
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(raw));
    } catch {
      return String(raw);
    }
  }, [booking]);

  const checkOutDateFormatted = useMemo(() => {
    const raw = booking?.checkOut || booking?.checkOutDate;
    if (!raw) return "";
    try {
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(raw));
    } catch {
      return String(raw);
    }
  }, [booking]);

  const guestCount = booking?.numberOfGuests || booking?.guests || 1;

  // Pre-load Stripe.js early on mount
  useEffect(() => {
    if (!isKeyPlaceholder) {
      getStripe().catch(() => {});
    }
  }, [isKeyPlaceholder]);

  // Viewport resize tracking for mobile keyboard
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const handleResize = () => {
      setViewportHeight(window.visualViewport.height);
    };
    handleResize();
    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", handleResize);
    return () => {
      window.visualViewport.removeEventListener("resize", handleResize);
      window.visualViewport.removeEventListener("scroll", handleResize);
    };
  }, []);

  // Escape key to close (unless processing)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !processing && paymentStage === "idle") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, processing, paymentStage]);

  // Scroll lock on body
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
      }
    };
  }, []);

  // Fetch clientSecret if not supplied
  useEffect(() => {
    if (clientSecret || !resolvedBookingId) return;

    let isMounted = true;
    const fetchSecret = async () => {
      setLoadingSecret(true);
      try {
        const idempotencyKey = `pay_booking_${resolvedBookingId}`;
        const { data } = await authApi.post(
          "/api/payments/",
          { bookingId: resolvedBookingId },
          {
            headers: {
              "Idempotency-Key": idempotencyKey,
            },
          }
        );
        if (isMounted) {
          if (data.success && data.data?.clientSecret) {
            setClientSecret(data.data.clientSecret);
          } else {
            setStripeInitError(data.message || "Could not start payment session");
          }
        }
      } catch (err) {
        if (isMounted) {
          setStripeInitError(
            err.response?.data?.message || err.message || "Failed to initialize payment"
          );
        }
      } finally {
        if (isMounted) setLoadingSecret(false);
      }
    };

    fetchSecret();
    return () => {
      isMounted = false;
    };
  }, [clientSecret, resolvedBookingId]);

  // Mount Stripe Elements
  useEffect(() => {
    if (!clientSecret || isKeyPlaceholder) {
      return;
    }

    let isMounted = true;

    const initStripe = async () => {
      try {
        const stripe = await getStripe();
        if (!isMounted || !stripe) return;
        stripeRef.current = stripe;

        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#0B1220",
              colorBackground: "#ffffff",
              colorText: "#0B1220",
              colorDanger: "#b91c1c",
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              borderRadius: "10px",
              spacingUnit: "4px",
            },
            rules: {
              ".Input": {
                borderColor: "#E5E7EB",
                boxShadow: "none",
                padding: "11px 12px",
                fontSize: "14px",
              },
              ".Input:focus": {
                borderColor: "#0B1220",
                boxShadow: "0 0 0 1px #0B1220",
              },
              ".Label": {
                fontWeight: "500",
                fontSize: "12px",
                color: "#374151",
                marginBottom: "4px",
              },
            },
          },
        });
        elementsRef.current = elements;

        // Configure PaymentElement
        const paymentElement = elements.create("payment", {
          layout: "tabs",
          wallets: {
            applePay: "never",
            googlePay: "never",
          },
        });
        paymentElementRef.current = paymentElement;

        const mount = paymentMountRef.current;
        if (mount) {
          paymentElement.mount(mount);
          paymentElement.on("ready", () => {
            if (isMounted) setStripeMounted(true);
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
        if (isMounted) {
          setStripeInitError(err.message || "Failed to load payment form");
        }
      }
    };

    initStripe();

    return () => {
      isMounted = false;
      if (paymentElementRef.current) {
        try {
          paymentElementRef.current.unmount();
          paymentElementRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
        paymentElementRef.current = null;
      }
    };
  }, [clientSecret, isKeyPlaceholder]);

  // Copy Reference handler
  const handleCopyReference = () => {
    if (!friendlyReference) return;
    navigator.clipboard.writeText(friendlyReference);
    toast.success("Reference copied");
  };

  // Authoritative polling for confirmation
  const pollBookingConfirmation = async (cleanId) => {
    const delays = [600, 1000, 1500, 2000, 2500, 3000, 3500];
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
        // Transient network retry
      }
    }

    return {
      status: latestBooking?.status || "PAYMENT_PENDING",
      booking: latestBooking,
    };
  };

  // Payment Submit Handler
  const handlePay = async (e) => {
    e.preventDefault();
    if (processing || holdExpired || paymentStage !== "idle") return;

    if (isKeyPlaceholder) {
      toast.error("Stripe publishable key is not configured in client .env.");
      return;
    }

    if (!stripeRef.current || !elementsRef.current) {
      toast.error("Payment form is not ready yet");
      return;
    }

    setProcessing(true);
    setPaymentStage("processing");
    setErrorMessage("");
    if (resolvedBookingId) {
      recordPaymentAttempt(resolvedBookingId, PAYMENT_ATTEMPT_STATES.PROCESSING);
    }

    // Start 30s slow confirmation safety timer
    confirmationTimerRef.current = setTimeout(() => {
      setPaymentStage((prev) => (prev === "confirming" ? "slow_confirming" : prev));
    }, 30000);

    try {
      const { error, paymentIntent } = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (error) {
        setErrorMessage(error.message || "Your card was declined. Try another card.");
        setPaymentStage("failed");
        setProcessing(false);
        if (resolvedBookingId) {
          recordPaymentAttempt(resolvedBookingId, PAYMENT_ATTEMPT_STATES.FAILED_RETRYABLE);
        }
        clearTimeout(confirmationTimerRef.current);
        return;
      }

      if (
        paymentIntent &&
        (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")
      ) {
        setPaymentStage("confirming");
        const outcome = await pollBookingConfirmation(resolvedBookingId);

        clearTimeout(confirmationTimerRef.current);

        if (outcome.status === "CONFIRMED") {
          if (resolvedBookingId) {
            recordPaymentAttempt(resolvedBookingId, PAYMENT_ATTEMPT_STATES.SUCCEEDED);
          }
          setConfirmedBookingData(outcome.booking);
          setPaymentStage("confirmed");
          setProcessing(false);
          // Persistent confirmation screen: do NOT auto-close or auto-navigate
        } else if (outcome.status === "PAYMENT_FAILED") {
          if (resolvedBookingId) {
            recordPaymentAttempt(resolvedBookingId, PAYMENT_ATTEMPT_STATES.FAILED_RETRYABLE);
          }
          setErrorMessage("Payment could not be completed. Please try again.");
          setPaymentStage("failed");
          setProcessing(false);
          if (onPending) onPending(outcome.booking);
        } else {
          // Slow confirmation window reached without definitive rejection
          setPaymentStage("slow_confirming");
          if (onPending) onPending(outcome.booking);
        }
      } else {
        setPaymentStage("failed");
        setErrorMessage("Payment could not be processed. Please try another card.");
        setProcessing(false);
        if (resolvedBookingId) {
          recordPaymentAttempt(resolvedBookingId, PAYMENT_ATTEMPT_STATES.FAILED_RETRYABLE);
        }
        clearTimeout(confirmationTimerRef.current);
      }
    } catch (err) {
      setErrorMessage(err.message || "Your card was declined. Try another card.");
      setPaymentStage("failed");
      setProcessing(false);
      if (resolvedBookingId) {
        recordPaymentAttempt(resolvedBookingId, PAYMENT_ATTEMPT_STATES.FAILED_RETRYABLE);
      }
      clearTimeout(confirmationTimerRef.current);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={processing ? undefined : onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        aria-hidden="true"
      />

      {/* Modal Dialog (Full sheet on mobile 390px, ~960px 2-column modal on desktop) */}
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-modal-title"
        initial={
          shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 10 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={
          shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 10 }
        }
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="relative w-full md:max-w-[960px] h-full md:h-auto md:max-h-[90vh] bg-white dark:bg-gray-900 md:border md:border-gray-200 md:dark:border-gray-800 md:rounded-2xl shadow-xl z-10 flex flex-col md:min-h-[580px] overflow-hidden"
        style={{
          maxHeight: viewportHeight && window.innerWidth < 768
            ? `${viewportHeight}px`
            : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div>
              <h2
                id="checkout-modal-title"
                className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight"
              >
                Confirm and pay
              </h2>
              {friendlyReference && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-gray-500 font-medium">
                    Reference: {friendlyReference}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyReference}
                    aria-label="Copy booking reference"
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer rounded"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (paymentStage === "confirmed") {
                navigate("/my-bookings");
              }
            }}
            disabled={processing && paymentStage !== "confirmed"}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 cursor-pointer"
            aria-label="Close checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Hold Countdown Banner (Section 3) */}
        <div
          className={`shrink-0 px-5 py-2 border-b text-xs flex items-center justify-between ${
            holdExpired
              ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
              : countdownUrgent
              ? "bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 border-amber-200/80 dark:border-amber-900/30 font-bold"
              : "bg-gray-50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 border-gray-200/60 dark:border-gray-800"
          }`}
        >
          <span>
            {holdExpired ? "Hold expired" : `Room held for ${countdownFormatted}`}
          </span>
          {expiryTimeFormatted && !holdExpired && (
            <span className="text-gray-500 font-normal">
              Held until {expiryTimeFormatted}
            </span>
          )}
        </div>

        {/* Mobile Collapsible Summary Row (390px, Section 2) */}
        <div className="md:hidden border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
          <button
            type="button"
            onClick={() => setMobileSummaryExpanded((prev) => !prev)}
            className="w-full px-5 py-3 flex items-center justify-between text-xs font-medium text-gray-800 dark:text-gray-200"
          >
            <span className="truncate pr-2">
              {stayName} · {checkInDateFormatted} · {formatINR(totalAmountNumber)}
            </span>
            <span className="shrink-0 flex items-center gap-1 text-gray-500">
              {mobileSummaryExpanded ? "Hide" : "Details"}
              {mobileSummaryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {mobileSummaryExpanded && (
            <div className="px-5 pb-4 space-y-3 text-xs border-t border-gray-100 dark:border-gray-800 pt-3">
              <div className="flex gap-3">
                <div className="w-20 h-16 rounded-xl overflow-hidden shrink-0 border border-gray-200 dark:border-gray-800">
                  <SafeImage src={stayImage} alt={stayName} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{stayName}</p>
                  {stayAreaAndCity && <p className="text-gray-500">{stayAreaAndCity}</p>}
                  <p className="text-gray-600 dark:text-gray-400 mt-0.5">{stayRoomType}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                <div>
                  <span className="text-gray-400 block">Check-in</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{checkInDateFormatted}, From 2:00 PM</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Check-out</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{checkOutDateFormatted}, Until 11:00 AM</span>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                {nightlyRate && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>{formatINR(nightlyRate)} × {numberOfNights} night{numberOfNights > 1 ? "s" : ""}</span>
                    <span>{formatINR(calculatedBaseRate)}</span>
                  </div>
                )}
                {calculatedTaxes !== null && calculatedTaxes > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Taxes and fees</span>
                    <span>{formatINR(calculatedTaxes)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-gray-900 dark:text-gray-100 pt-1">
                  <span>Total due</span>
                  <span>{formatINR(totalAmountNumber)}</span>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 pt-1">
                {BUSINESS_CONFIG.cancellationPolicy.summary}{" "}
                <Link to="/cancellation" target="_blank" className="underline text-gray-700 dark:text-gray-300">
                  Cancellation policy
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Content Body: Two Columns on Desktop, Single scrollable column on Mobile */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {paymentStage === "confirmed" ? (
            /* Confirmed State (Section 8) */
            <div className="p-6 md:p-8 max-w-lg mx-auto text-center space-y-5">
              <div className="w-12 h-12 mx-auto flex items-center justify-center text-emerald-600">
                <Check className="w-8 h-8" strokeWidth={2.5} />
              </div>

              <div>
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Booking confirmed
                </h3>
                {friendlyReference && (
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-gray-500">
                    <span>Reference: <strong className="text-gray-900 dark:text-gray-100">{friendlyReference}</strong></span>
                    <button
                      type="button"
                      onClick={handleCopyReference}
                      className="p-1 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
                      title="Copy reference"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Stay Summary Card */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-left space-y-2 text-xs">
                <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{stayName}</p>
                <p className="text-gray-500">{stayRoomType} · {guestCount} guest{guestCount > 1 ? "s" : ""}</p>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 text-[11px]">
                  <span>{checkInDateFormatted} – {checkOutDateFormatted}</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">{formatINR(totalAmountNumber)} paid</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (onViewReceipt) onViewReceipt(confirmedBookingData || booking);
                    else navigate("/my-bookings");
                  }}
                  className="w-full font-semibold"
                >
                  View receipt
                </Button>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(rawAddress || stayName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center h-10 px-4 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Get directions
                </a>

                <div className="flex items-center justify-center gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate("/my-bookings");
                    }}
                    className="text-xs text-stone-600 dark:text-stone-400 hover:text-[#0B1220] dark:hover:text-white underline cursor-pointer"
                  >
                    Go to My bookings
                  </button>
                  <span className="text-stone-300 dark:text-stone-700">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate("/my-bookings");
                    }}
                    className="text-xs font-semibold text-stone-800 dark:text-stone-200 hover:text-black dark:hover:text-white cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : paymentStage === "slow_confirming" ? (
            /* Slow Confirmation State (> 30s) */
            <div className="p-6 md:p-8 max-w-md mx-auto text-center space-y-4">
              <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Payment received
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                This is taking longer than usual. Your payment was received. We'll update My bookings as soon as it's confirmed.
              </p>
              <div className="pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    onClose();
                    navigate("/my-bookings");
                  }}
                  className="w-full"
                >
                  Go to My bookings
                </Button>
              </div>
            </div>
          ) : holdExpired ? (
            /* Hold Expired State (Section 3) */
            <div className="p-6 md:p-8 max-w-md mx-auto text-center space-y-4">
              <div className="w-10 h-10 mx-auto text-gray-400 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Hold expired
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                This hold has ended. The room may no longer be available.
              </p>
              <div className="pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    onClose();
                    navigate(`/rooms/${room?._id || booking?.roomCategoryId || ""}`);
                  }}
                  className="w-full"
                >
                  Search again
                </Button>
              </div>
            </div>
          ) : (
            /* Standard Checkout Grid (Desktop 2-col, Mobile single-col) */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5 md:p-6 min-h-[500px]">
              {/* Left Column: Your Stay (Desktop, Section 2) */}
              <div className="hidden md:flex md:col-span-5 flex-col space-y-4 pr-4 border-r border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Your stay
                </h3>

                {/* Small thumbnail (96x72, 10px radius) beside stay name */}
                <div className="flex gap-3.5 items-start">
                  <div className="w-[96px] h-[72px] rounded-[10px] overflow-hidden border border-gray-200 dark:border-gray-800 shrink-0">
                    <SafeImage src={stayImage} alt={stayName} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
                      {stayName}
                    </h4>
                    {stayAreaAndCity && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{stayAreaAndCity}</p>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{stayRoomType}</p>
                  </div>
                </div>

                {/* Stay schedule */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[11px]">Check-in</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{checkInDateFormatted}</span>
                    <span className="text-gray-500 block text-[11px]">From 2:00 PM</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Check-out</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{checkOutDateFormatted}</span>
                    <span className="text-gray-500 block text-[11px]">Until 11:00 AM</span>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  <span>{numberOfNights} night{numberOfNights > 1 ? "s" : ""}</span> · <span>{guestCount} guest{guestCount > 1 ? "s" : ""}</span>
                </div>

                {/* Price Breakdown */}
                <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                  {nightlyRate && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>{formatINR(nightlyRate)} × {numberOfNights} night{numberOfNights > 1 ? "s" : ""}</span>
                      <span>{formatINR(calculatedBaseRate)}</span>
                    </div>
                  )}
                  {calculatedTaxes !== null && calculatedTaxes > 0 && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Taxes and fees</span>
                      <span>{formatINR(calculatedTaxes)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-gray-900 dark:text-gray-100 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span>Total due</span>
                    <span>{formatINR(totalAmountNumber)}</span>
                  </div>
                </div>

                {/* Cancellation policy sentence */}
                <div className="pt-2 text-[11px] text-gray-500 leading-relaxed">
                  <p>
                    {BUSINESS_CONFIG.cancellationPolicy.summary}{" "}
                    <Link to="/cancellation" target="_blank" className="underline text-gray-700 dark:text-gray-300">
                      Cancellation policy
                    </Link>
                  </p>
                </div>
              </div>

              {/* Right Column: Payment Form, Guest Details, Actions (Section 4 & 5) */}
              <div className="md:col-span-7 flex flex-col justify-between">
                <form id="checkout-payment-form" onSubmit={handlePay} className="space-y-3">
                  {/* Guest details block (Section 5) */}
                  <GuestDetailsBlock user={null} />

                  {/* Payment form header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Payment method
                    </h3>
                    <span className="text-[11px] text-gray-500">
                      Payments are processed by Stripe
                    </span>
                  </div>

                  {/* Stripe Payment Mount or Skeletons (Section 4) */}
                  <div className="relative min-h-[190px]">
                    {(loadingSecret || !stripeMounted) && !stripeInitError && !isKeyPlaceholder && (
                      <div className="absolute inset-0 z-10 space-y-2.5 py-1 bg-white dark:bg-gray-900 pointer-events-none">
                        <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded-[10px] animate-pulse" />
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded-[10px] animate-pulse" />
                          <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded-[10px] animate-pulse" />
                        </div>
                        <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded-[10px] animate-pulse" />
                      </div>
                    )}

                    <div
                      id="stripe-payment-element-mount"
                      ref={paymentMountRef}
                      className={stripeMounted ? "opacity-100 transition-opacity duration-150" : "opacity-0"}
                    />
                  </div>

                  {/* Error Alert */}
                  {(errorMessage || stripeInitError) && (
                    <div
                      role="alert"
                      className="p-2.5 rounded-[10px] bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{errorMessage || stripeInitError}</span>
                    </div>
                  )}
                </form>

                {/* Bottom Status Area, Policy & Buttons */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 mt-3 space-y-2">
                  {/* Fixed-height status area (~44px) so Pay and Close buttons never shift */}
                  <div className="h-11 flex items-center justify-center text-center">
                    {paymentStage === "processing" ? (
                      <div
                        role="status"
                        aria-live="polite"
                        className="w-full p-2.5 rounded-[10px] bg-gray-50 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 font-medium"
                      >
                        Processing payment…
                      </div>
                    ) : paymentStage === "confirming" ? (
                      <div
                        role="status"
                        aria-live="polite"
                        className="w-full p-2.5 rounded-[10px] bg-gray-50 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 font-medium flex items-center justify-center gap-2"
                      >
                        <div className="w-3.5 h-3.5 border-2 border-gray-800 dark:border-gray-200 border-t-transparent rounded-full animate-spin" />
                        <span>Payment received. Confirming your booking…</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        By paying you agree to the{" "}
                        <Link to="/terms" target="_blank" className="underline text-gray-700 dark:text-gray-300">
                          Terms
                        </Link>{" "}
                        and the{" "}
                        <Link to="/cancellation" target="_blank" className="underline text-gray-700 dark:text-gray-300">
                          Cancellation policy
                        </Link>
                        .
                      </p>
                    )}
                  </div>

                  {/* Action Buttons: Never move, never clipped */}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      disabled={processing}
                      onClick={onClose}
                      className="flex-1 rounded-[10px]"
                    >
                      Close
                    </Button>
                    <Button
                      type="submit"
                      form="checkout-payment-form"
                      variant="primary"
                      size="md"
                      disabled={loadingSecret || !stripeMounted || processing || holdExpired}
                      isLoading={processing}
                      loadingText="Processing payment…"
                      className="flex-2 font-semibold rounded-[10px]"
                    >
                      Pay {formatINR(totalAmountNumber)}
                    </Button>
                  </div>

                  {/* Real Expiry time note */}
                  {expiryTimeFormatted && (
                    <p className="text-xs text-gray-500 text-center pt-0.5">
                      Your room is held until {expiryTimeFormatted}.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentModal;
