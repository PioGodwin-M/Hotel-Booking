
import { Router } from "express";

import {
  authenticateInternalService,
} from "../middleware/internalServiceAuth.js";

import {
  getInternalUserProfile,
} from "../controllers/userController.js";

const router = Router();

router.use(authenticateInternalService);

router.get("/:userId", getInternalUserProfile);

export default router;
