import React from "react";
import { Link } from "react-router-dom";
import { BUSINESS_CONFIG } from "../config/business";

export const HowBookingWorks = () => {
  const { holdDurationText, cancellationPolicy } = BUSINESS_CONFIG;

  const steps = [
    {
      step: "1",
      title: "Search and choose",
      description:
        "Select your city, dates, and number of guests to compare available rooms with all taxes included.",
    },
    {
      step: "2",
      title: "Reserve your dates",
      description:
        `Choose your room. We hold your dates exclusively for ${holdDurationText || "10 minutes"} while you complete payment.`,
    },
    {
      step: "3",
      title: "Pay to confirm",
      description:
        "Complete payment securely via Stripe. Your instant confirmation and invoice are emailed directly to you.",
    },
  ];

  return (
    <section className="page-container py-6 sm:py-8 text-left">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
          How booking works
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
          Three simple steps to secure your stay with zero hidden surprises.
        </p>
      </div>

      {/* 3-Step Strip (One row on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 sm:p-8 rounded-[12px] bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 shadow-2xs">
        {steps.map((item) => (
          <div key={item.step} className="flex items-start gap-4 text-left">
            <span className="w-8 h-8 rounded-full border border-stone-300 dark:border-white/20 text-[#0b1220] dark:text-[#faf8f5] text-sm font-semibold flex items-center justify-center shrink-0">
              {item.step}
            </span>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-semibold text-[#0b1220] dark:text-[#faf8f5]">
                {item.title}
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Policy reassurance footer line under the strip */}
      <div className="mt-3.5 px-2 text-xs text-stone-500 dark:text-stone-400 flex flex-wrap items-center gap-x-2 gap-y-1">
        {holdDurationText && (
          <span>• Reservations held for {holdDurationText} during checkout</span>
        )}
        <span>• Total price shown upfront before paying</span>
        {cancellationPolicy?.summary && (
          <span>
            • {cancellationPolicy.summary}{" "}
            <Link
              to={cancellationPolicy.policyUrl || "/cancellation"}
              className="text-[#0b1220] dark:text-white font-medium underline underline-offset-2 hover:text-stone-700"
            >
              Cancellation policy
            </Link>
          </span>
        )}
      </div>
    </section>
  );
};

export default HowBookingWorks;
