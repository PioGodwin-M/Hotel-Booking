import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BedDouble,
  Search,
  Building2,
  Trash2,
  AlertCircle,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import { assets } from "../../assets/assets";
import { useAppContext } from "../../context/AppContext";
import { useOwnerContext } from "../../context/OwnerContext";
import { authApi } from "../../lib/apiClient";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { SafeImage } from "../../components/ui/SafeImage";
import { usePageTitle } from "../../hooks/usePageTitle";
import { formatINR } from "../../lib/formatters";
import { showErrorToast } from "../../lib/toast";
import { cn } from "../../lib/utils";

export const ListRoom = () => {
  usePageTitle(
    "Room Inventory",
    "Control room availability, view pricing, and manage your room categories."
  );
  const { user, fetchRooms: refreshCatalogRooms } = useAppContext();
  const { hotels, selectedHotelId, selectHotel, isSampleMode } = useOwnerContext();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Delete dialog state
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  // Fetch all rooms owned by the user
  const fetchOwnerRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (hotels.length === 0) {
        setRooms([]);
        return;
      }

      const roomPromises = hotels.map(async (hotel) => {
        try {
          const res = await authApi.get(`/api/rooms/hotel/${hotel._id}`);
          const hotelRooms = res.data?.rooms || [];
          return hotelRooms.map((r) => ({
            ...r,
            hotelId: hotel._id,
            hotelName: hotel.name,
            hotelCity: hotel.city,
            hotelAddress: hotel.address,
          }));
        } catch {
          return [];
        }
      });

      const nested = await Promise.all(roomPromises);
      setRooms(nested.flat());
    } catch {
      const msg = "We couldn't load your room inventory. Please try again.";
      setError(msg);
      showErrorToast(msg, {
        id: "inventory-load-error",
        onRetry: () => fetchOwnerRooms(),
      });
    } finally {
      setLoading(false);
    }
  }, [hotels]);

  // 10s watchdog timeout to replace perpetual skeleton with inline error
  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => {
        setLoading(false);
        setError("Request timed out. We couldn't load your room inventory.");
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (user && hotels.length >= 0) {
      fetchOwnerRooms();
    }
  }, [user, hotels, fetchOwnerRooms]);

  // Filter rooms by selected property and search query
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (selectedHotelId !== "ALL" && r.hotelId !== selectedHotelId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchType = r.roomType?.toLowerCase().includes(q);
        const matchHotel = r.hotelName?.toLowerCase().includes(q);
        if (!matchType && !matchHotel) return false;
      }
      return true;
    });
  }, [rooms, selectedHotelId, searchQuery]);

  // Optimistic Availability Toggle via PATCH /api/rooms/:roomId/status
  const toggleAvailability = async (roomId, currentIsActive) => {
    if (isSampleMode) {
      toast.error("Sample mode is active. Availability updates are disabled.");
      return;
    }
    if (togglingId) return;
    setTogglingId(roomId);

    const nextIsActive = !currentIsActive;

    // 1. Optimistic update
    setRooms((prev) =>
      prev.map((r) => (r._id === roomId ? { ...r, isActive: nextIsActive } : r))
    );

    try {
      const { data } = await authApi.patch(`/api/rooms/${roomId}/status`, {
        isActive: nextIsActive,
      });

      if (data.success) {
        toast.success(
          data.message || (nextIsActive ? "Room listed in catalog" : "Room hidden from catalog")
        );
        if (refreshCatalogRooms) refreshCatalogRooms();
      } else {
        // Rollback
        setRooms((prev) =>
          prev.map((r) => (r._id === roomId ? { ...r, isActive: currentIsActive } : r))
        );
        toast.error(data.message || "Could not update room status");
      }
    } catch (err) {
      // Rollback
      setRooms((prev) =>
        prev.map((r) => (r._id === roomId ? { ...r, isActive: currentIsActive } : r))
      );
      toast.error(
        err.response?.data?.message || err.message || "Failed to update room availability"
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Room inventory
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Control room availability, view pricing, and manage your room categories.
          </p>
        </div>

        <Link to="/owner/add-room" className="self-start sm:self-auto">
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            className="font-semibold"
          >
            Add room
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by room type or hotel..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-900 dark:focus:border-white"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
        </div>

        {/* Property Selector */}
        {hotels.length > 0 && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
            <select
              value={selectedHotelId}
              onChange={(e) => selectHotel(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-900 dark:focus:border-white cursor-pointer"
            >
              <option value="ALL">All properties ({hotels.length})</option>
              {hotels.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Inventory Listing */}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-6 text-center space-y-3"
        >
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <div>
            <h3 className="font-bold text-sm text-[#0b1220] dark:text-[#faf8f5]">Could not load room inventory</h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => fetchOwnerRooms()}>
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <EmptyState
          title="No rooms found"
          description={
            rooms.length === 0
              ? "You haven't listed any rooms yet. Add your first room to begin receiving bookings."
              : "No rooms match your search. Try selecting another property or clearing your query."
          }
          actionLabel="Add room"
          onAction={() => window.location.assign("/owner/add-room")}
          className="my-10"
        />
      ) : (
        <>
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-hidden rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-[11px] font-semibold text-gray-500">
                  <th className="py-3 px-4">Room & Property</th>
                  <th className="py-3 px-4">Nightly rate</th>
                  <th className="py-3 px-4">Units</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Accepting bookings</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredRooms.map((room) => {
                  const roomImage = room.images?.[0] || assets.roomImg1;
                  const isActive = room.isActive !== false;

                  return (
                    <tr
                      key={room._id}
                      className="hover:bg-gray-50/70 dark:hover:bg-white/5 transition-colors"
                    >
                      {/* Photo & Category */}
                      <td className="py-3.5 px-4 flex items-center gap-3">
                        <div className="w-14 h-11 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-gray-800">
                          <SafeImage
                            src={roomImage}
                            alt={room.roomType}
                            fallbackLabel={room.roomType}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                            {room.roomType}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {room.hotelName} {room.hotelCity ? `(${room.hotelCity})` : ""}
                          </p>
                        </div>
                      </td>

                      {/* Rate */}
                      <td className="py-3.5 px-4 font-semibold text-sm text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatINR(room.pricePerNight)}
                        <span className="text-[11px] text-gray-400 font-normal">
                          {" "}/ night
                        </span>
                      </td>

                      {/* Units */}
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400">
                        {room.totalUnits || 1} {room.totalUnits === 1 ? "unit" : "units"}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={isActive ? "confirmed" : "neutral"}
                          size="sm"
                          dot
                        >
                          {isActive ? "Active in catalog" : "Hidden"}
                        </Badge>
                      </td>

                      {/* Availability Switch */}
                      <td className="py-3.5 px-4 text-center">
                        <label className={cn("relative inline-flex items-center", isSampleMode ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                          <input
                            type="checkbox"
                            checked={isActive}
                            disabled={togglingId === room._id || isSampleMode}
                            onChange={() => toggleAvailability(room._id, isActive)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(room)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          aria-label="Delete room category"
                          title="Delete room category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="md:hidden space-y-3">
            {filteredRooms.map((room) => {
              const roomImage = room.images?.[0] || assets.roomImg1;
              const isActive = room.isActive !== false;

              return (
                <div
                  key={room._id}
                  className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-13 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-gray-800">
                      <SafeImage
                        src={roomImage}
                        alt={room.roomType}
                        fallbackLabel={room.roomType}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                          {room.roomType}
                        </p>
                        <Badge
                          variant={isActive ? "confirmed" : "neutral"}
                          size="sm"
                          dot
                        >
                          {isActive ? "Active" : "Hidden"}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {room.hotelName}
                      </p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-1 tabular-nums">
                        {formatINR(room.pricePerNight)}{" "}
                        <span className="text-[10px] text-gray-400 font-normal">
                          / night
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Accepting bookings:
                      </span>
                      <label className={cn("relative inline-flex items-center", isSampleMode ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                        <input
                          type="checkbox"
                          checked={isActive}
                          disabled={togglingId === room._id || isSampleMode}
                          onChange={() => toggleAvailability(room._id, isActive)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={isSampleMode}
                      onClick={() => setDeleteCandidate(room)}
                      className={cn("p-1.5 rounded-lg transition-colors", isSampleMode ? "text-gray-300 dark:text-gray-700 cursor-not-allowed" : "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer")}
                      aria-label="Delete room category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Delete / Archive Confirmation Dialog */}
      <Modal
        isOpen={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        maxWidth="max-w-md"
        title="Delete room category"
        description="Room deletion information"
      >
        <div className="space-y-4 pt-2 text-xs">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-900 dark:text-amber-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Catalog constraint</span>
            </div>
            <p className="leading-relaxed">
              Permanent room deletion is disabled by the backend service to protect historical booking records and receipts.
            </p>
            <p className="leading-relaxed">
              To stop new bookings immediately, turn off the <strong>Accepting bookings</strong> toggle switch.
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={() => setDeleteCandidate(null)}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              variant="danger"
              size="md"
              disabled={true}
              title="Deletion not supported by backend microservice"
              className="flex-1 opacity-50 cursor-not-allowed"
            >
              Delete (Disabled)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ListRoom;
