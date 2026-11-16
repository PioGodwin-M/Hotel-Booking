import React from "react";
import { Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { Menu, Building2, ChevronDown, ArrowLeft } from "lucide-react";
import { useOwnerContext } from "../../context/OwnerContext";
import Logo from "../Logo";

export const Navbar = () => {
  const {
    hotels,
    selectedHotelId,
    selectHotel,
    setMobileDrawerOpen,
  } = useOwnerContext();

  return (
    <header className="flex items-center justify-between px-4 md:px-8 py-3 bg-[#0B1220] text-white border-b border-gray-800 z-30 shrink-0">
      {/* Left: Mobile Menu + Brand Logo + Host Badge */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Open sidebar menu"
          className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Logo tone="dark" />

        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-white/10 text-gray-300 text-xs font-medium">
          Owner portal
        </span>
      </div>

      {/* Right: Property Selector + Guest View + User Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Property Selector */}
        {hotels.length > 0 && (
          <div className="relative flex items-center">
            <Building2 className="w-3.5 h-3.5 text-gray-400 absolute left-3 pointer-events-none" />
            <select
              value={selectedHotelId}
              onChange={(e) => selectHotel(e.target.value)}
              aria-label="Filter by property"
              className="pl-8 pr-8 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white focus:outline-none focus:border-white cursor-pointer appearance-none max-w-[180px] sm:max-w-[240px] truncate"
            >
              <option value="ALL" className="bg-[#0B1220] text-white">
                All properties ({hotels.length})
              </option>
              {hotels.map((h) => (
                <option key={h._id} value={h._id} className="bg-[#0B1220] text-white">
                  {h.name} {h.city ? `(${h.city})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 pointer-events-none" />
          </div>
        )}

        {/* Back to Guest View */}
        <Link
          to="/"
          className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-gray-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Guest view</span>
        </Link>

        {/* Clerk User Button */}
        <div className="pl-1 flex items-center">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "w-8 h-8 ring-2 ring-white/20",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
};

export default Navbar;
