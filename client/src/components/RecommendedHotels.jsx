import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import HotelCard from './HotelCard';
import Title from './Title';

const RecommendedHotels = () => {
  const { rooms, searchedCities } = useAppContext();
  const [recommended, setRecommended] = useState([]);

  const filterHotels = () => {
    if (!searchedCities || searchedCities.length === 0) {
      // If no search → show all rooms
      setRecommended(rooms);
    } else {
      // Case-insensitive match
      const filteredHotels = rooms.filter((room) =>
        searchedCities.some(
          (city) => city.toLowerCase() === room.hotel.city.toLowerCase()
        )
      );
      setRecommended(filteredHotels);
    }
  };

  useEffect(() => {
    filterHotels();
    console.log("Rooms:", rooms);
    console.log("Searched Cities:", searchedCities);
  }, [rooms, searchedCities]);

  return (
    <div className="flex flex-col items-center px-6 md:px-16 lg:px-24 bg-slate-50 py-20">
      <Title
        title="Recommended Hotels"
        subTitle="Discover our handpicked selection of exceptional properties around the world, offering unparalleled luxury and unforgettable experiences"
      />

      {recommended.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-6 mt-20">
          {recommended.slice(0, 4).map((room, index) => (
            <HotelCard key={room._id} room={room} index={index} />
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-center mt-20">
          No recommended hotels found.
        </p>
      )}
    </div>
  );
};

export default RecommendedHotels;
