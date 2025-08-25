import React from 'react';
import { FaAward, FaHeadset, FaSearchDollar, FaCheckCircle } from 'react-icons/fa';
import journeyImage from '../assets/journey.jpg';
// --- Team Member Card Component ---
const TeamMember = ({ imgSrc, name, title }) => (
  <div className="text-center">
    <img
      src={imgSrc}
      alt={name}
      className="mx-auto h-40 w-40 rounded-full object-cover shadow-lg transform transition-transform duration-300 hover:scale-105"
    />
    <h3 className="mt-4 text-xl font-semibold text-gray-800">{name}</h3>
    <p className="text-md text-gray-500">{title}</p>
  </div>
);

// --- Feature Card Component ---
const FeatureCard = ({ icon, title, description }) => (
  <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
    <div className="text-4xl text-blue-600 mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

// --- Main About Us Page Component ---
const About = () => {
  return (
    <div className="bg-gray-50 font-sans">
      {/* Hero Section */}
      <section
        className="relative bg-cover bg-center text-white py-40 px-4"
        style={{ backgroundImage: "url('https://i.pinimg.com/originals/a7/63/a2/a763a25d2c76a16229b1dd052d0b8f44.jpg')" }}
      >
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="relative container mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight animate-fade-in-down">
            About QuickStay
          </h1>
          <p className="mt-4 text-xl md:text-2xl max-w-3xl mx-auto animate-fade-in-up">
            Crafting unforgettable travel experiences, one booking at a time.
          </p>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-20">
        <div className="container mx-auto px-6 lg:px-20">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2">
              <img
                src={journeyImage}
                alt="Our Journey"
                className="rounded-lg shadow-2xl w-full h-auto object-cover"
              />
            </div>
            <div className="lg:w-1/2">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">Our Story 📖</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Founded in 2025 by a group of passionate travelers, **QuickStay** was born from a simple idea: booking a hotel should be as delightful as the stay itself. We were tired of confusing websites and hidden fees. We envisioned a platform that was transparent, beautiful, and dedicated to helping people discover their perfect getaway.
              </p>
              <p className="text-gray-700 leading-relaxed">
                From a small startup to a trusted name in travel, our mission has remained the same: to connect travelers with exceptional accommodations and create memories that last a lifetime. We believe travel enriches our lives, and we're here to make it accessible and enjoyable for everyone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="bg-blue-50 py-20">
        <div className="container mx-auto px-6 lg:px-20 text-center">
          <h2 className="text-4xl font-bold text-gray-800 mb-3">Why Choose Us? ✨</h2>
          <p className="text-gray-600 text-lg mb-12 max-w-2xl mx-auto">
            We go the extra mile to ensure your booking experience is seamless and rewarding.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<FaSearchDollar />}
              title="Best Price Guarantee"
              description="Find the best deals and save more. We guarantee the lowest prices on all our listings."
            />
            <FeatureCard
              icon={<FaAward />}
              title="Curated Selection"
              description="Every hotel is hand-picked and vetted by our team to ensure quality and comfort."
            />
            <FeatureCard
              icon={<FaHeadset />}
              title="24/7 Support"
              description="Our dedicated support team is here to help you around the clock, anytime, anywhere."
            />
            <FeatureCard
              icon={<FaCheckCircle />}
              title="Seamless Booking"
              description="Enjoy a hassle-free booking process with our secure and user-friendly platform."
            />
          </div>
        </div>
      </section>

      {/* Meet the Team Section */}
      <section className="py-20">
        <div className="container mx-auto px-6 lg:px-20 text-center">
          <h2 className="text-4xl font-bold text-gray-800 mb-12">Meet Our Team 👋</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
            <TeamMember imgSrc="https://www.shutterstock.com/image-photo/successful-company-with-happy-workers-260nw-1662211225.jpg" name="Pio Godwin M" title="CEO & Founder" />
            <TeamMember imgSrc="https://www.shutterstock.com/image-photo/portrait-young-smiling-man-arm-260nw-1299946255.jpg" name="Kamalesh M" title="Head of Technology" />
            <TeamMember imgSrc="https://www.shutterstock.com/image-photo/headshot-portrait-smiling-millennial-businesswoman-260nw-1725712123.jpg" name="Raghunath S" title="Director of Hospitality" />
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="bg-blue-600 text-white py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready for Your Next Adventure?</h2>
          <p className="text-lg mb-8 max-w-xl mx-auto">
            Your dream destination is just a few clicks away. Let's find your perfect stay.
          </p>
          <button className="bg-white text-blue-600 font-bold py-3 px-8 rounded-full text-lg hover:bg-blue-100 transition-colors duration-300 shadow-lg">
            Explore Hotels
          </button>
        </div>
      </section>
    </div>
  );
};

export default About;