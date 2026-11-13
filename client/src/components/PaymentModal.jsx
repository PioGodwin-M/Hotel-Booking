import React, { useEffect, useRef, useState } from 'react';
import { getStripe } from '../lib/stripeClient';
import toast from 'react-hot-toast';

const PaymentModal = ({
  clientSecret,
  amountMinor,
  currency = 'INR',
  bookingId,
  onSuccess,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const paymentElementRef = useRef(null);

  const displayAmount = (amountMinor / 100).toFixed(2);
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
  const isKeyPlaceholder =
    !publishableKey || publishableKey.includes('REPLACE_WITH_YOUR');

  useEffect(() => {
    let isMounted = true;

    const initStripe = async () => {
      if (isKeyPlaceholder) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const stripe = await getStripe();
        if (!isMounted) return;
        stripeRef.current = stripe;

        if (!stripe || !clientSecret) {
          throw new Error('Stripe client or payment secret unavailable');
        }

        const elements = stripe.elements({
          clientSecret,
          appearance: { theme: 'stripe' },
        });
        elementsRef.current = elements;

        const paymentElement = elements.create('payment');
        paymentElementRef.current = paymentElement;

        const container = document.getElementById('stripe-payment-element-mount');
        if (container) {
          paymentElement.mount(container);
          paymentElement.on('ready', () => {
            if (isMounted) setLoading(false);
          });
        }
      } catch (err) {
        console.error('Stripe initialization failed:', err);
        if (isMounted) {
          setErrorMessage(err.message || 'Unable to load payment processor');
          setLoading(false);
        }
      }
    };

    initStripe();

    return () => {
      isMounted = false;
      if (paymentElementRef.current) {
        try {
          paymentElementRef.current.destroy();
        } catch {
          // cleanup
        }
      }
    };
  }, [clientSecret, isKeyPlaceholder]);

  const handlePay = async (e) => {
    e.preventDefault();
    if (processing) return;

    if (isKeyPlaceholder) {
      toast(
        'Stripe publishable key is not configured in .env. To complete live cards, set VITE_STRIPE_PUBLISHABLE_KEY.',
        { icon: '⚠️' }
      );
      return;
    }

    if (!stripeRef.current || !elementsRef.current) {
      toast.error('Payment form is not ready yet');
      return;
    }

    setProcessing(true);
    setErrorMessage('');

    try {
      const { error, paymentIntent } = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        redirect: 'if_required',
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (error) {
        setErrorMessage(error.message || 'Payment failed');
        toast.error(error.message || 'Payment failed');
      } else if (
        paymentIntent &&
        (paymentIntent.status === 'succeeded' ||
          paymentIntent.status === 'processing')
      ) {
        toast.success('Payment completed successfully!');
        if (onSuccess) onSuccess();
      } else {
        toast('Payment submitted for processing. Updating status...', { icon: 'ℹ️' });
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during payment');
      toast.error(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
      <div className='relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 md:p-8 overflow-hidden'>
        <button
          onClick={onClose}
          disabled={processing}
          className='absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer'
        >
          ✕
        </button>

        <h3 className='text-xl font-semibold text-gray-900'>Complete Payment</h3>
        <p className='text-sm text-gray-500 mt-1'>
          Booking ID: <span className='font-mono text-xs'>{bookingId}</span>
        </p>

        <div className='my-4 p-4 bg-gray-50 rounded-xl flex items-center justify-between'>
          <span className='text-sm text-gray-600 font-medium'>Amount Due:</span>
          <span className='text-2xl font-bold text-gray-900'>
            {currency} {displayAmount}
          </span>
        </div>

        {isKeyPlaceholder && (
          <div className='mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed'>
            <p className='font-semibold'>Stripe Test Mode Notice</p>
            <p className='mt-0.5'>
              Your <code className='bg-amber-100 px-1 rounded'>.env</code> contains the placeholder Stripe key.
              Set your valid <code className='bg-amber-100 px-1 rounded'>VITE_STRIPE_PUBLISHABLE_KEY</code> to enable full Stripe Elements card entry.
            </p>
          </div>
        )}

        <form onSubmit={handlePay}>
          <div
            id='stripe-payment-element-mount'
            className='min-h-[160px] py-2'
          >
            {loading && !isKeyPlaceholder && (
              <div className='py-12 text-center text-sm text-gray-400'>
                Loading secure payment form...
              </div>
            )}
          </div>

          {errorMessage && (
            <p className='text-xs text-red-600 bg-red-50 p-2.5 rounded-md mt-2'>
              {errorMessage}
            </p>
          )}

          <div className='mt-6 flex gap-3'>
            <button
              type='button'
              onClick={onClose}
              disabled={processing}
              className='flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition cursor-pointer'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={loading || processing}
              className='flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition cursor-pointer disabled:opacity-50'
            >
              {processing ? 'Processing...' : `Pay ${currency} ${displayAmount}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;

