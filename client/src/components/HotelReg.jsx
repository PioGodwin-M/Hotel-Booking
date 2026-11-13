import React, { useState } from 'react';
import { assets, cities } from '../assets/assets';
import { useAppContext } from '../context/AppContext';
import { authApi } from '../lib/apiClient';
import toast from 'react-hot-toast';

const HotelReg = () => {
  const { setShowHotelReg, setIsOwner, checkOwnerStatus, fetchRooms } = useAppContext();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      // POST to catalog-service via API Gateway: /api/hotels/
      const { data } = await authApi.post('/api/hotels/', {
        name: name.trim(),
        contact: contact.trim(),
        address: address.trim(),
        city: city.trim(),
      });

      if (data.success) {
        toast.success(data.message || 'Hotel registered successfully');
        setIsOwner(true);
        if (checkOwnerStatus) await checkOwnerStatus();
        if (fetchRooms) fetchRooms();
        setShowHotelReg(false);
      } else {
        toast.error(data.message || 'Failed to register hotel');
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'An error occurred during hotel registration';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed top-0 bottom-0 left-0 right-0 z-100 flex items-center justify-center bg-black/70'>
      <form onSubmit={onSubmitHandler} onClick={(e) => e.stopPropagation()} className='flex bg-white rounded-xl max-w-4xl max-md:mx-2'>
        <img src={assets.regImage} alt="reg-image" className='w-1/2 rounded-xl hidden md:block' />

        <div className='relative flex flex-col items-center md:w-1/2 p-8 md:p-10'>
          <img
            src={assets.closeIcon}
            alt='close-icon'
            onClick={() => setShowHotelReg(false)}
            className='absolute top-4 right-4 h-4 w-4 cursor-pointer'
          />
          <p className='text-2xl font-semibold mt-6'>Register Your Hotel</p>

          {/* Hotel Name */}
          <div className='w-full mt-4'>
            <label htmlFor='name' className='font-medium text-gray-500'>
              Hotel Name
            </label>
            <input
              id="name"
              onChange={(e) => setName(e.target.value)}
              value={name}
              type='text'
              placeholder='Type here'
              className='border border-gray-200 rounded w-full px-3 py-2.5 mt-1 outline-indigo-500 font-light'
              disabled={loading}
              required
            />
          </div>

          {/* Contact */}
          <div className='w-full mt-4'>
            <label htmlFor='contact' className='font-medium text-gray-500'>
              Phone
            </label>
            <input
              id="contact"
              onChange={(e) => setContact(e.target.value)}
              value={contact}
              type='text'
              placeholder='Type here'
              className='border border-gray-200 rounded w-full px-3 py-2.5 mt-1 outline-indigo-500 font-light'
              disabled={loading}
              required
            />
          </div>

          {/* Address */}
          <div className='w-full mt-4'>
            <label htmlFor='address' className='font-medium text-gray-500'>
              Address
            </label>
            <input
              id="address"
              onChange={(e) => setAddress(e.target.value)}
              value={address}
              type='text'
              placeholder='Type here'
              className='border border-gray-200 rounded w-full px-3 py-2.5 mt-1 outline-indigo-500 font-light'
              disabled={loading}
              required
            />
          </div>

          {/* Select City Drop Down */}
          <div className='w-full mt-4 max-w-60 mr-auto'>
            <label htmlFor='city' className='font-medium text-gray-500'>City</label>
            <select
              id='city'
              onChange={(e) => setCity(e.target.value)}
              value={city}
              className='border border-gray-200 rounded w-full px-3 py-2.5 mt-1 outline-indigo-500 font-light'
              disabled={loading}
              required
            >
              <option value="">Select City</option>
              {cities.map((cityName) => (
                <option key={cityName} value={cityName}>{cityName}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className='bg-indigo-500 hover:bg-indigo-600 transition-all text-white mr-auto px-6 py-2 rounded cursor-pointer mt-6 disabled:opacity-50'
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default HotelReg;
