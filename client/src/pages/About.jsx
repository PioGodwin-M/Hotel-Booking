import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Mail,
  Phone,
  Clock,
  MapPin,
} from "lucide-react";
import { usePageTitle } from "../hooks/usePageTitle";
import { BUSINESS_CONFIG } from "../config/business";
import { useAppContext } from "../context/AppContext";
import { HowBookingWorks } from "../components/HowBookingWorks";
import { SafeImage } from "../components/ui";

export const About = () => {
  const { rooms } = useAppContext();
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  usePageTitle(
    "About us",
    `Learn about ${BUSINESS_CONFIG.companyName}, our mission to make booking quality stays straightforward and reliable.`
  );

  // Compute real facts without inventing data
  const realCitiesCount = Array.isArray(rooms)
    ? new Set(rooms.map((r) => r?.hotel?.city).filter(Boolean)).size
    : 0;

  const facts = [
    realCitiesCount > 0 && {
      label: "Active destinations",
      value: `${realCitiesCount} cities`,
      note: "Live catalog locations",
    },
    {
      label: "Reservation hold",
      value: BUSINESS_CONFIG.holdDurationText,
      note: "Exclusive date lock",
    },
    {
      label: "Customer support",
      value: "Mon – Sat",
      note: "9:00 AM – 8:00 PM IST",
    },
    {
      label: "Payment security",
      value: BUSINESS_CONFIG.paymentProcessingPartner,
      note: "PCI-DSS encrypted",
    },
  ].filter(Boolean);

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="pt-16 sm:pt-20 pb-20 text-left">
      {/* 1. Hero: ~360px height, bright photo, text left-aligned in container */}
      <section className="relative h-[360px] bg-stone-900 text-white overflow-hidden flex items-center">
        <SafeImage
          src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=2000&q=80"
          alt="Bright, sunlit resort pool and villa"
          fallbackLabel="PGM Stays"
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1220]/90 via-[#0b1220]/65 to-transparent" />

        <div className="page-container relative z-10 w-full">
          <div className="max-w-[640px] space-y-3.5">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
              Simple, dependable stays across India and abroad.
            </h1>
            <p className="text-sm sm:text-base text-stone-200 leading-relaxed max-w-lg">
              We help travelers find comfortable hotels and boutique rooms with transparent upfront pricing and zero booking surprises.
            </p>
            <div className="pt-1">
              <Link
                to="/rooms"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-stone-900 font-semibold text-sm hover:bg-stone-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>Browse stays</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. What We Do: Two columns (Text on Left max 600px, 4:3 Photo on Right) + Facts Strip below */}
      <section className="py-12 sm:py-16 page-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center mb-10">
          {/* Left Column: two paragraphs */}
          <div className="lg:col-span-7 max-w-[600px] space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
              What we do
            </h2>
            <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed">
              {BUSINESS_CONFIG.companyName} was created to make reserving accommodations clear and reliable. Rather than inflating rates with hidden resort charges at the final checkout screen, we show the full price upfront—including taxes and room tariffs.
            </p>
            <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed">
              Every listing provides authentic photos, verified guest capacities, and a guaranteed 10-minute reservation hold while you confirm payment. When you book a room, your dates are locked immediately.
            </p>
          </div>

          {/* Right Column: 4:3 photo */}
          <div className="lg:col-span-5 aspect-[4/3] rounded-[12px] overflow-hidden bg-stone-100 dark:bg-white/5 border border-[#e7e5e0] dark:border-white/10 shadow-2xs">
            <SafeImage
              src="https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80"
              alt="Comfortable, sunlit modern room interior"
              fallbackLabel="PGM Stays interior"
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Facts Strip (Full container width) */}
        {facts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 sm:p-6 rounded-[12px] bg-[#f0ede6]/60 dark:bg-white/5 border border-[#e7e5e0] dark:border-white/10 shadow-2xs">
            {facts.map((fact) => (
              <div key={fact.label} className="space-y-1">
                <span className="text-xs text-stone-500 dark:text-stone-400 block font-medium">
                  {fact.label}
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#0b1220] dark:text-[#faf8f5] tabular-nums block">
                  {fact.value}
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400 block">
                  {fact.note}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. How Booking Works (reusable 3-step block) */}
      <div className="border-t border-[#e7e5e0] dark:border-white/10 py-6">
        <HowBookingWorks />
      </div>

      {/* 4. Our Commitments (3 cards in a row, equal height, full width) */}
      <section className="py-12 sm:py-16 page-container border-t border-[#e7e5e0] dark:border-white/10">
        <div className="max-w-[680px] mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            Our commitments
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            Three principles built directly into how our platform operates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BUSINESS_CONFIG.commitments.map((item) => (
            <div
              key={item.id}
              className="p-5 sm:p-6 rounded-[12px] bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 shadow-2xs flex flex-col justify-between space-y-2.5 h-full"
            >
              <div>
                <h3 className="text-base font-semibold text-[#0b1220] dark:text-[#faf8f5]">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed mt-2">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. For Hosts: Full container width, buttons on right at desktop */}
      <section className="py-12 sm:py-16 page-container border-t border-[#e7e5e0] dark:border-white/10">
        <div className="p-6 sm:p-10 rounded-[12px] bg-stone-900 text-white space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 border-b border-white/10 pb-6">
            <div className="max-w-xl space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                For property hosts and hotel owners
              </h2>
              <p className="text-sm text-stone-300 leading-relaxed">
                List your rooms on {BUSINESS_CONFIG.companyName} to connect with travelers looking for dependable stays.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to="/owner/add-room"
                className="px-5 py-2.5 rounded-xl bg-white text-stone-900 font-semibold text-sm hover:bg-stone-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                List your property
              </Link>
              <Link
                to="/owner"
                className="px-5 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white font-semibold text-sm hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Owner dashboard
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BUSINESS_CONFIG.hostBenefits.map((b) => (
              <div key={b.title} className="space-y-1.5">
                <h3 className="text-base font-semibold text-white">
                  {b.title}
                </h3>
                <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                  {b.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FAQ & Contact: Two columns (FAQ left 60%, Sticky Contact card right 40%) */}
      <section className="py-12 sm:py-16 page-container border-t border-[#e7e5e0] dark:border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* FAQ Column (about 60% on desktop) */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
                Frequently asked questions
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
                Answers to common questions about booking, payments, and cancellations.
              </p>
            </div>

            <div className="divide-y divide-[#e7e5e0] dark:divide-white/10 border-y border-[#e7e5e0] dark:border-white/10">
              {BUSINESS_CONFIG.faq.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div key={item.question} className="py-1">
                    <button
                      type="button"
                      onClick={() => toggleFaq(index)}
                      aria-expanded={isOpen}
                      className="w-full min-h-[48px] py-3.5 flex items-center justify-between text-left text-sm sm:text-base font-semibold text-[#0b1220] dark:text-[#faf8f5] hover:text-stone-600 dark:hover:text-stone-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220]"
                    >
                      <span className="pr-4">{item.question}</span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="pb-4 pt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed pr-6">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact Card Column (about 40% on desktop, sticky below navbar) */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <div className="rounded-[12px] bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 p-6 sm:p-7 shadow-2xs space-y-6">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
                  Need assistance?
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
                  Our team is available to help with reservations, date adjustments, or host onboarding.
                </p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-stone-700 dark:text-stone-300">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-stone-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="block font-medium text-[#0b1220] dark:text-white">Email</span>
                    <a
                      href={`mailto:${BUSINESS_CONFIG.supportEmail}`}
                      className="hover:underline text-stone-600 dark:text-stone-400"
                    >
                      {BUSINESS_CONFIG.supportEmail}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-stone-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="block font-medium text-[#0b1220] dark:text-white">Phone</span>
                    <span className="text-stone-600 dark:text-stone-400">
                      {BUSINESS_CONFIG.supportPhone}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-stone-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="block font-medium text-[#0b1220] dark:text-white">Hours</span>
                    <span className="text-stone-600 dark:text-stone-400">
                      {BUSINESS_CONFIG.supportHours}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-stone-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="block font-medium text-[#0b1220] dark:text-white">Location</span>
                    <span className="text-stone-600 dark:text-stone-400">
                      {BUSINESS_CONFIG.address.city}, {BUSINESS_CONFIG.address.state},{" "}
                      {BUSINESS_CONFIG.address.country}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#f0ede6] dark:border-white/10">
                <a
                  href={`mailto:${BUSINESS_CONFIG.supportEmail}?subject=Support%20Inquiry%20-%20PGM%20Stays`}
                  className="w-full inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#0b1220] dark:bg-white text-white dark:text-[#0b1220] text-sm font-semibold hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220]"
                >
                  Send a message
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
