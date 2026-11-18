import express from "express";

import {
  getOwnerHotelsInternal,
  getPropertyBookingSnapshotInternal,
} from "../controllers/internalHotelController.js";
import { authenticateInternalService } from "../middleware/internalServiceAuth.js";

const router = express.Router();

// Internal service-to-service endpoint protected by shared secret
router.get(
  "/owner/:ownerId",
  authenticateInternalService,
  getOwnerHotelsInternal
);

// Internal booking snapshot endpoint (Round 4g B3)
router.get(
  "/:propertyId/booking-snapshot",
  authenticateInternalService,
  getPropertyBookingSnapshotInternal
);

export default router;
