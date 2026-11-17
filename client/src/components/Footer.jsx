import React, { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "./Logo";
import { BRAND_TAGLINE, BRAND_COPYRIGHT } from "../config/brand";
import { useAppContext } from "../context/AppContext";
import { useSubscribe } from "../hooks/useSubscribe";
import { CheckCircle2, AlertCircle } from "lucide-react";

export const Footer = () => {
  const { rooms } = useAppContext();
  const {
    subscribe,
    isLoading,
    isSuccess,
    isError,
    errorMessage,
    isAvailable,
  } = useSubscribe();

  const [email, setEmail] = useState("");
  const [clientValidationError, setClientValidationError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setClientValidationError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setClientValidationError("Please enter a valid email address.");
      return;
    }

    const res = await subscribe(email);
    if (res.success) {
      setEmail("");
    }
  };

  // Extract cities that actually exist in the stays data
  const realCities = Array.from(
    new Set(
      Array.isArray(rooms)
        ? rooms.map((r) => r?.hotel?.city).filter(Boolean)
        : []
    )
  ).slice(0, 3);

  return (
    <footer className="bg-[#0b1220] text-white py-10 sm:py-12 border-t border-white/10 text-left">
      <div className="page-container">
        {/* Newsletter: One line (about 72px tall on desktop) */}
        {isAvailable && (
          <div className="pb-8 mb-8 border-b border-white/10">
            {isSuccess ? (
              <div
                role="status"
                className="min-h-[44px] flex items-center gap-2.5 text-emerald-300 text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>You're subscribed.</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="shrink-0">
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    Get stay ideas and offers
                  </h3>
                </div>

                <div className="w-full sm:max-w-md">
                  <form onSubmit={handleSubmit} className="space-y-1.5">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (clientValidationError) setClientValidationError("");
                        }}
                        placeholder="Enter your email"
                        aria-label="Email address for stay ideas and offers"
                        disabled={isLoading}
                        className="flex-1 h-11 min-h-[44px] px-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/15 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="h-11 min-h-[44px] px-5 rounded-xl bg-white text-stone-900 font-semibold text-sm hover:bg-stone-200 transition-colors shrink-0 disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        {isLoading ? "Subscribing..." : "Subscribe"}
                      </button>
                    </div>

                    {(clientValidationError || isError) && (
                      <div className="flex items-center gap-1.5 text-xs text-rose-400 pt-0.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {clientValidationError ||
                            errorMessage ||
                            "Couldn't subscribe. Try again."}
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-stone-400 pt-0.5">
                      We respect your privacy. Read our{" "}
                      <Link
                        to="/privacy"
                        className="text-stone-300 underline underline-offset-2 hover:text-white"
                      >
                        privacy policy
                      </Link>
                      .
                    </p>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Grid: 2 columns on mobile, 5 on lg */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12 pb-8 border-b border-white/10">
          {/* Brand Column (spans full 2 cols on mobile, 2 cols on lg) */}
          <div className="col-span-2 lg:col-span-2 space-y-3">
            <Logo size="md" tone="dark" />
            <p className="text-sm text-stone-300 max-w-sm leading-relaxed mt-2">
              {BRAND_TAGLINE}. We make booking comfortable rooms and vacation stays simple, transparent, and dependable.
            </p>
          </div>

          {/* Column 2: Stays */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Stays
            </h3>
            <ul className="space-y-1 text-sm text-stone-300">
              <li>
                <Link to="/rooms" className="h-8 flex items-center hover:text-white transition-colors">
                  All stays
                </Link>
              </li>
              {realCities.map((city) => (
                <li key={city}>
                  <Link
                    to={`/rooms?destination=${encodeURIComponent(city)}`}
                    className="h-8 flex items-center hover:text-white transition-colors"
                  >
                    Stays in {city}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/rooms?wishlist=true" className="h-8 flex items-center hover:text-white transition-colors">
                  Saved stays
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Company (Duplicate links removed) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Company
            </h3>
            <ul className="space-y-1 text-sm text-stone-300">
              <li>
                <Link to="/about" className="h-8 flex items-center hover:text-white transition-colors">
                  About us
                </Link>
              </li>
              <li>
                <Link to="/about" className="h-8 flex items-center hover:text-white transition-colors">
                  Our team
                </Link>
              </li>
              <li>
                <Link to="/about" className="h-8 flex items-center hover:text-white transition-colors">
                  Help & support
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: For Hosts */}
          <div className="col-span-2 sm:col-span-1 space-y-2">
            <h3 className="text-sm font-semibold text-white tracking-wide">
              For hosts
            </h3>
            <ul className="space-y-1 text-sm text-stone-300">
              <li>
                <Link to="/owner" className="h-8 flex items-center hover:text-white transition-colors">
                  Owner dashboard
                </Link>
              </li>
              <li>
                <Link to="/owner/add-room" className="h-8 flex items-center hover:text-white transition-colors">
                  List your property
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Privacy, Terms, and Cancellation live here */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-stone-400">
          <div>
            <span>{BRAND_COPYRIGHT}</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors py-1">
              Privacy policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors py-1">
              Terms of service
            </Link>
            <Link to="/cancellation" className="hover:text-white transition-colors py-1">
              Cancellation & refunds
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
