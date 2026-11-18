import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  Users,
  ShieldCheck,
  FileText,
  ExternalLink,
  Navigation,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock3,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { authApi } from "../lib/apiClient";
import { formatINR } from "../lib/formatters";
import { PropertyMap } from "../components/map/PropertyMap";
import { SafeImage } from "../components/ui/SafeImage";
import { Button } from "../components/ui/Button";
import { StatusText } from "../components/ui/StatusText";
import { ReceiptModal } from "../components/ReceiptModal";
import { PaymentModal } from "../components/PaymentModal";
import { DirectionsQR } from "../components/DirectionsQR";
import { downloadIcsFile } from "../lib/calendar";
import { getGoogleMapsSearchUrl, getGoogleMapsDirectionsUrl } from "../lib/geo";
import { useHoldCountdown } from "../hooks/useHoldCountdown";
import { BUSINESS_CONFIG } from "../config/business";
import { assets } from "../assets/assets";

export const BookingDetails = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user, rooms } = useAppContext();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [is404, setIs404] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);

  // Modal states
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Focus ref for accessible navigation
  const h1Ref = useRef(null);

  // Fetch booking details
  const fetchBooking = useCallback(
    async ({ silent = false } = {}) => {
      if (!bookingId) return;

      if (!silent) {
        setLoading(true);
        setError(null);
        setIs404(false);
      }

      try {
        const { data } = await authApi.get(`/api/bookings/${encodeURIComponent(bookingId)}`);
        if (data.success && data.booking) {
          setBooking(data.booking);
        } else {
          setError(data.message || "Failed to load booking details");
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setIs404(true);
        } else {
          setError(
            err.response?.data?.message ||
              "We couldn't load your booking details. Please try again."
          );
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [bookingId]
  );

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // Set page focus on h1 on initial load
  useEffect(() => {
    if (!loading && booking && h1Ref.current) {
      h1Ref.current.focus();
    }
  }, [loading, booking]);

  // Dynamic poll if confirming
  useEffect(() => {
    if (booking?.status === "CONFIRMING" || booking?.status === "PAYMENT_PENDING") {
      const interval = setInterval(() => {
        fetchBooking({ silent: true });
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [booking?.status, fetchBooking]);

  // Hold countdown for HELD / PAYMENT_PENDING statuses
  const {
    formatted: countdownFormatted,
    isExpired: localHoldExpired,
  } = useHoldCountdown(booking, () => {
    fetchBooking({ silent: true });
  });

  // Copy reference handler
  const handleCopyReference = () => {
    if (!booking?.reference) return;
    navigator.clipboard.writeText(booking.reference);
    toast.success("Reference copied");
  };

  // Add to calendar handler
  const handleAddToCalendar = () => {
    if (!booking) return;
    const stay = booking.stayDetails || {};
    downloadIcsFile({
      propertyName: stay.propertyName || "Stay",
      address: stay.address || "",
      city: stay.city || "",
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      checkInTime: stay.checkInTime || "14:00",
      checkOutTime: stay.checkOutTime || "11:00",
      reference: booking.reference,
      url: window.location.href,
    });
    toast.success("Calendar invite downloaded");
  };

  // Retry payment summary fetch
  const handleRetryPaymentSummary = async () => {
    setRetryingPayment(true);
    await fetchBooking({ silent: true });
    setRetryingPayment(false);
    toast.success("Payment details refreshed");
  };

  // Date formatting helpers
  const formatDateFull = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const formatTimeOnly = (timeStr, defaultLabel = "2:00 PM") => {
    if (!timeStr) return defaultLabel;
    try {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const period = hours >= 12 ? "PM" : "AM";
      const h12 = hours % 12 || 12;
      const mStr = minutes > 0 ? `:${String(minutes).padStart(2, "0")}` : ":00";
      return `${h12}${mStr} ${period}`;
    } catch {
      return defaultLabel;
    }
  };

  // Status mapping
  const status = booking?.status;
  const isPastStay =
    status === "CONFIRMED" &&
    booking?.checkOut &&
    new Date(booking.checkOut) < new Date();

  const getStatusBadge = () => {
    if (isPastStay) {
      return {
        label: "Past stay",
        className: "text-stone-600 dark:text-stone-400 font-medium",
      };
    }
    switch (status) {
      case "CONFIRMED":
        return {
          label: "Confirmed",
          className: "text-emerald-700 dark:text-emerald-400 font-semibold",
        };
      case "HELD":
      case "PAYMENT_PENDING":
        if (localHoldExpired) {
          return {
            label: "Hold expired",
            className: "text-stone-500 dark:text-stone-400 font-medium",
          };
        }
        return {
          label: `Payment pending · ${countdownFormatted} remaining`,
          className: "text-amber-700 dark:text-amber-400 font-semibold",
        };
      case "EXPIRED":
        return {
          label: "Expired",
          className: "text-stone-500 dark:text-stone-400 font-medium",
        };
      case "CANCELLED":
        return {
          label: "Cancelled",
          className: "text-rose-700 dark:text-rose-400 font-medium",
        };
      case "PAYMENT_FAILED":
        return {
          label: "Payment failed",
          className: "text-rose-700 dark:text-rose-400 font-medium",
        };
      default:
        return {
          label: status || "Pending",
          className: "text-stone-600 dark:text-stone-300 font-medium",
        };
    }
  };

  // 1. Loading Skeleton
  if (loading) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-6">
        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="space-y-2">
          <div className="h-4 w-36 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-8 w-72 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <div className="aspect-[4/3] bg-gray-200 dark:bg-gray-800 rounded-xl" />
            <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          </div>
          <div className="lg:col-span-5 space-y-6">
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // 2. 404 - Not Found / Access Denied
  if (is404) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto text-stone-600 dark:text-stone-300">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            We can't find this booking
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The booking you requested does not exist or belongs to another account.
          </p>
          <div className="pt-2">
            <Button variant="primary" onClick={() => navigate("/my-bookings")}>
              Go to My bookings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Generic Error State
  if (error || !booking) {
    return (
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center mx-auto text-rose-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Something went wrong
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {error || "We couldn't retrieve your booking details right now."}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/my-bookings")}>
              Back to My bookings
            </Button>
            <Button variant="primary" onClick={() => fetchBooking()}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const stay = booking.stayDetails || {};
  const statusBadge = getStatusBadge();
  const propertyName = stay.propertyName || "Hotel Stay";
  const areaCity = [stay.area, stay.city].filter(Boolean).join(", ");
  const nights = booking.numberOfNights || 1;

  // Directions and Search URLs (honoring backend-provided coordinates/address only)
  const coords = stay.coordinates || stay.publicCoordinates;
  const directionsUrl = getGoogleMapsDirectionsUrl({
    lat: coords?.lat,
    lng: coords?.lng,
    address: stay.address || stay.city,
  });
  const searchUrl = getGoogleMapsSearchUrl({
    lat: coords?.lat,
    lng: coords?.lng,
    address: stay.address || stay.city,
  });

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="print:hidden">
        <Link
          to="/my-bookings"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          My bookings
        </Link>
      </div>

      {/* Header Block */}
      <div className="border-b border-gray-200 dark:border-gray-800 pb-5 space-y-2">
        <div aria-live="polite">
          <span className={`text-xs ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        </div>

        <h1
          ref={h1Ref}
          tabIndex={-1}
          className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-gray-400 rounded"
        >
          {propertyName}
        </h1>

        <div className="flex items-center gap-2 pt-1 text-xs text-gray-600 dark:text-gray-400">
          <span>Reference:</span>
          <span className="font-sans font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
            {booking.reference}
          </span>
          <button
            type="button"
            onClick={handleCopyReference}
            className="p-1 hover:text-gray-900 dark:hover:text-gray-100 rounded cursor-pointer print:hidden"
            title="Copy reference"
            aria-label="Copy booking reference"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Status-specific Alerts / Banners */}
      {(status === "HELD" || status === "PAYMENT_PENDING") && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <Clock3 className="w-4 h-4 shrink-0 text-amber-600" />
              Complete your payment to confirm this stay
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {localHoldExpired
                ? "Your 10-minute hold has expired. The room may no longer be available."
                : `Room held for ${countdownFormatted}. Exact address and directions will unlock upon confirmation.`}
            </p>
          </div>
          {!localHoldExpired && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowPaymentModal(true)}
              className="shrink-0 font-semibold min-h-[44px] h-11"
            >
              Complete payment
            </Button>
          )}
        </div>
      )}

      {status === "EXPIRED" && (
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
          <div>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-200">
              This hold has ended
            </p>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
              The booking hold timed out before payment was completed.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate("/rooms")}
            className="shrink-0 min-h-[44px] h-11"
          >
            Check availability
          </Button>
        </div>
      )}

      {status === "CANCELLED" && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/20 p-4 print:hidden">
          <p className="text-sm font-semibold text-rose-900 dark:text-rose-200 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            This booking was cancelled
          </p>
          <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
            {booking.policy || "This booking has been cancelled in accordance with the cancellation policy."}
          </p>
        </div>
      )}

      {/* Mobile Top Actions Row (stacked 44px buttons, print:hidden) */}
      <div className="lg:hidden flex flex-col gap-2.5 print:hidden">
        {status === "CONFIRMED" && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowReceiptModal(true)}
            className="w-full min-h-[44px] h-11 font-semibold flex items-center justify-center rounded-[10px]"
            leftIcon={<FileText className="w-4 h-4" />}
          >
            Download receipt
          </Button>
        )}
        <Button
          variant="secondary"
          size="md"
          onClick={handleAddToCalendar}
          className="w-full min-h-[44px] h-11 flex items-center justify-center rounded-[10px]"
          leftIcon={<Calendar className="w-4 h-4" />}
        >
          Add to calendar
        </Button>
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-[10px] min-h-[44px] transition-colors"
          >
            <Navigation className="w-4 h-4" />
            Get directions
          </a>
        )}
      </div>

      {/* Main Grid: Left Column (~62%) and Right Column (~38%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (Col 7 / ~62%) */}
        <div className="lg:col-span-7 space-y-8">
          {/* 1. Your Stay Card */}
          <section
            aria-labelledby="section-your-stay"
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 space-y-4"
          >
            <h2 id="section-your-stay" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Your stay
            </h2>

            {/* Photo 4:3 */}
            <div className="aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800">
              <SafeImage
                src={stay.mainPhoto || assets.roomImg1}
                alt={propertyName}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-2 pt-1 text-sm">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                {propertyName}
              </h3>

              {areaCity && (
                <p className="text-gray-600 dark:text-gray-400 text-xs">
                  {areaCity}
                </p>
              )}

              {/* Strict privacy gate: render address ONLY when provided by backend */}
              {stay.address && (
                <p className="text-gray-700 dark:text-gray-300 text-xs flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <span>{stay.address}</span>
                </p>
              )}

              {/* Property Contacts: strictly only when provided */}
              {(stay.contactPhone || stay.contactEmail) && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
                  {stay.contactPhone && (
                    <a
                      href={`tel:${stay.contactPhone}`}
                      className="inline-flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-gray-100 underline"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {stay.contactPhone}
                    </a>
                  )}
                  {stay.contactEmail && (
                    <a
                      href={`mailto:${stay.contactEmail}`}
                      className="inline-flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-gray-100 underline"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {stay.contactEmail}
                    </a>
                  )}
                </div>
              )}

              {searchUrl && (
                <div className="pt-1 print:hidden">
                  <a
                    href={searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-gray-900 dark:text-gray-100 font-medium hover:underline"
                  >
                    Open in Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* 2. Dates Card */}
          <section
            aria-labelledby="section-dates"
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 space-y-4"
          >
            <h2 id="section-dates" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Dates
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Check-in</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {formatDateFull(booking.checkIn)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  From {formatTimeOnly(stay.checkInTime, "2:00 PM")}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">Check-out</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {formatDateFull(booking.checkOut)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Until {formatTimeOnly(stay.checkOutTime, "11:00 AM")}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 pt-1">
              Length of stay: <span className="font-semibold text-gray-900 dark:text-gray-100">{nights} {nights === 1 ? "night" : "nights"}</span>
            </p>
          </section>

          {/* 3. Room & Guests Card */}
          <section
            aria-labelledby="section-room-guests"
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 space-y-4"
          >
            <h2 id="section-room-guests" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Room and guests
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">Room type</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {stay.roomTypeName || "Standard Room"}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">Guests booked</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {booking.numberOfGuests || 1} {booking.numberOfGuests === 1 ? "guest" : "guests"}
                  {stay.maxGuests ? ` (max ${stay.maxGuests})` : ""}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">Rooms</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {booking.numberOfRooms || 1} {booking.numberOfRooms === 1 ? "room" : "rooms"}
                </span>
              </div>

              {stay.bedConfiguration && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Bed arrangement</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {stay.bedConfiguration}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* 4. Where You'll Stay (Map Card) */}
          <section
            aria-labelledby="section-where-stay"
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 id="section-where-stay" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Where you'll stay
              </h2>
              {stay.locationPrecision === "approximate" && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Approximate location
                </span>
              )}
            </div>

            {/* Map rendering strictly from backend-provided coordinates */}
            {coords && typeof coords.lat === "number" && typeof coords.lng === "number" ? (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                  <PropertyMap
                    height="320px"
                    interactive={true}
                    accessibleName={`Location map for ${propertyName}`}
                    center={{ lat: coords.lat, lng: coords.lng }}
                    zoom={stay.coordinates ? 15 : 13}
                    markers={
                      stay.coordinates
                        ? [
                            {
                              id: booking.id,
                              lat: coords.lat,
                              lng: coords.lng,
                              title: propertyName,
                            },
                          ]
                        : []
                    }
                    circle={
                      !stay.coordinates && coords
                        ? {
                            lat: coords.lat,
                            lng: coords.lng,
                            radiusMeters: 500,
                            precision: "approximate",
                          }
                        : null
                    }
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 print:hidden">
                  {directionsUrl && (
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0b1220] hover:bg-stone-800 dark:bg-white dark:text-[#0b1220] rounded-lg transition-colors min-h-[44px]"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Get directions
                    </a>
                  )}
                  {searchUrl && (
                    <a
                      href={searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors min-h-[44px]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in Maps
                    </a>
                  )}
                </div>
              </div>
            ) : (
              // Fallback when no coordinates exist (never render an empty map frame)
              <div className="space-y-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Exact map coordinates are unavailable for this stay.
                </p>
                {stay.address && (
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                    Address: {stay.address}
                  </p>
                )}
                {searchUrl && (
                  <a
                    href={searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-gray-900 dark:text-gray-100 font-semibold underline"
                  >
                    Search on Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </section>

          {/* 5. Timeline Card */}
          {Array.isArray(booking.timeline) && booking.timeline.length > 0 && (
            <section
              aria-labelledby="section-timeline"
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 space-y-4"
            >
              <h2 id="section-timeline" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Booking timeline
              </h2>

              <div className="space-y-3 text-xs">
                {booking.timeline.map((evt, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-stone-900 dark:bg-stone-100 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {evt.label}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-[11px]">
                        {evt.timestamp
                          ? new Intl.DateTimeFormat("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "numeric",
                              minute: "numeric",
                              hour12: true,
                            }).format(new Date(evt.timestamp))
                          : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column (Col 5 / ~38%, sticky on desktop) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          {/* 1. Payment Summary Card */}
          <section
            aria-labelledby="section-payment-summary"
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 space-y-4 shadow-sm"
          >
            <h2 id="section-payment-summary" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Payment summary
            </h2>

            {/* Price Breakdown */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Room charges ({nights} {nights === 1 ? "night" : "nights"})</span>
                <span className="tabular-nums font-medium text-gray-900 dark:text-gray-100">
                  {formatINR(booking.priceBreakdown?.roomCharges || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Taxes & service fees</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  {booking.priceBreakdown?.taxesAndFees === 0
                    ? "Included"
                    : formatINR(booking.priceBreakdown?.taxesAndFees || 0)}
                </span>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-base font-bold text-gray-900 dark:text-gray-100">
                <span>Total amount</span>
                <span className="text-lg tabular-nums">
                  {formatINR(booking.priceBreakdown?.totalAmount || 0)}
                </span>
              </div>
            </div>

            {/* Payment Details (Resilient: never breaks page if unavailable) */}
            {booking.paymentSummary ? (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                {status === "CONFIRMED" && (
                  <p className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Payment received
                  </p>
                )}

                {booking.paymentSummary.paidAt && (
                  <p>
                    Paid on{" "}
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(booking.paymentSummary.paidAt))}
                  </p>
                )}

                {booking.paymentSummary.cardLast4 && (
                  <p className="capitalize">
                    {booking.paymentSummary.cardBrand || "Card"} ending in{" "}
                    <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                      {booking.paymentSummary.cardLast4}
                    </span>
                  </p>
                )}

                {booking.paymentSummary.paymentReference && (
                  <p className="text-[11px] text-gray-500 pt-1">
                    Receipt Ref: {booking.paymentSummary.paymentReference}
                  </p>
                )}
              </div>
            ) : status === "CONFIRMED" ? (
              // Degraded payment notice when Payment Service summary is unavailable
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 text-xs space-y-2">
                <p className="text-gray-600 dark:text-gray-400">
                  Payment details are unavailable right now.
                </p>
                <button
                  type="button"
                  disabled={retryingPayment}
                  onClick={handleRetryPaymentSummary}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100 hover:underline cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${retryingPayment ? "animate-spin" : ""}`} />
                  Try again
                </button>
              </div>
            ) : null}

            {/* Desktop Action Buttons (print:hidden) */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 hidden lg:flex flex-col gap-2.5 print:hidden">
              {status === "CONFIRMED" && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setShowReceiptModal(true)}
                  className="w-full font-semibold min-h-[44px] h-11 flex items-center justify-center rounded-[10px]"
                  leftIcon={<FileText className="w-4 h-4" />}
                >
                  Download receipt
                </Button>
              )}

              <Button
                variant="secondary"
                size="md"
                onClick={handleAddToCalendar}
                className="w-full min-h-[44px] h-11 flex items-center justify-center rounded-[10px]"
                leftIcon={<Calendar className="w-4 h-4" />}
              >
                Add to calendar
              </Button>

              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-[10px] min-h-[44px] transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                  Get directions
                </a>
              )}
            </div>
          </section>

          {/* 2. Cancellation Policy Card */}
          <section
            aria-labelledby="section-policy"
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 space-y-3"
          >
            <h2 id="section-policy" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Cancellation policy
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {booking.policy || BUSINESS_CONFIG.cancellationPolicy.summary}
            </p>
          </section>

          {/* 3. Directions on your phone (QR Code) */}
          {/* Strictly only shown for CONFIRMED bookings with exact coordinates in stayDetails */}
          {status === "CONFIRMED" && stay.coordinates && (
            <DirectionsQR
              coordinates={stay.coordinates}
              propertyName={propertyName}
            />
          )}

          {/* 4. Support Card */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800/60 p-4 bg-gray-50/50 dark:bg-gray-900/30 text-xs text-gray-500 space-y-1.5 print:hidden">
            <p className="font-medium text-gray-700 dark:text-gray-300">
              Need assistance with this reservation?
            </p>
            <p>
              Contact customer support at{" "}
              <a
                href={`mailto:${BUSINESS_CONFIG.supportEmail}`}
                className="text-gray-900 dark:text-gray-100 underline"
              >
                {BUSINESS_CONFIG.supportEmail}
              </a>{" "}
              or call{" "}
              <a
                href={`tel:${BUSINESS_CONFIG.supportPhone}`}
                className="text-gray-900 dark:text-gray-100 underline"
              >
                {BUSINESS_CONFIG.supportPhone}
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showReceiptModal && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          booking={booking}
          user={user}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          booking={{ ...booking, _id: booking.id }}
          room={rooms?.find((r) => r._id === booking.roomCategoryId) || null}
          onClose={() => setShowPaymentModal(false)}
          onViewReceipt={() => {
            setShowPaymentModal(false);
            setShowReceiptModal(true);
          }}
        />
      )}
    </div>
  );
};

export default BookingDetails;
