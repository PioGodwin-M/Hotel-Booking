import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import HotelCard from './HotelCard';
import Title from './Title';

const RecommendedHotels = () => {
  const { rooms, searchedCities } = useAppContext();
  const [recommended, setRecommended] = useState([]);

  useEffect(() => {
    if (!Array.isArray(rooms)) {
      setRecommended([]);
      return;
    }

    if (!searchedCities || searchedCities.length === 0) {
      setRecommended(rooms);
    } else {
      const filtered = rooms.filter((room) => {
        const city = room?.hotel?.city || '';
        return searchedCities.some(
          (searched) => searched.toLowerCase() === city.toLowerCase()
        );
      });
      setRecommended(filtered.length > 0 ? filtered : rooms);
    }
  }, [rooms, searchedCities]);

  return (
    <div className="flex flex-col items-center px-6 md:px-16 lg:px-24 bg-slate-50 py-20">
      <Title
        title="Recommended Hotels"
        subTitle="Discover our handpicked selection of exceptional properties around the world, offering unparalleled luxury and unforgettable experiences"
      />

      {recommended.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-6 mt-16">
          {recommended.slice(0, 4).map((room, index) => (
            <HotelCard key={room._id} room={room} index={index} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center mt-12 text-sm">
          No recommended hotels available at the moment.
        </p>
      )}
    </div>
  );
};

export default RecommendedHotels;
