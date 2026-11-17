import React, { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { useReducedMotion } from "framer-motion";
import { Button } from "../components/ui/Button";
import { usePageTitle } from "../hooks/usePageTitle";
import { BRAND_NAME } from "../config/brand";

export const BookingSuccess = () => {
  usePageTitle(
    "Booking Confirmed",
    "Your hotel booking is confirmed and payment has been processed."
  );
  const [searchParams] = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const confettiFired = useRef(false);

  const bookingId = searchParams.get("bookingId");
  const paymentIntentId = searchParams.get("payment_intent");

  useEffect(() => {
    if (!confettiFired.current && !shouldReduceMotion) {
      confettiFired.current = true;
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#059669", "#0B1220", "#3B82F6", "#F59E0B"],
        });
      } catch {
        // ignore
      }
    }
  }, [shouldReduceMotion]);

  return (
    <div className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-lg mx-auto text-center space-y-6">
      <div className="mx-auto flex items-center justify-center text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Booking confirmed
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-md mx-auto">
          Thank you for booking with {BRAND_NAME}. Your payment has been received and your room is reserved.
        </p>
      </div>

      {(bookingId || paymentIntentId) && (
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700 text-xs font-mono text-gray-600 dark:text-gray-400 text-left space-y-1">
          {bookingId && <p>Booking ID: {bookingId}</p>}
          {paymentIntentId && <p>Payment Ref: {paymentIntentId}</p>}
        </div>
      )}

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link to="/my-bookings" className="w-full sm:w-auto">
          <Button
            variant="primary"
            size="md"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full font-semibold"
          >
            View in My bookings
          </Button>
        </Link>
        <Link to="/rooms" className="w-full sm:w-auto">
          <Button variant="outline" size="md" className="w-full">
            Browse more stays
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default BookingSuccess;
