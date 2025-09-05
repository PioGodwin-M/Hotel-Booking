import React, { useState, useMemo } from 'react'
import { assets, facilityIcons } from '../assets/assets'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StarRating from '../components/StarRating';
import { useAppContext } from '../context/AppContext';

const CheckBox = ({label, selected=false, onChange = () => {}}) => {
  return (
    <label className='flex gap-3 items-center cursor-pointer mt-2 text-sm'>
      <input 
        type='checkbox' 
        checked={selected} 
        onChange={(e)=>onChange(e.target.checked,label)}
      />
      <span className='font-light select-none'>{label}</span>
    </label>
  )
}

const RadioButton = ({label, selected=false, onChange = () => {}}) => {
  return (
    <label className='flex gap-3 items-center cursor-pointer mt-2 text-sm'>
      <input 
        type='radio' 
        name='sort-option'
        checked={selected} 
        onChange={()=>onChange(label)}
      />
      <span className='font-light select-none'>{label}</span>
    </label>
  )
}

const AllRooms = () => {
  const [openFilters, SetOpenFilters] = useState(false);
  const roomTypes = ["Single Bed","Double Bed","Luxury Room","Family Suite"];
  const priceRanges = ["0 to 500","500 to 1000","1000 to 1500","1500 and more"];
  const sortOptions = ["Prices Low to High","Prices High to Low","Newest First"];

  const [searchParams, setSearchParams] = useSearchParams(); // ✅ FIXED
  const { rooms, navigate, currency } = useAppContext();

  const [selectedFilters, setSelectedFilters] = useState({
    roomTypes:[],
    priceRange:[],
  });
  const [selectedSort, setSelectedSort] = useState('');

  const handleFilterChange=(Checked,value,type)=>{
    setSelectedFilters((prev)=>{
      const updatedFilters={...prev};
      if(Checked){
        updatedFilters[type].push(value);
      } else {
        updatedFilters[type]=prev[type].filter((item)=>item !== value);
      }
      return updatedFilters;
    });
  }

  const handleSortChange=(value)=>{
    setSelectedSort(value);
  }

  const matchesRoomType=(room)=>{
    if(selectedFilters.roomTypes.length===0) return true;
    return selectedFilters.roomTypes.includes(room.roomType);
  }

  const matchesPriceRange=(room)=>{
    if(selectedFilters.priceRange.length===0) return true;
    return selectedFilters.priceRange.some((range)=>{
      const [min,max] = range.split(' to ').map(Number);
      return room.pricePerNight >= min && room.pricePerNight <= max;
    });
  }

  const sortedRooms= (a,b)=>{
    if(selectedSort==="Prices Low to High"){
      return a.pricePerNight - b.pricePerNight;
    } else if(selectedSort==="Prices High to Low"){
      return b.pricePerNight - a.pricePerNight;
    } else if(selectedSort==="Newest First"){
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return 0;
  }

  const filterDestinations=(room)=>{
    const destination = searchParams.get('destination');
    if(!destination) return true;
    return room.hotel.city.toLowerCase().includes(destination.toLowerCase()) 
        || room.hotel.name.toLowerCase().includes(destination.toLowerCase());
  }

  const filteredRooms = useMemo(()=>{
    return rooms
      .filter((room)=>matchesRoomType(room) && matchesPriceRange(room) && filterDestinations(room))
      .sort(sortedRooms);
  },[rooms,selectedFilters,selectedSort,searchParams]);

  const clearFilters=()=>{
    setSelectedFilters({  
      roomTypes:[],
      priceRange:[],
    });
    setSelectedSort('');
    setSearchParams({});
  }

  return (
    <div className='flex flex-col-reverse lg:flex-row items-start justify-between pt-28 md:pt-35 px-4 md:px-16 lg:px-24 xl:px-32'>
      <div>
        <div className='flex flex-col items-start text-left'>
          <h1 className='font-playfair text-4xl md:text-[40px]'>Hotel Rooms</h1>
          <p className='text-sm md:text-base text-gray-500/90 mt-2 max-w-174'>
            Take advantage of our limited-time offers and special packages to enhance your stay and create unforgettable memories.
          </p>
        </div>

        {filteredRooms.map((room)=>(
          <div key={room._id} className='flex flex-col md:flex-row items-start py-10 gap-6 border-b border-gray-300 last:pb-30 last:border-0'> 
            <img 
              onClick={()=>{navigate(`/rooms/${room._id}`);scrollTo(0,0)}} 
              src={room.images[0]} 
              alt="room-image" 
              title='View Room Details' 
              className='max-h-65 md:w-1/2 rounded-xl shadow-lg object-cover cursor-pointer'
            />
            <div className='flex flex-col gap-2 md:w-1/2'>
              <p className='text-gray-500'>{room.hotel.city}</p>
              <p 
                className='text-gray-800 text-3xl font-playfair cursor-pointer' 
                onClick={()=>{navigate(`/rooms/${room._id}`);scrollTo(0,0)}}
              >
                {room.hotel.name}
              </p>
              <div className='flex items-center'>
                <StarRating/>
                <p className='ml-2'>200+ reviews</p>
              </div>

              <div className='flex items-center gap-1 text-gray-500 mt-2 text-sm'>
                <img src={assets.locationIcon} alt="location-icon"/>
                <span>{room.hotel.address}</span>
              </div>

              <div className='flex items-center mt-4 mb-6 gap-4'>
                {room.amenities.map((item,index)=>(
                  <div key={index} className='flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F5F5ff]/70'>
                    <img src={facilityIcons[item]} alt={item} className='w-5 h-5'/>
                    <p className='text-xs'>{item}</p>
                  </div>
                ))}
              </div>

              <p className='text-xl font-medium text-gray-700'>₹ {room.pricePerNight} /night</p>
            </div>
          </div>
        ))}
      </div>

      <div className='bg-white w-80 border border-gray-300 text-gray-600 max-lg:mb-8 min-lg:mt-16'>
        <div className={`flex items-center justify-between px-5 py-2.5 min-lg:border-b border-gray-300 ${openFilters && "border-b"}`}>
          <p className='text-base font-medium text-gray-800'>FILTERS</p>
          <div className='text-xs cursor-pointer'>
            <span onClick={()=>SetOpenFilters(!openFilters)} className='lg:hidden'>{openFilters?'HIDE':'SHOW' }</span>
            <span onClick={clearFilters} className='hidden lg:block'>Clear</span>
          </div>
        </div>

        <div className={`${openFilters? 'h-auto' : 'h-0 lg:h-auto'} overflow-hidden transition-all duration-700`}>
          <div className='px-5 pt-5'>
            <p className='font-medium text-gray-800 pb-2'>Popular filters</p>
            {roomTypes.map((room,index)=>(
              <CheckBox 
                key={index} 
                label={room} 
                selected={selectedFilters.roomTypes.includes(room)} 
                onChange={(checked)=> handleFilterChange(checked,room,'roomTypes')}
              />
            ))}
          </div>

          <div className='px-5 pt-5'>
            <p className='font-medium text-gray-800 pb-2'>Price Range</p>
            {priceRanges.map((range,index)=>(
              <CheckBox 
                key={index} 
                label={`${currency} ${range}`} 
                selected={selectedFilters.priceRange.includes(range)} 
                onChange={(checked)=> handleFilterChange(checked,range,'priceRange')}
              />
            ))}
          </div>

          <div className='px-5 pt-5 pb-7'>
            <p className='font-medium text-gray-800 pb-2'>Sort By</p>
            {sortOptions.map((option,index)=>(
              <RadioButton 
                key={index} 
                label={option} 
                selected={selectedSort===option} 
                onChange={()=>handleSortChange(option)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AllRooms
