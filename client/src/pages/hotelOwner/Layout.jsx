import React, { useEffect } from 'react';
import Navbar from '../../components/hotelOwner/Navbar';
import Sidebar from '../../components/hotelOwner/Sidebar';
import { Outlet } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';

const Layout = () => {
  const { isOwner, checkingOwner, navigate } = useAppContext();

  useEffect(() => {
    // Only redirect if authentication and ownership status resolution has completed
    if (!checkingOwner && !isOwner) {
      navigate('/');
    }
  }, [checkingOwner, isOwner, navigate]);

  if (checkingOwner) {
    return (
      <div className='flex items-center justify-center h-screen bg-gray-50 text-gray-500 text-sm'>
        Verifying hotel owner access...
      </div>
    );
  }

  if (!isOwner) {
    return null;
  }

  return (
    <div className='flex flex-col h-screen'>
      <Navbar />
      <div className='flex h-full'>
        <Sidebar />
        <div className='flex-1 p-4 pt-10 md:px-10 h-full overflow-y-auto'>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
