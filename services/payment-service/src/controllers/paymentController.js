
import mongoose from "mongoose";
import { createPayment } from "../services/paymentService.js";

export const createPaymentController = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { bookingId } = req.body;
    const idempotencyKey = req.get("Idempotency-Key");

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      typeof bookingId !== "string" ||
      !mongoose.isValidObjectId(bookingId)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid bookingId is required",
      });
    }

    if (
      typeof idempotencyKey !== "string" ||
      !idempotencyKey.trim() ||
      idempotencyKey.trim().length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required",
      });
    }

    const payment = await createPayment({
      bookingId,
      userId,
      idempotencyKey,
    });

    return res.status(200).json({
      success: true,
      message: "Payment initiated successfully",
      data: payment,
    });
  } catch (error) {
    return next(error);
  }
};
