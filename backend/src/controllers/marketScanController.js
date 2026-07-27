const { scanMarket } = require("../services/marketScanService");

/**
 * GET /api/market-scan
 */
exports.scanMarket = async (req, res, next) => {
  try {
    const data = await scanMarket();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
