import { useState, useEffect, useMemo } from "react";
import { USE_SAMPLE_DATA } from "../config/env";
import { SAMPLE_TRIP_IDEAS } from "../data/sampleContent";
import { useAppContext } from "../context/AppContext";

/**
 * Hook to retrieve curated trip ideas.
 * Enriches sample starting prices with real stay prices whenever matching stays exist.
 * Returns: { data, isLoading, error, isSample }
 */
export const useTripIdeas = () => {
  const { rooms } = useAppContext();
  const [rawData, setRawData] = useState(USE_SAMPLE_DATA ? SAMPLE_TRIP_IDEAS : []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSample, setIsSample] = useState(USE_SAMPLE_DATA);

  useEffect(() => {
    const endpoint = import.meta.env.VITE_TRIP_IDEAS_ENDPOINT;

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
          const items = Array.isArray(result) ? result : result?.data || [];
          setRawData(items);
          setIsSample(false);
          setIsLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err.message);
          setIsLoading(false);
          if (USE_SAMPLE_DATA) {
            setRawData(SAMPLE_TRIP_IDEAS);
            setIsSample(true);
          } else {
            setRawData([]);
            setIsSample(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }

    if (USE_SAMPLE_DATA) {
      setRawData(SAMPLE_TRIP_IDEAS);
      setIsSample(true);
    } else {
      setRawData([]);
      setIsSample(false);
    }
  }, []);

  // Dynamically enrich starting price from real database catalog when available
  const data = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    if (!Array.isArray(rooms) || rooms.length === 0) return rawData;

    return rawData.map((item) => {
      let matchingPrices = [];

      if (item.filterCity) {
        const cityRooms = rooms.filter(
          (r) =>
            r?.hotel?.city &&
            r.hotel.city.toLowerCase() === item.filterCity.toLowerCase()
        );
        matchingPrices.push(
          ...cityRooms.map((r) => r.pricePerNight).filter(Boolean)
        );
      }

      if (item.filterAmenity && matchingPrices.length === 0) {
        const amenityRooms = rooms.filter((r) =>
          Array.isArray(r.amenities)
            ? r.amenities.some((a) =>
                a.toLowerCase().includes(item.filterAmenity.toLowerCase())
              )
            : false
        );
        matchingPrices.push(
          ...amenityRooms.map((r) => r.pricePerNight).filter(Boolean)
        );
      }

      const realCheapest =
        matchingPrices.length > 0 ? Math.min(...matchingPrices) : null;

      return {
        ...item,
        startingPrice: realCheapest || item.defaultStartingPrice || 3000,
      };
    });
  }, [rawData, rooms]);

  return { data, isLoading, error, isSample };
};

export default useTripIdeas;
