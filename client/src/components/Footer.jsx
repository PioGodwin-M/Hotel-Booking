import React from "react";
import { Link } from "react-router-dom";
import Logo from "./Logo";
import { BRAND_NAME, BRAND_TAGLINE, BRAND_COPYRIGHT } from "../config/brand";
import { assets } from "../assets/assets";

export const Footer = () => {
  return (
    <footer className="bg-[#0b1220] text-white pt-16 pb-12 border-t border-white/10 text-left">
      <div className="page-container">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12 pb-12 border-b border-white/10">
          {/* Brand Column (spans 2 cols on lg) */}
          <div className="lg:col-span-2 space-y-4">
            <Logo size="md" tone="dark" />
            <p className="text-xs sm:text-sm text-stone-300 max-w-sm leading-relaxed mt-3">
              {BRAND_TAGLINE}. We make booking comfortable rooms and vacation stays simple, transparent, and dependable.
            </p>
          </div>

          {/* Column 2: Stays */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Stays
            </h3>
            <ul className="space-y-2 text-xs text-stone-300">
              <li>
                <Link to="/rooms" className="hover:text-white transition-colors">
                  All Stays
                </Link>
              </li>
              <li>
                <Link to="/rooms?destination=Goa" className="hover:text-white transition-colors">
                  Stays in Goa
                </Link>
              </li>
              <li>
                <Link to="/rooms?destination=Jaipur" className="hover:text-white transition-colors">
                  Stays in Jaipur
                </Link>
              </li>
              <li>
                <Link to="/rooms?destination=Udaipur" className="hover:text-white transition-colors">
                  Stays in Udaipur
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Company
            </h3>
            <ul className="space-y-2 text-xs text-stone-300">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  Our Team
                </Link>
              </li>
              <li>
                <Link to="/rooms?wishlist=true" className="hover:text-white transition-colors">
                  Saved Stays
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  Help & Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: For Hosts */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tracking-wide">
              For Hosts
            </h3>
            <ul className="space-y-2 text-xs text-stone-300">
              <li>
                <Link to="/owner" className="hover:text-white transition-colors">
                  Owner Dashboard
                </Link>
              </li>
              <li>
                <Link to="/owner/add-room" className="hover:text-white transition-colors">
                  List Your Property
                </Link>
              </li>
              <li>
                <Link to="/owner" className="hover:text-white transition-colors">
                  Host Guidelines
                </Link>
              </li>
              <li>
                <Link to="/owner" className="hover:text-white transition-colors">
                  Host Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <div>
            <span>{BRAND_COPYRIGHT}</span>
          </div>

          <div className="flex items-center gap-5">
            <Link to="/about" className="hover:text-white transition-colors">
              Privacy Notice
            </Link>
            <Link to="/about" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link to="/about" className="hover:text-white transition-colors">
              Cookie Preferences
            </Link>
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <img src={assets.instagramIcon} alt="Instagram" className="w-4 h-4 invert" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Twitter"
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <img src={assets.twitterIcon} alt="Twitter" className="w-4 h-4 invert" />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <img src={assets.facebookIcon} alt="Facebook" className="w-4 h-4 invert" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <img src={assets.linkendinIcon} alt="LinkedIn" className="w-4 h-4 invert" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
