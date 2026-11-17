import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Star, ArrowRight, X, CheckCircle2 } from "lucide-react";
import { useGuestReviews } from "../hooks/useGuestReviews";

export const GuestReviews = () => {
  const { data, isLoading, isSample } = useGuestReviews();
  const [activeModalReview, setActiveModalReview] = useState(null);

  const reviews = data?.reviews || [];
  const summary = data?.summary || null;

  // In real mode, hidden if no reviews exist
  if (isLoading || reviews.length === 0) {
    return null;
  }

  // Show up to 3 reviews in the rating-first row
  const displayReviews = reviews.slice(0, 3);
  const avgRating = summary?.averageRating || 4.8;
  const totalCount = summary?.totalReviews || reviews.length;

  return (
    <section className="page-container text-left" aria-label="Guest reviews">
      {/* Heading only */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            Guest reviews
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

      {/* Rating-First Row: Left column ~280px, Right column 3 quotes with vertical hairlines */}
      <div className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-10 pt-2">
        {/* Left Column: ~280px rating summary */}
        <div className="w-full lg:w-[280px] shrink-0 flex flex-col justify-between py-1 border-b lg:border-b-0 lg:border-r border-[#e7e5e0] dark:border-white/10 pb-6 lg:pb-0 lg:pr-8">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-[48px] font-semibold tracking-tight text-[#0b1220] dark:text-[#faf8f5] leading-none tabular-nums">
                {avgRating.toFixed(1)}
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-0.5 text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-amber-500 text-amber-500"
                    />
                  ))}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Based on {totalCount} reviews
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 lg:mt-auto pt-2">
            <Link
              to="/rooms"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#0b1220] dark:text-white hover:underline transition-colors"
            >
              <span>See all reviews</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Right Column: Quotes side by side with 1px hairlines (no cards, no shadows, no carousel) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#e7e5e0] dark:divide-white/10">
          {displayReviews.map((rev, index) => {
            const initial =
              rev.authorName?.charAt(0)?.toUpperCase() ||
              rev.authorInitial?.charAt(0)?.toUpperCase() ||
              "G";

            return (
              <div
                key={rev.id || index}
                className={`flex flex-col justify-between py-4 md:py-0 ${
                  index === 0 ? "md:pr-6" : index === 1 ? "md:px-6" : "md:pl-6"
                }`}
              >
                <div>
                  {/* Stars and month/year on one line */}
                  <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className="w-3.5 h-3.5 fill-amber-500 text-amber-500"
                        />
                      ))}
                    </div>
                    <span className="text-stone-400 text-xs">{rev.monthYear}</span>
                  </div>

                  {/* Quote text clamped to 5 lines */}
                  <p className="line-clamp-5 text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed mt-2.5">
                    "{rev.comment}"
                  </p>

                  {rev.comment?.length > 150 && (
                    <button
                      type="button"
                      onClick={() => setActiveModalReview(rev)}
                      className="text-xs font-semibold text-stone-900 dark:text-stone-100 hover:underline mt-1.5 cursor-pointer block"
                    >
                      Read more
                    </button>
                  )}
                </div>

                {/* Author info: 32px initial-letter avatar, name, home city, stay link */}
                <div className="mt-4 pt-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-white/10 text-stone-800 dark:text-stone-200 text-xs font-semibold flex items-center justify-center shrink-0 border border-stone-200 dark:border-white/10">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-semibold text-[#0b1220] dark:text-[#faf8f5] truncate">
                        {rev.authorName} {rev.authorInitial}
                      </span>
                      {rev.authorCity && (
                        <span className="text-xs text-stone-400 truncate">
                          • {rev.authorCity}
                        </span>
                      )}
                    </div>
                    {rev.stayName && (
                      <Link
                        to={rev.roomId ? `/rooms/${rev.roomId}` : "/rooms"}
                        className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white truncate block hover:underline"
                      >
                        {rev.stayName}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Review Modal Dialog */}
      {activeModalReview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-review-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 p-6 sm:p-7 shadow-xl text-left space-y-4">
            <div className="flex items-center justify-between border-b border-[#e7e5e0] dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-amber-500 text-amber-500"
                    />
                  ))}
                </div>
                <span className="text-xs text-stone-400">
                  {activeModalReview.monthYear}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalReview(null)}
                aria-label="Close review"
                className="p-1 rounded-lg text-stone-400 hover:text-stone-800 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p
              id="modal-review-title"
              className="text-sm sm:text-base text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-line"
            >
              "{activeModalReview.comment}"
            </p>

            <div className="pt-3 border-t border-[#e7e5e0] dark:border-white/10 flex items-center justify-between">
              <div>
                <span className="block text-sm font-semibold text-[#0b1220] dark:text-[#faf8f5]">
                  {activeModalReview.authorName} {activeModalReview.authorInitial}
                </span>
                <span className="text-xs text-stone-500">
                  {activeModalReview.authorCity}
                </span>
              </div>
              {activeModalReview.stayName && (
                <Link
                  to={
                    activeModalReview.roomId
                      ? `/rooms/${activeModalReview.roomId}`
                      : "/rooms"
                  }
                  onClick={() => setActiveModalReview(null)}
                  className="text-xs font-medium text-stone-700 dark:text-stone-300 hover:underline"
                >
                  {activeModalReview.stayName}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default GuestReviews;
