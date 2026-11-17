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

        {/* Sticky Compact Search Pill (Desktop - Section 1.5) */}
        {isScrolled && (
          <button
            type="button"
            onClick={() => {
              if (isHome) {
                window.scrollTo({ top: 0, behavior: "smooth" });
                setTimeout(() => {
                  const destInput = document.getElementById("hero-destination");
                  if (destInput) destInput.focus();
                }, 300);
              } else {
                navigate("/rooms");
              }
            }}
            aria-label="Search stays by destination, dates and guests"
            className="hidden lg:flex items-center gap-3 px-4 py-1.5 rounded-full border border-stone-200 dark:border-white/15 bg-white dark:bg-[#151d30] shadow-sm hover:shadow-md transition-all text-xs font-medium text-[#0b1220] dark:text-[#faf8f5] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220]"
          >
            <span className="font-semibold text-stone-800 dark:text-stone-200">Where</span>
            <span className="text-stone-300 dark:text-stone-600">·</span>
            <span className="text-stone-600 dark:text-stone-400">Dates</span>
            <span className="text-stone-300 dark:text-stone-600">·</span>
            <span className="text-stone-600 dark:text-stone-400">Guests</span>
            <div className="w-6 h-6 rounded-full bg-[#0b1220] dark:bg-white text-white dark:text-[#0b1220] flex items-center justify-center ml-0.5 shrink-0">
              <Search className="w-3 h-3" />
            </div>
          </button>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search Trigger (Mobile / Compact) */}
          <Link
            to="/rooms"
            aria-label="Search stays"
            className={cn(
              "w-11 h-11 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 lg:hidden",
              textColorClass
            )}
          >
            <Search className="w-5 h-5" />
          </Link>

          {/* Wishlist Link (Filled heart when active, count only on saved stays page) */}
          <Link
            to="/rooms?wishlist=true"
            aria-label="View saved stays"
            className={cn(
              "relative w-11 h-11 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10",
              textColorClass
            )}
          >
            <Heart
              className={cn(
                "w-5 h-5 transition-colors",
                wishlistCount > 0 ? "fill-rose-600 text-rose-600" : ""
              )}
            />
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

          {/* Mobile Menu Button (44px target) */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            className={cn(
              "md:hidden w-11 h-11 flex items-center justify-center rounded-lg transition-colors cursor-pointer",
              textColorClass
            )}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer with 50% Dark Backdrop (Section 2 #6) */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* 50% dark backdrop - tap to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              aria-hidden="true"
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="md:hidden fixed inset-x-0 top-[56px] bg-white dark:bg-[#0b1220] border-b border-[#e7e5e0] dark:border-white/10 shadow-xl px-6 py-4 flex flex-col gap-3 text-left z-50 max-h-[calc(100svh-56px)] overflow-y-auto"
            >
              <div className="flex flex-col">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMenuOpen(false)}
                    className="min-h-[48px] flex items-center text-base font-semibold text-[#0b1220] dark:text-[#faf8f5] border-b border-stone-100 dark:border-white/5 active:bg-stone-50"
                  >
                    {link.name}
                  </Link>
                ))}

                <Link
                  to="/rooms?wishlist=true"
                  onClick={() => setIsMenuOpen(false)}
                  className="min-h-[48px] flex items-center justify-between text-base font-semibold text-[#0b1220] dark:text-[#faf8f5] border-b border-stone-100 dark:border-white/5 active:bg-stone-50"
                >
                  <span className="flex items-center gap-2">
                    <Heart
                      className={cn(
                        "w-4 h-4 text-rose-600",
                        wishlistCount > 0 ? "fill-rose-600" : ""
                      )}
                    />{" "}
                    Saved stays
                  </span>
                  {wishlistCount > 0 && (
                    <span className="text-xs text-stone-500 tabular-nums">
                      ({wishlistCount})
                    </span>
                  )}
                </Link>
              </div>

              {user ? (
                <div className="flex flex-col gap-2.5 pt-2">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate("/my-bookings");
                    }}
                    className="min-h-[48px] justify-start text-base"
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
                    className="min-h-[48px] justify-start text-base"
                    leftIcon={<Building2 className="w-4 h-4" />}
                  >
                    {isOwner ? "Owner Dashboard" : "List your property"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setIsMenuOpen(false);
                    openSignIn();
                  }}
                  className="w-full min-h-[48px] text-base font-semibold mt-2"
                >
                  Sign In
                </Button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
