import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { usePageTitle } from "../hooks/usePageTitle";
import { BUSINESS_CONFIG } from "../config/business";

export const Privacy = () => {
  usePageTitle(
    "Privacy Policy",
    `Learn how ${BUSINESS_CONFIG.companyName} collects, protects, and handles your personal information.`
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
          Privacy Policy
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mb-8 pb-4 border-b border-[#e7e5e0] dark:border-white/10">
          Last updated: November 2026 • Effective immediately
        </p>

        <div className="space-y-6 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              1. Information We Collect
            </h2>
            <p>
              When you browse, search, or book a room on {BUSINESS_CONFIG.companyName}, we collect only the essential details required to fulfill your reservation:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-stone-600 dark:text-stone-400">
              <li>Contact details: your name, email address, and phone number.</li>
              <li>Reservation details: selected dates, guest counts, and special check-in requests.</li>
              <li>Authentication data: your account ID managed securely via Clerk.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              2. Payment Information & Stripe
            </h2>
            <p>
              We do not store or process payment card numbers on our servers. All transactions are securely handled by our PCI-DSS compliant payment processing partner, <strong>Stripe</strong>. Stripe processes your card or UPI payment through tokenized encryption.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              3. How We Use Your Information
            </h2>
            <p>
              Your information is strictly used to:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-stone-600 dark:text-stone-400">
              <li>Confirm and manage your room bookings.</li>
              <li>Send transaction receipts and check-in instructions via transactional email (Brevo).</li>
              <li>Provide customer support when you contact our team.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
              4. Contact Us
            </h2>
            <p>
              If you have any questions regarding your data privacy, please contact our support team at{" "}
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

export default Privacy;
