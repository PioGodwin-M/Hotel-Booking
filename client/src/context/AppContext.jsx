import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { publicApi, authApi } from '../lib/apiClient';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const currency = import.meta.env.VITE_CURRENCY || '₹';
  const navigate = useNavigate();
  const { getToken, isSignedIn, isLoaded: isAuthLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const user = clerkUser || (import.meta.env.DEV && typeof window !== "undefined" && window.__DEV_USER ? window.__DEV_USER : null);

  const [isOwner, setIsOwner] = useState(false);
  const [checkingOwner, setCheckingOwner] = useState(true);
  const [showHotelReg, setShowHotelReg] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [profileSyncError, setProfileSyncError] = useState(null);

  // Synchronization guard refs (prevents duplicate requests in Strict Mode & race conditions)
  const latestRequestIdRef = useRef(0);
  const syncedUserIdRef = useRef(null);
  const inFlightPromiseRef = useRef(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);

  // searchedCities kept in local state for filtering & backward compatibility
  // Note: Backend user-service does not persist recent search history
  const [searchedCities, setSearchedCities] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [isServerUnreachable, setIsServerUnreachable] = useState(false);
  const [roomsError, setRoomsError] = useState(false);

  // Register Clerk token getter for authApi interceptor
  useEffect(() => {
    window.__getClerkToken = getToken;
    return () => {
      delete window.__getClerkToken;
    };
  }, [getToken]);

  /**
   * Fetch all rooms (public)
   * BACKEND DEPENDENCY:
   * The catalog-service provides GET /api/rooms returning active rooms.
   * When offline / unreachable:
   * - If VITE_USE_SAMPLE_DATA=true (dev only): dynamically loads sample stays.
   * - If false (default): marks isServerUnreachable=true, roomsError=true, rooms=[].
   */
  const roomsFetching = useRef(false);
  const fetchRooms = useCallback(async () => {
    if (roomsFetching.current) return;
    roomsFetching.current = true;
    setLoadingRooms(true);

    const useSample =
      import.meta.env.DEV &&
      import.meta.env.VITE_USE_SAMPLE_DATA === 'true';

    try {
      const response = await publicApi.get('/api/rooms', { timeout: 5000 });
      setRooms(response.data?.rooms ?? []);
      setIsServerUnreachable(false);
      setRoomsError(false);
    } catch {
      if (useSample) {
        try {
          const mod = await import('../data/sampleStays');
          setRooms(mod.SAMPLE_STAYS);
          setIsServerUnreachable(false);
          setRoomsError(false);
        } catch {
          setRooms([]);
          setIsServerUnreachable(true);
          setRoomsError(true);
        }
      } else {
        setRooms([]);
        setIsServerUnreachable(true);
        setRoomsError(true);
      }
    } finally {
      roomsFetching.current = false;
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  /**
   * Synchronize authenticated user profile with User Service.
   * Calls GET /api/users/me using the verified Clerk session token.
   * Includes Strict Mode deduplication, stale-response protection, and controlled retry.
   */
  const syncUserProfile = useCallback(
    async (options = {}) => {
      const force = options?.force === true;

      // Development mock fallback: when running without a real Clerk session
      if (!clerkUser?.id) {
        if (
          import.meta.env.DEV &&
          typeof window !== "undefined" &&
          window.__DEV_USER
        ) {
          setUserProfile(window.__DEV_USER);
          setProfileSyncError(null);
        } else {
          setUserProfile(null);
        }
        syncedUserIdRef.current = null;
        return;
      }

      if (!isSignedIn) {
        setUserProfile(null);
        syncedUserIdRef.current = null;
        return;
      }

      const targetUserId = clerkUser.id;

      // Deduplication: skip if already synchronized for this user ID (unless force: true)
      if (!force && syncedUserIdRef.current === targetUserId) {
        return;
      }

      // Concurrency guard: if a sync for this exact user is already in flight, reuse its promise
      if (inFlightPromiseRef.current && syncedUserIdRef.current === null) {
        return inFlightPromiseRef.current;
      }

      const currentRequestId = ++latestRequestIdRef.current;
      setSyncingProfile(true);
      setProfileSyncError(null);

      const promise = (async () => {
        try {
          const response = await authApi.get("/api/users/me");

          // Stale response check: verify active user and request ID have not changed while in flight
          if (
            latestRequestIdRef.current !== currentRequestId ||
            clerkUser?.id !== targetUserId
          ) {
            return;
          }

          if (response.data?.success && response.data?.data) {
            setUserProfile(response.data.data);
            syncedUserIdRef.current = targetUserId;
            retryCountRef.current = 0;
            setProfileSyncError(null);
          } else {
            throw new Error(
              response.data?.message || "Invalid response from user service"
            );
          }
        } catch (error) {
          // Stale response check on error
          if (
            latestRequestIdRef.current !== currentRequestId ||
            clerkUser?.id !== targetUserId
          ) {
            return;
          }

          const errMsg =
            error?.response?.data?.message ||
            error?.message ||
            "Profile synchronization failed";

          console.warn("[AppContext] Profile synchronization failed:", errMsg);
          setProfileSyncError(errMsg);
          syncedUserIdRef.current = null;

          // Controlled retry with exponential backoff (max 3 retries)
          if (retryCountRef.current < 3) {
            const attempt = retryCountRef.current + 1;
            retryCountRef.current = attempt;
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 6000);

            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(() => {
              if (clerkUser?.id === targetUserId && isSignedIn) {
                syncUserProfile({ force: true });
              }
            }, delay);
          }
        } finally {
          if (latestRequestIdRef.current === currentRequestId) {
            setSyncingProfile(false);
            inFlightPromiseRef.current = null;
          }
        }
      })();

      inFlightPromiseRef.current = promise;
      return promise;
    },
    [isSignedIn, clerkUser]
  );

  /**
   * Determine isOwner via GET /api/hotels/owner (authenticated).
   * In the microservices architecture, ownership is determined by whether the user
   * owns any registered hotels in catalog-service.
   */
  const checkOwnerStatus = useCallback(async () => {
    if (import.meta.env.DEV && typeof window !== "undefined" && (window.__DEV_OWNER || new URLSearchParams(window.location.search).get('dev_owner') === 'true')) {
      setIsOwner(true);
      setCheckingOwner(false);
      return;
    }

    if (!isSignedIn) {
      setIsOwner(false);
      setCheckingOwner(false);
      return;
    }

    setCheckingOwner(true);
    try {
      const response = await authApi.get('/api/hotels/owner');
      const count = response.data?.count ?? response.data?.hotels?.length ?? 0;
      setIsOwner(count > 0);
    } catch {
      setIsOwner(false);
    } finally {
      setCheckingOwner(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isAuthLoaded || isSignedIn === undefined) return;

    if (isSignedIn && clerkUser?.id) {
      syncUserProfile();
      checkOwnerStatus();
    } else {
      // Clear timers and state on logout
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      latestRequestIdRef.current++;
      inFlightPromiseRef.current = null;
      retryCountRef.current = 0;
      syncedUserIdRef.current = null;
      setUserProfile(null);
      setProfileSyncError(null);
      setIsOwner(false);
      setCheckingOwner(false);
    }

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [isAuthLoaded, isSignedIn, clerkUser?.id, syncUserProfile, checkOwnerStatus]);

  const value = {
    currency,
    navigate,
    user,
    userProfile,
    syncingProfile,
    profileSyncError,
    syncUserProfile,
    getToken,
    isOwner,
    setIsOwner,
    checkingOwner,
    checkOwnerStatus,
    // publicApi exported as `axios` for backward compatibility
    axios: publicApi,
    authApi,
    showHotelReg,
    setShowHotelReg,
    searchedCities,
    setSearchedCities,
    rooms,
    loadingRooms,
    fetchRooms,
    isServerUnreachable,
    roomsError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  return useContext(AppContext);
};
