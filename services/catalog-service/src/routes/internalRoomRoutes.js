
import express from "express";

import {
  getRoomPricing,
} from "../controllers/internalRoomController.js";

import {
  authenticateInternalService,
} from "../middleware/internalServiceAuth.js";

const router = express.Router();

router.get(
  "/:roomId/pricing",
  authenticateInternalService,
  getRoomPricing
);

export default router;
