import React from 'react';
import { Link } from 'react-router-dom';
import { assets } from '../assets/assets';
import { useAppContext } from '../context/AppContext';

const HotelCard = ({ room, index }) => {
  const { currency } = useAppContext();
  const roomImage = room?.images?.[0] || assets.roomImg1;
  const hotelName = room?.hotel?.name || 'Hotel Stay';
  const hotelAddress = room?.hotel?.address || room?.hotel?.city || 'Location unavailable';

  return (
    <Link
      to={'/rooms/' + room._id}
      onClick={() => window.scrollTo(0, 0)}
      key={room._id}
      className='relative max-w-70 w-full rounded-xl overflow-hidden bg-white text-gray-500/90 shadow-[0px_4px_4px_rgba(0,0,0,0.05)] transition-all duration-300 transform hover:-translate-y-2 hover:shadow-lg'
    >
      <img src={roomImage} alt="Room" className='w-full h-44 object-cover' />

      {index % 2 === 0 && (
        <p className='px-3 py-1 absolute top-3 left-3 text-xs bg-white text-gray-800 font-medium rounded-full shadow-xs'>
          Best Seller
        </p>
      )}

      <div className='p-4 pt-5'>
        <div className='flex items-center justify-between'>
          <p className='font-playfair text-xl font-medium text-gray-800 truncate' title={hotelName}>
            {hotelName}
          </p>
          <div className='flex items-center gap-1 text-sm font-medium text-gray-700 shrink-0 ml-1'>
            <img src={assets.starIconFilled} alt="StarIcon" className='h-4 w-4' /> 4.5
          </div>
        </div>
        <div className='flex items-center gap-1 text-sm text-gray-500 mt-1 truncate'>
          <img src={assets.locationIcon} alt='location-icon' className='h-3.5 w-3.5 shrink-0' />
          <span className='truncate'>{hotelAddress}</span>
        </div>
        <div className='flex items-center justify-between mt-4'>
          <p>
            <span className='text-xl font-semibold text-gray-800'>
              {currency || '₹'} {room.pricePerNight}
            </span>
            <span className='text-xs text-gray-500'>/night</span>
          </p>
          <button className='px-4 py-2 text-sm font-medium border border-gray-300 rounded hover:bg-gray-50 transition-all cursor-pointer'>
            Book Now
          </button>
        </div>
      </div>
    </Link>
  );
};

export default HotelCard;
