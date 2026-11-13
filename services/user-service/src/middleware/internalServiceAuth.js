
import { timingSafeEqual } from "node:crypto";

export const authenticateInternalService = (
  req,
  res,
  next
) => {
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;
  const providedSecret = req.get("x-internal-service-key");

  if (!expectedSecret) {
    return res.status(503).json({
      success: false,
      message: "Internal service authentication is not configured",
    });
  }

  if (!providedSecret) {
    return res.status(401).json({
      success: false,
      message: "Internal service authentication required",
    });
  }

  const expected = Buffer.from(expectedSecret);
  const provided = Buffer.from(providedSecret);

  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return res.status(403).json({
      success: false,
      message: "Invalid internal service credentials",
    });
  }

  next();
};
