import React, { useEffect, useState, useCallback } from 'react';
import Title from '../../components/Title';
import { assets } from '../../assets/assets';
import { useAppContext } from '../../context/AppContext';
import { authApi } from '../../lib/apiClient';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { currency, user, rooms } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    hotelsCount: 0,
    roomsCount: 0,
    hotels: [],
    bookings: [],
    totalBookings: 0,
    totalRevenue: 0,
    revenueByCurrency: {},
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch owner's hotels from catalog-service
      const hotelsRes = await authApi.get('/api/hotels/owner');
      const hotels = hotelsRes.data?.hotels || [];

      // 2. Fetch room count across all owner's hotels
      let totalRooms = 0;
      for (const hotel of hotels) {
        try {
          const roomsRes = await authApi.get(`/api/rooms/hotel/${hotel._id}`);
          totalRooms += (roomsRes.data?.rooms || []).length;
        } catch {
          // ignore per-hotel room count failure
        }
      }

      // 3. Fetch owner booking analytics from booking-service via API Gateway
      let ownerBookings = [];
      let totalRevenue = 0;
      let totalBookings = 0;
      let revenueByCurrency = {};

      try {
        const dashRes = await authApi.get('/api/bookings/owner');
        if (dashRes.data?.success) {
          ownerBookings = dashRes.data.bookings || [];
          totalBookings = dashRes.data.totalBookings || 0;
          totalRevenue = dashRes.data.totalRevenue;
          revenueByCurrency = dashRes.data.revenueByCurrency || {};
        }
      } catch (dashErr) {
        toast.error(dashErr.response?.data?.message || 'Failed to load booking metrics');
      }

      setStats({
        hotelsCount: hotels.length,
        roomsCount: totalRooms,
        hotels,
        bookings: ownerBookings,
        totalBookings,
        totalRevenue,
        revenueByCurrency,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  // Format revenue display with multi-currency safeguard
  const revenueDisplay =
    stats.totalRevenue !== null && stats.totalRevenue !== undefined
      ? `${currency} ${stats.totalRevenue}`
      : Object.entries(stats.revenueByCurrency || {}).length > 0
      ? Object.entries(stats.revenueByCurrency)
          .map(([curr, amt]) => `${curr} ${amt}`)
          .join(', ')
      : `${currency} 0`;

  // Render status badge reflecting the actual booking lifecycle state
  const renderStatusBadge = (item) => {
    const status = item.status;
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-block py-1 px-3 text-xs rounded-full font-medium bg-green-100 text-green-700">
            Confirmed
          </span>
        );
      case 'HELD':
        return (
          <span className="inline-block py-1 px-3 text-xs rounded-full font-medium bg-amber-100 text-amber-700">
            Hold Active
          </span>
        );
      case 'PAYMENT_PENDING':
        return (
          <span className="inline-block py-1 px-3 text-xs rounded-full font-medium bg-blue-100 text-blue-700">
            Payment Pending
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-block py-1 px-3 text-xs rounded-full font-medium bg-red-100 text-red-700">
            Cancelled
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-block py-1 px-3 text-xs rounded-full font-medium bg-gray-100 text-gray-600">
            Expired
          </span>
        );
      case 'PAYMENT_FAILED':
        return (
          <span className="inline-block py-1 px-3 text-xs rounded-full font-medium bg-rose-100 text-rose-700">
            Failed
          </span>
        );
      default:
        return (
          <span
            className={`inline-block py-1 px-3 text-xs rounded-full font-medium ${
              item.isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {item.isPaid ? 'Completed' : 'Pending'}
          </span>
        );
    }
  };

  return (
    <div>
      <Title
        align="left"
        font="outfit"
        title="Dashboard"
        subTitle="Monitor your hotel listings, track inventory and analyse performance all in one place."
      />

      {loading ? (
        <div className="my-8 p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          Loading dashboard metrics...
        </div>
      ) : (
        <>
          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-8">
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg flex p-4 items-center">
              <img src={assets.totalBookingIcon} alt="Hotels" className="max-sm:hidden h-10" />
              <div className="flex flex-col sm:ml-4 font-medium">
                <p className="text-blue-600 text-sm">Registered Hotels</p>
                <p className="text-gray-900 text-2xl font-semibold mt-1">{stats.hotelsCount}</p>
              </div>
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg flex p-4 items-center">
              <img src={assets.listIcon} alt="Rooms" className="max-sm:hidden h-8 w-8 text-indigo-500" />
              <div className="flex flex-col sm:ml-4 font-medium">
                <p className="text-indigo-600 text-sm">Active Rooms</p>
                <p className="text-gray-900 text-2xl font-semibold mt-1">{stats.roomsCount}</p>
              </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded-lg flex p-4 items-center">
              <img src={assets.totalBookingIcon} alt="Total Bookings" className="max-sm:hidden h-10" />
              <div className="flex flex-col sm:ml-4 font-medium">
                <p className="text-blue-600 text-sm">Total Bookings</p>
                <p className="text-gray-900 text-2xl font-semibold mt-1">{stats.totalBookings}</p>
              </div>
            </div>

            <div className="bg-green-50/50 border border-green-100 rounded-lg flex p-4 items-center">
              <img src={assets.totalRevenueIcon} alt="Revenue" className="max-sm:hidden h-10" />
              <div className="flex flex-col sm:ml-4 font-medium">
                <p className="text-green-600 text-sm">Total Revenue</p>
                <p className="text-gray-900 text-2xl font-semibold mt-1">
                  {revenueDisplay}
                </p>
              </div>
            </div>
          </div>

          {/* Registered Hotels List */}
          <h2 className="text-xl text-blue-950/80 font-medium mb-3">Your Properties</h2>
          {stats.hotels.length === 0 ? (
            <p className="text-gray-500 text-sm mb-8">No hotels registered yet.</p>
          ) : (
            <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {stats.hotels.map((hotel) => (
                <div key={hotel._id} className="p-4 border border-gray-200 rounded-lg bg-white shadow-xs">
                  <p className="font-semibold text-gray-800">{hotel.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{hotel.address}, {hotel.city}</p>
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                    <span>Phone: {hotel.contact}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${hotel.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {hotel.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Bookings Table */}
          <h2 className="text-xl text-blue-950/70 font-medium mb-5">Recent Bookings</h2>
          <div className="w-full max-w-3xl text-left border border-gray-300 rounded-lg max-h-80 overflow-y-auto mb-8">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="py-3 px-4 text-gray-800 font-medium max-sm:hidden">Room Name</th>
                  <th className="py-3 px-4 text-gray-800 font-medium text-center">Total Amount</th>
                  <th className="py-3 px-4 text-gray-800 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {stats.bookings.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500 border-t border-gray-200">
                      No recent bookings to display.
                    </td>
                  </tr>
                ) : (
                  stats.bookings.map((item, index) => {
                    // Enrich room name using catalog rooms from AppContext
                    const matchedRoom = Array.isArray(rooms)
                      ? rooms.find((r) => r._id === (item.roomCategoryId || item.room?._id))
                      : null;
                    const roomName = matchedRoom?.roomType || item.room?.roomType || 'Standard Room';

                    // Total amount extracted from priceSnapshot or backwards-compatible fallback
                    const totalAmount =
                      item.priceSnapshot?.totalAmount ?? item.totalAmount ?? item.totalPrice ?? 0;
                    const itemCurrency = item.priceSnapshot?.currency || currency;

                    return (
                      <tr key={item._id || index} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-700 border-t border-gray-200 max-sm:hidden">
                          {roomName}
                        </td>
                        <td className="py-3 px-4 text-gray-700 border-t border-gray-200 text-center font-medium">
                          {itemCurrency} {totalAmount}
                        </td>
                        <td className="py-3 px-4 text-gray-700 border-t border-gray-200 text-center">
                          {renderStatusBadge(item)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
