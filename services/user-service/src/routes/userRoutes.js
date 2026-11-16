
import { Router } from "express";

import authenticate from "../middleware/authMiddleware.js";
import noCache from "../middleware/noCacheMiddleware.js";

import {
  getMyProfile,
  updateMyProfile,
  deactivateMyProfile,
} from "../controllers/userController.js";

const router = Router();

router.use(authenticate);

router.get("/me", noCache, getMyProfile);

router.patch("/me", updateMyProfile);

router.delete("/me", deactivateMyProfile);

export default router;
