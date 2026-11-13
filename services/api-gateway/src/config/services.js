
export const services = {
  user: process.env.USER_SERVICE_URL,
  catalog: process.env.CATALOG_SERVICE_URL,
  booking: process.env.BOOKING_SERVICE_URL,
  payment: process.env.PAYMENT_SERVICE_URL,
};

export const validateServices = () => {
  const missing = Object.entries(services)
    .filter(([, url]) => !url)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing service URLs: ${missing.join(", ")}`
    );
  }
};
