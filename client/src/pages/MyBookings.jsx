import React, { useEffect, useState, useCallback } from 'react';
import Title from '../components/Title';
import { assets } from '../assets/assets';
import { useAppContext } from '../context/AppContext';
import { authApi } from '../lib/apiClient';
import PaymentModal from '../components/PaymentModal';
import toast from 'react-hot-toast';

const MyBookings = () => {
  const { user, rooms, currency } = useAppContext();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [initiatingPaymentId, setInitiatingPaymentId] = useState(null);

  // State for active Stripe payment modal
  const [activePayment, setActivePayment] = useState(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      // Microservices: GET /api/bookings/?page=1&limit=50 via API Gateway
      const { data } = await authApi.get('/api/bookings/?page=1&limit=50');
      if (data.success) {
        setBookings(data.bookings || []);
      } else {
        toast.error(data.message || 'Could not fetch your bookings');
      }
    } catch (error) {
      const msg =
        error.response?.data?.message || error.message || 'Failed to fetch bookings';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initiate payment with Payment Service via API Gateway
  const handlePayment = async (booking) => {
    if (initiatingPaymentId) return;
    setInitiatingPaymentId(booking._id);

    try {
      // Deterministic payment idempotency key derived from booking ID.
      // Ensures retries for the same booking reuse the same key and do not trigger PAYMENT_ID_MISMATCH,
      // while separate bookings receive distinct keys.
      const idempotencyKey = `pay_booking_${booking._id}`;

      const { data } = await authApi.post(
        '/api/payments/',
        { bookingId: booking._id },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      if (data.success && data.data?.clientSecret) {
        setActivePayment({
          bookingId: booking._id,
          clientSecret: data.data.clientSecret,
          amountMinor: data.data.amountMinor,
          currency: data.data.currency || 'INR',
        });
      } else {
        toast.error(data.message || 'Payment initiation failed');
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || 'Payment could not be started'
      );
    } finally {
      setInitiatingPaymentId(null);
    }
  };

  // Cancel booking hold via PATCH /api/bookings/:bookingId/cancel
  const handleCancel = async (bookingId) => {
    if (cancellingId) return;
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;

    setCancellingId(bookingId);
    try {
      const { data } = await authApi.patch(`/api/bookings/${bookingId}/cancel`);
      if (data.success) {
        toast.success(data.message || 'Booking cancelled successfully');
        fetchBookings();
      } else {
        toast.error(data.message || 'Could not cancel booking');
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || 'Cancellation failed'
      );
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user, fetchBookings]);

  return (
    <div className="py-28 md:pb-35 md:pt-32 px-4 md:px-16 lg:px-24 xl:px-32">
      <Title
        title="My Bookings"
        subTitle="Easily manage your past, current, and upcoming hotel reservations in one place. Plan your trips seamlessly with just a few clicks"
        align="left"
      />

      <div className="max-w-6xl mt-8 w-full text-gray-800">
        <div className="hidden md:grid md:grid-cols-[3fr_2fr_1.2fr] w-full border-b border-gray-300 font-medium text-base py-3">
          <div>Hotels</div>
          <div>Date & Timings</div>
          <div>Payment & Status</div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-500">
            Loading your bookings...
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-16 text-center text-gray-500 bg-gray-50 rounded-lg mt-4 border border-gray-200">
            <p className="font-medium text-gray-700">No bookings found</p>
            <p className="text-sm mt-1 text-gray-400">
              When you reserve a room, it will appear here.
            </p>
          </div>
        ) : (
          bookings.map((booking) => {
            // Find enriched catalog room info from context
            const matchedRoom = Array.isArray(rooms)
              ? rooms.find((r) => r._id === booking.roomCategoryId)
              : null;

            const hotelName =
              matchedRoom?.hotel?.name || booking.hotel?.name || 'Hotel Stay';
            const hotelAddress =
              matchedRoom?.hotel?.address ||
              booking.hotel?.address ||
              'Address available on confirmation';
            const roomType =
              matchedRoom?.roomType || booking.room?.roomType || 'Standard Room';
            const roomImage =
              matchedRoom?.images?.[0] ||
              booking.room?.images?.[0] ||
              assets.roomImg1;

            const checkInDate = booking.checkIn || booking.checkInDate;
            const checkOutDate = booking.checkOut || booking.checkOutDate;
            const guestCount = booking.numberOfGuests || booking.guests || 1;
            const totalPrice =
              booking.priceSnapshot?.totalAmount ?? booking.totalPrice ?? 0;

            const isPaid = booking.status === 'CONFIRMED' || booking.isPaid;
            const canPay =
              booking.status === 'HELD' ||
              booking.status === 'PAYMENT_PENDING' ||
              (!isPaid && booking.status !== 'CANCELLED' && booking.status !== 'EXPIRED');
            // Customer cancellation is strictly permitted only when booking status is 'HELD'.
            // PAYMENT_PENDING, CONFIRMED, CANCELLED, EXPIRED, and PAYMENT_FAILED cannot be cancelled by customer.
            const canCancel = booking.status === 'HELD';

            return (
              <div
                key={booking._id}
                className="grid grid-cols-1 md:grid-cols-[3fr_2fr_1.2fr] w-full border-b border-gray-300 py-6 first:border-t gap-4"
              >
                {/* Hotel Details */}
                <div className="flex flex-col md:flex-row">
                  <img
                    src={roomImage}
                    alt="hotel-img"
                    className="w-full md:w-44 h-32 rounded shadow object-cover"
                  />
                  <div className="flex flex-col gap-1.5 max-md:mt-3 md:ml-4">
                    <p className="font-playfair text-2xl">
                      {hotelName}
                      <span className="text-sm font-inter text-gray-500">
                        {' '}
                        ({roomType})
                      </span>
                    </p>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <img src={assets.locationIcon} alt="Location" className="h-4" />
                      <span>{hotelAddress}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <img src={assets.guestsIcon} alt="Guests" className="h-4" />
                      <span>Guests: {guestCount}</span>
                    </div>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      Total: {currency} {totalPrice}
                    </p>
                  </div>
                </div>

                {/* Date & Timings */}
                <div className="flex flex-row md:items-center md:gap-12 mt-3 gap-8">
                  <div>
                    <p className="text-xs uppercase text-gray-400 font-medium">Check-In</p>
                    <p className="text-gray-700 text-sm font-medium mt-0.5">
                      {checkInDate ? new Date(checkInDate).toDateString() : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400 font-medium">Check-Out</p>
                    <p className="text-gray-700 text-sm font-medium mt-0.5">
                      {checkOutDate ? new Date(checkOutDate).toDateString() : '—'}
                    </p>
                  </div>
                </div>

                {/* Payment & Actions */}
                <div className="flex flex-col items-start justify-center pt-3 gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        isPaid
                          ? 'bg-green-500'
                          : booking.status === 'CANCELLED' || booking.status === 'EXPIRED'
                          ? 'bg-gray-400'
                          : 'bg-amber-500'
                      }`}
                    ></div>
                    <span
                      className={`text-xs font-semibold uppercase ${
                        isPaid
                          ? 'text-green-600'
                          : booking.status === 'CANCELLED' || booking.status === 'EXPIRED'
                          ? 'text-gray-500'
                          : 'text-amber-600'
                      }`}
                    >
                      {booking.status || (isPaid ? 'Paid' : 'Unpaid')}
                    </span>
                  </div>

                  {canPay && (
                    <button
                      onClick={() => handlePayment(booking)}
                      disabled={initiatingPaymentId === booking._id}
                      className="px-4 py-1.5 mt-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-full transition cursor-pointer disabled:opacity-50"
                    >
                      {initiatingPaymentId === booking._id ? 'Initiating...' : 'Pay Now'}
                    </button>
                  )}

                  {canCancel && (
                    <button
                      onClick={() => handleCancel(booking._id)}
                      disabled={cancellingId === booking._id}
                      className="px-4 py-1 text-xs text-red-600 hover:bg-red-50 rounded-full border border-red-200 transition cursor-pointer"
                    >
                      {cancellingId === booking._id ? 'Cancelling...' : 'Cancel Hold'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Stripe Payment Modal */}
      {activePayment && (
        <PaymentModal
          bookingId={activePayment.bookingId}
          clientSecret={activePayment.clientSecret}
          amountMinor={activePayment.amountMinor}
          currency={activePayment.currency}
          onClose={() => setActivePayment(null)}
          onSuccess={() => {
            setActivePayment(null);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
};

export default MyBookings;
