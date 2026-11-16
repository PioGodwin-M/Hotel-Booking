import React, { useEffect } from "react";
import Navbar from "../../components/hotelOwner/Navbar";
import Sidebar from "../../components/hotelOwner/Sidebar";
import { Outlet } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import { OwnerProvider, useOwnerContext } from "../../context/OwnerContext";
import { AlertTriangle } from "lucide-react";

const LayoutContent = () => {
  const { isOwner, checkingOwner, navigate } = useAppContext();
  const { isSampleMode } = useOwnerContext();

  useEffect(() => {
    if (!checkingOwner && !isOwner) {
      navigate("/");
    }
  }, [checkingOwner, isOwner, navigate]);

  if (checkingOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#faf8f5] dark:bg-[#0b1220] text-[#0b1220] dark:text-[#faf8f5] gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#c8a15a] border-t-transparent animate-spin" />
        <span className="text-xs uppercase tracking-widest text-[#0b1220]/60 dark:text-[#faf8f5]/60 font-semibold">
          Verifying host credentials...
        </span>
      </div>
    );
  }

  if (!isOwner) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#faf8f5] dark:bg-[#0b1220]">
      <Navbar />
      {isSampleMode && (
        <div
          role="status"
          className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 shadow-2xs select-none"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-semibold px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 text-[10px] uppercase tracking-wider">
              Sample mode active
            </span>
            <span className="hidden sm:inline">Write actions (registering properties, adding rooms, and changing availability) are disabled to protect data integrity.</span>
            <span className="sm:hidden">Write actions disabled in sample mode.</span>
          </div>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 h-full overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const Layout = () => {
  return (
    <OwnerProvider>
      <LayoutContent />
    </OwnerProvider>
  );
};

export default Layout;
