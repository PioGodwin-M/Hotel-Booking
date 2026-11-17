import { useState, useEffect } from "react";
import { USE_SAMPLE_DATA } from "../config/env";
import { SAMPLE_REVIEWS_DATA } from "../data/sampleContent";

/**
 * Hook to retrieve verified guest reviews and aggregate rating statistics.
 * Returns: { data: { reviews: [], summary: {} }, isLoading, error, isSample }
 */
export const useGuestReviews = () => {
  const [data, setData] = useState(
    USE_SAMPLE_DATA ? SAMPLE_REVIEWS_DATA : { reviews: [], summary: null }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSample, setIsSample] = useState(USE_SAMPLE_DATA);

  useEffect(() => {
    const endpoint = import.meta.env.VITE_REVIEWS_ENDPOINT;

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
          const reviews = Array.isArray(result)
            ? result
            : result?.reviews || result?.data || [];
          const summary = result?.summary || null;
          setData({ reviews, summary });
          setIsSample(false);
          setIsLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err.message);
          setIsLoading(false);
          if (USE_SAMPLE_DATA) {
            setData(SAMPLE_REVIEWS_DATA);
            setIsSample(true);
          } else {
            setData({ reviews: [], summary: null });
            setIsSample(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }

    if (USE_SAMPLE_DATA) {
      setData(SAMPLE_REVIEWS_DATA);
      setIsSample(true);
    } else {
      setData({ reviews: [], summary: null });
      setIsSample(false);
    }
  }, []);

  return { data, isLoading, error, isSample };
};

export default useGuestReviews;
