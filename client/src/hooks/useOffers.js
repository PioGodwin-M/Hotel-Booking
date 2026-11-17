import { useState, useEffect } from "react";
import { USE_SAMPLE_DATA } from "../config/env";
import { SAMPLE_OFFERS } from "../data/sampleContent";

/**
 * Hook to retrieve active promotional offers.
 * Returns: { data, isLoading, error, isSample }
 */
export const useOffers = () => {
  const [data, setData] = useState(USE_SAMPLE_DATA ? SAMPLE_OFFERS : []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSample, setIsSample] = useState(USE_SAMPLE_DATA);

  useEffect(() => {
    const endpoint = import.meta.env.VITE_OFFERS_ENDPOINT;

    // If a real backend endpoint is explicitly provided, fetch from it
    if (endpoint) {
      let isMounted = true;
      setIsLoading(true);
      fetch(endpoint)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((result) => {
          if (!isMounted) return;
          const offers = Array.isArray(result) ? result : result?.data || [];
          setData(offers);
          setIsSample(false);
          setIsLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err.message);
          setIsLoading(false);
          if (USE_SAMPLE_DATA) {
            setData(SAMPLE_OFFERS);
            setIsSample(true);
          } else {
            setData([]);
            setIsSample(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }

    // Default mode: return sample data in preview mode, or empty array in production
    if (USE_SAMPLE_DATA) {
      setData(SAMPLE_OFFERS);
      setIsSample(true);
    } else {
      setData([]);
      setIsSample(false);
    }
  }, []);

  return { data, isLoading, error, isSample };
};

export default useOffers;
