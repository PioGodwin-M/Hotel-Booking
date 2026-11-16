import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Star, Quote, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MOCK_TESTIMONIALS, SHOW_SAMPLE_DATA_LABELS } from "../data/mock";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";

export const Testimonial = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const carouselRef = useRef(null);

  const testimonials = MOCK_TESTIMONIALS;
  const count = testimonials.length;

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % count);
  }, [count]);

  const prevSlide = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + count) % count);
  }, [count]);

  // Autoplay effect: pauses on hover and disabled when prefers-reduced-motion is active
  useEffect(() => {
    if (shouldReduceMotion || isHovered) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 6000);

    return () => clearInterval(interval);
  }, [shouldReduceMotion, isHovered, nextSlide]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevSlide();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nextSlide();
    }
  };

  const current = testimonials[activeIndex];

  return (
    <section
      ref={carouselRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Guest Testimonials"
      className="py-24 md:py-32 px-4 sm:px-6 lg:px-8 bg-[#faf8f5] dark:bg-[#0b1220] border-t border-[#efece6] dark:border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a15a]"
    >
      <div className="max-w-4xl mx-auto text-center">
        {SHOW_SAMPLE_DATA_LABELS && (
          <div className="flex justify-center mb-3">
            <Badge variant="neutral" size="sm">
              Sample guest reviews
            </Badge>
          </div>
        )}

        <h2 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
          What Our Guests Say
        </h2>
        <p className="mt-3 text-sm md:text-base text-stone-600 dark:text-stone-400 max-w-xl mx-auto">
          Real feedback and reviews from travellers who booked their stays with us.
        </p>

        {/* Carousel Content */}
        <div className="relative mt-12 md:mt-16 min-h-[300px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }
              }
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="flex flex-col items-center"
            >
              {/* Star Rating */}
              <div className="flex items-center gap-1 mb-6">
                {[...Array(current.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-[#c8a15a] text-[#c8a15a]"
                  />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="font-playfair text-xl sm:text-2xl md:text-3xl font-medium leading-relaxed text-[#0b1220] dark:text-[#faf8f5] italic max-w-3xl">
                "{current.quote}"
              </blockquote>

              {/* Author */}
              <div className="mt-8 flex items-center gap-3.5">
                <img
                  src={current.avatar}
                  alt={current.name}
                  loading="lazy"
                  className="w-13 h-13 rounded-full object-cover ring-2 ring-[#c8a15a]/40"
                />
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <p className="font-sans font-semibold text-sm text-[#0b1220] dark:text-[#faf8f5]">
                      {current.name}
                    </p>
                    <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
                  </div>
                  <p className="text-xs text-[#0b1220]/50 dark:text-[#faf8f5]/50">
                    {current.location}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls & Indicator Dots */}
        <div className="mt-10 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous testimonial"
            className="p-2.5 rounded-full border border-[#e2ddd4] dark:border-white/10 hover:border-[#c8a15a] text-[#0b1220] dark:text-[#faf8f5] hover:bg-[#c8a15a]/10 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === activeIndex
                    ? "w-8 bg-[#c8a15a]"
                    : "w-2 bg-[#e2ddd4] dark:bg-white/20 hover:bg-[#c8a15a]/50"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next testimonial"
            className="p-2.5 rounded-full border border-[#e2ddd4] dark:border-white/10 hover:border-[#c8a15a] text-[#0b1220] dark:text-[#faf8f5] hover:bg-[#c8a15a]/10 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Testimonial;
