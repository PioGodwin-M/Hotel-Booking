import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useClerk, UserButton } from "@clerk/clerk-react";
import {
  Menu,
  X,
  Heart,
  Search,
  CalendarCheck,
  Building2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "./Logo";
import { useAppContext } from "../context/AppContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

const Navbar = () => {
  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Stays", path: "/rooms" },
    { name: "About", path: "/about" },
  ];

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { openSignIn } = useClerk();

  const location = useLocation();
  const { user, navigate, isOwner, setShowHotelReg } = useAppContext();
  const { wishlistCount } = useWishlist();

  const isHome = location.pathname === "/";

  useEffect(() => {
    if (!isHome) {
      setIsScrolled(true);
      return;
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  // Lock body scroll and Esc key listener when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e) => {
        if (e.key === "Escape") setIsMenuOpen(false);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isMenuOpen]);

  const textColorClass = isScrolled || !isHome
    ? "text-[#0b1220] dark:text-[#faf8f5]"
    : "text-white";

  return (
    <header
      className={cn(
        "fixed top-0 left-0 w-full z-40 transition-all duration-200",
        isScrolled || !isHome
          ? "bg-white/95 dark:bg-[#0b1220]/95 backdrop-blur-md shadow-2xs border-b border-[#e7e5e0] dark:border-white/10 py-3"
          : "bg-gradient-to-b from-black/70 via-black/25 to-transparent py-4"
      )}
    >
      <div className="page-container flex items-center justify-between">
        {/* Brand Logo */}
        <Logo size="md" tone={!isScrolled && isHome ? "dark" : "light"} />

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium transition-colors duration-150 rounded-lg",
                  isActive
                    ? isScrolled || !isHome
                      ? "text-[#0b1220] dark:text-[#faf8f5] font-semibold"
                      : "text-white font-semibold"
                    : isScrolled || !isHome
                    ? "text-stone-600 dark:text-stone-300 hover:text-[#0b1220] dark:hover:text-white"
                    : "text-stone-200 hover:text-white"
                )}
              >
                {link.name}
                {isActive && (
                  <motion.span
                    layoutId="navbarActiveIndicator"
                    className={cn(
                      "absolute bottom-1 left-4 right-4 h-0.5 rounded-full",
                      isScrolled || !isHome ? "bg-[#0b1220] dark:bg-white" : "bg-white"
                    )}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search Trigger */}
          <Link
            to="/rooms"
            aria-label="Search stays"
            className={cn(
              "p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10",
              textColorClass
            )}
          >
            <Search className="w-5 h-5" />
          </Link>

          {/* Wishlist Link with Badge */}
          <Link
            to="/rooms?wishlist=true"
            aria-label="View saved stays"
            className={cn(
              "relative p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10",
              textColorClass
            )}
          >
            <Heart className="w-5 h-5" />
            {wishlistCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center font-mono">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Host Portal CTA (Desktop) */}
          {user && (
            <button
              onClick={() => (isOwner ? navigate("/owner") : setShowHotelReg(true))}
              className={cn(
                "hidden lg:inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-[10px] border transition-colors cursor-pointer",
                isScrolled || !isHome
                  ? "border-[#e7e5e0] text-[#0b1220] dark:border-white/15 dark:text-[#faf8f5] hover:bg-stone-50 dark:hover:bg-white/10"
                  : "border-white/30 text-white hover:bg-white/10"
              )}
            >
              <Building2 className="w-3.5 h-3.5" />
              {isOwner ? "Owner dashboard" : "List your property"}
            </button>
          )}

          {/* Clerk Auth / Sign In Button */}
          {user ? (
            <div className="flex items-center pl-1">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: "w-8 h-8 rounded-full border border-stone-200 dark:border-white/20",
                  },
                }}
              >
                <UserButton.MenuItems>
                  <UserButton.Action
                    label="My Bookings"
                    labelIcon={<CalendarCheck className="w-4 h-4 text-[#0b1220]" />}
                    onClick={() => navigate("/my-bookings")}
                  />
                  {isOwner && (
                    <UserButton.Action
                      label="Owner Dashboard"
                      labelIcon={<Building2 className="w-4 h-4 text-[#0b1220]" />}
                      onClick={() => navigate("/owner")}
                    />
                  )}
                </UserButton.MenuItems>
              </UserButton>
            </div>
          ) : (
            <Button
              variant={isScrolled || !isHome ? "primary" : "secondary"}
              size="sm"
              onClick={openSignIn}
              className="ml-1"
            >
              Sign In
            </Button>
          )}

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            className={cn(
              "md:hidden p-2 rounded-lg transition-colors cursor-pointer",
              textColorClass
            )}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="md:hidden fixed inset-x-0 top-[56px] bg-white dark:bg-[#0b1220] border-b border-[#e7e5e0] dark:border-white/10 shadow-lg px-6 py-6 flex flex-col gap-5 text-left"
          >
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-base font-semibold text-[#0b1220] dark:text-[#faf8f5] py-2 border-b border-stone-100 dark:border-white/5"
                >
                  {link.name}
                </Link>
              ))}

              <Link
                to="/rooms?wishlist=true"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-between text-sm font-medium text-[#0b1220] dark:text-[#faf8f5] py-2"
              >
                <span className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-600" /> Saved Stays
                </span>
                {wishlistCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold font-mono">
                    {wishlistCount}
                  </span>
                )}
              </Link>
            </div>

            {user && (
              <div className="flex flex-col gap-2.5 pt-2 border-t border-[#e7e5e0] dark:border-white/10">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate("/my-bookings");
                  }}
                  leftIcon={<CalendarCheck className="w-4 h-4" />}
                >
                  My Bookings
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setIsMenuOpen(false);
                    isOwner ? navigate("/owner") : setShowHotelReg(true);
                  }}
                  leftIcon={<Building2 className="w-4 h-4" />}
                >
                  {isOwner ? "Owner Dashboard" : "List your property"}
                </Button>
              </div>
            )}

            {!user && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setIsMenuOpen(false);
                  openSignIn();
                }}
                className="w-full"
              >
                Sign In
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
