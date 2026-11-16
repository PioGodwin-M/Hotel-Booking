import React, { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { CheckCircle2, MapPin, ArrowRight, Printer } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { formatINR, formatDateRange } from "../lib/formatters";

export const BookingSuccessModal = ({
  isOpen,
  onClose,
  booking,
  onViewReceipt,
  onViewBookings,
}) => {
  const confettiFired = useRef(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (isOpen && !confettiFired.current && !shouldReduceMotion) {
      confettiFired.current = true;
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ["#059669", "#0b1220", "#3b82f6"],
        });
      } catch {
        // ignore if canvas blocked
      }
    }
  }, [isOpen, shouldReduceMotion]);

  if (!booking || booking.status !== "CONFIRMED") return null;

  const hotelName = booking.hotel?.name || "Hotel Stay";
  const hotelAddress = booking.hotel?.address || booking.hotel?.city || "Destination";
  const roomType = booking.roomType || booking.room?.roomType || "Standard Room";
  const checkIn = booking.checkIn || booking.checkInDate;
  const checkOut = booking.checkOut || booking.checkOutDate;
  const totalAmount =
    booking.priceSnapshot?.totalAmount ?? booking.totalPrice ?? 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      showCloseButton={false}
      closeOnBackdropClick={false}
    >
      <div className="text-center space-y-5 pt-1 pb-1">
        {/* Success Icon */}
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            Booking Confirmed!
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-sm mx-auto">
            Your payment was successful and your reservation is confirmed.
          </p>
        </div>

        {/* Summary Card */}
        <div className="p-4 rounded-xl bg-[#faf9f6] dark:bg-white/5 border border-[#e7e5e0] dark:border-white/10 text-left space-y-3">
          <div className="flex items-start justify-between border-b border-[#e7e5e0] dark:border-white/10 pb-3 gap-2">
            <div>
              <p className="text-sm font-semibold text-[#0b1220] dark:text-[#faf8f5]">
                {hotelName}
              </p>
              <p className="text-xs text-stone-600 dark:text-stone-400 font-medium">
                {roomType}
              </p>
              <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                <span className="truncate max-w-[200px]">{hotelAddress}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base font-bold text-[#0b1220] dark:text-[#faf8f5] tabular-nums">
                {formatINR(totalAmount)}
              </span>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Taxes paid</p>
            </div>
          </div>

          <div className="text-xs">
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Dates
            </p>
            <p className="font-medium text-[#0b1220] dark:text-[#faf8f5] mt-0.5">
              {formatDateRange(checkIn, checkOut)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <Button
            variant="primary"
            size="md"
            onClick={onViewBookings}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full font-medium"
          >
            Go to My Bookings
          </Button>

          {onViewReceipt && (
            <Button
              variant="secondary"
              size="md"
              onClick={onViewReceipt}
              leftIcon={<Printer className="w-4 h-4" />}
              className="w-full font-medium"
            >
              View Receipt
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default BookingSuccessModal;
