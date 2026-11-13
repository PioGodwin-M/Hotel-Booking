import express from "express";

import { getOwnerHotelsInternal } from "../controllers/internalHotelController.js";
import { authenticateInternalService } from "../middleware/internalServiceAuth.js";

const router = express.Router();

// Internal service-to-service endpoint protected by shared secret
router.get(
  "/owner/:ownerId",
  authenticateInternalService,
  getOwnerHotelsInternal
);

export default router;
