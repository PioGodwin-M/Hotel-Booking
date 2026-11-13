
import { getAuth } from "@clerk/express";

export const authenticate = (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    req.user = {
      id: userId,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};
