import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { useOffers } from "../hooks/useOffers";
import { SafeImage } from "./ui";

export const CurrentOffers = () => {
  const { data: offers, isLoading, isSample } = useOffers();
  const [copiedCode, setCopiedCode] = useState(null);

  // If loading or no offers are available, cleanly hide section (no empty frame)
  if (isLoading || !offers || offers.length === 0) {
    return null;
  }

  const handleCopyCode = (e, code) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    toast.success("Code copied");
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  return (
    <section className="page-container text-left">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            Current offers
          </h2>
          {isSample && (
            <span className="text-xs text-stone-500 dark:text-stone-400 font-normal">
              Sample
            </span>
          )}
        </div>

        <Link
          to="/rooms"
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220] rounded"
        >
          <span>All stays</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex lg:grid lg:grid-cols-3 gap-4 sm:gap-6 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 snap-x snap-mandatory scrollbar-none">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="group flex flex-col justify-between w-[85vw] sm:w-[420px] lg:w-auto min-w-[85vw] sm:min-w-[420px] lg:min-w-0 snap-start shrink-0 lg:shrink rounded-[12px] bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200"
          >
            {/* Image Banner */}
            <Link
              to={offer.filterUrl || "/rooms"}
              className="relative aspect-[16/9] overflow-hidden bg-stone-100 dark:bg-white/5 block"
            >
              <SafeImage
                src={offer.image}
                alt={offer.title}
                fallbackLabel={offer.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
              />
              {/* Only ONE tag: the plain discount badge */}
              <div className="absolute top-3 left-3 z-10">
                <span className="px-2.5 py-1 rounded-[6px] text-xs font-semibold bg-[#0b1220] text-white shadow-xs">
                  {offer.discount}
                </span>
              </div>
            </Link>

            {/* Content Details */}
            <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 gap-4">
              <div className="space-y-1.5">
                <Link
                  to={offer.filterUrl || "/rooms"}
                  className="block text-base font-semibold text-[#0b1220] dark:text-[#faf8f5] leading-snug group-hover:underline underline-offset-2"
                >
                  {offer.title}
                </Link>

                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                  {offer.condition}
                </p>

                {/* Validity text: 14px with 4.5:1 contrast */}
                <p className="text-sm text-stone-600 dark:text-stone-300 pt-1">
                  Valid until {offer.validUntil}
                </p>
              </div>

              {/* Action: Copy Code & Link */}
              <div className="pt-3 border-t border-[#f0ede6] dark:border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500 dark:text-stone-400">Code:</span>
                  <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-white/10 text-xs font-semibold tabular-nums tracking-[0.02em] text-[#0b1220] dark:text-[#faf8f5]">
                    {offer.code}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleCopyCode(e, offer.code)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-stone-300 dark:border-white/15 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1220]"
                >
                  {copiedCode === offer.code ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-stone-500" />
                      <span>Copy code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CurrentOffers;
