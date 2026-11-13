import React, { useEffect, useState } from 'react';
import Title from '../../components/Title';
import { useAppContext } from '../../context/AppContext';
import { authApi } from '../../lib/apiClient';
import toast from 'react-hot-toast';

const DEFAULT_SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
];

const AddRoom = () => {
  const { setShowHotelReg, fetchRooms } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [fetchingHotels, setFetchingHotels] = useState(true);
  const [hotels, setHotels] = useState([]);
  const [selectedHotelId, setSelectedHotelId] = useState('');

  const [imageUrls, setImageUrls] = useState(['', '', '', '']);
  const [inputs, setInputs] = useState({
    roomType: '',
    pricePerNight: '',
    totalUnits: 1,
    amenities: {
      'Free Wifi': false,
      'Free Breakfast': false,
      'Mountain View': false,
      'Pool Access': false,
    },
  });

  // Fetch owner's hotels to bind the new room to
  useEffect(() => {
    let isMounted = true;
    const fetchHotels = async () => {
      try {
        setFetchingHotels(true);
        const { data } = await authApi.get('/api/hotels/owner');
        if (isMounted) {
          const list = data.hotels || [];
          setHotels(list);
          if (list.length > 0) {
            setSelectedHotelId(list[0]._id);
          }
        }
      } catch (err) {
        if (isMounted) {
          toast.error(err.response?.data?.message || 'Could not fetch your hotels');
        }
      } finally {
        if (isMounted) setFetchingHotels(false);
      }
    };

    fetchHotels();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleImageUrlChange = (index, value) => {
    setImageUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const useSampleImages = () => {
    setImageUrls([...DEFAULT_SAMPLE_IMAGES]);
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (!selectedHotelId) {
      toast.error('Please select or register a hotel first');
      return;
    }

    const price = Number(inputs.pricePerNight);
    const units = Number(inputs.totalUnits);

    if (!inputs.roomType || !price || price <= 0) {
      toast.error('Please enter a valid room type and price');
      return;
    }

    if (!units || units < 1) {
      toast.error('Total units must be at least 1');
      return;
    }

    const filteredImages = imageUrls.map((u) => u.trim()).filter(Boolean);
    if (filteredImages.length === 0) {
      toast.error('Please provide at least one valid image URL');
      return;
    }

    const selectedAmenities = Object.keys(inputs.amenities).filter(
      (key) => inputs.amenities[key]
    );

    setLoading(true);
    try {
      const payload = {
        hotelId: selectedHotelId,
        roomType: inputs.roomType,
        pricePerNight: price,
        totalUnits: units,
        amenities: selectedAmenities,
        images: filteredImages,
      };

      const { data } = await authApi.post('/api/rooms/', payload);

      if (data.success) {
        toast.success(data.message || 'Room added successfully');
        setImageUrls(['', '', '', '']);
        setInputs({
          roomType: '',
          pricePerNight: '',
          totalUnits: 1,
          amenities: {
            'Free Wifi': false,
            'Free Breakfast': false,
            'Mountain View': false,
            'Pool Access': false,
          },
        });
        if (fetchRooms) fetchRooms();
      } else {
        toast.error(data.message || 'Failed to add room');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to add room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmitHandler} className='flex flex-col items-center justify-center p-4 md:p-10'>
      <div className='flex flex-col gap-6 items-start justify-center w-full max-w-3xl'>
        <Title align="left" font="outfit" title="Add Room" subTitle="You can add a room using the form below" />

        {/* Hotel Selection Alert / Dropdown */}
        {fetchingHotels ? (
          <div className='w-full p-4 text-sm text-gray-500 bg-gray-50 rounded border border-gray-200'>
            Loading your registered hotels...
          </div>
        ) : hotels.length === 0 ? (
          <div className='w-full p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
            <div>
              <p className='font-semibold'>No Hotel Registered</p>
              <p className='text-sm text-amber-700'>You must register a hotel before you can add rooms to it.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowHotelReg(true)}
              className='px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded transition'
            >
              Register Hotel
            </button>
          </div>
        ) : (
          <div className='w-full max-w-md'>
            <label htmlFor='hotelSelect' className='block text-gray-800 font-medium mb-1'>
              Select Hotel
            </label>
            <select
              id='hotelSelect'
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value)}
              className='border border-gray-300 rounded p-2 w-full text-sm outline-none'
              required
            >
              {hotels.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} — {h.city} ({h.address})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Images section */}
        <div className='w-full'>
          <div className='flex items-center justify-between'>
            <p className='text-gray-800 font-medium'>Room Image URLs</p>
            <button
              type="button"
              onClick={useSampleImages}
              className='text-xs text-blue-600 hover:text-blue-800 underline'
            >
              Use Sample Photos
            </button>
          </div>
          <p className='text-xs text-gray-500 mt-0.5 mb-2'>
            Provide public image URLs (direct HTTP/HTTPS links)
          </p>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 w-full'>
            {imageUrls.map((url, index) => (
              <div key={index} className='flex flex-col gap-1'>
                <input
                  type='url'
                  placeholder={`Image URL ${index + 1}`}
                  value={url}
                  onChange={(e) => handleImageUrlChange(index, e.target.value)}
                  className='border border-gray-300 rounded p-2 text-sm w-full outline-none'
                />
                {url && (
                  <div className='h-20 w-full rounded border border-gray-200 overflow-hidden bg-gray-50'>
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      className='h-full w-full object-cover'
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Room Type, Price, Units */}
        <div className='w-full flex flex-wrap gap-4'>
          <div className='flex-1 min-w-[180px]'>
            <label htmlFor='roomTypeSelect' className='block text-gray-800 font-medium mb-1'>
              Room Type
            </label>
            <select
              id='roomTypeSelect'
              value={inputs.roomType}
              onChange={(e) => setInputs({ ...inputs, roomType: e.target.value })}
              className='border border-gray-300 rounded p-2 w-full text-sm outline-none'
              required
            >
              <option value="">Select Room Type</option>
              <option value="Single Bed">Single Bed</option>
              <option value="Double Bed">Double Bed</option>
              <option value="Luxury Room">Luxury Room</option>
              <option value="Family Suite">Family Suite</option>
            </select>
          </div>

          <div className='w-36'>
            <label htmlFor='priceInput' className='block text-gray-800 font-medium mb-1'>
              Price <span className='text-xs text-gray-500'>/night</span>
            </label>
            <input
              id='priceInput'
              type='number'
              min="1"
              placeholder='0'
              className='border border-gray-300 rounded p-2 w-full text-sm outline-none'
              value={inputs.pricePerNight}
              onChange={(e) => setInputs({ ...inputs, pricePerNight: e.target.value })}
              required
            />
          </div>

          <div className='w-36'>
            <label htmlFor='unitsInput' className='block text-gray-800 font-medium mb-1'>
              Total Units
            </label>
            <input
              id='unitsInput'
              type='number'
              min="1"
              placeholder='1'
              className='border border-gray-300 rounded p-2 w-full text-sm outline-none'
              value={inputs.totalUnits}
              onChange={(e) => setInputs({ ...inputs, totalUnits: e.target.value })}
              required
            />
          </div>
        </div>

        {/* Amenities */}
        <div className='w-full'>
          <p className='text-gray-800 font-medium mb-2'>Amenities</p>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm'>
            {Object.keys(inputs.amenities).map((amenity, index) => (
              <label key={index} className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={inputs.amenities[amenity]}
                  onChange={() =>
                    setInputs({
                      ...inputs,
                      amenities: {
                        ...inputs.amenities,
                        [amenity]: !inputs.amenities[amenity],
                      },
                    })
                  }
                />
                <span className='text-gray-700'>{amenity}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type='submit'
          className='bg-[#2563EB] hover:bg-blue-700 text-white px-8 py-2.5 rounded mt-4 cursor-pointer font-medium disabled:opacity-50 transition'
          disabled={loading || fetchingHotels || hotels.length === 0}
        >
          {loading ? 'Adding Room...' : 'Add Room'}
        </button>
      </div>
    </form>
  );
};

export default AddRoom;
