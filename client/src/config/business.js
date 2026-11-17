/**
 * Centralized Business Configuration for PGM Stays.
 * Single source of truth for company contact information, operational policies,
 * commitments, FAQs, and support details.
 *
 * NOTE: Unconfigured production values are marked with '// TODO: ...' placeholders.
 * Do not invent legal entity numbers, years, awards, or statistics.
 */

import { BRAND_NAME, HOLD_DURATION_MINUTES } from "./brand";

export const BUSINESS_CONFIG = {
  // Brand & Company Info
  companyName: BRAND_NAME,
  legalName: "" /* TODO: Official registered business entity name (e.g., PGM Stays Pvt. Ltd.) */,
  tagline: "Find your next stay",
  description:
    "We help travelers discover comfortable hotels, vacation homes, and boutique rooms with transparent upfront pricing and dependable service.",

  // Contact Details
  supportEmail: "support@pgmstays.com" /* TODO: Official customer support email address */,
  supportPhone: "+91 80 0000 0000" /* TODO: Official customer support telephone number */,
  address: {
    line1: "" /* TODO: Office street address */,
    city: "Chennai",
    state: "Tamil Nadu",
    postalCode: "" /* TODO: Office postal PIN code */,
    country: "India",
  },
  supportHours: "Monday – Saturday, 9:00 AM – 8:00 PM IST",

  // Operational Rules (backed by microservice implementation)
  holdDurationMinutes: HOLD_DURATION_MINUTES,
  holdDurationText: `${HOLD_DURATION_MINUTES} minutes`,
  paymentProcessingPartner: "Stripe",
  acceptedPaymentMethods:
    "Credit/debit cards (Visa, Mastercard, RuPay, American Express) and UPI via Stripe",

  // Cancellation & Refund Policies
  cancellationPolicy: {
    summary:
      "Free cancellation up to 48 hours before check-in. Cancellations made within 48 hours receive a 50% refund minus transaction fees.",
    policyUrl: "/cancellation",
    detailedText:
      "Bookings canceled at least 48 hours prior to the standard check-in time (2:00 PM on arrival date) are eligible for a 100% full refund. Cancellations made between 24 and 48 hours prior to check-in receive a 50% refund. Cancellations made under 24 hours before check-in or no-shows are non-refundable. Refunds are automatically credited to the original payment method through Stripe within 5–7 business days.",
  },

  // Customer Commitments (Only what is true in the product)
  commitments: [
    {
      id: "upfront-price",
      title: "Price shown before you pay",
      description:
        "Taxes and room charges are displayed upfront on the stay page. We do not add hidden resort fees or checkout surcharges.",
    },
    {
      id: "secure-stripe",
      title: "Payments handled by Stripe",
      description:
        "Every transaction is encrypted and authorized via Stripe. We never store credit or debit card numbers on our servers.",
    },
    {
      id: "held-reservations",
      title: `Reservations held for ${HOLD_DURATION_MINUTES} minutes`,
      description:
        `Once you enter checkout, your dates are locked exclusively for ${HOLD_DURATION_MINUTES} minutes so no one else can book them while you confirm.`,
    },
  ],

  // Host Benefits (For the host acquisition section)
  hostBenefits: [
    {
      title: "Direct listing control",
      description:
        "Set your own nightly room rates, add photos, specify amenities, and manage availability directly from your owner dashboard.",
    },
    {
      title: "Guaranteed upfront payouts",
      description:
        "Payments are captured securely through Stripe before a guest arrives, ensuring reliable fulfillment with zero cash collection hassle.",
    },
    {
      title: "Zero listing fees",
      description:
        "Publish your property for free. Only standard payment processing applies when a successful reservation is confirmed.",
    },
  ],

  // Team (Optional: empty until real team members are defined)
  // TODO: Add verified team members: [{ name: '', role: '', initials: '', photo: '' }]
  team: [],

  // FAQ Accordion Content (8 standard operational questions)
  faq: [
    {
      question: "How do I book a stay on PGM Stays?",
      answer:
        "Choose your destination, select your check-in and check-out dates, pick an available room that suits your group, and click Reserve. Your dates are held exclusively for 10 minutes while you complete payment.",
    },
    {
      question: "Which payment methods are accepted?",
      answer:
        "We accept all major domestic and international debit and credit cards (Visa, Mastercard, RuPay, American Express) as well as UPI, powered by Stripe's secure payment gateway.",
    },
    {
      question: "How long are dates held while I checkout?",
      answer:
        `When you proceed to payment, your room is held for ${HOLD_DURATION_MINUTES} minutes. If payment is not completed within that window, the hold automatically expires and releases the room back to other guests.`,
    },
    {
      question: "What is your cancellation and refund policy?",
      answer:
        "Cancellations made 48 hours or more before check-in receive a full refund. Cancellations between 24 and 48 hours receive a 50% refund. Cancellations made within 24 hours of check-in are non-refundable.",
    },
    {
      question: "Can I change my booking dates after confirming?",
      answer:
        "Date changes depend on the property's availability. Please contact customer support with your booking reference number and our team will coordinate the change with the property owner.",
    },
    {
      question: "Can I receive a GST tax invoice for business travel?",
      answer:
        "Yes. Your payment confirmation email from Brevo includes a comprehensive booking summary with itemized room charges and applicable taxes suitable for business expense reporting.",
    },
    {
      question: "How do I contact the hotel or host before check-in?",
      answer:
        "After your booking is confirmed, your confirmation email and My Bookings page provide the property's direct contact phone number and exact address for check-in coordination.",
    },
    {
      question: "How do I list my hotel or room on PGM Stays?",
      answer:
        "Click 'Owner Dashboard' in the navigation bar or 'List your property' to register as a host. Once registered, you can add rooms, upload photos, and set pricing in under five minutes.",
    },
  ],
};

export default BUSINESS_CONFIG;
