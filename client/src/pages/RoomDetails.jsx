import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { assets, facilityIcons, roomCommonData } from '../assets/assets';
import StarRating from '../components/StarRating';
import { useAppContext } from '../context/AppContext';
import { authApi, publicApi } from '../lib/apiClient';
import { useClerk } from '@clerk/clerk-react';
import toast from 'react-hot-toast';

const RoomDetails = () => {
  const { rooms, navigate, user, currency } = useAppContext();
  const { openSignIn } = useClerk();
  const { id } = useParams();

  // Local calendar date calculation helpers (avoids UTC timezone date shifting)
  const toLocalDateString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const minCheckIn = toLocalDateString(tomorrow);

  const getDayAfter = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const nextDay = new Date(year, month - 1, day + 1);
    return toLocalDateString(nextDay);
  };

  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [guests, setGuests] = useState(1);
  const [room, setRoom] = useState(null);
  const [mainImage, setMainImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load room either from global context or directly from public catalog endpoint
  useEffect(() => {
    let isMounted = true;

    if (Array.isArray(rooms) && rooms.length > 0) {
      const foundRoom = rooms.find((r) => r._id === id);
      if (foundRoom) {
        setRoom(foundRoom);
        if (Array.isArray(foundRoom.images) && foundRoom.images.length > 0) {
          setMainImage(foundRoom.images[0]);
        }
        return;
      }
    }

    if (id) {
      publicApi
        .get(`/api/rooms/${id}`)
        .then((res) => {
          if (isMounted && res.data?.room) {
            setRoom(res.data.room);
            if (Array.isArray(res.data.room.images) && res.data.room.images.length > 0) {
              setMainImage(res.data.room.images[0]);
            }
          }
        })
        .catch(() => {
          // Fallback UI handles missing room
        });
    }

    return () => {
      isMounted = false;
    };
  }, [rooms, id]);

  const handleCheckInChange = (newCheckIn) => {
    setCheckInDate(newCheckIn);
    if (!checkOutDate || checkOutDate <= newCheckIn) {
      setCheckOutDate(getDayAfter(newCheckIn));
    }
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!user) {
      toast.error('Please sign in to book a room');
      if (openSignIn) openSignIn();
      return;
    }

    if (!checkInDate || !checkOutDate) {
      toast.error('Please select both check-in and check-out dates');
      return;
    }

    if (checkInDate >= checkOutDate) {
      toast.error('Check-out date must be strictly after check-in date');
      return;
    }

    const guestCount = Number(guests);
    if (!guestCount || guestCount < 1 || guestCount > 10) {
      toast.error('Guests must be between 1 and 10');
      return;
    }

    const hotelId = room?.hotel?._id || room?.hotel;
    if (!hotelId) {
      toast.error('Hotel information is missing for this room');
      return;
    }

    setSubmitting(true);
    try {
      // Generate a client-side idempotency key for safe retries
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `book_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      // Build ISO UTC strings from the exact local calendar date chosen (avoids timezone shift)
      const payload = {
        hotelId,
        roomCategoryId: room._id,
        checkIn: new Date(`${checkInDate}T00:00:00.000Z`).toISOString(),
        checkOut: new Date(`${checkOutDate}T00:00:00.000Z`).toISOString(),
        numberOfRooms: 1,
        numberOfGuests: guestCount,
        idempotencyKey,
      };

      const { data } = await authApi.post('/api/bookings/', payload);

      if (data.success) {
        toast.success(data.message || 'Booking hold created! Complete payment in My Bookings.');
        navigate('/my-bookings');
        window.scrollTo(0, 0);
      } else {
        toast.error(data.message || 'Booking reservation could not be completed');
      }
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Booking failed. Please try different dates or another room.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!room) {
    return (
      <div className='py-36 px-4 text-center max-w-xl mx-auto'>
        <p className='text-gray-600 text-lg'>Loading room details...</p>
        <p className='text-gray-400 text-xs mt-2'>
          If the room does not appear, catalog data may be loading or the room ID might be invalid.
        </p>
        <Link
          to='/rooms'
          className='inline-block mt-6 px-6 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700'
        >
          Back to all rooms
        </Link>
      </div>
    );
  }

  const hotelName = room.hotel?.name || 'Hotel';
  const hotelAddress = room.hotel?.address || room.hotel?.city || 'Location details unavailable';
  const roomImages = Array.isArray(room.images) && room.images.length > 0 ? room.images : [assets.roomImg1];
  const roomAmenities = Array.isArray(room.amenities) ? room.amenities : [];
  const hostImage = room.hotel?.owner?.image || assets.userIcon;

  return (
    <div className='py-28 md:py-35 px-4 md:px-16 lg:px-24 xl:px-32'>
      <div className='flex flex-col md:flex-row items-start md:items-center gap-2'>
        <h1 className='text-3xl md:text-4xl font-playfair'>
          {hotelName}
          <span className='font-inter text-sm'> ({room.roomType})</span>
        </h1>
        <p className='text-xs font-inter py-1.5 px-3 text-white bg-orange-500 rounded-full'>
          Special Rate
        </p>
      </div>

      <div className='flex gap-1 items-center mt-2'>
        <StarRating />
        <p className='ml-2 text-sm text-gray-500'>200+ reviews</p>
      </div>

      <div className='flex items-center gap-1 text-gray-500 mt-2 text-sm'>
        <img src={assets.locationIcon} alt="Location" className='h-4' />
        <span>{hotelAddress}</span>
      </div>

      {/* Images gallery */}
      <div className='flex flex-col lg:flex-row mt-6 gap-6'>
        <div className='lg:w-1/2 w-full'>
          <img
            src={mainImage || roomImages[0]}
            alt="Room"
            className='w-full h-80 md:h-96 rounded-xl shadow-lg object-cover'
          />
        </div>
        <div className='grid grid-cols-2 gap-4 lg:w-1/2 w-full'>
          {roomImages.slice(0, 4).map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`Room thumb ${index + 1}`}
              onClick={() => setMainImage(image)}
              className={`w-full h-36 md:h-44 rounded-xl shadow-md object-cover cursor-pointer ${
                (mainImage || roomImages[0]) === image ? 'ring-3 ring-orange-500' : ''
              }`}
            />
          ))}
        </div>
      </div>

      <div className='flex flex-col md:flex-row md:justify-between items-start md:items-center mt-10 gap-4'>
        <div>
          <h2 className='text-2xl md:text-3xl font-playfair'>Experience Luxury Like Never Before</h2>
          <div className='flex flex-wrap items-center gap-3 mt-3'>
            {roomAmenities.map((item, index) => (
              <div key={index} className='flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100'>
                {facilityIcons[item] && (
                  <img src={facilityIcons[item]} alt={item} className='w-4 h-4' />
                )}
                <p className='text-xs text-gray-700'>{item}</p>
              </div>
            ))}
          </div>
        </div>
        <p className='text-2xl font-semibold text-gray-900'>
          {currency} {room.pricePerNight}{' '}
          <span className='text-sm font-normal text-gray-500'>/night</span>
        </p>
      </div>

      {/* Reservation Form */}
      <form
        onSubmit={onSubmitHandler}
        className='flex flex-col md:flex-row items-start md:items-center border border-gray-200 justify-between bg-white shadow-xl p-6 rounded-xl mx-auto mt-12 max-w-6xl mb-12 gap-6'
      >
        <div className='flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8 text-gray-600 w-full md:w-auto'>
          <div className='flex flex-col w-full md:w-auto'>
            <label htmlFor="checkInDate" className='font-medium text-sm text-gray-700'>
              Check-In
            </label>
            <input
              type='date'
              id='checkInDate'
              value={checkInDate}
              min={minCheckIn}
              onChange={(e) => handleCheckInChange(e.target.value)}
              className='w-full rounded border border-gray-300 px-3 py-2 mt-1.5 text-sm outline-none'
              required
            />
          </div>

          <div className='w-px h-12 bg-gray-200 max-md:hidden'></div>

          <div className='flex flex-col w-full md:w-auto'>
            <label htmlFor="checkOutDate" className='font-medium text-sm text-gray-700'>
              Check-Out
            </label>
            <input
              type='date'
              id='checkOutDate'
              value={checkOutDate}
              min={getDayAfter(checkInDate) || getDayAfter(minCheckIn)}
              disabled={!checkInDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              className='w-full rounded border border-gray-300 px-3 py-2 mt-1.5 text-sm outline-none disabled:bg-gray-100'
              required
            />
          </div>

          <div className='w-px h-12 bg-gray-200 max-md:hidden'></div>

          <div className='flex flex-col w-full md:w-auto'>
            <label htmlFor="guests" className='font-medium text-sm text-gray-700'>
              Guests
            </label>
            <input
              type='number'
              id='guests'
              min="1"
              max="10"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className='w-24 rounded border border-gray-300 px-3 py-2 mt-1.5 text-sm outline-none'
              required
            />
          </div>
        </div>

        <button
          type='submit'
          disabled={submitting}
          className='bg-[#2563EB] hover:bg-blue-700 text-white rounded-md max-md:w-full px-8 py-3.5 text-base font-medium cursor-pointer transition disabled:opacity-50'
        >
          {submitting ? 'Reserving...' : 'Book Now'}
        </button>
      </form>

      {/* Common Specifications */}
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 my-10'>
        {roomCommonData.map((spec, index) => (
          <div key={index} className='flex items-start gap-3'>
            <img src={spec.icon} alt={`${spec.title}-icon`} className='w-6 h-6 mt-0.5' />
            <div>
              <p className='text-sm font-medium text-gray-800'>{spec.title}</p>
              <p className='text-xs text-gray-500 mt-0.5'>{spec.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className='max-w-3xl border-y border-gray-200 my-12 py-8 text-gray-600 text-sm leading-relaxed'>
        <p>
          Reservations hold room inventory temporarily. Guests will be allocated to rooms according to availability to ensure a comfortable and pleasant stay.
        </p>
      </div>

      {/* Hosted By */}
      <div className='flex flex-col items-start gap-4'>
        <div className='flex items-center gap-4'>
          <img
            src={hostImage}
            alt="Host"
            className='h-14 w-14 rounded-full object-cover border border-gray-200'
          />
          <div>
            <p className='text-lg font-medium text-gray-900'>Hosted By {hotelName}</p>
            <div className='flex items-center mt-1'>
              <StarRating />
              <p className='ml-2 text-xs text-gray-500'>Superhost verified</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomDetails;
