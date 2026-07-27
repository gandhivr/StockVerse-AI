const { analyzePortfolio } = require("../services/portfolioService");
const Portfolio = require("../models/Portfolio");

/**
 * POST /api/portfolio/analyze
 * Analyze a portfolio (no auth required for demo)
 * Body: { holdings: [{symbol, name, quantity, buyPrice, sector}] }
 */
exports.analyzePortfolio = async (req, res, next) => {
  try {
    const { holdings } = req.body;

    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return res.status(400).json({ success: false, message: "holdings array is required" });
    }

    if (holdings.length > 50) {
      return res.status(400).json({ success: false, message: "Maximum 50 holdings allowed" });
    }

    // Validate each holding
    for (const h of holdings) {
      if (!h.symbol || !h.quantity || !h.buyPrice) {
        return res.status(400).json({
          success: false,
          message: "Each holding must have symbol, quantity, and buyPrice",
        });
      }
    }

    const analysis = await analyzePortfolio(holdings);

    res.json({ success: true, data: analysis });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/portfolio/save
 * Save portfolio to DB
 */
exports.savePortfolio = async (req, res, next) => {
  try {
    const { holdings, name, userId } = req.body;

    const portfolio = await Portfolio.findOneAndUpdate(
      { userId: userId || "demo_user" },
      { holdings, name: name || "My Portfolio", updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: portfolio });
  } catch (error) {
    next(error);
  }
};
