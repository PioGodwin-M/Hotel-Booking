import React, { useEffect, useState, useMemo } from "react";
import {
  BedDouble,
  Image as ImageIcon,
  X,
  Eye,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import { useOwnerContext } from "../../context/OwnerContext";
import { authApi } from "../../lib/apiClient";
import { RoomCard } from "../../components/RoomCard";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { usePageTitle } from "../../hooks/usePageTitle";
import { cn } from "../../lib/utils";

const DEFAULT_SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
];

const ROOM_TYPE_OPTIONS = [
  "Single Bed",
  "Double Bed",
  "Luxury Room",
  "Family Suite",
];

const AMENITY_OPTIONS = [
  "Free Wifi",
  "Free Breakfast",
  "Swimming Pool",
  "Mountain View",
  "Room Service",
  "Spa",
];

export const AddRoom = () => {
  usePageTitle(
    "Add Room Category",
    "Configure room types, nightly pricing, inventory units, and amenities."
  );
  const { setShowHotelReg, fetchRooms, currency } = useAppContext();
  const { hotels, loadingHotels, selectedHotelId, isSampleMode } = useOwnerContext();

  const [loading, setLoading] = useState(false);
  const [targetHotelId, setTargetHotelId] = useState("");

  const [imageUrls, setImageUrls] = useState([
    DEFAULT_SAMPLE_IMAGES[0],
    DEFAULT_SAMPLE_IMAGES[1],
    "",
    "",
  ]);

  const [form, setForm] = useState({
    roomType: "Luxury Room",
    pricePerNight: "12500",
    totalUnits: 1,
    amenities: {
      "Free Wifi": true,
      "Free Breakfast": true,
      "Swimming Pool": true,
      "Mountain View": false,
      "Room Service": false,
      "Spa": false,
    },
  });

  // Default target hotel
  useEffect(() => {
    if (hotels.length > 0) {
      if (selectedHotelId && selectedHotelId !== "ALL") {
        setTargetHotelId(selectedHotelId);
      } else {
        setTargetHotelId(hotels[0]._id);
      }
    }
  }, [hotels, selectedHotelId]);

  const handleImageUrlChange = (index, value) => {
    setImageUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const toggleAmenity = (name) => {
    setForm((prev) => ({
      ...prev,
      amenities: {
        ...prev.amenities,
        [name]: !prev.amenities[name],
      },
    }));
  };

  const useSampleImages = () => {
    setImageUrls([...DEFAULT_SAMPLE_IMAGES]);
    toast.success("Loaded sample room photos");
  };

  // Live Room Card Preview Mock
  const targetHotel = useMemo(() => {
    return hotels.find((h) => h._id === targetHotelId) || hotels[0] || null;
  }, [hotels, targetHotelId]);

  const previewRoom = useMemo(() => {
    const validImages = imageUrls.filter((u) => u && /^https:\/\/.+/i.test(u.trim()));
    const activeAmenities = Object.keys(form.amenities).filter((k) => form.amenities[k]);

    return {
      _id: "preview-id",
      hotel: targetHotel || {
        name: "Preview Hotel",
        city: "Goa",
        address: "Calangute Beach Road",
      },
      roomType: form.roomType || "Standard Room",
      pricePerNight: Number(form.pricePerNight) || 12000,
      amenities: activeAmenities,
      images: validImages.length > 0 ? validImages : [DEFAULT_SAMPLE_IMAGES[0]],
      isNew: true,
      rating: null,
      reviewsCount: 0,
    };
  }, [targetHotel, form, imageUrls]);

  // Submit Handler
  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (loading) return; // Guard double-submit

    if (isSampleMode) {
      toast.error("Sample mode is active. Room creation is disabled.");
      return;
    }

    if (!targetHotelId) {
      toast.error("Please select a hotel property");
      return;
    }

    const price = Number(form.pricePerNight);
    const units = Number(form.totalUnits);

    if (!form.roomType.trim() || !price || price <= 0) {
      toast.error("Please enter a valid room type and nightly price");
      return;
    }

    if (!units || units < 1) {
      toast.error("Total units must be at least 1");
      return;
    }

    const filteredImages = imageUrls.map((u) => u.trim()).filter(Boolean);
    if (filteredImages.length === 0) {
      toast.error("Please provide at least one photo URL for the room");
      return;
    }

    const selectedAmenities = Object.keys(form.amenities).filter(
      (key) => form.amenities[key]
    );

    setLoading(true);
    try {
      const payload = {
        hotelId: targetHotelId,
        roomType: form.roomType.trim(),
        pricePerNight: price,
        totalUnits: units,
        amenities: selectedAmenities,
        images: filteredImages,
      };

      const { data } = await authApi.post("/api/rooms/", payload);

      if (data.success) {
        toast.success(data.message || "Room category added successfully!");
        if (fetchRooms) fetchRooms();
      } else {
        toast.error(data.message || "Failed to add room category");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to add room category"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="pb-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Add room category
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          Configure room types, pricing, available units, and amenities.
        </p>
      </div>

      {/* No Hotels Safeguard */}
      {hotels.length === 0 && !loadingHotels && (
        <div className="p-5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-900 dark:text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-sm">No registered properties found</p>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              You must register at least one property before adding rooms.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={isSampleMode}
            onClick={() => {
              if (isSampleMode) {
                toast.error("Registration disabled in sample mode");
                return;
              }
              setShowHotelReg(true);
            }}
            className="shrink-0"
          >
            {isSampleMode ? "Disabled in sample mode" : "Register property"}
          </Button>
        </div>
      )}

      {/* Form & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: 7 cols on lg */}
        <form
          onSubmit={onSubmitHandler}
          className="lg:col-span-7 p-5 sm:p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs space-y-5"
        >
          {/* Target Hotel Selector */}
          <div>
            <label
              htmlFor="target-hotel"
              className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
            >
              Property
            </label>
            <Select
              id="target-hotel"
              value={targetHotelId}
              onChange={(e) => setTargetHotelId(e.target.value)}
              disabled={hotels.length === 0}
            >
              {hotels.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} {h.city ? `(${h.city})` : ""}
                </option>
              ))}
            </Select>
          </div>

          {/* Room Category & Nightly Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="room-type-select"
                className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Room type
              </label>
              <Select
                id="room-type-select"
                value={form.roomType}
                onChange={(e) => setForm({ ...form, roomType: e.target.value })}
                options={ROOM_TYPE_OPTIONS}
              />
            </div>

            <Input
              label={`Price per night (${currency})`}
              type="number"
              min="1"
              value={form.pricePerNight}
              onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })}
              placeholder="e.g. 4500"
              leftIcon={<span className="text-sm font-semibold text-stone-500">₹</span>}
            />
          </div>

          {/* Capacity / Total Units */}
          <div>
            <Input
              label="Available inventory units"
              type="number"
              min="1"
              max="100"
              value={form.totalUnits}
              onChange={(e) => setForm({ ...form, totalUnits: e.target.value })}
              leftIcon={<BedDouble className="w-4 h-4 text-stone-400" />}
              helperText="Number of physical rooms available under this category"
            />
          </div>

          {/* Amenities Chips */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Included amenities
            </label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((amenity) => {
                const active = form.amenities[amenity];
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border select-none",
                      active
                        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-gray-900 dark:border-white font-semibold"
                        : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400"
                    )}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    <span>{amenity}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo URLs */}
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Room photos (4 URLs)
              </label>
              <button
                type="button"
                onClick={useSampleImages}
                className="text-xs font-medium text-[#0b1220] dark:text-[#faf8f5] underline hover:text-stone-600 dark:hover:text-stone-300 transition-colors cursor-pointer"
              >
                Use sample photos
              </button>
            </div>

            <div className="space-y-2">
              {imageUrls.map((url, i) => {
                const isValidHttps = Boolean(url && /^https:\/\/[^\s]+$/i.test(url.trim()));
                return (
                  <div key={i} className="flex items-center gap-2">
                    {isValidHttps ? (
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800">
                        <img
                          src={url.trim()}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <Input
                        placeholder={`Photo URL ${i + 1}`}
                        value={url}
                        onChange={(e) => handleImageUrlChange(i, e.target.value)}
                        leftIcon={<ImageIcon className="w-3.5 h-3.5" />}
                      />
                    </div>
                    {url && (
                      <button
                        type="button"
                        onClick={() => handleImageUrlChange(i, "")}
                        className="p-2 text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
                        aria-label="Clear image URL"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              Paste links to your photos (HTTPS URLs only).
            </p>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading || hotels.length === 0 || isSampleMode}
              isLoading={loading}
              loadingText="Saving room..."
              className="w-full font-semibold"
            >
              {isSampleMode ? "Room creation disabled in sample mode" : "Add room category"}
            </Button>
          </div>
        </form>

        {/* Right Preview: 5 cols on lg */}
        <aside className="lg:col-span-5 sticky top-28 self-start space-y-3">
          <div className="flex items-center gap-1.5 pb-1">
            <Eye className="w-4 h-4 text-gray-500" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Live guest preview
            </h3>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            This card shows how your room will appear to guests in search results.
          </p>

          <RoomCard room={previewRoom} layout="grid" />
        </aside>
      </div>
    </div>
  );
};

export default AddRoom;
