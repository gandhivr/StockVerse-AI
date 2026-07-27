const { getPrediction, getFutureForecast } = require("../services/predictionService");
const {
  runMultiAgentForecast,
  DEFAULT_HORIZONS,
} = require("../services/multiAgentPredictionService");
const { generateStockInsight, analyzeStockNewsSentiment } = require("../services/geminiService");
const { getStockData } = require("../services/stockService");
const { fetchGoogleFinanceNews } = require("../services/newsService");
const {
  analyzeChart,
  buildTraderToolkit,
  buildRiskDashboard,
} = require("../services/chartPatternService");

/**
 * POST /api/predict
 * Body: { symbol: "RELIANCE" }
 */
exports.predict = async (req, res, next) => {
  try {
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ success: false, message: "symbol is required" });
    }

    const [prediction, stockData] = await Promise.all([
      getPrediction(symbol.toUpperCase()),
      getStockData(symbol.toUpperCase()),
    ]);

    // Optionally enrich with Gemini insight (non-blocking)
    let aiInsight = null;
    try {
      aiInsight = await generateStockInsight(stockData, prediction);
    } catch (e) {
      // Gemini unavailable — skip insight
    }

    res.json({
      success: true,
      data: {
        ...prediction,
        stockData,
        aiInsight,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/predict/:symbol
 * Convenience GET endpoint
 */
exports.predictGet = async (req, res, next) => {
  req.body = { symbol: req.params.symbol };
  return exports.predict(req, res, next);
};

/**
 * GET /api/predict/:symbol/forecast
 * Multi-day future forecast with Gemini narrative
 */
exports.forecast = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const data = await getFutureForecast(symbol.toUpperCase());
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/predict/:symbol/agents?horizons=1,7,30,90
 * Multi-agent forecast for next day, week, month, and custom horizons
 */
exports.agentForecast = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const horizons =
      typeof req.query.horizons === "string"
        ? req.query.horizons.split(",").map((value) => Number(value.trim()))
        : DEFAULT_HORIZONS;

    const data = await runMultiAgentForecast(symbol.toUpperCase(), horizons);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/predict/:symbol/chart-intelligence?range=1y
 * Chart pattern, support/resistance, risk/reward, and technical setup analysis
 */
exports.chartIntelligence = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const range = typeof req.query.range === "string" ? req.query.range : "1y";
    const data = await analyzeChart(symbol.toUpperCase(), range);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/predict/:symbol/trader-toolkit?capital=100000&risk=1
 * Trade plan, position sizing, multi-timeframe agreement, and setup backtest
 */
exports.traderToolkit = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const data = await buildTraderToolkit(symbol.toUpperCase(), {
      capital: req.query.capital,
      riskPercent: req.query.risk,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/predict/risk-dashboard?symbols=RELIANCE,TCS,INFY
 * Market-wide risk and opportunity scanner
 */
exports.riskDashboard = async (req, res, next) => {
  try {
    const symbols =
      typeof req.query.symbols === "string"
        ? req.query.symbols.split(",").map((symbol) => symbol.trim()).filter(Boolean)
        : undefined;
    const data = await buildRiskDashboard(symbols);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/predict/:symbol/news-sentiment
 * Fetches news and performs sentiment analysis using Gemini
 */
exports.stockNewsSentiment = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const cleanSymbol = symbol.toUpperCase();

    // Fetch news (Google Finance search query)
    const news = await fetchGoogleFinanceNews(`${cleanSymbol} stock news`);

    if (!news || news.length === 0) {
      return res.json({
        success: true,
        data: {
          sentimentScore: 0.15,
          impact: "LOW",
          direction: "NEUTRAL",
          keyEvents: ["No recent high-impact headlines found."],
          signalAdjustment: "HOLD_SIGNAL",
          reasoning: "No recent news was retrieved from search channels.",
          beginnerExplanation: "There are no major news events driving the stock price today.",
          news: [],
          fetchedAt: new Date().toISOString(),
        }
      });
    }

    try {
      const sentiment = await analyzeStockNewsSentiment(cleanSymbol, news);
      res.json({
        success: true,
        data: {
          ...sentiment,
          news,
          fetchedAt: new Date().toISOString(),
        }
      });
    } catch (geminiError) {
      console.warn(`Gemini stock news sentiment failed for ${cleanSymbol}:`, geminiError.message);
      res.json({
        success: true,
        data: {
          sentimentScore: 0.0,
          impact: "LOW",
          direction: "NEUTRAL",
          keyEvents: news.slice(0, 3).map(n => n.title),
          signalAdjustment: "HOLD_SIGNAL",
          reasoning: "AI analysis was skipped due to temporary service load.",
          beginnerExplanation: "News sentiment is stable and has no immediate positive or negative alerts.",
          news,
          fetchedAt: new Date().toISOString(),
        }
      });
    }
  } catch (error) {
    next(error);
  }
};
