import React, { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "./ui/Button";

export const NewsLetter = () => {
  const [email, setEmail] = useState("");

  const validateEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    toast.success("Thank you for subscribing to our updates!");
    setEmail("");
  };

  return (
    <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto my-16 md:my-20">
      <div className="relative rounded-xl bg-[#0b1220] text-white p-8 sm:p-12 text-center border border-white/10 shadow-sm">
        <div className="relative z-10 max-w-xl mx-auto space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Get travel updates & special deals
          </h2>

          <p className="text-xs sm:text-sm text-stone-300 max-w-md mx-auto leading-relaxed">
            Subscribe to receive discounts, destination guides, and early access to weekend deals.
          </p>

          <form
            onSubmit={handleSubscribe}
            className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-md mx-auto"
          >
            <div className="relative w-full">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                aria-label="Email address for updates"
                className="w-full pl-10 pr-3.5 py-2.5 text-base sm:text-sm rounded-[10px] bg-white/10 border border-white/20 text-white placeholder:text-stone-400 focus:outline-none focus:border-white focus:ring-1 focus:ring-white h-11"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              className="w-full sm:w-auto px-5 py-2.5 font-medium shrink-0 min-h-[44px] h-11 text-base sm:text-sm flex items-center justify-center"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Subscribe
            </Button>
          </form>

          <p className="text-[11px] text-stone-400 pt-1">
            Zero spam. You can unsubscribe at any time.
          </p>
        </div>
      </div>
    </section>
  );
};

export default NewsLetter;
