
import {
  getOrCreateUser,
  getUserProfile,
  updateUserProfile,
  deactivateUser,
  getInternalUser,
} from "../services/userService.js";

export const getMyProfile = async (req, res, next) => {
  try {
    const user = await getOrCreateUser(req.user.id);

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "User account is not active",
      });
    }

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const user = await updateUserProfile(
      req.user.id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateMyProfile = async (
  req,
  res,
  next
) => {
  try {
    const user = await deactivateUser(req.user.id);

    res.status(200).json({
      success: true,
      message: "Application profile deactivated",
      data: {
        clerkUserId: user.clerkUserId,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getInternalUserProfile = async (
  req,
  res,
  next
) => {
  try {
    const user = await getInternalUser(req.params.userId);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
