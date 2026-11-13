import React, { useState, useMemo, useEffect } from 'react';
import { assets, facilityIcons } from '../assets/assets';
import { useSearchParams } from 'react-router-dom';
import StarRating from '../components/StarRating';
import { useAppContext } from '../context/AppContext';

const CheckBox = ({ label, selected = false, onChange = () => {} }) => {
  return (
    <label className='flex gap-3 items-center cursor-pointer mt-2 text-sm'>
      <input
        type='checkbox'
        checked={selected}
        onChange={(e) => onChange(e.target.checked, label)}
      />
      <span className='font-light select-none text-gray-700'>{label}</span>
    </label>
  );
};

const RadioButton = ({ label, selected = false, onChange = () => {} }) => {
  return (
    <label className='flex gap-3 items-center cursor-pointer mt-2 text-sm'>
      <input
        type='radio'
        name='sort-option'
        checked={selected}
        onChange={() => onChange(label)}
      />
      <span className='font-light select-none text-gray-700'>{label}</span>
    </label>
  );
};

const AllRooms = () => {
  const [openFilters, setOpenFilters] = useState(false);
  const roomTypes = ['Single Bed', 'Double Bed', 'Luxury Room', 'Family Suite'];
  const priceRanges = ['0 to 500', '500 to 1000', '1000 to 1500', '1500 and more'];
  const sortOptions = ['Prices Low to High', 'Prices High to Low', 'Newest First'];

  const [searchParams, setSearchParams] = useSearchParams();
  const { rooms, loadingRooms, navigate, currency } = useAppContext();

  const [selectedFilters, setSelectedFilters] = useState({
    roomTypes: [],
    priceRange: [],
  });
  const [selectedSort, setSelectedSort] = useState('');

  const handleFilterChange = (checked, value, type) => {
    setSelectedFilters((prev) => {
      const updatedFilters = { ...prev };
      if (checked) {
        updatedFilters[type].push(value);
      } else {
        updatedFilters[type] = prev[type].filter((item) => item !== value);
      }
      return updatedFilters;
    });
  };

  const handleSortChange = (value) => {
    setSelectedSort(value);
  };

  const filteredRooms = useMemo(() => {
    if (!Array.isArray(rooms)) return [];

    const matchesRoomType = (room) => {
      if (selectedFilters.roomTypes.length === 0) return true;
      return selectedFilters.roomTypes.includes(room.roomType);
    };

    const matchesPriceRange = (room) => {
      if (selectedFilters.priceRange.length === 0) return true;

      return selectedFilters.priceRange.some((range) => {
        if (range.includes('and more')) {
          const min = Number(range.split(' ')[0]);
          return (room.pricePerNight || 0) >= min;
        } else {
          const [min, max] = range.split(' to ').map(Number);
          return (room.pricePerNight || 0) >= min && (room.pricePerNight || 0) <= max;
        }
      });
    };

    const sortedRooms = (a, b) => {
      if (selectedSort === 'Prices Low to High') {
        return (a.pricePerNight || 0) - (b.pricePerNight || 0);
      } else if (selectedSort === 'Prices High to Low') {
        return (b.pricePerNight || 0) - (a.pricePerNight || 0);
      } else if (selectedSort === 'Newest First') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      return 0;
    };

    const filterDestinations = (room) => {
      const destination = searchParams.get('destination');
      if (!destination) return true;
      const dest = destination.toLowerCase();
      const city = (room.hotel?.city || '').toLowerCase();
      const name = (room.hotel?.name || '').toLowerCase();
      return city.includes(dest) || name.includes(dest);
    };

    return rooms
      .filter((room) => matchesRoomType(room) && matchesPriceRange(room) && filterDestinations(room))
      .sort(sortedRooms);
  }, [rooms, selectedFilters, selectedSort, searchParams]);

  const clearFilters = () => {
    setSelectedFilters({
      roomTypes: [],
      priceRange: [],
    });
    setSelectedSort('');
    setSearchParams({});
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className='flex flex-col-reverse lg:flex-row items-start justify-between pt-28 md:pt-35 px-4 md:px-16 lg:px-24 xl:px-32 gap-8'>
      <div className='flex-1 w-full'>
        <div className='flex flex-col items-start text-left'>
          <h1 className='font-playfair text-4xl md:text-[40px]'>Hotel Rooms</h1>
          <p className='text-sm md:text-base text-gray-500/90 mt-2 max-w-174'>
            Take advantage of our limited-time offers and special packages to enhance your stay and create unforgettable memories.
          </p>
        </div>

        {loadingRooms ? (
          <div className='py-20 text-center text-gray-500'>
            Loading rooms...
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className='py-20 text-center text-gray-500 bg-gray-50 rounded-xl my-8 p-8 border border-gray-200'>
            <p className='text-lg font-medium text-gray-700'>No rooms found</p>
            <p className='text-sm text-gray-400 mt-1'>
              Try adjusting your destination or filter criteria, or check back later.
            </p>
            {(selectedFilters.roomTypes.length > 0 || selectedFilters.priceRange.length > 0 || searchParams.get('destination')) && (
              <button
                onClick={clearFilters}
                className='mt-4 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700'
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          filteredRooms.map((room) => {
            const roomImage = room.images?.[0] || assets.roomImg1;
            const hotelName = room.hotel?.name || 'Hotel Stay';
            const hotelCity = room.hotel?.city || '';
            const hotelAddress = room.hotel?.address || hotelCity || 'Location details unavailable';
            const amenities = Array.isArray(room.amenities) ? room.amenities : [];

            return (
              <div
                key={room._id}
                className='flex flex-col md:flex-row items-start py-10 gap-6 border-b border-gray-300 last:pb-30 last:border-0'
              >
                <img
                  onClick={() => {
                    navigate(`/rooms/${room._id}`);
                    window.scrollTo(0, 0);
                  }}
                  src={roomImage}
                  alt="room"
                  title='View Room Details'
                  className='h-60 w-full md:w-1/2 rounded-xl shadow-lg object-cover cursor-pointer'
                />
                <div className='flex flex-col gap-2 md:w-1/2 w-full'>
                  {hotelCity && <p className='text-gray-500 text-sm'>{hotelCity}</p>}
                  <p
                    className='text-gray-800 text-3xl font-playfair cursor-pointer hover:text-blue-600 transition'
                    onClick={() => {
                      navigate(`/rooms/${room._id}`);
                      window.scrollTo(0, 0);
                    }}
                  >
                    {hotelName}
                    <span className='font-inter text-sm text-gray-500 font-normal'> ({room.roomType})</span>
                  </p>
                  <div className='flex items-center'>
                    <StarRating />
                    <p className='ml-2 text-sm text-gray-500'>200+ reviews</p>
                  </div>

                  <div className='flex items-center gap-1 text-gray-500 mt-1 text-sm'>
                    <img src={assets.locationIcon} alt="location" className='h-3.5 w-3.5' />
                    <span>{hotelAddress}</span>
                  </div>

                  <div className='flex flex-wrap items-center mt-3 mb-4 gap-2'>
                    {amenities.map((item, index) => (
                      <div key={index} className='flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F5F5ff]/80'>
                        {facilityIcons[item] && (
                          <img src={facilityIcons[item]} alt={item} className='w-4 h-4' />
                        )}
                        <p className='text-xs text-gray-700'>{item}</p>
                      </div>
                    ))}
                  </div>

                  <p className='text-xl font-semibold text-gray-800'>
                    {currency} {room.pricePerNight}{' '}
                    <span className='text-xs font-normal text-gray-500'>/night</span>
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Filters Sidebar */}
      <div className='bg-white w-full lg:w-80 border border-gray-300 rounded-lg text-gray-600 max-lg:mb-8 shrink-0'>
        <div className={`flex items-center justify-between px-5 py-3 border-b border-gray-300`}>
          <p className='text-base font-semibold text-gray-800'>FILTERS</p>
          <div className='text-xs cursor-pointer text-blue-600 font-medium'>
            <span onClick={() => setOpenFilters(!openFilters)} className='lg:hidden'>
              {openFilters ? 'HIDE' : 'SHOW'}
            </span>
            <span onClick={clearFilters} className='hidden lg:block hover:underline'>
              Clear
            </span>
          </div>
        </div>

        <div className={`${openFilters ? 'block' : 'hidden'} lg:block p-5`}>
          <div>
            <p className='font-medium text-gray-800 mb-2'>Room Types</p>
            {roomTypes.map((type) => (
              <CheckBox
                key={type}
                label={type}
                selected={selectedFilters.roomTypes.includes(type)}
                onChange={(checked, val) => handleFilterChange(checked, val, 'roomTypes')}
              />
            ))}
          </div>

          <hr className='my-4 border-gray-200' />

          <div>
            <p className='font-medium text-gray-800 mb-2'>Price Range</p>
            {priceRanges.map((range) => (
              <CheckBox
                key={range}
                label={range}
                selected={selectedFilters.priceRange.includes(range)}
                onChange={(checked, val) => handleFilterChange(checked, val, 'priceRange')}
              />
            ))}
          </div>

          <hr className='my-4 border-gray-200' />

          <div>
            <p className='font-medium text-gray-800 mb-2'>Sort By</p>
            {sortOptions.map((opt) => (
              <RadioButton
                key={opt}
                label={opt}
                selected={selectedSort === opt}
                onChange={handleSortChange}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllRooms;
