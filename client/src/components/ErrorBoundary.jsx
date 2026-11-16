import React, { Component } from "react";
import { AlertTriangle, RotateCw, ArrowLeft } from "lucide-react";
import { Button } from "./ui/Button";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    // Automatically reset error boundary when location/route changes
    if (this.props.resetKey && this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  handleBackToStays = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== "undefined") {
      window.location.href = "/rooms";
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="py-20 px-4 text-center max-w-md mx-auto my-auto flex flex-col items-center justify-center min-h-[50vh]">
          {/* Plain 24px icon without tinted circle */}
          <AlertTriangle
            className="w-6 h-6 text-stone-700 dark:text-stone-300 mb-4"
            aria-hidden="true"
          />

          <h2 className="text-xl font-bold tracking-tight text-[#0b1220] dark:text-[#faf8f5]">
            Something went wrong
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-sm">
            An unexpected error occurred while displaying this page. Your data and account remain safe.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              onClick={this.handleTryAgain}
              leftIcon={<RotateCw className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Try again
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={this.handleBackToStays}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Back to stays
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
