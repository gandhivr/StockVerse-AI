const { getNewsSentiment } = require("../services/newsService");

/**
 * GET /api/news-sentiment
 * Query: ?topic=RELIANCE (optional)
 */
exports.getNewsSentiment = async (req, res, next) => {
  try {
    const topic = req.query.topic || "Indian stock market NSE BSE NIFTY";
    const data = await getNewsSentiment(topic);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
