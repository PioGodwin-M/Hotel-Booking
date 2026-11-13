/**
 * Stripe SDK loader without external npm dependencies.
 * Dynamically injects Stripe.js (https://js.stripe.com/v3/) when invoked.
 */
let stripePromise = null;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = new Promise((resolve, reject) => {
      const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

      if (window.Stripe) {
        resolve(window.Stripe(publishableKey));
        return;
      }

      const existingScript = document.querySelector('script[src="https://js.stripe.com/v3/"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.Stripe) {
            resolve(window.Stripe(publishableKey));
          } else {
            reject(new Error('Stripe.js was loaded but window.Stripe is unavailable.'));
          }
        });
        existingScript.addEventListener('error', () => {
          reject(new Error('Failed to load Stripe.js script.'));
        });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => {
        if (window.Stripe) {
          resolve(window.Stripe(publishableKey));
        } else {
          reject(new Error('Stripe.js was loaded but window.Stripe is unavailable.'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load Stripe.js from CDN.'));
      };
      document.head.appendChild(script);
    });
  }
  return stripePromise;
};
