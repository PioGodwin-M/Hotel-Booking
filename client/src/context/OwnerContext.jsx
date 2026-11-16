import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "../lib/apiClient";
import { useAppContext } from "./AppContext";

const OwnerContext = createContext();

const STORAGE_KEY = "pgm_owner_selected_hotel_v1";

export const isSampleHotel = (h) => {
  if (!h) return false;
  if (h.isSample) return true;
  const name = (h.name || "").trim();
  return /^\[sample\]/i.test(name) || name.toLowerCase().includes("sample");
};

export const OwnerProvider = ({ children }) => {
  const { user, isOwner } = useAppContext();
  const [hotels, setHotels] = useState([]);
  const [isSampleMode, setIsSampleMode] = useState(false);
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [selectedHotelId, setSelectedHotelId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "ALL";
    } catch {
      return "ALL";
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const fetchHotels = useCallback(async () => {
    if (!user || !isOwner) {
      setHotels([]);
      setIsSampleMode(false);
      setLoadingHotels(false);
      return;
    }

    setLoadingHotels(true);
    try {
      const res = await authApi.get("/api/hotels/owner");
      const rawList = res.data?.hotels || [];

      // Filter sample properties out of owner workspace
      const realList = rawList.filter((h) => !isSampleHotel(h));
      const sampleList = rawList.filter((h) => isSampleHotel(h));
      const sampleModeActive =
        sampleList.length > 0 || import.meta.env.VITE_USE_SAMPLE_DATA === "true";

      setHotels(realList);
      setIsSampleMode(sampleModeActive);

      // If previously selected hotel was a sample hotel, reset selection to ALL
      setSelectedHotelId((prevId) => {
        if (prevId === "ALL") return "ALL";
        const exists = realList.some((h) => h._id === prevId);
        return exists ? prevId : "ALL";
      });
    } catch {
      setHotels([]);
      setIsSampleMode(false);
    } finally {
      setLoadingHotels(false);
    }
  }, [user, isOwner]);

  useEffect(() => {
    fetchHotels();
  }, [fetchHotels]);

  const selectHotel = (hotelId) => {
    setSelectedHotelId(hotelId);
    try {
      localStorage.setItem(STORAGE_KEY, hotelId);
    } catch {
      // ignore
    }
  };

  return (
    <OwnerContext.Provider
      value={{
        hotels,
        isSampleMode,
        loadingHotels,
        selectedHotelId,
        selectHotel,
        fetchHotels,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileDrawerOpen,
        setMobileDrawerOpen,
      }}
    >
      {children}
    </OwnerContext.Provider>
  );
};

export const useOwnerContext = () => {
  const context = useContext(OwnerContext);
  if (!context) {
    throw new Error("useOwnerContext must be used within an OwnerProvider");
  }
  return context;
};
