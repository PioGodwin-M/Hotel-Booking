import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useClerk } from "@clerk/clerk-react";
import {
  Star,
  MapPin,
  Heart,
  Share2,
  Calendar,
  Users,
  ShieldCheck,
  CheckCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Check,
  Info,
  Map,
  Maximize2,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import toast from "react-hot-toast";
import { assets, facilityIcons } from "../assets/assets";
import { useAppContext } from "../context/AppContext";
import { useWishlist } from "../context/WishlistContext";
import { authApi, publicApi } from "../lib/apiClient";
import { getStripe } from "../lib/stripeClient";
import PaymentModal from "../components/PaymentModal";
import { findMatchingActiveHold } from "../lib/bookingStatus";
import {
  MOCK_REVIEWS,
  MOCK_RATINGS_BREAKDOWN,
  MOCK_HOST_PROFILES,
  SHOW_SAMPLE_DATA_LABELS,
} from "../data/mock";
import { BRAND_NAME, HOLD_DURATION_TEXT } from "../config/brand";
import { formatINR } from "../lib/formatters";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { DateRangePicker, GuestsStepper, SafeImage } from "../components/ui";
import { usePageTitle } from "../hooks/usePageTitle";
import { cn } from "../lib/utils";

export const RoomDetails = () => {
  const { id } = useParams();
  const { rooms, navigate, user } = useAppContext();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { openSignIn } = useClerk();
  const shouldReduceMotion = useReducedMotion();

  // Date helpers
  const toLocalDateString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const minCheckIn = toLocalDateString(tomorrow);


  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [guests, setGuests] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [activeBooking, setActiveBooking] = useState(null);
  const [reserveError, setReserveError] = useState(null);

  // Pre-load Stripe SDK on mount for instant payment form readiness
  useEffect(() => {
    getStripe().catch(() => {});
  }, []);

  // Lightbox modal state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [userBookings, setUserBookings] = useState([]);

  // Fetch customer bookings to detect existing active holds
  useEffect(() => {
    if (!user) {
      setUserBookings([]);
      return;
    }
    let isCurrent = true;
    authApi
      .get("/api/bookings/?page=1&limit=50")
      .then((res) => {
        if (isCurrent && res.data?.success) {
          setUserBookings(res.data.bookings || []);
        }
      })
      .catch(() => {});
    return () => {
      isCurrent = false;
    };
  }, [user]);

  // Match existing active unexpired hold for this hotel, room category, and selected dates
  const matchingActiveHold = useMemo(() => {
    if (!user || !room?._id || !checkInDate || !checkOutDate) return null;
    const hotelId = room?.hotel?._id || room?.hotel;
    return findMatchingActiveHold(userBookings, {
      hotelId,
      roomCategoryId: room._id,
      checkInDate,
      checkOutDate,
    });
  }, [user, userBookings, room, checkInDate, checkOutDate]);

  const pageTitle = room?.hotel?.name
    ? `${room.hotel.name} – ${room.roomType || "Stay"}`
    : "Stay Details";
  usePageTitle(
    pageTitle,
    "Explore rooms, view transparent pricing, and reserve your stay."
  );

  // Fetch room data
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);

    if (Array.isArray(rooms) && rooms.length > 0) {
      const found = rooms.find((r) => r._id === id);
      if (found) {
        setRoom(found);
        setLoading(false);
        return;
      }
    }

    // Dynamic resolution for sample stays when VITE_USE_SAMPLE_DATA=true in dev
    if (
      id?.startsWith("sample-") &&
      import.meta.env.DEV &&
      import.meta.env.VITE_USE_SAMPLE_DATA === "true"
    ) {
      import("../data/sampleStays")
        .then((mod) => {
          if (!isMounted) return;
          const found = mod.SAMPLE_STAYS.find((r) => r._id === id);
          if (found) {
            setRoom(found);
          } else {
            setError(true);
          }
          setLoading(false);
        })
        .catch(() => {
          if (isMounted) {
            setError(true);
            setLoading(false);
          }
        });
      return;
    }

    if (id) {
      publicApi
        .get(`/api/rooms/${id}`)
        .then((res) => {
          if (isMounted) {
            if (res.data?.room) {
              setRoom(res.data.room);
            } else {
              setError(true);
            }
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setError(true);
            setLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [rooms, id]);


  // Calculate nights
  const numberOfNights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    const start = new Date(`${checkInDate}T00:00:00.000Z`);
    const end = new Date(`${checkOutDate}T00:00:00.000Z`);
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [checkInDate, checkOutDate]);

  const pricePerNight = Number(room?.pricePerNight) || 0;
  // Exact match to backend calculation: pricePerNight * numberOfNights
  const totalPrice = numberOfNights > 0 ? pricePerNight * numberOfNights : pricePerNight;

  const roomImages = useMemo(() => {
    if (Array.isArray(room?.images) && room.images.length > 0) {
      return room.images;
    }
    return [assets.roomImg1, assets.roomImg2, assets.roomImg3, assets.roomImg4];
  }, [room]);

  // Gallery Click-to-Swap:
  // displayOrder stores the current permutation of image indices.
  // displayOrder[0] is always the MAIN image.
  // displayOrder[1..] are the other photos shown in the thumbnail slots.
  const [displayOrder, setDisplayOrder] = useState(() =>
    Array.from({ length: roomImages.length }, (_, i) => i)
  );

  useEffect(() => {
    setDisplayOrder(Array.from({ length: roomImages.length }, (_, i) => i));
  }, [room?._id, roomImages.length]);

  const handleSwap = (thumbSlotIndex) => {
    setDisplayOrder((prev) => {
      if (thumbSlotIndex <= 0 || thumbSlotIndex >= prev.length) return prev;
      const next = [...prev];
      const prevMain = next[0];
      next[0] = next[thumbSlotIndex];
      next[thumbSlotIndex] = prevMain;
      return next;
    });
  };

  const currentMainOriginalIndex = displayOrder[0] ?? 0;
  const currentMainImg = roomImages[currentMainOriginalIndex] || roomImages[0];

  const lightboxTriggerRef = useRef(null);
  const lightboxContainerRef = useRef(null);

  const openLightbox = (indexToOpen = 0, triggerEl = null) => {
    lightboxTriggerRef.current = triggerEl || document.activeElement;
    setLightboxIndex(indexToOpen);
    setLightboxOpen(true);
  };

  // Mobile swipe handlers for main image
  const [touchStart, setTouchStart] = useState(null);
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (diff > 50 && roomImages.length > 1) {
      handleSwap(1);
    } else if (diff < -50 && roomImages.length > 1) {
      handleSwap(Math.min(roomImages.length - 1, 4));
    }
    setTouchStart(null);
  };

  // Lightbox swipe handlers
  const [lbTouchStart, setLbTouchStart] = useState(null);
  const handleLbTouchStart = (e) => {
    setLbTouchStart(e.targetTouches[0].clientX);
  };
  const handleLbTouchEnd = (e) => {
    if (lbTouchStart === null) return;
    const diff = lbTouchStart - e.changedTouches[0].clientX;
    if (diff > 50) {
      setLightboxIndex((prev) => (prev + 1) % roomImages.length);
    } else if (diff < -50) {
      setLightboxIndex((prev) => (prev - 1 + roomImages.length) % roomImages.length);
    }
    setLbTouchStart(null);
  };

  // Lightbox keyboard controls, focus trap, and scroll lock
  useEffect(() => {
    if (!lightboxOpen) {
      if (lightboxTriggerRef.current && typeof lightboxTriggerRef.current.focus === "function") {
        lightboxTriggerRef.current.focus();
      }
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus close button initially
    const closeBtn = document.querySelector("[data-lightbox-close]");
    if (closeBtn) closeBtn.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setLightboxOpen(false);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev - 1 + roomImages.length) % roomImages.length);
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev + 1) % roomImages.length);
      } else if (e.key === "Tab") {
        const modal = lightboxContainerRef.current;
        if (!modal) return;
        const focusables = modal.querySelectorAll("button:not([disabled])");
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxOpen, roomImages.length]);

  // Reservation submit handler
  const handleReserve = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (submitting) return;

    if (isSampleStay) {
      toast.error("Sample stay. Booking is turned off.");
      return;
    }

    if (!user) {
      toast.error("Please sign in to complete your booking");
      if (openSignIn) openSignIn();
      return;
    }

    if (!checkInDate || !checkOutDate) {
      toast.error("Please select check-in and check-out dates");
      return;
    }

    if (checkInDate >= checkOutDate) {
      toast.error("Check-out date must be after check-in date");
      return;
    }

    const hotelId = room?.hotel?._id || room?.hotel;
    if (!hotelId) {
      toast.error("Hotel information is missing for this property");
      return;
    }

    // If an active unexpired hold already exists for this stay and dates, open checkout directly without creating a second hold
    if (matchingActiveHold) {
      setActiveBooking(matchingActiveHold);
      return;
    }

    setSubmitting(true);
    setReserveError(null);

    // 15s safety timeout to prevent stuck spinner if network drops
    const watchdogTimer = setTimeout(() => {
      setSubmitting(false);
      setReserveError({
        message: "Reservation request timed out. Please try again.",
        isUnavailable: false,
      });
    }, 15000);

    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `book_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const payload = {
        hotelId,
        roomCategoryId: room._id,
        checkIn: new Date(`${checkInDate}T00:00:00.000Z`).toISOString(),
        checkOut: new Date(`${checkOutDate}T00:00:00.000Z`).toISOString(),
        numberOfRooms: 1,
        numberOfGuests: Number(guests) || 1,
        idempotencyKey,
      };

      const { data } = await authApi.post("/api/bookings/", payload);
      clearTimeout(watchdogTimer);

      if (data.success && data.booking) {
        setUserBookings((prev) => [data.booking, ...prev]);
        // Open checkout modal immediately over Room Details (Section 1)
        setActiveBooking(data.booking);
        setReserveError(null);
      } else {
        const msg = data.message || "Booking could not be created";
        const isUnavailable = /unavailable|taken|sold out|inventory|no room/i.test(msg);
        setReserveError({ message: msg, isUnavailable });
        toast.error(msg);
      }
    } catch (err) {
      clearTimeout(watchdogTimer);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Could not hold room. Please try different dates.";
      const isUnavailable =
        err.response?.status === 409 ||
        /unavailable|taken|sold out|inventory|no room/i.test(msg);
      setReserveError({ message: msg, isUnavailable });
      toast.error(msg);
    } finally {
      clearTimeout(watchdogTimer);
      setSubmitting(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: room?.hotel?.name || "Hotel Stay",
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    }
  };

  // Loading View
  if (loading) {
    return (
      <div className="pt-28 md:pt-36 pb-24 page-container space-y-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[420px]">
          <Skeleton className="md:col-span-2 h-full rounded-xl" />
          <Skeleton className="h-full rounded-xl" />
          <Skeleton className="h-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Not Found View
  if (error || !room) {
    return (
      <div className="pt-36 pb-24 px-4 text-center max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 flex items-center justify-center mx-auto mb-4">
          <Info className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Stay not found
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          The property or room you are looking for may have been removed or is temporarily unavailable.
        </p>
        <Link to="/rooms" className="inline-block mt-6">
          <Button variant="primary" size="md">
            Browse all stays
          </Button>
        </Link>
      </div>
    );
  }

  const rawHotelName = room.hotel?.name || "Hotel";
  const isSampleStay = Boolean(
    SHOW_SAMPLE_DATA_LABELS && (
      room?.isSample ||
      (typeof room?._id === "string" && room._id.startsWith("sample-")) ||
      /^\[sample\]/i.test(rawHotelName)
    )
  );
  // Strip [Sample] prefix so stay name gets full width
  const hotelName = rawHotelName.replace(/^\[Sample\]\s*/i, "").trim();
  const hotelAddress = room.hotel?.address || room.hotel?.city || "Location not specified";
  const roomType = room.roomType || "Standard Room";
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];
  const wishlisted = isWishlisted(room._id);
  const host = MOCK_HOST_PROFILES.default;
  const hasHostMetrics = Boolean(host?.yearsHosting || host?.responseTime);
  const ratingBreakdown = MOCK_RATINGS_BREAKDOWN;
  const reviews = MOCK_REVIEWS;

  const renderThumbButton = (slotIndex, className = "", moreCount = 0) => {
    const originalIndex = displayOrder[slotIndex];
    if (originalIndex === undefined || !roomImages[originalIndex]) return null;
    const imgUrl = roomImages[originalIndex];

    return (
      <button
        type="button"
        key={`${slotIndex}-${imgUrl}`}
        onClick={(e) => {
          if (moreCount > 0 && e.target.closest("[data-open-all]")) {
            openLightbox(0, e.currentTarget);
          } else {
            handleSwap(slotIndex);
          }
        }}
        aria-label={`Show photo ${originalIndex + 1} of ${roomImages.length}`}
        aria-current={currentMainOriginalIndex === originalIndex ? "true" : undefined}
        className={cn(
          "relative rounded-xl overflow-hidden bg-stone-100 dark:bg-white/5 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white focus-visible:ring-offset-2 hover:brightness-95 group",
          className
        )}
      >
        <SafeImage
          src={imgUrl}
          alt={`${hotelName} photo ${originalIndex + 1}`}
          fallbackLabel={hotelName}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {moreCount > 0 && (
          <div
            data-open-all="true"
            onClick={(e) => {
              e.stopPropagation();
              openLightbox(0, e.currentTarget);
            }}
            className="absolute inset-0 bg-black/60 hover:bg-black/70 transition-colors flex flex-col items-center justify-center text-white p-2 text-center"
          >
            <span className="text-base sm:text-lg font-bold">+{moreCount} more</span>
            <span className="text-[11px] font-medium opacity-90 mt-0.5">View all photos</span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="pt-24 md:pt-32 pb-28 page-container">
      {/* Back Link & Action Bar */}
      <div className="flex items-center justify-between pb-4">
        <Link
          to="/rooms"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All stays</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share property"
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => toggleWishlist(room)}
            aria-label={wishlisted ? "Remove from saved stays" : "Save to wishlist"}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
          >
            <Heart
              className={cn(
                "w-4 h-4 transition-colors",
                wishlisted ? "fill-rose-500 text-rose-500" : "text-current"
              )}
            />
          </button>
        </div>
      </div>

      {/* Title & Location Header */}
      <div className="pb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="neutral" size="sm">
            {roomType}
          </Badge>
          <span className="text-gray-300 dark:text-gray-700">&middot;</span>
          <div className="flex items-center gap-1 text-sm font-medium text-gray-800 dark:text-gray-200">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>{ratingBreakdown.overall}</span>
            <span className="text-gray-500 dark:text-gray-400 font-normal">
              ({ratingBreakdown.totalReviews} reviews)
            </span>
            {SHOW_SAMPLE_DATA_LABELS && (
              <Badge variant="neutral" size="sm" className="ml-1">
                Sample reviews
              </Badge>
            )}
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          {hotelName}
        </h1>

        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 mt-2">
          <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
          <span>{hotelAddress}</span>
        </div>
      </div>

      {/* Gallery Section: Main Image + 4-Thumbnail Grid with Click-to-Swap */}
      <div className="relative mb-10">
        {/* Desktop Gallery (>= 1024px): 65% Main + 35% Thumbnails */}
        <div className="hidden lg:flex gap-3 h-[440px] w-full">
          {/* Main Image (about 65% width) */}
          <div
            className={cn(
              "relative h-full rounded-xl overflow-hidden bg-stone-100 dark:bg-white/5 group select-none",
              roomImages.length > 1 ? "w-[65%]" : "w-full"
            )}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => openLightbox(currentMainOriginalIndex, e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openLightbox(currentMainOriginalIndex, e.currentTarget);
                }
              }}
              aria-label={`Enlarge photo ${currentMainOriginalIndex + 1} of ${roomImages.length}`}
              className="w-full h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white rounded-xl overflow-hidden"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMainImg}
                  initial={shouldReduceMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full"
                >
                  <SafeImage
                    src={currentMainImg}
                    alt={`${hotelName} - Main photo`}
                    fallbackLabel={hotelName}
                    loading="eager"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </motion.div>
              </AnimatePresence>

              {/* Small Enlarge button in corner */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openLightbox(currentMainOriginalIndex, e.currentTarget);
                }}
                aria-label="Enlarge photo"
                className="absolute bottom-3 right-3 z-10 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-medium backdrop-blur-sm flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Enlarge</span>
              </button>
            </div>
          </div>

          {/* Right Column Thumbnails (about 35% width) - 0 empty cells */}
          {roomImages.length > 1 && (
            <div className="w-[35%] h-full flex flex-col">
              {roomImages.length === 2 ? (
                <div className="w-full h-full">
                  {renderThumbButton(1, "w-full h-full")}
                </div>
              ) : roomImages.length === 3 ? (
                <div className="grid grid-rows-2 gap-3 w-full h-full">
                  {renderThumbButton(1, "w-full h-full")}
                  {renderThumbButton(2, "w-full h-full")}
                </div>
              ) : roomImages.length === 4 ? (
                <div className="grid grid-rows-2 gap-3 w-full h-full">
                  <div className="w-full h-full">
                    {renderThumbButton(1, "w-full h-full")}
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full h-full">
                    {renderThumbButton(2, "w-full h-full")}
                    {renderThumbButton(3, "w-full h-full")}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 grid-rows-2 gap-3 w-full h-full">
                  {renderThumbButton(1, "w-full h-full")}
                  {renderThumbButton(2, "w-full h-full")}
                  {renderThumbButton(3, "w-full h-full")}
                  {renderThumbButton(4, "w-full h-full", roomImages.length > 5 ? roomImages.length - 5 : 0)}
                </div>
              )}
            </div>
          )}

          {/* View All Photos Button */}
          <button
            type="button"
            onClick={(e) => openLightbox(0, e.currentTarget)}
            className="absolute bottom-4 right-4 z-10 px-3.5 py-1.5 rounded-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm text-gray-900 dark:text-gray-100 text-xs font-semibold shadow-xs border border-gray-200/80 dark:border-gray-700 hover:bg-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white"
          >
            View all {roomImages.length} photos
          </button>
        </div>

        {/* Mobile Gallery (< 1024px) */}
        <div className="lg:hidden flex flex-col w-full">
          {/* Main Image with Swipe */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => openLightbox(currentMainOriginalIndex, e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openLightbox(currentMainOriginalIndex, e.currentTarget);
              }
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            aria-label={`Enlarge photo ${currentMainOriginalIndex + 1} of ${roomImages.length}`}
            className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-xl overflow-hidden bg-stone-100 dark:bg-white/5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white select-none"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMainImg}
                initial={shouldReduceMotion ? undefined : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full"
              >
                <SafeImage
                  src={currentMainImg}
                  alt={`${hotelName} - Main photo`}
                  fallbackLabel={hotelName}
                  loading="eager"
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </AnimatePresence>

            {/* Counter badge */}
            <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm tabular-nums">
              {currentMainOriginalIndex + 1} / {roomImages.length}
            </div>

            {/* Tap to enlarge helper */}
            <div className="absolute bottom-3 right-3 z-10 px-2.5 py-1 rounded-lg bg-black/60 text-white text-xs font-medium backdrop-blur-sm flex items-center gap-1">
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Tap to enlarge</span>
            </div>
          </div>

          {/* Row of thumbnails below (tap to swap; scrolls if more than 4) */}
          {roomImages.length > 1 && (
            <div className="mt-3 flex gap-2.5 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {displayOrder.slice(1).map((originalIdx, slotMinusOne) => {
                const slotIdx = slotMinusOne + 1;
                const imgUrl = roomImages[originalIdx];
                return (
                  <button
                    type="button"
                    key={`${slotIdx}-${imgUrl}`}
                    onClick={() => handleSwap(slotIdx)}
                    aria-label={`Show photo ${originalIdx + 1} of ${roomImages.length}`}
                    aria-current={currentMainOriginalIndex === originalIdx ? "true" : undefined}
                    className="relative w-20 h-14 sm:w-24 sm:h-16 shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] dark:focus-visible:ring-white hover:brightness-95"
                  >
                    <SafeImage
                      src={imgUrl}
                      alt={`${hotelName} thumbnail ${originalIdx + 1}`}
                      fallbackLabel={hotelName}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content & Sticky Reservation Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12 items-start">
        {/* Left 2 Cols: Stay Information */}
        <div className="lg:col-span-2 space-y-10">
          {/* Host Profile Card */}
          <div className="p-6 rounded-xl bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Hosted by {host.name}
                </h2>
                {host.isSuperhost && (
                  <Badge variant="gold" size="sm">
                    Superhost
                  </Badge>
                )}
                {SHOW_SAMPLE_DATA_LABELS && (
                  <Badge variant="neutral" size="sm">
                    Sample host
                  </Badge>
                )}
              </div>
              {hasHostMetrics && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {host.role && <span>{host.role} &middot; </span>}
                  {host.yearsHosting && <span>{host.yearsHosting} years hosting &middot; </span>}
                  {host.responseTime && <span>Typical response: {host.responseTime}</span>}
                </p>
              )}
              {host.bio && (
                <p className="text-sm text-gray-700 dark:text-gray-300 pt-2 leading-relaxed">
                  {host.bio}
                </p>
              )}
            </div>
            {host.avatar ? (
              <img
                src={host.avatar}
                alt={host.name}
                className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-gray-700 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold flex items-center justify-center shrink-0 text-sm">
                {host.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* Highlights */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Stay highlights
              </h2>
              {SHOW_SAMPLE_DATA_LABELS && (
                <Badge variant="neutral" size="sm">
                  Sample
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/80 dark:border-white/5 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Prime location
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Close to key attractions, restaurants, and local transport options.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/80 dark:border-white/5 flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Flexible check-in
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Front desk is available 24 hours to assist with arrivals and luggage.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Amenities
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {amenities.map((amenity, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 flex items-center gap-2.5"
                >
                  {facilityIcons[amenity] ? (
                    <img
                      src={facilityIcons[amenity]}
                      alt=""
                      className="w-4 h-4 opacity-75 dark:invert shrink-0"
                    />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                    {amenity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Guest Reviews & Rating Breakdown */}
          <div className="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {ratingBreakdown.overall} &middot; {ratingBreakdown.totalReviews} guest reviews
                </h2>
              </div>
              {SHOW_SAMPLE_DATA_LABELS && (
                <Badge variant="neutral" size="sm" className="text-xs font-normal">
                  Sample reviews
                </Badge>
              )}
            </div>

            {/* Category breakdown bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
              {ratingBreakdown.categories.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      {cat.name}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                      {cat.score}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${(cat.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Individual Reviews */}
            <div className="space-y-4">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 rounded-xl bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {rev.avatar ? (
                        <img
                          src={rev.avatar}
                          alt={rev.author}
                          className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 font-semibold text-xs text-gray-700 dark:text-gray-300 flex items-center justify-center">
                          {rev.author.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {rev.author}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {rev.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {rev.headline}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    "{rev.comment}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Sticky Desktop Reservation Card */}
        <aside className="hidden lg:block lg:col-span-1 sticky top-28 self-start w-full">
          <div className="p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-5">
            {/* Price Header */}
            <div className="flex items-baseline justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 tabular-nums">
                  {formatINR(pricePerNight)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  / night
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isSampleStay && (
                  <Badge variant="neutral" size="sm">
                    Sample stay
                  </Badge>
                )}
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{ratingBreakdown.overall}</span>
                </div>
              </div>
            </div>

            {/* Date and Guests Box */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-stone-50/50 dark:bg-white/5 p-3 space-y-3">
              <div>
                <p className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Dates
                </p>
                <DateRangePicker
                  startDate={checkInDate}
                  endDate={checkOutDate}
                  minDate={minCheckIn}
                  onChange={({ startDate, endDate }) => {
                    setCheckInDate(startDate);
                    setCheckOutDate(endDate);
                  }}
                  compact={true}
                />
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Guests
                </p>
                <GuestsStepper
                  value={guests}
                  onChange={setGuests}
                  min={1}
                  max={6}
                />
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>
                  {formatINR(pricePerNight)} &times; {numberOfNights || 1}{" "}
                  {(numberOfNights || 1) === 1 ? "night" : "nights"}
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  {formatINR(totalPrice)}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Taxes & fees</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Included</span>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-gray-100">
                <span>Total amount</span>
                <span className="text-xl font-bold tabular-nums">
                  {formatINR(totalPrice)}
                </span>
              </div>
            </div>

            {/* Reserve CTA */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleReserve}
              onMouseEnter={() => {
                getStripe().catch(() => {});
              }}
              disabled={isSampleStay}
              isLoading={submitting}
              loadingText="Holding room..."
              className="w-full font-semibold shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSampleStay
                ? "Sample stay. Booking is turned off."
                : matchingActiveHold
                ? "Continue to payment"
                : "Reserve"}
            </Button>

            {/* Inline reservation error feedback (Section 1) */}
            {reserveError && (
              <div
                role="alert"
                className="p-3.5 rounded-[10px] bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-xs text-rose-800 dark:text-rose-200 space-y-2.5"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{reserveError.message}</p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleReserve}
                    className="px-3 py-1.5 rounded-[10px] bg-[#0B1220] text-white text-xs font-medium hover:bg-black transition-colors cursor-pointer"
                  >
                    Try again
                  </button>
                  {reserveError.isUnavailable && (
                    <button
                      type="button"
                      onClick={() => {
                        setCheckInDate("");
                        setCheckOutDate("");
                        setReserveError(null);
                      }}
                      className="px-3 py-1.5 rounded-[10px] border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      Choose other dates
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-center text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1.5 leading-normal">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Pay within {HOLD_DURATION_TEXT} to confirm. Free cancellation before payment.</span>
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-4 px-6 flex items-center justify-between shadow-lg">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {formatINR(totalPrice)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {numberOfNights > 0
                ? `(${numberOfNights} ${numberOfNights === 1 ? "night" : "nights"})`
                : "/ night"}
            </span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Taxes included</p>
        </div>

        <Button
          variant="primary"
          size="md"
          disabled={isSampleStay}
          onClick={handleReserve}
          onMouseEnter={() => {
            getStripe().catch(() => {});
          }}
          isLoading={submitting}
          className="h-11 min-h-[44px] px-6 text-base font-semibold"
        >
          {isSampleStay
            ? "Booking turned off"
            : matchingActiveHold
            ? "Continue to payment"
            : "Reserve"}
        </Button>
      </div>

      {/* Checkout Payment Modal (Direct Checkout Flow, Section 1) */}
      {activeBooking && (
        <PaymentModal
          booking={activeBooking}
          room={room}
          onClose={() => {
            setActiveBooking(null);
            if (user) {
              authApi
                .get("/api/bookings/?page=1&limit=50")
                .then((res) => {
                  if (res.data?.success) setUserBookings(res.data.bookings || []);
                })
                .catch(() => {});
            }
          }}
          onViewReceipt={(b) => {
            setActiveBooking(null);
            navigate("/my-bookings", { state: { viewReceiptBookingId: b?._id } });
          }}
        />
      )}

      {/* Full-Screen Lightbox Modal */}
      <AnimatePresence>
        {lightboxOpen && (
          <div
            ref={lightboxContainerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Photo gallery lightbox"
            onTouchStart={handleLbTouchStart}
            onTouchEnd={handleLbTouchEnd}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 select-none"
          >
            {/* Close Button */}
            <button
              data-lightbox-close="true"
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-6 right-6 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close lightbox"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Counter */}
            <div className="absolute top-6 left-6 z-10 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-mono tabular-nums">
              {lightboxIndex + 1} / {roomImages.length}
            </div>

            {/* Left arrow */}
            <button
              type="button"
              onClick={() =>
                setLightboxIndex(
                  (prev) => (prev - 1 + roomImages.length) % roomImages.length
                )
              }
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Image */}
            <motion.img
              key={lightboxIndex}
              src={roomImages[lightboxIndex]}
              alt={`Photo ${lightboxIndex + 1} of ${roomImages.length}`}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = assets.roomImg1;
              }}
              initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
            />

            {/* Right arrow */}
            <button
              type="button"
              onClick={() =>
                setLightboxIndex((prev) => (prev + 1) % roomImages.length)
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RoomDetails;
