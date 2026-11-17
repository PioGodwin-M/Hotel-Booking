import React from "react";
import Hero from "../components/Hero";
import RecommendedHotels from "../components/RecommendedHotels";
import CurrentOffers from "../components/CurrentOffers";
import FeaturedDestination from "../components/FeaturedDestination";
import TripIdeas from "../components/TripIdeas";
import GuestReviews from "../components/GuestReviews";
import TrustLine from "../components/TrustLine";
import { usePageTitle } from "../hooks/usePageTitle";

export const Home = () => {
  usePageTitle(
    "Find your next stay",
    "Hotels, rooms and holiday stays. See the full price before you pay."
  );

  return (
    <>
      <Hero />
      {/* 
        Home Order & Rhythm (Round 4d):
        Order: Hero, Recommended stays (2 rows), Offers, Popular destinations, Trip ideas, Guest reviews, Trust line, Footer.
        Spacing strictly driven by --section-gap (56px desktop, 36px mobile).
        Top padding gives breathing room below the Hero search capsule so the heading does not collide.
      */}
      <div className="pt-8 sm:pt-11 space-y-[var(--section-gap)] pb-[var(--section-gap)]">
        <RecommendedHotels />
        <CurrentOffers />
        <FeaturedDestination />
        <TripIdeas />
        <GuestReviews />
        <TrustLine />
      </div>
    </>
  );
};

export default Home;
