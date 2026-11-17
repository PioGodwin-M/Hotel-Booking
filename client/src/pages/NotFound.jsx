import React from "react";
import { Link } from "react-router-dom";
import { Compass, ArrowRight, Home } from "lucide-react";
import { Button } from "../components/ui/Button";
import { usePageTitle } from "../hooks/usePageTitle";

export const NotFound = () => {
  usePageTitle("Page Not Found");

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="mx-auto flex items-center justify-center text-gray-400 dark:text-gray-500">
          <Compass className="w-10 h-10" aria-hidden="true" />
        </div>

        <div>
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
            Error 404
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5] mt-1.5">
            Page not found
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            The page you are looking for doesn't exist or may have been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link to="/rooms" className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Browse stays
            </Button>
          </Link>
          <Link to="/" className="w-full sm:w-auto">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Home className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
