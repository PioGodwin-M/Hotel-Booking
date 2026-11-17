import { useState, useCallback } from "react";
import { USE_SAMPLE_DATA } from "../config/env";

/**
 * Hook to manage newsletter subscription requests.
 * Returns: { subscribe, isLoading, isSuccess, isError, errorMessage, isAvailable, reset }
 */
export const useSubscribe = () => {
  const endpoint = import.meta.env.VITE_NEWSLETTER_ENDPOINT;
  // Available if real endpoint exists, or if running in preview sample data mode
  const isAvailable = Boolean(endpoint) || USE_SAMPLE_DATA;

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsSuccess(false);
    setIsError(false);
    setErrorMessage("");
  }, []);

  const subscribe = useCallback(
    async (email) => {
      // Basic validation
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setIsError(true);
        setErrorMessage("Please enter a valid email address.");
        return { success: false, error: "Invalid email" };
      }

      setIsLoading(true);
      setIsError(false);
      setErrorMessage("");

      if (endpoint) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim() }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `HTTP ${res.status}`);
          }

          setIsLoading(false);
          setIsSuccess(true);
          return { success: true };
        } catch (err) {
          setIsLoading(false);
          setIsError(true);
          setErrorMessage(err.message || "Couldn't subscribe. Try again.");
          return { success: false, error: err.message };
        }
      }

      // Preview mode simulation (600ms delay)
      if (USE_SAMPLE_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        setIsLoading(false);
        setIsSuccess(true);
        return { success: true };
      }

      setIsLoading(false);
      setIsError(true);
      setErrorMessage("Newsletter service is currently unconfigured.");
      return { success: false, error: "Unconfigured endpoint" };
    },
    [endpoint]
  );

  return {
    subscribe,
    isLoading,
    isSuccess,
    isError,
    errorMessage,
    isAvailable,
    reset,
  };
};

export default useSubscribe;
