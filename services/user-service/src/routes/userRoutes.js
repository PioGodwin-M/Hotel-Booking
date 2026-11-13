
import { Router } from "express";

import authenticate from "../middleware/authMiddleware.js";

import {
  getMyProfile,
  updateMyProfile,
  deactivateMyProfile,
} from "../controllers/userController.js";

const router = Router();

router.use(authenticate);

router.get("/me", getMyProfile);

router.patch("/me", updateMyProfile);

router.delete("/me", deactivateMyProfile);

export default router;
