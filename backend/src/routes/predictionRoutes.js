const express = require("express");
const router = express.Router();
const {
  predict,
  predictGet,
  forecast,
  agentForecast,
  chartIntelligence,
  traderToolkit,
  riskDashboard,
  stockNewsSentiment,
} = require("../controllers/predictionController");
const { fundamentals } = require("../controllers/fundamentalController");

router.post("/", predict);
router.get("/risk-dashboard", riskDashboard);
router.get("/:symbol/agents", agentForecast);
router.get("/:symbol/chart-intelligence", chartIntelligence);
router.get("/:symbol/trader-toolkit", traderToolkit);
router.get("/:symbol/forecast", forecast); // must be before /:symbol
router.get("/:symbol/fundamentals", fundamentals);
router.get("/:symbol/news-sentiment", stockNewsSentiment);
router.get("/:symbol", predictGet);

module.exports = router;
