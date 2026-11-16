import React, { Suspense, lazy, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HotelReg from "./components/HotelReg";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAppContext } from "./context/AppContext";

import Home from "./pages/Home";
// Lazy-loaded route components for performance
const About = lazy(() => import("./pages/About"));
const AllRooms = lazy(() => import("./pages/AllRooms"));
const RoomDetails = lazy(() => import("./pages/RoomDetails"));
const MyBookings = lazy(() => import("./pages/MyBookings"));
const BookingSuccess = lazy(() => import("./pages/BookingSuccess"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Layout = lazy(() => import("./pages/hotelOwner/Layout"));
const Dashboard = lazy(() => import("./pages/hotelOwner/Dashboard"));
const AddRoom = lazy(() => import("./pages/hotelOwner/AddRoom"));
const ListRoom = lazy(() => import("./pages/hotelOwner/ListRoom"));
const CardStressTest = lazy(() => import("./pages/CardStressTest"));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-xs tracking-wider text-[#0b1220]/60 dark:text-[#faf8f5]/60">
    <div className="w-8 h-8 rounded-full border-2 border-[#0b1220] dark:border-white border-t-transparent animate-spin" />
    <span>Loading...</span>
  </div>
);

function App() {
  const location = useLocation();
  const isOwner = location.pathname.includes("owner");
  const { showHotelReg, isServerUnreachable, fetchRooms } = useAppContext();

  // Dismiss any active toasts when navigating between routes so they never leak across pages
  useEffect(() => {
    toast.dismiss();
  }, [location.pathname]);

  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary resetKey={location.pathname}>
        {/* Skip to Main Content Link for Keyboard & Screen Reader Users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-5 focus:py-2.5 focus:bg-[#0b1220] focus:text-[#faf8f5] focus:rounded-full focus:shadow-luxury-lg focus:outline-none focus:ring-2 focus:ring-[#c8a15a] text-xs font-semibold"
        >
          Skip to content
        </a>

        {/* Global Toaster positioned strictly below navbar so it never covers brand or avatar */}
        <Toaster
          position="top-right"
          containerStyle={{
            top: "80px",
            right: "20px",
          }}
          toastOptions={{
            duration: 4000,
            style: {
              background: "#0b1220",
              color: "#faf8f5",
              borderRadius: "12px",
              fontSize: "13px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
            },
            success: {
              duration: 3500,
              ariaProps: { role: "status", "aria-live": "polite" },
            },
            error: {
              duration: 6000,
              ariaProps: { role: "alert", "aria-live": "assertive" },
            },
          }}
        />

        {/* Unreachable Server Warning Banner */}
        {isServerUnreachable && (
          <div
            role="status"
            className="fixed top-0 inset-x-0 z-50 bg-[#0b1220] text-stone-200 text-xs py-2 px-4 text-center border-b border-white/10 flex items-center justify-center gap-2 shadow-sm"
          >
            <span>We can't reach the server. Some features are unavailable.</span>
            <button
              onClick={() => fetchRooms()}
              className="font-bold underline text-white hover:text-stone-300 cursor-pointer ml-1"
            >
              Retry
            </button>
          </div>
        )}

        {!isOwner && <Navbar />}
        {showHotelReg && <HotelReg />}

        <main id="main-content" tabIndex={-1} className="min-h-[72vh] focus:outline-none">
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/rooms" element={<AllRooms />} />
                <Route path="/rooms/:id" element={<RoomDetails />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/booking-success" element={<BookingSuccess />} />
                <Route path="/stress-test" element={<CardStressTest />} />
                <Route path="/owner" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="add-room" element={<AddRoom />} />
                  <Route path="list-room" element={<ListRoom />} />
                </Route>
                {/* Catch-all 404 Route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>

        {!isOwner && <Footer />}
      </ErrorBoundary>
    </MotionConfig>
  );
}

export default App;
