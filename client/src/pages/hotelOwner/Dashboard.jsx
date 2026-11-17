import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  TrendingUp,
  Building2,
  BedDouble,
  CalendarCheck,
  CreditCard,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useAppContext } from "../../context/AppContext";
import { useOwnerContext } from "../../context/OwnerContext";
import { authApi } from "../../lib/apiClient";
import { Button } from "../../components/ui/Button";
import { StatusText } from "../../components/ui/StatusText";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { usePageTitle } from "../../hooks/usePageTitle";
import { formatINR } from "../../lib/formatters";
import { showErrorToast } from "../../lib/toast";

// Animated Count-Up component with prefers-reduced-motion support
const CountUp = ({ target = 0, isMoney = false }) => {
  const shouldReduceMotion = useReducedMotion();
  const [val, setVal] = useState(shouldReduceMotion ? target : 0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setVal(target);
      return;
    }

    let start = 0;
    const end = Number(target) || 0;
    const duration = 600;
    const steps = 24;
    const stepTime = duration / steps;
    const increment = end / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setVal(end);
        clearInterval(timer);
      } else {
        setVal(Math.round(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [target, shouldReduceMotion]);

  if (isMoney) {
    return <span>{formatINR(val)}</span>;
  }

  return <span>{Number(val).toLocaleString()}</span>;
};

// Hand-Built Lightweight SVG Revenue Chart
const RevenueChart = ({ bookings = [] }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Group confirmed bookings by date (last 7 data points)
  const chartData = useMemo(() => {
    const map = {};
    bookings
      .filter((b) => b.status === "CONFIRMED")
      .forEach((b) => {
        const d = b.createdAt ? b.createdAt.split("T")[0] : "Recent";
        const amt = Number(b.priceSnapshot?.totalAmount) || Number(b.totalPrice) || 0;
        map[d] = (map[d] || 0) + amt;
      });

    const entries = Object.entries(map).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    return entries.slice(-7);
  }, [bookings]);

  if (chartData.length === 0) {
    return (
      <div className="h-56 flex flex-col items-center justify-center p-6 text-center rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-800">
        <TrendingUp className="w-8 h-8 text-gray-400 mb-2" />
        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
          No confirmed revenue yet
        </p>
        <p className="text-xs text-gray-500 max-w-xs mt-1">
          Revenue trends will appear here as guests complete payments for their bookings.
        </p>
      </div>
    );
  }

  // SVG coordinates calculation
  const width = 640;
  const height = 220;
  const padding = 35;
  const maxVal = Math.max(...chartData.map((d) => d[1]), 1000);

  const points = chartData.map((d, i) => {
    const x = padding + (i / Math.max(chartData.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - (d[1] / maxVal) * (height - 2 * padding);
    return { x, y, date: d[0], amount: d[1] };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
      >
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B1220" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0B1220" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Baseline grid */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="1"
        />

        {/* Area fill */}
        <path d={areaD} fill="url(#revenueGradient)" />

        {/* Line stroke */}
        <path
          d={pathD}
          fill="none"
          stroke="#0B1220"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:stroke-gray-300"
        />

        {/* Points & Interactive circles */}
        {points.map((pt, i) => (
          <g key={i}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r="4"
              fill="#0B1220"
              className="dark:fill-gray-200 transition-transform duration-150 hover:scale-150 cursor-pointer"
              onMouseEnter={() => setHoveredPoint(pt)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
            {/* Date label */}
            <text
              x={pt.x}
              y={height - 12}
              textAnchor="middle"
              className="text-[10px] fill-current opacity-40 font-mono"
            >
              {pt.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>

      {/* Floating Tooltip */}
      {hoveredPoint && (
        <div
          className="absolute z-10 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full border border-gray-700"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100 - 8}%`,
          }}
        >
          <p className="text-[10px] text-gray-400 font-mono">{hoveredPoint.date}</p>
          <p className="text-white font-bold tabular-nums">
            {formatINR(hoveredPoint.amount)}
          </p>
        </div>
      )}
    </div>
  );
};

export const Dashboard = () => {
  usePageTitle(
    "Owner Dashboard",
    "Monitor bookings, revenue, and room categories across your properties."
  );
  const { user } = useAppContext();
  const { hotels, selectedHotelId } = useOwnerContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allBookings, setAllBookings] = useState([]);
  const [roomsCount, setRoomsCount] = useState(0);

  // Sorting for recent reservations
  const [sortField, setSortField] = useState("createdAt");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch room count across all owner's real hotels
      let totalRooms = 0;
      for (const hotel of hotels) {
        try {
          const res = await authApi.get(`/api/rooms/hotel/${hotel._id}`);
          totalRooms += (res.data?.rooms || []).length;
        } catch {
          // ignore
        }
      }
      setRoomsCount(totalRooms);

      // 2. Fetch owner bookings from Booking Service
      const dashRes = await authApi.get("/api/bookings/owner");
      if (dashRes.data?.success) {
        setAllBookings(dashRes.data.bookings || []);
      }
    } catch {
      const msg = "We couldn't load your dashboard data. Please try again.";
      setError(msg);
      showErrorToast(msg, {
        id: "dashboard-load-error",
        onRetry: () => fetchMetrics(),
      });
    } finally {
      setLoading(false);
    }
  }, [hotels]);

  // 10s timeout watchdog to replace perpetual skeleton with inline error
  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => {
        setLoading(false);
        setError("Request timed out. We couldn't load your dashboard data.");
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (user && hotels.length >= 0) {
      fetchMetrics();
    }
  }, [user, hotels, fetchMetrics]);

  // Filter bookings by selected property, strictly excluding any sample stays
  const filteredBookings = useMemo(() => {
    const nonSample = allBookings.filter((b) => {
      const hName = b.hotelName || b.hotel?.name || "";
      return !hName.startsWith("[Sample]") && !hName.toLowerCase().includes("sample");
    });
    if (selectedHotelId === "ALL") {
      return nonSample;
    }
    return nonSample.filter((b) => (b.hotelId || b.hotel?._id) === selectedHotelId);
  }, [allBookings, selectedHotelId]);

  /**
   * FORMULA DEFINITION:
   * "Confirmed Revenue" = sum of priceSnapshot.totalAmount for bookings strictly in 'CONFIRMED' status.
   * Bookings in 'HELD', 'PAYMENT_PENDING', 'CANCELLED', 'EXPIRED', or 'PAYMENT_FAILED' are excluded.
   */
  const confirmedRevenue = useMemo(() => {
    return filteredBookings
      .filter((b) => b.status === "CONFIRMED")
      .reduce((sum, b) => {
        const amount = Number(b.priceSnapshot?.totalAmount) || Number(b.totalPrice) || 0;
        return sum + amount;
      }, 0);
  }, [filteredBookings]);

  const totalBookingsCount = filteredBookings.length;
  const activeHoldsCount = filteredBookings.filter((b) => b.status === "HELD").length;

  // Sorted reservations
  const sortedBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "amount") {
        valA = Number(a.priceSnapshot?.totalAmount) || Number(b.totalPrice) || 0;
        valB = Number(b.priceSnapshot?.totalAmount) || Number(b.totalPrice) || 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredBookings, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const selectedHotelObj = hotels.find((h) => h._id === selectedHotelId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Title & Filter Recap Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Owner Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {selectedHotelId === "ALL"
              ? `Aggregated metrics across all ${hotels.length} registered properties.`
              : `Showing performance for ${selectedHotelObj?.name || "selected property"}.`}
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-6 text-center space-y-3"
        >
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <div>
            <h3 className="font-bold text-sm text-[#0b1220] dark:text-[#faf8f5]">Could not load dashboard data</h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => fetchMetrics()}>
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Confirmed Revenue Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Confirmed revenue
              </span>
              <CreditCard className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 tabular-nums">
              <CountUp target={confirmedRevenue} isMoney />
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Sum of paid & confirmed stays
            </p>
          </div>

          {/* Total Bookings Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Total bookings
              </span>
              <CalendarCheck className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 tabular-nums">
              <CountUp target={totalBookingsCount} />
            </div>
            <p className="text-[11px] text-gray-500">
              {activeHoldsCount} active holds in progress
            </p>
          </div>

          {/* Active Rooms Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Room categories
              </span>
              <BedDouble className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 tabular-nums">
              <CountUp target={roomsCount} />
            </div>
            <p className="text-[11px] text-gray-500">
              Active listings in catalog
            </p>
          </div>

          {/* Registered Properties Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Properties
              </span>
              <Building2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 tabular-nums">
              <CountUp target={hotels.length} />
            </div>
            <p className="text-[11px] text-gray-500">
              Active hotel properties
            </p>
          </div>
        </div>
      )}

      {/* Lightweight SVG Revenue Progression Chart */}
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Revenue progression
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Confirmed booking revenue over time
          </p>
        </div>

        <RevenueChart bookings={filteredBookings} />
      </div>

      {/* Recent Bookings Table Section */}
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Recent bookings
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Latest reservation holds and confirmed stays
            </p>
          </div>

          <span className="text-xs font-mono text-gray-500">
            {sortedBookings.length} total records
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : sortedBookings.length === 0 ? (
          <EmptyState
            title="No bookings recorded"
            description="When guests book rooms in your properties, their reservations will appear here."
            className="my-4 border-0 shadow-none bg-transparent"
          />
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] font-semibold text-gray-500">
                    <th className="py-3 px-3">
                      <button
                        onClick={() => handleSort("createdAt")}
                        className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                      >
                        <span>Date</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-3">Booking ID & Property</th>
                    <th className="py-3 px-3">Dates & Guests</th>
                    <th className="py-3 px-3">
                      <button
                        onClick={() => handleSort("amount")}
                        className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                      >
                        <span>Amount</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleSort("status")}
                        className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white cursor-pointer ml-auto"
                      >
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sortedBookings.map((b) => {
                    const hotelName = b.hotel?.name || "Hotel";
                    const amount =
                      Number(b.priceSnapshot?.totalAmount) || Number(b.totalPrice) || 0;
                    const checkIn = b.checkIn || b.checkInDate;
                    const checkOut = b.checkOut || b.checkOutDate;
                    const guestCount = b.numberOfGuests || b.guests || 1;

                    return (
                      <tr
                        key={b._id}
                        className="hover:bg-gray-50/70 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-3 text-gray-500 font-mono text-[11px]">
                          {b.createdAt
                            ? new Date(b.createdAt).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {hotelName}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            ID: {b._id?.slice(-8).toUpperCase()}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400 text-[11px]">
                          <p>
                            {checkIn ? new Date(checkIn).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"} &rarr;{" "}
                            {checkOut ? new Date(checkOut).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {guestCount} {guestCount === 1 ? "guest" : "guests"}
                          </p>
                        </td>
                        <td className="py-3 px-3 font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                          {formatINR(amount)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <StatusText status={b.status}>
                            {b.status === "CONFIRMED"
                              ? "Confirmed"
                              : b.status === "HELD"
                              ? "Held"
                              : b.status === "PAYMENT_PENDING"
                              ? "Pending"
                              : b.status === "CANCELLED"
                              ? "Cancelled"
                              : "Expired"}
                          </StatusText>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className="md:hidden space-y-3">
              {sortedBookings.map((b) => {
                const hotelName = b.hotel?.name || "Hotel";
                const amount =
                  Number(b.priceSnapshot?.totalAmount) || Number(b.totalPrice) || 0;
                const checkIn = b.checkIn || b.checkInDate;
                const checkOut = b.checkOut || b.checkOutDate;

                return (
                  <div
                    key={b._id}
                    className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-800 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          {hotelName}
                        </p>
                        <p className="text-[10px] font-mono text-gray-400">
                          {b._id?.slice(-8).toUpperCase()}
                        </p>
                      </div>
                      <StatusText status={b.status}>
                        {b.status === "CONFIRMED"
                          ? "Confirmed"
                          : b.status === "HELD"
                          ? "Held"
                          : b.status === "CANCELLED"
                          ? "Cancelled"
                          : "Pending"}
                      </StatusText>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200 dark:border-gray-800">
                      <span className="text-gray-500 text-[11px]">
                        {checkIn ? new Date(checkIn).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"} &rarr;{" "}
                        {checkOut ? new Date(checkOut).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatINR(amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
