const express = require("express");
const router = express.Router();
const { getTradersMatch, compareStocks } = require("../services/recommendationService");

router.post("/match", async (req, res, next) => {
  try {
    const { goal, risk, horizon } = req.body;

    // Simple validations
    if (!goal || !risk || !horizon) {
      return res.status(400).json({
        success: false,
        message: "Missing questionnaire inputs: goal, risk, and horizon are required.",
      });
    }

    const validGoals = ["safety", "growth", "dividends"];
    const validRisks = ["low", "medium", "high"];
    const validHorizons = ["short", "long"];

    if (!validGoals.includes(goal) || !validRisks.includes(risk) || !validHorizons.includes(horizon)) {
      return res.status(400).json({
        success: false,
        message: "Invalid questionnaire parameters provided.",
      });
    }

    console.log(`Matching stock recommendation for Goal: ${goal}, Risk: ${risk}, Horizon: ${horizon}`);
    const recommendations = await getTradersMatch(goal, risk, horizon);

    res.json({
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/compare", async (req, res, next) => {
  try {
    const { symbol1, symbol2 } = req.body;

    if (!symbol1 || !symbol2) {
      return res.status(400).json({
        success: false,
        message: "Both stock symbols are required for comparison.",
      });
    }

    if (symbol1.toUpperCase() === symbol2.toUpperCase()) {
      return res.status(400).json({
        success: false,
        message: "Please choose two different stocks to compare.",
      });
    }

    console.log(`Comparing stocks: ${symbol1} vs ${symbol2}`);
    const report = await compareStocks(symbol1, symbol2);

    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
