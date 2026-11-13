import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { publicApi, authApi } from '../lib/apiClient';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const currency = import.meta.env.VITE_CURRENCY || '₹';
  const navigate = useNavigate();
  const { getToken, isSignedIn, isLoaded: isAuthLoaded } = useAuth();
  const { user } = useUser();

  const [isOwner, setIsOwner] = useState(false);
  const [checkingOwner, setCheckingOwner] = useState(true);
  const [showHotelReg, setShowHotelReg] = useState(false);
  // searchedCities kept in local state for filtering & backward compatibility
  // Note: Backend user-service does not persist recent search history
  const [searchedCities, setSearchedCities] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

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
   * The catalog-service currently only provides GET /api/rooms/hotel/:hotelId
   * A public GET /api/rooms endpoint returning all active rooms is a documented backend dependency.
   */
  const roomsFetching = useRef(false);
  const fetchRooms = useCallback(async () => {
    if (roomsFetching.current) return;
    roomsFetching.current = true;
    setLoadingRooms(true);
    try {
      const response = await publicApi.get('/api/rooms');
      setRooms(response.data?.rooms ?? []);
    } catch {
      // Graceful fallback to empty array when endpoint is missing or returns error
      setRooms([]);
    } finally {
      roomsFetching.current = false;
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  /**
   * Determine isOwner via GET /api/hotels/owner (authenticated).
   * In the microservices architecture, ownership is determined by whether the user
   * owns any registered hotels in catalog-service.
   */
  const checkOwnerStatus = useCallback(async () => {
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
    checkOwnerStatus();
  }, [isAuthLoaded, isSignedIn, checkOwnerStatus]);

  const value = {
    currency,
    navigate,
    user,
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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  return useContext(AppContext);
};
