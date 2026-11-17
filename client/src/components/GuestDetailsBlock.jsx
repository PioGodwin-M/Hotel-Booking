import React, { useState, useEffect, useId } from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Guest Details Block for Checkout.
 * Guarded by VITE_ENABLE_GUEST_DETAILS (default false).
 * When enabled (preview mode), displays note "Preview. Not saved yet."
 */
export const GuestDetailsBlock = ({ user, onValidityChange }) => {
  const isEnabled = import.meta.env.VITE_ENABLE_GUEST_DETAILS === "true";
  const [showGST, setShowGST] = useState(false);

  // Form states
  const [fullName, setFullName] = useState(
    user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || ""
  );
  const userEmail =
    user?.primaryEmailAddress?.emailAddress || user?.email || "guest@example.com";

  const [phone, setPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [gstin, setGstin] = useState("");

  // Validation errors
  const [errors, setErrors] = useState({});

  const nameId = useId();
  const phoneId = useId();
  const requestsId = useId();
  const gstId = useId();

  useEffect(() => {
    if (typeof onValidityChange === "function") {
      const isValid = Boolean(fullName.trim() && phone.replace(/\D/g, "").length === 10);
      onValidityChange(isValid);
    }
  }, [fullName, phone, onValidityChange]);

  if (!isEnabled) {
    return null;
  }

  const validatePhone = (val) => {
    const cleaned = val.replace(/\D/g, "");
    if (!cleaned) return "Enter a phone number";
    if (cleaned.length !== 10) return "Enter a valid 10-digit mobile number";
    return "";
  };

  const validateGST = (val) => {
    if (!val) return "";
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(val.toUpperCase().trim())) {
      return "Enter a valid 15-character GSTIN";
    }
    return "";
  };

  const handlePhoneBlur = () => {
    const err = validatePhone(phone);
    setErrors((prev) => ({ ...prev, phone: err }));
  };

  const handleGSTBlur = () => {
    const err = validateGST(gstin);
    setErrors((prev) => ({ ...prev, gstin: err }));
  };

  return (
    <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Guest details
        </h4>
        <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
          Preview. Not saved yet.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Full Name */}
        <div>
          <label htmlFor={nameId} className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full name
          </label>
          <input
            id={nameId}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full h-10 px-3 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B1220]"
            placeholder="First and last name"
          />
        </div>

        {/* Email (Read-only) */}
        <div>
          <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email address
          </label>
          <div className="w-full h-10 px-3 flex items-center rounded-[10px] border border-gray-200/60 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400 text-sm cursor-not-allowed">
            {userEmail}
          </div>
        </div>

        {/* Phone Number */}
        <div className="sm:col-span-2">
          <label htmlFor={phoneId} className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mobile number <span className="text-rose-600">*</span>
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-3 rounded-l-[10px] border border-r-0 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 text-sm font-medium">
              +91
            </span>
            <input
              id={phoneId}
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
              }}
              onBlur={handlePhoneBlur}
              className={cn(
                "w-full h-10 px-3 rounded-r-[10px] border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B1220]",
                errors.phone
                  ? "border-rose-500 focus:ring-rose-500"
                  : "border-gray-200 dark:border-gray-700"
              )}
              placeholder="10-digit mobile number"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
            />
          </div>
          {errors.phone && (
            <p id={`${phoneId}-error`} role="alert" className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.phone}</span>
            </p>
          )}
        </div>

        {/* Special Requests */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor={requestsId} className="block font-medium text-gray-700 dark:text-gray-300">
              Special requests <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <span className="text-[11px] text-gray-400">
              {specialRequests.length}/300
            </span>
          </div>
          <textarea
            id={requestsId}
            rows={2}
            maxLength={300}
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            className="w-full p-2.5 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B1220] resize-none"
            placeholder="Early check-in, quiet room, dietary preferences..."
          />
        </div>

        {/* GST Details Accordion */}
        <div className="sm:col-span-2">
          {!showGST ? (
            <button
              type="button"
              onClick={() => setShowGST(true)}
              className="text-xs text-stone-600 dark:text-stone-300 hover:text-[#0B1220] dark:hover:text-white underline font-medium cursor-pointer"
            >
              + Add GST details for business tax invoice
            </button>
          ) : (
            <div className="p-3 rounded-[10px] border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor={gstId} className="block font-medium text-gray-700 dark:text-gray-300">
                  GSTIN <span className="text-gray-400 font-normal">(15-character number)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowGST(false);
                    setGstin("");
                    setErrors((prev) => ({ ...prev, gstin: "" }));
                  }}
                  className="text-[11px] text-gray-400 hover:text-gray-600"
                >
                  Remove
                </button>
              </div>
              <input
                id={gstId}
                type="text"
                maxLength={15}
                value={gstin}
                onChange={(e) => {
                  setGstin(e.target.value.toUpperCase());
                  if (errors.gstin) setErrors((prev) => ({ ...prev, gstin: "" }));
                }}
                onBlur={handleGSTBlur}
                className={cn(
                  "w-full h-9 px-3 rounded-[8px] border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-[#0B1220]",
                  errors.gstin
                    ? "border-rose-500 focus:ring-rose-500"
                    : "border-gray-200 dark:border-gray-700"
                )}
                placeholder="22AAAAA0000A1Z5"
              />
              {errors.gstin && (
                <p role="alert" className="text-[11px] text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.gstin}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuestDetailsBlock;
