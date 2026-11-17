import React, { useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Phone,
  Image as ImageIcon,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Upload,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { cities } from "../assets/assets";
import { useAppContext } from "../context/AppContext";
import { useOwnerContext } from "../context/OwnerContext";
import { authApi } from "../lib/apiClient";
import { BRAND_NAME } from "../config/brand";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { OwnerLocationPicker } from "./map/OwnerLocationPicker";
import { cn } from "../lib/utils";

const STEPS = [
  { id: 1, label: "Basics", icon: <Building2 className="w-4 h-4" /> },
  { id: 2, label: "Location", icon: <MapPin className="w-4 h-4" /> },
  { id: 3, label: "Contact", icon: <Phone className="w-4 h-4" /> },
  { id: 4, label: "Photos", icon: <ImageIcon className="w-4 h-4" /> },
  { id: 5, label: "Review", icon: <Check className="w-4 h-4" /> },
];

export const HotelReg = () => {
  const { setShowHotelReg, setIsOwner, checkOwnerStatus, fetchRooms, navigate } =
    useAppContext();

  // Try to read fetchHotels if inside owner context
  let fetchOwnerHotels = null;
  try {
    const ownerCtx = useOwnerContext();
    fetchOwnerHotels = ownerCtx?.fetchHotels;
  } catch {
    // HotelReg can be opened globally by non-owners before registering
  }

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form draft state
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    contact: "",
    email: "",
    latitude: null,
    longitude: null,
    locationPrecision: "exact",
    area: "",
    images: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    ],
  });

  const [errors, setErrors] = useState({});

  // Scroll lock and Esc key listener for modal accessibility
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading) {
        setShowHotelReg(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, setShowHotelReg]);

  // Step Validation logic
  const validateStep = (s) => {
    const errs = {};
    if (s === 1) {
      if (!form.name.trim() || form.name.trim().length < 3) {
        errs.name = "Hotel name must be at least 3 characters";
      }
    } else if (s === 2) {
      if (!form.address.trim() || form.address.trim().length < 5) {
        errs.address = "Please enter a valid street address (min 5 characters)";
      }
      if (!form.city) {
        errs.city = "Please select a city";
      }
    } else if (s === 3) {
      if (!form.contact.trim() || form.contact.trim().length < 7) {
        errs.contact = "Please provide a valid contact phone number";
      }
    } else if (s === 4) {
      if (!form.images || form.images.length === 0) {
        errs.images = "Please include at least one photo of the property";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  // Drag and drop photo upload handler
  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    addFiles(files);
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };

  const addFiles = (files) => {
    const valid = files.filter((f) => {
      const isImg = f.type.startsWith("image/");
      const isSizeOk = f.size <= 5 * 1024 * 1024; // 5MB limit
      if (!isImg) toast.error(`${f.name} is not an image file`);
      if (!isSizeOk) toast.error(`${f.name} exceeds 5MB size limit`);
      return isImg && isSizeOk;
    });

    valid.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setForm((prev) => ({
          ...prev,
          images: [...prev.images, uploadEvent.target.result],
        }));
      };
      reader.readAsDataURL(f);
    });
  };

  const removePhoto = (idx) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  };

  // Submit Final Registration
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      toast.error("Please complete all required steps with valid information");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact: form.contact.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
      };

      if (form.latitude !== null && form.longitude !== null) {
        payload.latitude = form.latitude;
        payload.longitude = form.longitude;
        payload.locationPrecision = form.locationPrecision || "exact";
      }

      if (form.area && form.area.trim()) {
        payload.area = form.area.trim();
      }

      const { data } = await authApi.post("/api/hotels/", payload);

      if (data.success) {
        toast.success(data.message || "Property registered successfully!");
        setIsOwner(true);
        if (checkOwnerStatus) await checkOwnerStatus();
        if (fetchRooms) fetchRooms();
        if (fetchOwnerHotels) fetchOwnerHotels();
        setShowHotelReg(false);
        navigate("/owner");
      } else {
        toast.error(data.message || "Failed to register property");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        onClick={() => !loading && setShowHotelReg(false)}
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotel-reg-title"
        className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-10 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="hotel-reg-title"
                className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100"
              >
                List your property
              </h3>
              <p className="text-[11px] text-gray-500">
                Register your hotel on {BRAND_NAME}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHotelReg(false)}
            disabled={loading}
            aria-label="Close registration dialog"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Step Indicator */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
          <div className="flex items-center justify-between">
            {STEPS.map((s, idx) => {
              const isActive = step === s.id;
              const isPast = step > s.id;
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                        isActive
                          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                          : isPast
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                      )}
                    >
                      {isPast ? <Check className="w-3.5 h-3.5" /> : s.id}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-medium mt-1 hidden sm:block",
                        isActive
                          ? "text-gray-900 dark:text-white font-semibold"
                          : isPast
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-gray-400"
                      )}
                    >
                      {s.label}
                    </span>
                  </div>

                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 flex-1 mx-2 transition-colors",
                        isPast ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Body */}
        <div className="p-6 min-h-[240px] flex flex-col justify-between">
          <div>
            {/* Step 1: Basics */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Property basics
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    What is the official name of your hotel or stay?
                  </p>
                </div>

                <Input
                  label="Hotel name"
                  placeholder="e.g. Grand Palace Hotel, Mountain View Resort"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  error={errors.name}
                  leftIcon={<Building2 className="w-4 h-4" />}
                  autoFocus
                />
              </div>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Location & address
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Where is your property located?
                  </p>
                </div>

                <Input
                  label="Street address"
                  placeholder="e.g. 12 Beach Road, Near Clock Tower"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  error={errors.address}
                  leftIcon={<MapPin className="w-4 h-4" />}
                />

                <Select
                  label="City"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  error={errors.city}
                  placeholder="Select a city..."
                  options={cities}
                />

                <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
                  <OwnerLocationPicker
                    latitude={form.latitude}
                    longitude={form.longitude}
                    locationPrecision={form.locationPrecision}
                    area={form.area}
                    city={form.city}
                    address={form.address}
                    onChange={({ latitude, longitude, locationPrecision, area }) => {
                      setForm((prev) => ({
                        ...prev,
                        latitude,
                        longitude,
                        locationPrecision,
                        area,
                      }));
                    }}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Contact */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Contact details
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Phone number for reservation queries and guest assistance.
                  </p>
                </div>

                <Input
                  label="Phone number"
                  placeholder="e.g. +91 98765 43210"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  error={errors.contact}
                  leftIcon={<Phone className="w-4 h-4" />}
                />
              </div>
            )}

            {/* Step 4: Photos */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Property photos
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Add photos of your property facade and facilities.
                  </p>
                </div>

                {/* Drag and drop zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center hover:border-gray-400 transition-colors cursor-pointer bg-gray-50/50 dark:bg-gray-800/20"
                >
                  <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Drag & drop photos here, or browse files
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Supports JPG, PNG, WebP up to 5MB each
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                    id="hotel-photo-input"
                  />
                  <label
                    htmlFor="hotel-photo-input"
                    className="inline-block mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
                  >
                    Select photos
                  </label>
                </div>

                {/* Thumbnails preview */}
                {form.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {form.images.map((img, i) => (
                      <div
                        key={i}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group"
                      >
                        <img
                          src={img}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {errors.images && (
                  <p className="text-xs text-rose-500 font-medium">{errors.images}</p>
                )}
              </div>
            )}

            {/* Step 5: Review */}
            {step === 5 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Review and confirm
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Please verify your property details before submitting.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                    <span className="text-gray-500">
                      Hotel name
                    </span>
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {form.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                    <span className="text-gray-500">
                      City
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {form.city}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                    <span className="text-gray-500">
                      Street address
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[240px]">
                      {form.address}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                    <span className="text-gray-500">
                      Map location
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {form.latitude != null && form.longitude != null
                        ? `${form.latitude.toFixed(4)}, ${form.longitude.toFixed(4)} (${form.locationPrecision})`
                        : "No coordinates set"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">
                      Phone number
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {form.contact}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-emerald-600 pt-1">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Immediate access to room listing upon registration</span>
                </div>
              </div>
            )}
          </div>

          {/* Wizard Footer Controls */}
          <div className="pt-5 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button
                variant="outline"
                size="md"
                onClick={handleBack}
                disabled={loading}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleNext}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                isLoading={loading}
                loadingText="Registering..."
              >
                Complete registration
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotelReg;
