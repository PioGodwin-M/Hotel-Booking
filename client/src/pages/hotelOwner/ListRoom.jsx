import React, { useEffect, useState, useCallback } from 'react';
import Title from '../../components/Title';
import { useAppContext } from '../../context/AppContext';
import { authApi } from '../../lib/apiClient';
import toast from 'react-hot-toast';

const ListRoom = () => {
  const { user, currency } = useAppContext();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  // Fetch rooms belonging to all hotels of the authenticated owner
  const fetchOwnerRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Retrieve owner's hotels
      const hotelsRes = await authApi.get('/api/hotels/owner');
      const hotels = hotelsRes.data?.hotels || [];

      if (hotels.length === 0) {
        setRooms([]);
        return;
      }

      // Step 2: Retrieve rooms for each owned hotel
      const roomPromises = hotels.map(async (hotel) => {
        try {
          const res = await authApi.get(`/api/rooms/hotel/${hotel._id}`);
          const hotelRooms = res.data?.rooms || [];
          // Enrich room items with parent hotel details for clean display
          return hotelRooms.map((r) => ({
            ...r,
            hotelName: hotel.name,
            hotelCity: hotel.city,
          }));
        } catch (err) {
          console.error(`Failed to fetch rooms for hotel ${hotel._id}:`, err);
          return [];
        }
      });

      const nestedRooms = await Promise.all(roomPromises);
      setRooms(nestedRooms.flat());
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load your rooms';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle active status via PATCH /api/rooms/:roomId/status with { isActive: boolean }
  const toggleAvailability = async (roomId, currentIsActive) => {
    if (togglingId) return;
    setTogglingId(roomId);

    const nextIsActive = !currentIsActive;

    // Optimistically update UI
    setRooms((prev) =>
      prev.map((r) => (r._id === roomId ? { ...r, isActive: nextIsActive } : r))
    );

    try {
      const { data } = await authApi.patch(`/api/rooms/${roomId}/status`, {
        isActive: nextIsActive,
      });

      if (data.success) {
        toast.success(data.message || (nextIsActive ? 'Room activated' : 'Room deactivated'));
      } else {
        // Rollback on rejection
        setRooms((prev) =>
          prev.map((r) => (r._id === roomId ? { ...r, isActive: currentIsActive } : r))
        );
        toast.error(data.message || 'Could not update status');
      }
    } catch (err) {
      // Rollback on error
      setRooms((prev) =>
        prev.map((r) => (r._id === roomId ? { ...r, isActive: currentIsActive } : r))
      );
      toast.error(err.response?.data?.message || err.message || 'Status update failed');
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOwnerRooms();
    }
  }, [user, fetchOwnerRooms]);

  return (
    <div>
      <Title
        align="left"
        font="outfit"
        title="Room Listings"
        subTitle="View, edit, or manage all listed rooms. Keep the information up-to-date to provide the best experience for users."
      />
      <div className="flex items-center justify-between mt-8 max-w-3xl">
        <p className="text-gray-500 font-medium">All Rooms ({rooms.length})</p>
        <button
          onClick={fetchOwnerRooms}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="w-full max-w-3xl mt-4 p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          Loading your rooms...
        </div>
      ) : error ? (
        <div className="w-full max-w-3xl mt-4 p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <p className="font-medium">Error loading rooms</p>
          <p className="mt-1">{error}</p>
          <button
            onClick={fetchOwnerRooms}
            className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-xs"
          >
            Retry
          </button>
        </div>
      ) : rooms.length === 0 ? (
        <div className="w-full max-w-3xl mt-4 p-8 text-center bg-gray-50 rounded-lg border border-gray-200 text-gray-500">
          <p className="font-medium text-gray-700">No rooms listed yet</p>
          <p className="text-sm mt-1">Register a hotel and add rooms from the Add Room tab to see them here.</p>
        </div>
      ) : (
        <div className="w-full max-w-3xl text-left border border-gray-300 rounded-lg max-h-96 overflow-y-auto mt-3">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="py-3 px-4 text-gray-800 font-medium text-left">Room Type</th>
                <th className="py-3 px-4 text-gray-800 font-medium text-left max-sm:hidden">Hotel</th>
                <th className="py-3 px-4 text-gray-800 font-medium text-left max-sm:hidden">Amenities</th>
                <th className="py-3 px-4 text-gray-800 font-medium text-left">Price / night</th>
                <th className="py-3 px-4 text-gray-800 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {rooms.map((item) => {
                const isItemActive = item.isActive ?? true;
                return (
                  <tr key={item._id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-gray-800 border-t border-gray-200 font-medium">
                      {item.roomType}
                    </td>
                    <td className="py-3 px-4 text-gray-600 border-t border-gray-200 max-sm:hidden">
                      {item.hotelName ? `${item.hotelName} (${item.hotelCity})` : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600 border-t border-gray-200 max-sm:hidden">
                      {Array.isArray(item.amenities) && item.amenities.length > 0
                        ? item.amenities.join(', ')
                        : 'None'}
                    </td>
                    <td className="py-3 px-4 text-gray-700 border-t border-gray-200">
                      {currency} {item.pricePerNight}
                    </td>
                    <td className="py-3 px-4 text-sm text-center border-t border-gray-200">
                      <label className="relative inline-flex items-center cursor-pointer text-gray-900 gap-3">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={isItemActive}
                          disabled={togglingId === item._id}
                          onChange={() => toggleAvailability(item._id, isItemActive)}
                        />
                        <div className="w-12 h-7 bg-slate-300 rounded-full peer peer-checked:bg-blue-600 transition-colors duration-200 peer-disabled:opacity-50"></div>
                        <span className="dot absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-5"></span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ListRoom;
