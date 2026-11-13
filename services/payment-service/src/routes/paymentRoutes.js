import { Router } from "express";
import { createPaymentController } from "../controllers/paymentController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/", authenticate, createPaymentController);

export default router;