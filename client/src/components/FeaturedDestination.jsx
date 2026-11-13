import React from 'react';
import { useAppContext } from '../context/AppContext';
import HotelCard from './HotelCard';
import Title from './Title';
import { useNavigate } from 'react-router-dom';

const FeaturedDestination = () => {
  const { rooms } = useAppContext();
  const navigate = useNavigate();

  if (!Array.isArray(rooms) || rooms.length === 0) {
    return null;
  }

  return (
    <div className='flex flex-col items-center px-6 md:px-16 lg:px-24 bg-slate-50 py-20'>
      <Title
        title='Featured Destinations'
        subTitle='Discover our handpicked selection of exceptional properties around the world, offering unparalleled luxury and unforgettable experiences'
      />
      <div className='flex flex-wrap justify-center gap-6 mt-16'>
        {rooms.slice(0, 4).map((room, index) => (
          <HotelCard key={room._id} room={room} index={index} />
        ))}
      </div>
      <button
        className='mt-12 px-6 py-2.5 text-sm font-medium border border-gray-300 rounded-full bg-white hover:bg-gray-50 transition-all cursor-pointer shadow-xs'
        onClick={() => {
          navigate('/rooms');
          window.scrollTo(0, 0);
        }}
      >
        View All Destinations
      </button>
    </div>
  );
};

export default FeaturedDestination;
