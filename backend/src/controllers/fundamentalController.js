const { getFundamentalAnalysis } = require("../services/fundamentalService");

/**
 * GET /api/predict/:symbol/fundamentals
 * Full AI-powered fundamental analysis for an NSE stock.
 */
exports.fundamentals = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    if (!symbol) {
      return res.status(400).json({ success: false, message: "symbol is required" });
    }

    const data = await getFundamentalAnalysis(symbol.toUpperCase());
    res.json({ success: true, data });
  } catch (error) {
    // Gemini rate limit — surface as 429 with a user-friendly message
    if (error.isRateLimit || isRateLimitError(error)) {
      return res.status(429).json({
        success: false,
        message: "Gemini AI rate limit reached. Please wait 30–60 seconds and try again.",
        userMessage: "The AI service is temporarily busy. Please wait a moment and click Analyze again.",
        retryAfterSeconds: 45,
      });
    }

    if (error.message?.includes("API_KEY") || error.message?.includes("GEMINI_API_KEY")) {
      return res.status(503).json({
        success: false,
        message: "AI service unavailable. Please configure GEMINI_API_KEY.",
        userMessage: "The AI service is not configured yet.",
      });
    }

    next(error);
  }
};

function isRateLimitError(error) {
  const msg = error?.message || "";
  return (
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("quota") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Too Many Requests") ||
    msg.includes("rate limit") ||
    msg.includes("rate limited") ||
    msg.includes("high demand") ||
    msg.includes("Service Unavailable") ||
    msg.includes("temporarily")
  );
}
