import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Copy, Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import toast from "react-hot-toast";
import { MOCK_EXCLUSIVE_OFFERS, SHOW_SAMPLE_DATA_LABELS } from "../data/mock";
import { Badge } from "./ui/Badge";
import { SafeImage } from "./ui";

export const ExclusiveOffers = () => {
  const shouldReduceMotion = useReducedMotion();
  const offers = MOCK_EXCLUSIVE_OFFERS;
  const [copiedCode, setCopiedCode] = useState(null);

  const handleCopy = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    toast.success("Code copied");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <section className="py-16 md:py-20 page-container text-left">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
              Special Offers & Deals
            </h2>
            {SHOW_SAMPLE_DATA_LABELS && (
              <Badge variant="neutral" size="sm">
                Sample offers
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            Save on your next trip with these promotional discounts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {offers.map((offer) => (
          <motion.div
            key={offer._id}
            whileHover={
              shouldReduceMotion
                ? undefined
                : { y: -3, transition: { duration: 0.15 } }
            }
            className="group relative rounded-xl overflow-hidden bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            {/* Image banner */}
            <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
              <SafeImage
                src={offer.image}
                alt={offer.title}
                fallbackLabel={offer.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
              />
              <div className="absolute top-3 right-3">
                <span className="px-2.5 py-0.5 rounded-[6px] text-xs font-bold bg-rose-600 text-white shadow-2xs">
                  {offer.priceOff}% OFF
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col justify-between flex-1 gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#0b1220] dark:text-[#faf8f5]">
                  {offer.title}
                </h3>
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
                  {offer.description}
                </p>
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mt-2.5">
                  {offer.expiryDate}
                </p>
              </div>

              {/* Dashed Coupon Box with Copy Button */}
              <div className="pt-3 border-t border-[#e7e5e0] dark:border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(offer.code)}
                  aria-label={`Copy coupon code ${offer.code}`}
                  className="min-h-[44px] flex items-center gap-2 px-3.5 py-2 rounded-lg border border-dashed border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-white/5 text-sm tabular-nums tracking-[0.02em] font-semibold text-[#0b1220] dark:text-[#faf8f5] hover:bg-stone-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {copiedCode === offer.code ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-stone-500" />
                  )}
                  <span>{offer.code}</span>
                  <span className="text-xs font-sans font-medium text-stone-500 pl-1.5 border-l border-stone-200 dark:border-stone-700">
                    {copiedCode === offer.code ? "Copied" : "Copy"}
                  </span>
                </button>

                <Link
                  to="/rooms"
                  className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-semibold text-[#0b1220] dark:text-white hover:underline py-1"
                >
                  View stays <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default ExclusiveOffers;
