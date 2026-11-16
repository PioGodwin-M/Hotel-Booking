import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Users,
  CreditCard,
  FileText,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import toast from "react-hot-toast";
import { assets } from "../assets/assets";
import { useAppContext } from "../context/AppContext";
import { authApi } from "../lib/apiClient";
import PaymentModal from "../components/PaymentModal";
import ReceiptModal from "../components/ReceiptModal";
import BookingSuccessModal from "../components/BookingSuccessModal";
import ErrorBoundary from "../components/ErrorBoundary";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Tabs } from "../components/ui/Tabs";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { SafeImage } from "../components/ui";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatINR } from "../lib/formatters";
import { showErrorToast } from "../lib/toast";
import { HOLD_DURATION_TEXT } from "../config/brand";

export const MyBookings = () => {
  usePageTitle(
    "My Bookings",
    "View and manage your upcoming, past, and cancelled hotel bookings."
  );
  const { user, rooms, currency } = useAppContext();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("upcoming");

  // Payment modal state
  const [activePayment, setActivePayment] = useState(null);
  const [initiatingPaymentId, setInitiatingPaymentId] = useState(null);

  // Receipt modal state
  const [receiptBooking, setReceiptBooking] = useState(null);

  // Success celebration modal state
  const [successBooking, setSuccessBooking] = useState(null);

  // Cancellation dialog state
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch bookings from Booking Service
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authApi.get("/api/bookings/?page=1&limit=50");
      if (data.success) {
        setBookings(data.bookings || []);
      } else {
        const msg = data.message || "Could not retrieve bookings";
        setError(msg);
        showErrorToast(msg, { id: "my-bookings-load-error", onRetry: () => fetchBookings() });
      }
    } catch {
      const msg = "We couldn't load your bookings. Please try again.";
      setError(msg);
      showErrorToast(msg, {
        id: "my-bookings-load-error",
        onRetry: () => fetchBookings(),
      });
    } finally {
      setLoading(false);
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

  // Initiate Stripe Payment
  const handlePayment = async (booking) => {
    if (initiatingPaymentId) return;
    setInitiatingPaymentId(booking._id);

    try {
      // Deterministic idempotency key derived from booking ID.
      const idempotencyKey = `pay_booking_${booking._id}`;

      const { data } = await authApi.post(
        "/api/payments/",
        { bookingId: booking._id },
        {
          headers: {
            "Idempotency-Key": idempotencyKey,
          },
        }
      );

      if (data.success && data.data?.clientSecret) {
        setActivePayment({
          bookingId: booking._id,
          clientSecret: data.data.clientSecret,
          amountMinor: data.data.amountMinor,
          currency: data.data.currency || "INR",
          booking,
        });
      } else {
        toast.error(data.message || "Payment session could not be established");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Payment session could not be started"
      );
    } finally {
      setInitiatingPaymentId(null);
    }
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
        fetchBookings();
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
    { id: "upcoming", label: "Upcoming", count: categorizedBookings.upcoming.length },
    { id: "past", label: "Past stays", count: categorizedBookings.past.length },
    { id: "cancelled", label: "Cancelled", count: categorizedBookings.cancelled.length },
  ];

  return (
    <div className="pt-24 md:pt-32 pb-28 page-container">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            My bookings
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-xl">
            View your upcoming and past stays, complete pending payments, and download receipts.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="self-start md:self-end">
          <Tabs
            tabs={tabItems}
            activeTab={activeTab}
            onChange={setActiveTab}
            variant="pill"
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
          <div className="py-20 text-center text-sm text-gray-500 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-900 dark:border-white border-t-transparent animate-spin" />
            <span>Loading your bookings...</span>
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
          currentBookings.map((booking, idx) => {
            const matchedRoom = Array.isArray(rooms)
              ? rooms.find((r) => r._id === booking.roomCategoryId)
              : null;

            const hotelName =
              matchedRoom?.hotel?.name || booking.hotel?.name || "Hotel";
            const hotelAddress =
              matchedRoom?.hotel?.address ||
              booking.hotel?.address ||
              booking.hotel?.city ||
              "Location";
            const roomType =
              matchedRoom?.roomType || booking.room?.roomType || "Standard Room";
            const roomImage =
              matchedRoom?.images?.[0] ||
              booking.room?.images?.[0] ||
              assets.roomImg1;

            const checkIn = booking.checkIn || booking.checkInDate;
            const checkOut = booking.checkOut || booking.checkOutDate;
            const guestCount = booking.numberOfGuests || booking.guests || 1;
            const totalAmount =
              booking.priceSnapshot?.totalAmount ?? booking.totalPrice ?? 0;

            const isConfirmed = booking.status === "CONFIRMED";
            const isHeld = booking.status === "HELD";
            const isPaymentPending = booking.status === "PAYMENT_PENDING";
            const isCancelled = booking.status === "CANCELLED";

            // Payment is possible if HELD or PAYMENT_PENDING
            const canPay = isHeld || isPaymentPending;
            // Customer cancellation is strictly permitted only when booking status is 'HELD'
            const canCancel = isHeld;

            return (
              <motion.div
                key={booking._id}
                initial={
                  shouldReduceMotion ? undefined : { opacity: 0, y: 8 }
                }
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs hover:border-gray-300 dark:hover:border-gray-700 transition-all p-5 sm:p-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  {/* Col 1: Photo & Hotel Info */}
                  <div className="lg:col-span-5 flex flex-col sm:flex-row gap-4 items-start">
                    <div className="w-full sm:w-32 h-24 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shrink-0">
                      <SafeImage
                        src={roomImage}
                        alt={hotelName}
                        fallbackLabel={hotelName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge
                          variant={
                            isConfirmed
                              ? "confirmed"
                              : isHeld
                              ? "held"
                              : isPaymentPending
                              ? "pending"
                              : isCancelled
                              ? "cancelled"
                              : "failed"
                          }
                          size="sm"
                          dot
                        >
                          {isConfirmed
                            ? "Confirmed"
                            : isHeld
                            ? `Payment pending (${HOLD_DURATION_TEXT} hold)`
                            : isPaymentPending
                            ? "Processing"
                            : isCancelled
                            ? "Cancelled"
                            : "Expired"}
                        </Badge>
                      </div>

                      <h3
                        className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate"
                        title={hotelName}
                      >
                        {hotelName}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                        {roomType} &middot; {guestCount} {guestCount === 1 ? "guest" : "guests"}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{hotelAddress}</span>
                      </div>
                    </div>
                  </div>

                  {/* Col 2: Dates & Total */}
                  <div className="lg:col-span-4 py-3 sm:py-0 border-y lg:border-y-0 lg:border-x border-gray-200 dark:border-gray-800 lg:px-6">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          Check in
                        </p>
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                          {checkIn
                            ? new Date(checkIn).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          From 2:00 PM
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          Check out
                        </p>
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                          {checkOut
                            ? new Date(checkOut).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Until 11:00 AM
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">
                        Total amount
                      </span>
                      <span className="font-bold text-base text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatINR(totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Col 3: Actions */}
                  <div className="lg:col-span-3 flex flex-col gap-2 items-start lg:items-end justify-center">
                    {/* Pay Now Button */}
                    {canPay && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handlePayment(booking)}
                        disabled={initiatingPaymentId === booking._id}
                        isLoading={initiatingPaymentId === booking._id}
                        loadingText="Starting..."
                        className="w-full sm:w-auto font-semibold"
                        leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                      >
                        Complete payment
                      </Button>
                    )}

                    {/* Cancel Hold Button (ONLY for HELD bookings) */}
                    {canCancel && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setCancellingBooking(booking)}
                        className="w-full sm:w-auto text-xs"
                      >
                        Cancel hold
                      </Button>
                    )}

                    {/* View Official Receipt */}
                    {isConfirmed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReceiptBooking(booking)}
                        className="w-full sm:w-auto text-xs"
                        leftIcon={<FileText className="w-3.5 h-3.5 text-gray-500" />}
                      >
                        View receipt
                      </Button>
                    )}

                    {isCancelled && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-gray-400" />
                        <span>Cancelled</span>
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Stripe Payment Modal */}
      {activePayment && (
        <ErrorBoundary>
          <PaymentModal
            bookingId={activePayment.bookingId?._id || activePayment.bookingId}
            clientSecret={activePayment.clientSecret}
            amountMinor={activePayment.amountMinor}
            currency={activePayment.currency}
            onClose={() => setActivePayment(null)}
            onSuccess={(confirmedBooking) => {
              setActivePayment(null);
              fetchBookings();
              // Show celebration modal strictly when authoritative backend confirmed
              if (confirmedBooking && confirmedBooking.status === "CONFIRMED") {
                setSuccessBooking(confirmedBooking);
              }
            }}
            onPending={() => {
              setActivePayment(null);
              fetchBookings();
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
              className="flex-1"
            >
              Keep hold
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={confirmCancel}
              isLoading={isCancelling}
              loadingText="Cancelling..."
              className="flex-1"
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
