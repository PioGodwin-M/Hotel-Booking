
const escapeHtml = (value = "") => {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
};

const formatDate = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

const formatAmount = (amount, currency = "INR") => {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(amount);
};

const getBookingDetails = (payload) => ({
  bookingId: payload.bookingId,
  checkIn: formatDate(payload.checkIn),
  checkOut: formatDate(payload.checkOut),
  numberOfRooms: payload.numberOfRooms,
  numberOfGuests: payload.numberOfGuests,
  totalAmount: formatAmount(
    payload.totalAmount,
    payload.currency
  ),
  currency: payload.currency || "INR",
});

const createEmailLayout = ({
  title,
  greeting,
  message,
  status,
  details,
  footerMessage,
}) => {
  const safeTitle = escapeHtml(title);
  const safeGreeting = escapeHtml(greeting);
  const safeMessage = escapeHtml(message);
  const safeStatus = escapeHtml(status);
  const safeFooter = escapeHtml(footerMessage);

  const detailRows = [
    ["Booking Reference", details.bookingId],
    ["Check-in", details.checkIn],
    ["Check-out", details.checkOut],
    ["Rooms", details.numberOfRooms],
    ["Guests", details.numberOfGuests],
    ["Total Amount", details.totalAmount],
  ];

  const htmlRows = detailRows
    .map(([label, value]) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;color:#666;">
          ${escapeHtml(label)}
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;font-weight:600;text-align:right;">
          ${escapeHtml(value ?? "Not available")}
        </td>
      </tr>
    `)
    .join("");

  const textRows = detailRows
    .map(([label, value]) =>
      `${label}: ${value ?? "Not available"}`
    )
    .join("\n");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${safeTitle}</title>
      </head>

      <body style="
        margin:0;
        padding:20px;
        background-color:#f4f6f8;
        font-family:Arial,Helvetica,sans-serif;
        color:#333;
      ">
        <div style="
          max-width:600px;
          margin:0 auto;
          background:#ffffff;
          border-radius:10px;
          overflow:hidden;
        ">
          <div style="
            padding:25px;
            background:#172554;
            color:white;
            text-align:center;
          ">
            <h1 style="margin:0;font-size:24px;">
              Hotel Booking
            </h1>
          </div>

          <div style="padding:30px;">
            <h2 style="margin-top:0;">${safeTitle}</h2>

            <p>Hello ${safeGreeting},</p>

            <p style="line-height:1.7;">
              ${safeMessage}
            </p>

            <div style="
              margin:20px 0;
              padding:15px;
              background:#f8fafc;
              border-radius:6px;
            ">
              <strong>Status:</strong> ${safeStatus}
            </div>

            <h3>Booking Details</h3>

            <table style="
              width:100%;
              border-collapse:collapse;
              font-size:14px;
            ">
              ${htmlRows}
            </table>

            <p style="
              margin-top:25px;
              line-height:1.6;
              color:#666;
            ">
              ${safeFooter}
            </p>
          </div>

          <div style="
            padding:20px;
            background:#f8fafc;
            text-align:center;
            color:#888;
            font-size:12px;
          ">
            This is an automated notification from Hotel Booking.
            Please do not reply to this email.
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Hotel Booking - ${title}

Hello ${greeting},

${message}

Status: ${status}

BOOKING DETAILS
${textRows}

${footerMessage}

This is an automated notification from Hotel Booking.
  `.trim();

  return { html, text };
};

// 1. Booking confirmation.
export const bookingConfirmedTemplate = ({
  displayName,
  payload,
}) => {
  const details = getBookingDetails(payload);

  const subject = `Booking Confirmed - ${details.bookingId}`;

  const content = createEmailLayout({
    title: "Your Booking Is Confirmed!",
    greeting: displayName || "Customer",
    message:
      "Your payment was successful and your hotel booking has been confirmed. We look forward to your stay.",
    status: "CONFIRMED",
    details,
    footerMessage:
      "Please keep this booking reference for future communication.",
  });

  return { subject, ...content };
};

// 2. Booking cancellation.
export const bookingCancelledTemplate = ({
  displayName,
  payload,
}) => {
  const details = getBookingDetails(payload);

  const subject = `Booking Cancelled - ${details.bookingId}`;

  const content = createEmailLayout({
    title: "Your Booking Has Been Cancelled",
    greeting: displayName || "Customer",
    message:
      "Your booking has been successfully cancelled. The booking inventory has been released.",
    status: "CANCELLED",
    details,
    footerMessage:
      "If you believe this cancellation is incorrect, please contact our support team.",
  });

  return { subject, ...content };
};

// 3. Payment failure.
export const bookingPaymentFailedTemplate = ({
  displayName,
  payload,
}) => {
  const details = getBookingDetails(payload);

  const subject = `Payment Failed - ${details.bookingId}`;

  const failureCode = payload.failureCode || "Not available";

  const content = createEmailLayout({
    title: "Your Payment Could Not Be Completed",
    greeting: displayName || "Customer",
    message:
      "We could not complete the payment for your booking. The booking could not be confirmed.",
    status: "PAYMENT FAILED",
    details,
    footerMessage:
      `Failure reference: ${failureCode}. Please create a new booking and try again if you wish to proceed.`,
  });

  return { subject, ...content };
};

// 4. Booking expiration.
export const bookingExpiredTemplate = ({
  displayName,
  payload,
}) => {
  const details = getBookingDetails(payload);

  const subject = `Booking Hold Expired - ${details.bookingId}`;

  const content = createEmailLayout({
    title: "Your Booking Hold Has Expired",
    greeting: displayName || "Customer",
    message:
      "Your temporary room reservation has expired because the booking was not completed within the permitted hold period.",
    status: "EXPIRED",
    details,
    footerMessage:
      "The held room inventory has been released. You can create a new booking if you still wish to reserve this room.",
  });

  return { subject, ...content };
};

// Central template resolver.
export const getBookingEmailTemplate = ({
  eventType,
  displayName,
  payload,
}) => {
  const templateInput = {
    displayName,
    payload,
  };

  switch (eventType) {
    case "BookingConfirmed":
      return bookingConfirmedTemplate(templateInput);

    case "BookingCancelled":
      return bookingCancelledTemplate(templateInput);

    case "BookingPaymentFailed":
      return bookingPaymentFailedTemplate(templateInput);

    case "BookingExpired":
      return bookingExpiredTemplate(templateInput);

    default:
      throw new Error(
        `Unsupported booking event type: ${eventType}`
      );
  }
};
