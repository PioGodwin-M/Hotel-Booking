import { timingSafeEqual } from "node:crypto";

export const authenticatePaymentService = (req, res, next) => {
  const configuredSecret = process.env.PAYMENT_SERVICE_SECRET;
  const suppliedSecret = req.get("x-payment-service-key");

  if (!configuredSecret || !suppliedSecret) {
    return res.status(401).json({
      success: false,
      message: "Payment Service authentication required",
    });
  }

  const expected = Buffer.from(configuredSecret);
  const supplied = Buffer.from(suppliedSecret);

  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid Payment Service credentials",
    });
  }

  return next();
};