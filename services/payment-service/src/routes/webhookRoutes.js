import { Router, raw } from "express";
import { handleStripeWebhook } from "../controllers/webhookController.js";

const router = Router();

router.post(
  "/",
  raw({ type: "application/json" }),
  handleStripeWebhook
);

export default router;