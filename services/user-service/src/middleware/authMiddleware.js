
import { getAuth } from "@clerk/express";

const authenticate = (req, res, next) => {
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

  next();
};

export default authenticate;
