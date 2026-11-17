import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { usePageTitle } from "../hooks/usePageTitle";
import { BUSINESS_CONFIG } from "../config/business";

export const Terms = () => {
  usePageTitle(
    "Terms of Service",
    `Terms and conditions governing the use of ${BUSINESS_CONFIG.companyName}.`
  );

  return (
    <div className="pt-24 pb-20 page-container text-left">
      <div className="max-w-[720px] mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5] mb-3">
          Terms of Service
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mb-8 pb-4 border-b border-[#e7e5e0] dark:border-white/10">
          Last updated: November 2026 • Effective immediately
        </p>

        <div className="space-y-6 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              1. Platform Agreement
            </h2>
            <p>
              By accessing or booking stays through {BUSINESS_CONFIG.companyName}, you agree to these Terms of Service. If you do not agree, please do not use the platform.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              2. Booking & Temporary Holds
            </h2>
            <p>
              When initiating a reservation, selected room inventory is held for a period of {BUSINESS_CONFIG.holdDurationText} to allow you to complete checkout. If payment is not finalized within this period, the hold is released back to available inventory.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              3. Pricing and Fees
            </h2>
            <p>
              All room rates displayed on our search results and room detail pages include applicable local taxes and room tariffs. No surprise booking or checkout fees are added at payment time.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              4. Host Responsibilities
            </h2>
            <p>
              Property owners who list accommodations through {BUSINESS_CONFIG.companyName} represent that their property complies with local hospitality regulations, is clean and safe, and honors confirmed bookings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              5. Support and Dispute Resolution
            </h2>
            <p>
              For booking assistance, inquiries, or dispute mediation, reach out to our customer care team at{" "}
              <a
                href={`mailto:${BUSINESS_CONFIG.supportEmail}`}
                className="underline font-medium text-[#0b1220] dark:text-white"
              >
                {BUSINESS_CONFIG.supportEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
