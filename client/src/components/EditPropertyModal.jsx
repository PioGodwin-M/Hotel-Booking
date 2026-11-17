import React, { useState, useEffect } from "react";
import { Building2, X, MapPin, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "../lib/apiClient";
import { useOwnerContext } from "../context/OwnerContext";
import { useAppContext } from "../context/AppContext";
import { getOwnerCoordinates } from "../lib/geo";
import { cities } from "../assets/assets";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { OwnerLocationPicker } from "./map/OwnerLocationPicker";

export const EditPropertyModal = ({ hotel, isOpen, onClose }) => {
  const { fetchHotels } = useOwnerContext();
  const { fetchRooms } = useAppContext();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationPrecision, setLocationPrecision] = useState("exact");
  const [area, setArea] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Initialize form state when hotel changes
  useEffect(() => {
    if (hotel) {
      setName(hotel.name || "");
      setCity(hotel.city || "");
      setAddress(hotel.address || "");
      setContact(hotel.contact || "");

      const coords = getOwnerCoordinates(hotel);
      if (coords) {
        setLatitude(coords.lat);
        setLongitude(coords.lng);
      } else {
        setLatitude(null);
        setLongitude(null);
      }

      setLocationPrecision(hotel.location?.locationPrecision || "exact");
      setArea(hotel.area || "");
      setErrors({});
    }
  }, [hotel, isOpen]);

  // Accessibility: scroll lock & escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen || !hotel) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errs = {};
    if (!name.trim()) errs.name = "Property name is required";
    if (!city.trim()) errs.city = "City is required";
    if (!address.trim()) errs.address = "Address is required";
    if (!contact.trim()) errs.contact = "Contact number is required";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        city: city.trim(),
        address: address.trim(),
        contact: contact.trim(),
        latitude: latitude != null ? Number(latitude) : null,
        longitude: longitude != null ? Number(longitude) : null,
        locationPrecision: locationPrecision || "exact",
        area: area ? area.trim() : null,
      };

      const res = await authApi.put(`/api/hotels/${hotel._id}`, payload);

      if (res.data?.success) {
        toast.success(res.data.message || "Property updated successfully");
        if (fetchHotels) await fetchHotels();
        if (fetchRooms) fetchRooms();
        onClose();
      } else {
        toast.error(res.data?.message || "Failed to update property");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Could not update property. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        onClick={() => !loading && onClose()}
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-property-title"
        className="relative w-full max-w-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 rounded-2xl shadow-xl z-10 overflow-hidden my-8 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-stone-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="edit-property-title"
                className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100"
              >
                Edit property details
              </h3>
              <p className="text-[11px] text-stone-500">
                Update name, address, and map location for {hotel.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Basic Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Property name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              placeholder="e.g. Grand Heritage Resort"
            />
            <Select
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              error={errors.city}
              options={cities}
              placeholder="Select city..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Street address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              error={errors.address}
              placeholder="e.g. 12 Beach Road, Near Clock Tower"
              leftIcon={<MapPin className="w-4 h-4" />}
            />
            <Input
              label="Phone number"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              error={errors.contact}
              placeholder="e.g. +91 98765 43210"
              leftIcon={<Phone className="w-4 h-4" />}
            />
          </div>

          {/* Location Picker Section */}
          <div className="pt-4 border-t border-stone-200 dark:border-white/10" id="property-location-section">
            <div className="mb-3">
              <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Map location
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Set coordinates so guests can find your property on the map.
              </p>
            </div>

            <OwnerLocationPicker
              latitude={latitude}
              longitude={longitude}
              locationPrecision={locationPrecision}
              area={area}
              city={city}
              address={address}
              onChange={({ latitude: newLat, longitude: newLng, locationPrecision: newPrec, area: newArea }) => {
                setLatitude(newLat);
                setLongitude(newLng);
                setLocationPrecision(newPrec);
                setArea(newArea);
              }}
            />
          </div>

          {/* Form Footer */}
          <div className="pt-4 border-t border-stone-200 dark:border-white/10 flex items-center justify-end gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={loading}
              className="rounded-[10px] text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={loading}
              loadingText="Saving..."
              className="rounded-[10px] text-xs font-semibold"
            >
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPropertyModal;