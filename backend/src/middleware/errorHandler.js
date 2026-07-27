/**
 * Global Error Handler Middleware
 * Catches all errors passed via next(err)
 */

const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err.stack || err.message);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(", ") });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ success: false, message: `${field} already exists.` });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, message: "Invalid token." });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, message: "Token expired." });
  }

  const status = err.status || err.statusCode || 500;
  const friendlyMessages = {
    400: "The request could not be processed. Please check the submitted values.",
    401: "Please sign in again to continue.",
    403: "You do not have permission to perform this action.",
    404: "The requested resource was not found.",
    429: "Too many requests. Please wait a moment and try again.",
    500: "The service hit an unexpected problem. Please try again shortly.",
    502: "An upstream market or AI service is not responding.",
    503: "This service is temporarily unavailable.",
  };

  res.status(status).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? friendlyMessages[status] || "Something went wrong."
        : err.message,
    userMessage: friendlyMessages[status] || "Something went wrong. Please try again.",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
