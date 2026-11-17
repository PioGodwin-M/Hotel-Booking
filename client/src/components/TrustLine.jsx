import React from "react";
import { Link } from "react-router-dom";
import { BUSINESS_CONFIG } from "../config/business";

export const TrustLine = () => {
  const { cancellationPolicy, paymentProcessingPartner, commitments } = BUSINESS_CONFIG;

  const facts = [
    commitments?.[0]?.title || "Price shown before you pay",
    cancellationPolicy?.summary
      ? "Free cancellation up to 48 hours before check-in"
      : null,
    paymentProcessingPartner
      ? `Encrypted payments processed by ${paymentProcessingPartner}`
      : null,
  ].filter(Boolean);

  if (facts.length === 0) return null;

  return (
    <div className="page-container">
      <div className="min-h-[56px] py-4 border-y border-[#e7e5e0] dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-2">
          {facts.map((fact, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
              <span>{fact}</span>
            </div>
          ))}
        </div>

        <Link
          to="/cancellation"
          className="text-xs text-stone-500 dark:text-stone-400 hover:text-[#0b1220] dark:hover:text-white transition-colors underline underline-offset-2 shrink-0"
        >
          Cancellation policy
        </Link>
      </div>
    </div>
  );
};

export default TrustLine;
