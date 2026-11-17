import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, ShieldCheck, RefreshCw } from "lucide-react";
import { usePageTitle } from "../hooks/usePageTitle";
import { BUSINESS_CONFIG } from "../config/business";

export const Cancellation = () => {
  usePageTitle(
    "Cancellation and Refund Policy",
    `Understand the cancellation rules and refund processing timelines for bookings on ${BUSINESS_CONFIG.companyName}.`
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
          Cancellation & Refund Policy
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mb-8 pb-4 border-b border-[#e7e5e0] dark:border-white/10">
          Clear, straightforward refund terms with no hidden penalty clauses.
        </p>

        {/* Summary Card */}
        <div className="p-5 sm:p-6 rounded-[12px] bg-[#f0ede6]/60 dark:bg-white/5 border border-stone-200 dark:border-white/10 mb-8">
          <h2 className="text-base font-semibold text-[#0b1220] dark:text-[#faf8f5] mb-2">
            Quick Policy Summary
          </h2>
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
            {BUSINESS_CONFIG.cancellationPolicy.summary}
          </p>
        </div>

        <div className="space-y-6 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              1. Standard Cancellation Timeline
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-stone-600 dark:text-stone-400">
              <li>
                <strong>48+ hours before check-in:</strong> 100% full refund credited back to your original payment method.
              </li>
              <li>
                <strong>Between 24 and 48 hours before check-in:</strong> 50% refund credited back to your original payment method.
              </li>
              <li>
                <strong>Under 24 hours or no-show:</strong> Non-refundable, as the room cannot be re-listed on short notice.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              2. Refund Processing Times
            </h2>
            <p>
              Refunds are initiated immediately upon cancellation. Depending on your financial institution or card issuer, the credited funds will appear in your bank or card statement within <strong>5–7 business days</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              3. How to Request Cancellation
            </h2>
            <p>
              You can cancel your reservation directly by visiting your{" "}
              <Link to="/my-bookings" className="underline font-medium text-[#0b1220] dark:text-white">
                My Bookings
              </Link>{" "}
              page and selecting your upcoming trip, or by reaching out to our support team at{" "}
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

export default Cancellation;
