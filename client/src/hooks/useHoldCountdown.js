import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BUSINESS_CONFIG } from "../config/business";

/**
 * Live hold countdown hook.
 * Computes remaining time every second.
 *
 * @param {Object} booking - Booking object with holdExpiresAt or createdAt
 * @param {Function} onExpire - Optional callback when timer reaches zero
 */
export const useHoldCountdown = (booking, onExpire) => {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const holdExpiresAt = booking?.holdExpiresAt;
  const createdAt = booking?.createdAt;

  // Calculate target expiry timestamp in ms
  const expiryTimestamp = useMemo(() => {
    if (holdExpiresAt) {
      const parsed = new Date(holdExpiresAt).getTime();
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }

    if (createdAt) {
      const created = new Date(createdAt).getTime();
      if (!isNaN(created) && created > 0) {
        const holdMs = (BUSINESS_CONFIG.holdDurationMinutes || 10) * 60 * 1000;
        return created + holdMs;
      }
    }

    return null;
  }, [holdExpiresAt, createdAt]);

  // Expiry time formatted as e.g. "4:52 PM"
  const expiryTimeFormatted = useMemo(() => {
    if (!expiryTimestamp) return "";
    try {
      return new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(new Date(expiryTimestamp));
    } catch {
      return "";
    }
  }, [expiryTimestamp]);

  const calculateSecondsLeft = useCallback(() => {
    if (!expiryTimestamp) return 0;
    const now = Date.now();
    return Math.max(0, Math.floor((expiryTimestamp - now) / 1000));
  }, [expiryTimestamp]);

  const [secondsRemaining, setSecondsRemaining] = useState(calculateSecondsLeft);
  const hasTriggeredExpire = useRef(false);

  useEffect(() => {
    // Re-initialize when booking changes
    const initial = calculateSecondsLeft();
    setSecondsRemaining(initial);
    hasTriggeredExpire.current = initial <= 0;

    if (initial <= 0) {
      return;
    }

    const interval = setInterval(() => {
      const remaining = calculateSecondsLeft();
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (!hasTriggeredExpire.current) {
          hasTriggeredExpire.current = true;
          if (typeof onExpireRef.current === "function") {
            onExpireRef.current();
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateSecondsLeft]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  const isExpired = secondsRemaining <= 0;
  const isUrgent = secondsRemaining > 0 && secondsRemaining <= 120; // Under 2 minutes

  return {
    secondsRemaining,
    formatted,
    minutes,
    seconds,
    isUrgent,
    isExpired,
    expiryTimeFormatted,
  };
};

export default useHoldCountdown;
