
const errorMiddleware = (error, req, res, next) => {
  console.error("Notification Service error:", error);

  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.status || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "Internal server error"
        : error.message,
  });
};

export default errorMiddleware;
