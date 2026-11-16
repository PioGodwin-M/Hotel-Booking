import React from "react";
import Hero from "../components/Hero";
import FeaturedDestination from "../components/FeaturedDestination";
import ExclusiveOffers from "../components/ExclusiveOffers";
import Testimonial from "../components/Testimonial";
import NewsLetter from "../components/NewsLetter";
import RecommendedHotels from "../components/RecommendedHotels";
import { usePageTitle } from "../hooks/usePageTitle";

export const Home = () => {
  usePageTitle(
    "Find your next stay",
    "Search hotels, vacation stays, and comfortable rooms across India and abroad."
  );

  return (
    <>
      <Hero />
      <RecommendedHotels />
      <FeaturedDestination />
      <ExclusiveOffers />
      <Testimonial />
      <NewsLetter />
    </>
  );
};

export default Home;
