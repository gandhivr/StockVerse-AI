/**
 * Watchlist Controller
 * Manage user stock watchlists
 */

const Watchlist = require("../models/Watchlist");

/**
 * GET /api/watchlist/:userId
 */
exports.getWatchlist = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const watchlist = await Watchlist.findOne({ userId }) || { userId, symbols: [] };
    res.json({ success: true, data: watchlist });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/watchlist/:userId/add
 * Body: { symbol: "RELIANCE" }
 */
exports.addToWatchlist = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ success: false, message: "symbol is required" });
    }

    const watchlist = await Watchlist.findOneAndUpdate(
      { userId },
      { $addToSet: { symbols: symbol.toUpperCase() } },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: watchlist });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/watchlist/:userId/remove/:symbol
 */
exports.removeFromWatchlist = async (req, res, next) => {
  try {
    const { userId, symbol } = req.params;

    const watchlist = await Watchlist.findOneAndUpdate(
      { userId },
      { $pull: { symbols: symbol.toUpperCase() } },
      { new: true }
    );

    res.json({ success: true, data: watchlist });
  } catch (error) {
    next(error);
  }
};
