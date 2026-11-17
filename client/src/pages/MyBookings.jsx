import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  AlertTriangle,
  Copy,
} from "lucide-react";
import toast from "react-hot-toast";
import { assets } from "../assets/assets";
import { useAppContext } from "../context/AppContext";
import { authApi } from "../lib/apiClient";
import { getStripe } from "../lib/stripeClient";
import PaymentModal from "../components/PaymentModal";
import ReceiptModal from "../components/ReceiptModal";
import BookingSuccessModal from "../components/BookingSuccessModal";
import ErrorBoundary from "../components/ErrorBoundary";
import { Button } from "../components/ui/Button";
import { StatusText } from "../components/ui/StatusText";
import { Tabs } from "../components/ui/Tabs";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { SafeImage } from "../components/ui";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatINR } from "../lib/formatters";
import { formatBookingReference } from "../lib/bookingReference";
import { useHoldCountdown } from "../hooks/useHoldCountdown";
import { showErrorToast } from "../lib/toast";
import {
  getBookingStatusDisplay,
} from "../lib/bookingStatus";

const BookingCardItem = ({
  booking,
  rooms,
  onPay,
  onViewReceipt,
  onCountdownExpire,
}) => {
  const matchedRoom = Array.isArray(rooms)
    ? rooms.find((r) => r._id === booking.roomCategoryId)
    : null;

  const hotelName = matchedRoom?.hotel?.name || booking.hotel?.name || "Hotel";
  const hotelCity =
    matchedRoom?.hotel?.city ||
    booking.hotel?.city ||
    (matchedRoom?.hotel?.address ? matchedRoom.hotel.address.split(",").pop().trim() : "") ||
    "Location";
  const roomType = matchedRoom?.roomType || booking.room?.roomType || "Standard Room";
  const roomImage = matchedRoom?.images?.[0] || booking.room?.images?.[0] || assets.roomImg1;

  const checkIn = booking.checkIn || booking.checkInDate;
  const checkOut = booking.checkOut || booking.checkOutDate;
  const guestCount = booking.numberOfGuests || booking.guests || 1;
  const totalAmount = booking.priceSnapshot?.totalAmount ?? booking.totalPrice ?? 0;

  const friendlyRef = formatBookingReference(booking._id);

  // Live hold countdown (Section 3 & 9)
  const { formatted: countdownFormatted, isExpired: localExpired } = useHoldCountdown(
    booking,
    onCountdownExpire
  );

  // Authoritative booking status display & lifecycle mapping
  const statusDisplay = getBookingStatusDisplay({
    booking,
    isExpiredCountdown: localExpired,
    countdownText: countdownFormatted,
  });

  const handleCopyRef = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(friendlyRef);
    toast.success("Reference copied");
  };

  const formatDateOnly = (d) => {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(dt);
    } catch {
      return d;
    }
  };

  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 sm:p-6 transition-all hover:border-gray-300 dark:hover:border-gray-700">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Left: Photo & Hotel Details (Col 5) */}
        <div className="lg:col-span-5 flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-full sm:w-[160px] h-[120px] rounded-[10px] overflow-hidden border border-gray-200 dark:border-gray-800 shrink-0">
            <SafeImage
              src={roomImage}
              alt={hotelName}
              fallbackLabel={hotelName}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            {/* Status: plain text, no pill, no border (Section 9) */}
            <div className="mb-1">
              <StatusText status={statusDisplay.statusType}>
                {statusDisplay.label}
              </StatusText>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate" title={hotelName}>
              {hotelName}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
              {roomType} · {hotelCity}
            </p>

            {/* Reference with copy button: Inter (not monospace), tabular numbers, 13px */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="font-sans text-[13px] tabular-nums font-medium text-gray-700 dark:text-gray-300">
                {friendlyRef}
              </span>
              <button
                type="button"
                onClick={handleCopyRef}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded cursor-pointer"
                title="Copy reference"
                aria-label="Copy booking reference"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Middle: Stay Schedule & Total (Col 4) */}
        <div className="lg:col-span-4 py-3 sm:py-0 border-y lg:border-y-0 lg:border-x border-gray-200 dark:border-gray-800 lg:px-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Check in</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                {formatDateOnly(checkIn)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                From 2:00 PM
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Check out</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                {formatDateOnly(checkOut)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Until 11:00 AM
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              {guestCount} {guestCount === 1 ? "guest" : "guests"} · 1 room
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {formatINR(totalAmount)}
            </span>
          </div>
        </div>

        {/* Right: Actions (Col 3) */}
        <div className="lg:col-span-3 flex flex-col gap-2.5 items-start lg:items-end justify-center w-full">
          {statusDisplay.canPay && (
            <Button
              variant="primary"
              size="md"
              onClick={() => onPay(booking, matchedRoom)}
              onMouseEnter={() => {
                getStripe().catch(() => {});
              }}
              className="w-full sm:w-auto font-semibold min-h-[44px] h-11 text-sm flex items-center justify-center rounded-[10px]"
            >
              Complete payment
            </Button>
          )}

          {statusDisplay.statusType === "confirming" && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Confirming your booking…
            </span>
          )}

          {statusDisplay.canViewReceipt && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewReceipt(booking)}
              className="w-full sm:w-auto text-sm min-h-[44px] h-11 flex items-center justify-center rounded-[10px]"
              leftIcon={<FileText className="w-4 h-4 text-gray-500" />}
            >
              View receipt
            </Button>
          )}

          {statusDisplay.statusType === "expired" && (
            <p className="text-xs text-gray-400">Hold expired</p>
          )}

          {statusDisplay.statusType === "cancelled" && (
            <p className="text-xs text-gray-400">Booking cancelled</p>
          )}
        </div>
      </div>
    </div>
  );
};

export const MyBookings = () => {
  usePageTitle(
    "My Bookings",
    "View and manage your upcoming, past, and cancelled hotel bookings."
  );
  const { user, rooms, currency } = useAppContext();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("upcoming");

  // Payment checkout modal state (opens immediately with booking preloaded, Section 1 & 4)
  const [activePaymentModal, setActivePaymentModal] = useState(null);

  // Receipt modal state
  const [receiptBooking, setReceiptBooking] = useState(null);

  // Success celebration modal state
  const [successBooking, setSuccessBooking] = useState(null);

  // Cancellation dialog state
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Preload Stripe SDK on page mount
  useEffect(() => {
    getStripe().catch(() => {});
  }, []);

  // Fetch bookings from Booking Service (supports silent background re-fetching)
  const fetchBookings = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const { data } = await authApi.get("/api/bookings/?page=1&limit=50");
      if (data.success) {
        setBookings(data.bookings || []);
      } else if (!silent) {
        const msg = data.message || "Could not retrieve bookings";
        setError(msg);
        showErrorToast(msg, { id: "my-bookings-load-error", onRetry: () => fetchBookings() });
      }
    } catch {
      if (!silent) {
        const msg = "We couldn't load your bookings. Please try again.";
        setError(msg);
        showErrorToast(msg, {
          id: "my-bookings-load-error",
          onRetry: () => fetchBookings(),
        });
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  // 10s watchdog timeout to replace perpetual skeleton with inline error
  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => {
        setLoading(false);
        setError("Request timed out. We couldn't load your bookings.");
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user, fetchBookings]);

  // Open Checkout Modal immediately without "Starting..." delay (Section 1 & 4)
  const handleOpenCheckout = (booking, matchedRoom) => {
    setActivePaymentModal({
      booking,
      room: matchedRoom,
    });
  };

  // Perform confirmed cancellation (ONLY permitted for HELD bookings)
  const confirmCancel = async () => {
    if (!cancellingBooking || isCancelling) return;
    setIsCancelling(true);

    try {
      const { data } = await authApi.patch(
        `/api/bookings/${cancellingBooking._id}/cancel`
      );
      if (data.success) {
        toast.success("Booking cancelled and room released");
        setCancellingBooking(null);
        fetchBookings({ silent: true });
      } else {
        toast.error(data.message || "Could not cancel booking");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Cancellation failed"
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // Filter bookings into tabs: Upcoming, Past, Cancelled
  const todayDate = useMemo(() => new Date().toISOString().split("T")[0], []);

  const categorizedBookings = useMemo(() => {
    const upcoming = [];
    const past = [];
    const cancelled = [];

    bookings.forEach((b) => {
      if (b.status === "CANCELLED") {
        cancelled.push(b);
      } else if (
        b.status === "CONFIRMED" &&
        b.checkOut &&
        b.checkOut.split("T")[0] < todayDate
      ) {
        past.push(b);
      } else if (b.status === "EXPIRED" || b.status === "PAYMENT_FAILED") {
        past.push(b);
      } else {
        upcoming.push(b);
      }
    });

    return { upcoming, past, cancelled };
  }, [bookings, todayDate]);

  const currentBookings = categorizedBookings[activeTab] || [];

  const tabItems = [
    { id: "upcoming", label: "Upcoming", count: loading ? undefined : categorizedBookings.upcoming.length },
    { id: "past", label: "Past stays", count: loading ? undefined : categorizedBookings.past.length },
    { id: "cancelled", label: "Cancelled", count: loading ? undefined : categorizedBookings.cancelled.length },
  ];

  return (
    <div className="pt-24 md:pt-32 pb-28 page-container min-h-[calc(100svh-56px-320px)]">
      {/* Page Header (Section 9) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-gray-900 dark:text-gray-100">
            My bookings
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-xl">
            Upcoming and past stays, payments and receipts.
          </p>
        </div>

        {/* Clean plain underline tabs (Section 9) */}
        <div className="self-start md:self-end">
          <Tabs
            tabs={tabItems}
            activeTab={activeTab}
            onChange={setActiveTab}
            variant="underline"
          />
        </div>
      </div>

      {/* Bookings List */}
      <div className="mt-6 space-y-4">
        <h2 className="sr-only">Your Bookings Overview</h2>
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-6 text-center space-y-3 my-6"
          >
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <div>
              <h3 className="font-bold text-sm text-[#0b1220] dark:text-[#faf8f5]">Could not load bookings</h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => fetchBookings()}>
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-stone-200 dark:border-white/10 p-5 sm:p-6 bg-white dark:bg-[#151d30] animate-pulse flex flex-col md:flex-row gap-5"
              >
                <div className="w-full md:w-[160px] h-[120px] bg-stone-200 dark:bg-white/10 rounded-[10px] shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-stone-200 dark:bg-white/10 rounded w-1/4" />
                  <div className="h-6 bg-stone-200 dark:bg-white/10 rounded w-1/2" />
                  <div className="h-4 bg-stone-200 dark:bg-white/10 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : currentBookings.length === 0 ? (
          <EmptyState
            title={
              activeTab === "upcoming"
                ? "No upcoming stays"
                : activeTab === "past"
                ? "No past stays"
                : "No cancelled bookings"
            }
            description={
              activeTab === "upcoming"
                ? "You don't have any upcoming trips booked. Discover a stay for your next trip."
                : activeTab === "past"
                ? "Completed stays will appear here after checkout."
                : "Cancelled bookings will appear here."
            }
            actionLabel={activeTab === "upcoming" ? "Browse stays" : undefined}
            onAction={activeTab === "upcoming" ? () => navigate("/rooms") : undefined}
            className="my-10"
          />
        ) : (
          currentBookings.map((booking) => (
            <BookingCardItem
              key={booking._id}
              booking={booking}
              rooms={rooms}
              onPay={handleOpenCheckout}
              onViewReceipt={(b) => setReceiptBooking(b)}
              onCountdownExpire={() => fetchBookings({ silent: true })}
            />
          ))
        )}
      </div>

      {/* Stripe Payment Checkout Modal (Extended Two-Column Modal, Section 1 & 2) */}
      {activePaymentModal && (
        <ErrorBoundary>
          <PaymentModal
            booking={activePaymentModal.booking}
            room={activePaymentModal.room}
            onClose={() => {
              setActivePaymentModal(null);
              fetchBookings({ silent: true });
            }}
            onViewReceipt={(b) => {
              setActivePaymentModal(null);
              fetchBookings({ silent: true });
              setReceiptBooking(b);
            }}
          />
        </ErrorBoundary>
      )}

      {/* Cancellation Confirmation Dialog */}
      <Modal
        isOpen={Boolean(cancellingBooking)}
        onClose={() => setCancellingBooking(null)}
        maxWidth="max-w-md"
        title="Cancel booking hold?"
        description="Are you sure you want to cancel this booking hold?"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Your room hold will be cancelled and released immediately for other guests to book.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setCancellingBooking(null)}
              disabled={isCancelling}
              className="flex-1 rounded-[10px]"
            >
              Keep hold
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={confirmCancel}
              isLoading={isCancelling}
              loadingText="Cancelling..."
              className="flex-1 rounded-[10px]"
            >
              Cancel hold
            </Button>
          </div>
        </div>
      </Modal>

      {/* Official Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(receiptBooking)}
        onClose={() => setReceiptBooking(null)}
        booking={receiptBooking}
        user={user}
        currency={currency}
      />

      {/* Booking Success Celebration Modal */}
      <BookingSuccessModal
        isOpen={Boolean(successBooking)}
        onClose={() => setSuccessBooking(null)}
        booking={successBooking}
        currency={currency}
        onViewReceipt={() => {
          const b = successBooking;
          setSuccessBooking(null);
          setReceiptBooking(b);
        }}
        onViewBookings={() => {
          setSuccessBooking(null);
          setActiveTab("upcoming");
        }}
      />
    </div>
  );
};

export default MyBookings;
