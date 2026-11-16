import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Award,
  Headphones,
  CheckCircle2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { SafeImage } from "../components/ui";
import { usePageTitle } from "../hooks/usePageTitle";
import { BRAND_NAME, HOLD_DURATION_TEXT } from "../config/brand";

const InitialsAvatar = ({ initials, name, title }) => (
  <div className="text-center group">
    <div className="mx-auto h-28 w-28 rounded-full bg-[#f0ede6] dark:bg-white/10 border-2 border-[#e7e5e0] dark:border-white/15 flex items-center justify-center text-2xl font-bold text-[#0b1220] dark:text-[#faf8f5] shadow-xs group-hover:border-[#0b1220] dark:group-hover:border-white transition-colors">
      <span>{initials}</span>
    </div>
    <h3 className="mt-4 text-lg font-semibold text-[#0b1220] dark:text-[#faf8f5]">
      {name}
    </h3>
    <p className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-0.5">
      {title}
    </p>
  </div>
);

const FeatureCard = ({ icon, title, description }) => (
  <div className="p-6 rounded-xl bg-white dark:bg-[#151d30] border border-[#e7e5e0] dark:border-white/10 shadow-2xs text-left space-y-2.5">
    <div className="w-10 h-10 rounded-lg bg-[#f0ede6] dark:bg-white/10 text-[#0b1220] dark:text-[#faf8f5] flex items-center justify-center">
      {icon}
    </div>
    <h3 className="text-base font-semibold text-[#0b1220] dark:text-[#faf8f5]">
      {title}
    </h3>
    <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
      {description}
    </p>
  </div>
);

export const About = () => {
  usePageTitle(
    `About Us`,
    `Learn about ${BRAND_NAME}, our mission to make booking quality stays straightforward and reliable.`
  );

  return (
    <div className="pt-20 pb-16">
      {/* Hero Section */}
      <section
        className="relative bg-cover bg-center text-white py-24 md:py-32 text-center overflow-hidden"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2000&q=85')",
        }}
      >
        <div className="absolute inset-0 bg-[#0b1220]/75" />
        <div className="page-container relative z-10 max-w-3xl space-y-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Making Great Stays Simple and Reliable
          </h1>
          <p className="text-sm sm:text-base text-stone-200 max-w-xl mx-auto leading-relaxed">
            We help travellers discover comfortable hotel rooms and vacation stays with clear pricing and zero hassle.
          </p>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16 md:py-20 page-container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div className="relative rounded-2xl overflow-hidden shadow-sm aspect-[4/3] bg-stone-100 dark:bg-stone-800">
            <SafeImage
              src="https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80"
              alt="Comfortable, sunlit modern stay interior"
              fallbackLabel="PGM Stays Interior"
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-4 text-left">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
              Built for everyday travellers who value peace of mind
            </h2>
            <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed">
              We started <strong>{BRAND_NAME}</strong> with a simple goal: booking a hotel should be transparent, fast, and completely dependable. No misleading photos, no hidden resort fees at checkout, and no complicated jargon.
            </p>
            <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed">
              Every property listed on our platform is checked for cleanliness, genuine amenities, and friendly host service. Whether you are traveling for work, a weekend trip, or a family holiday, we make sure your stay is comfortable.
            </p>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-[#faf9f6] dark:bg-[#151d30]/50 border-y border-[#e7e5e0] dark:border-white/10">
        <div className="page-container text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            Why Travelers Choose {BRAND_NAME}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
            Everything you need for a smooth and comfortable hotel booking.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
            <FeatureCard
              icon={<Award className="w-5 h-5 text-[#0b1220] dark:text-white" />}
              title="Quality Stays"
              description="Clean rooms, accurate photos, and amenities verified before listing."
            />
            <FeatureCard
              icon={<Clock className="w-5 h-5 text-[#0b1220] dark:text-white" />}
              title={`${HOLD_DURATION_TEXT} Hold`}
              description={`When you reserve, your room is held for ${HOLD_DURATION_TEXT} while you complete payment.`}
            />
            <FeatureCard
              icon={<Headphones className="w-5 h-5 text-[#0b1220] dark:text-white" />}
              title="Help When You Need It"
              description="Dedicated customer support to assist with check-in questions or booking changes."
            />
            <FeatureCard
              icon={<CheckCircle2 className="w-5 h-5 text-[#0b1220] dark:text-white" />}
              title="Clear Pricing"
              description="Taxes and service fees are included upfront. What you see is what you pay."
            />
          </div>
        </div>
      </section>

      {/* Leadership Section with initials avatars */}
      <section className="py-16 page-container text-center">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
          Our Team
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
          The team working behind {BRAND_NAME} to make your trips better.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-12">
          <InitialsAvatar
            initials="PG"
            name="Pio Godwin M"
            title="Founder & Product Lead"
          />
          <InitialsAvatar
            initials="KM"
            name="Kamalesh M"
            title="Engineering Lead"
          />
          <InitialsAvatar
            initials="RS"
            name="Raghunath S"
            title="Host & Partner Operations"
          />
        </div>
      </section>

      {/* CTA Banner */}
      <section className="page-container pb-10">
        <div className="rounded-2xl bg-[#0b1220] text-white p-8 md:p-12 text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Ready to find your next stay?
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 max-w-md mx-auto">
            Browse our rooms across popular destinations. Reserve now and pay to confirm.
          </p>
          <div className="pt-2">
            <Link to="/rooms">
              <Button
                variant="secondary"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Browse All Stays
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
