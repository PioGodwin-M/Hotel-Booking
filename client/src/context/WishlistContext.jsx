import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";

const WishlistContext = createContext();

const STORAGE_KEY = "pgm_hotel_wishlist_v1";

export const WishlistProvider = ({ children }) => {
  const [wishlist, setWishlist] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      // storage quota or private browsing safeguard
    }
  }, [wishlist]);

  // Purge sample stays from wishlist when sample mode is disabled or in production
  useEffect(() => {
    const isSampleEnabled =
      import.meta.env.DEV &&
      import.meta.env.VITE_USE_SAMPLE_DATA === "true";
    if (!isSampleEnabled) {
      setWishlist((prev) =>
        prev.filter((item) => {
          const id = String(item._id || item);
          return !id.startsWith("sample-");
        })
      );
    }
  }, []);

  const isWishlisted = useCallback(
    (roomId) => {
      if (!roomId) return false;
      return wishlist.some((item) => (item._id || item) === roomId);
    },
    [wishlist]
  );

  const toggleWishlist = useCallback((room) => {
    if (!room || (!room._id && typeof room !== "string")) return;

    const roomId = room._id || room;
    setWishlist((prev) => {
      const exists = prev.some((item) => (item._id || item) === roomId);
      if (exists) {
        toast.success("Removed from your saved stays", {
          icon: "🖤",
          style: {
            borderRadius: "999px",
            background: "#0B1220",
            color: "#FAF8F5",
            fontSize: "13px",
          },
        });
        return prev.filter((item) => (item._id || item) !== roomId);
      } else {
        toast.success("Saved to your wishlist", {
          icon: "✨",
          style: {
            borderRadius: "999px",
            background: "#0B1220",
            color: "#FAF8F5",
            fontSize: "13px",
          },
        });
        // Store room object or fallback ID
        return [...prev, typeof room === "object" ? room : { _id: roomId }];
      }
    });
  }, []);

  const clearWishlist = useCallback(() => {
    setWishlist([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        wishlistCount: wishlist.length,
        isWishlisted,
        toggleWishlist,
        clearWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};
