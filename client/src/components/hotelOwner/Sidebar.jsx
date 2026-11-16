import React, { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  BedDouble,
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAppContext } from "../../context/AppContext";
import { useOwnerContext } from "../../context/OwnerContext";
import { BRAND_NAME } from "../../config/brand";
import { cn } from "../../lib/utils";

export const Sidebar = () => {
  const { setShowHotelReg } = useAppContext();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileDrawerOpen,
    setMobileDrawerOpen,
  } = useOwnerContext();
  const shouldReduceMotion = useReducedMotion();
  const drawerRef = useRef(null);

  // Esc key closes mobile drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && mobileDrawerOpen) {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileDrawerOpen, setMobileDrawerOpen]);

  // Lock scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = "hidden";
      // Focus first element in drawer
      const timer = setTimeout(() => {
        if (drawerRef.current) {
          const focusable = drawerRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) focusable[0].focus();
        }
      }, 50);
      return () => {
        document.body.style.overflow = "";
        clearTimeout(timer);
      };
    }
  }, [mobileDrawerOpen]);

  const navItems = [
    {
      name: "Dashboard",
      path: "/owner",
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
      end: true,
    },
    {
      name: "Add room",
      path: "/owner/add-room",
      icon: <PlusCircle className="w-4 h-4 shrink-0" />,
      end: false,
    },
    {
      name: "Room inventory",
      path: "/owner/list-room",
      icon: <BedDouble className="w-4 h-4 shrink-0" />,
      end: false,
    },
  ];

  // Reusable Nav List
  const renderNavLinks = (isMobile = false) => (
    <div className="flex flex-col gap-1 py-3 flex-1">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.end}
          onClick={() => isMobile && setMobileDrawerOpen(false)}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors select-none",
              isActive
                ? "bg-white/10 text-white font-semibold"
                : "text-gray-400 hover:text-white hover:bg-white/5",
              !isMobile && sidebarCollapsed && "justify-center px-2"
            )
          }
          title={!isMobile && sidebarCollapsed ? item.name : undefined}
        >
          <span>{item.icon}</span>
          {(!sidebarCollapsed || isMobile) && (
            <span className="truncate">{item.name}</span>
          )}
        </NavLink>
      ))}

      {/* Register New Property Action */}
      <button
        type="button"
        onClick={() => {
          if (isMobile) setMobileDrawerOpen(false);
          setShowHotelReg(true);
        }}
        className={cn(
          "mt-3 flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 bg-white hover:bg-gray-100 transition-colors cursor-pointer",
          !isMobile && sidebarCollapsed && "justify-center px-2"
        )}
        title={!isMobile && sidebarCollapsed ? "Register property" : undefined}
      >
        <Building2 className="w-4 h-4 shrink-0" />
        {(!sidebarCollapsed || isMobile) && (
          <span className="truncate">Register property</span>
        )}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-[#0B1220] text-white border-r border-gray-800 h-full transition-all duration-200 relative z-20 shrink-0",
          sidebarCollapsed ? "w-16" : "w-60"
        )}
      >
        <div className="p-3 flex-1 flex flex-col justify-between">
          {renderNavLinks(false)}

          {/* Collapse Toggle Footer */}
          <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
            {!sidebarCollapsed && (
              <span className="text-[11px] text-gray-500 pl-2">
                Collapse menu
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors mx-auto cursor-pointer"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              aria-hidden="true"
            />

            {/* Slide-in Drawer */}
            <motion.div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Owner navigation"
              initial={
                shouldReduceMotion ? { opacity: 0 } : { x: "-100%" }
              }
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-72 max-w-[80vw] bg-[#0B1220] text-white border-r border-gray-800 h-full p-5 flex flex-col justify-between z-10 shadow-2xl"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                  <span className="text-base font-bold text-white">
                    Owner menu
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    aria-label="Close menu"
                    className="p-1 rounded-lg text-gray-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {renderNavLinks(true)}
              </div>

              <div className="pt-4 border-t border-gray-800 text-xs text-gray-500 text-center">
                {BRAND_NAME} Owner Portal
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
