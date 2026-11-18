import React from "react";
import { Printer, ShieldCheck } from "lucide-react";
import Logo from "./Logo";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { formatINR, formatDateRange } from "../lib/formatters";
import { BRAND_NAME } from "../config/brand";

export const ReceiptModal = ({ isOpen, onClose, booking, user }) => {
  if (!booking) return null;

  const bookingIdStr = (booking.id || booking._id || "").toString();
  const receiptNumber =
    booking.paymentSummary?.paymentReference ||
    `REC-${bookingIdStr.slice(-8).toUpperCase()}`;
  const checkIn = booking.checkIn || booking.checkInDate;
  const checkOut = booking.checkOut || booking.checkOutDate;
  const guestCount = booking.numberOfGuests || booking.guests || 1;
  const totalAmount =
    booking.priceBreakdown?.totalAmount ??
    booking.priceSnapshot?.totalAmount ??
    booking.totalPrice ??
    0;
  const nights =
    booking.priceBreakdown?.numberOfNights ||
    booking.numberOfNights ||
    booking.priceSnapshot?.numberOfNights ||
    (checkIn && checkOut
      ? Math.max(
          1,
          Math.round(
            (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)
          )
        )
      : 1);

  const hotelName =
    booking.stayDetails?.propertyName ||
    booking.hotel?.name ||
    "Hotel Stay";
  const hotelAddress =
    booking.stayDetails?.address ||
    [booking.stayDetails?.area, booking.stayDetails?.city].filter(Boolean).join(", ") ||
    booking.hotel?.address ||
    booking.hotel?.city ||
    "Destination";
  const roomType =
    booking.stayDetails?.roomTypeName ||
    booking.roomType ||
    booking.room?.roomType ||
    "Standard Room";

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-xl"
      title="Booking Receipt"
      description="Payment confirmation and receipt details"
    >
      <div id="printable-receipt" className="space-y-6 pt-1 text-left">
        {/* Folio Header */}
        <div className="flex items-start justify-between pb-5 border-b border-[#e7e5e0] dark:border-white/10">
          <div>
            <Logo size="sm" />
            <p className="text-xs font-mono text-stone-600 dark:text-stone-400 mt-2">
              Receipt No: {receiptNumber}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Date: {new Date(booking.createdAt || Date.now()).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="text-right">
            <Badge variant="confirmed" size="sm" dot>
              Confirmed & Paid
            </Badge>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              Payment via Stripe
            </p>
          </div>
        </div>

        {/* Guest & Property Grid */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
              Guest Name
            </p>
            <p className="font-semibold text-sm text-[#0b1220] dark:text-[#faf8f5] mt-0.5">
              {user?.fullName || user?.firstName || "Guest"}
            </p>
            <p className="text-stone-500 dark:text-stone-400 text-xs">
              {user?.primaryEmailAddress?.emailAddress || "Registered User"}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
              Property
            </p>
            <p className="font-semibold text-sm text-[#0b1220] dark:text-[#faf8f5] mt-0.5">
              {hotelName}
            </p>
            <p className="text-stone-500 dark:text-stone-400 text-xs truncate">
              {hotelAddress}
            </p>
          </div>
        </div>

        {/* Stay Details Table */}
        <div className="rounded-xl border border-[#e7e5e0] dark:border-white/10 overflow-hidden">
          <div className="bg-[#faf9f6] dark:bg-white/5 p-3 text-xs font-semibold text-stone-600 dark:text-stone-400 grid grid-cols-3">
            <span>Room Type</span>
            <span className="text-center">Dates</span>
            <span className="text-right">Total</span>
          </div>

          <div className="p-3.5 text-xs grid grid-cols-3 items-center border-t border-[#e7e5e0] dark:border-white/10">
            <div>
              <p className="font-semibold text-[#0b1220] dark:text-[#faf8f5]">
                {roomType}
              </p>
              <p className="text-stone-500 dark:text-stone-400 text-[11px]">
                {nights} {nights === 1 ? "night" : "nights"}, {guestCount} {guestCount === 1 ? "guest" : "guests"}
              </p>
            </div>

            <div className="text-center text-xs text-stone-700 dark:text-stone-300">
              <p>{formatDateRange(checkIn, checkOut)}</p>
            </div>

            <div className="text-right font-bold text-sm text-[#0b1220] dark:text-[#faf8f5] tabular-nums">
              {formatINR(totalAmount)}
            </div>
          </div>
        </div>

        {/* Price Summary */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
            <span>Room charges ({nights} {nights === 1 ? "night" : "nights"})</span>
            <span className="tabular-nums">{formatINR(totalAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
            <span>Taxes & service fees</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">Included</span>
          </div>
          <div className="pt-2.5 border-t border-[#e7e5e0] dark:border-white/10 flex items-center justify-between text-base font-bold text-[#0b1220] dark:text-[#faf8f5]">
            <span>Total Paid</span>
            <span className="text-lg tabular-nums">
              {formatINR(totalAmount)}
            </span>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="p-3 rounded-lg bg-[#faf9f6] dark:bg-white/5 border border-[#e7e5e0] dark:border-white/10 flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Official confirmation receipt from {BRAND_NAME}. Payment secured and verified.
          </span>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-3 print:hidden">
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Print / Save Receipt
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReceiptModal;
