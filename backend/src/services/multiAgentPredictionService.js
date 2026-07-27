const axios = require("axios");
const { getHistoricalData, getStockData, getPrimarySymbol } = require("./stockService");
const {
  technicalAnalysisPrediction,
  calculateRSI,
  calculateSMA,
  calculateMACD,
} = require("./predictionService");
const { savePredictionSnapshot } = require("./predictionTrackingService");
const { getNewsSentimentForSymbol, FALLBACK_SENTIMENT } = require("./newsSentimentAgent");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const DEFAULT_HORIZONS = [1, 7, 30, 60, 90];
const CONFIDENCE_CAPS = {
  1: 62,
  7: 58,
  30: 54,
  60: 50,
  90: 47,
};

function calculateVolatility(closes) {
  if (closes.length < 2) return 0.01;
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

function directionFor(changePercent) {
  if (changePercent > 0.35) return "UP";
  if (changePercent < -0.35) return "DOWN";
  return "FLAT";
}

function signalFor(changePercent, riskScore) {
  if (changePercent >= 2 && riskScore < 7) return "BUY";
  if (changePercent <= -2 || riskScore >= 8) return "SELL";
  return "HOLD";
}

function confidenceCapFor(days) {
  const exactCap = CONFIDENCE_CAPS[days];
  if (exactCap) return exactCap;
  if (days <= 1) return 62;
  if (days <= 7) return 58;
  if (days <= 30) return 54;
  if (days <= 60) return 50;
  return 47;
}

function newsAgreesWithSignal(signal, newsDirection) {
  return (
    (signal === "BUY" && newsDirection === "BULLISH") ||
    (signal === "SELL" && newsDirection === "BEARISH") ||
    (signal === "HOLD" && newsDirection === "NEUTRAL")
  );
}

function newsConflictsWithSignal(signal, newsDirection) {
  return (
    (signal === "BUY" && newsDirection === "BEARISH") ||
    (signal === "SELL" && newsDirection === "BULLISH")
  );
}

function newsConfidenceAdjustment(signal, newsResult) {
  if (!newsResult || newsResult.impact === "LOW") return 0;
  if (newsAgreesWithSignal(signal, newsResult.direction)) {
    return newsResult.impact === "HIGH" ? 5 : 3;
  }
  if (newsConflictsWithSignal(signal, newsResult.direction)) {
    return newsResult.impact === "HIGH" ? -8 : -4;
  }
  return 0;
}

function applyNewsSignalAdjustment(signal, newsResult) {
  if (!newsResult || newsResult.impact !== "HIGH") return signal;
  if (signal === "BUY" && newsResult.direction === "BEARISH") return "HOLD";
  if (signal === "SELL" && newsResult.direction === "BULLISH") return "HOLD";
  return signal;
}

function honestConfidence(item, risk, signal, newsResult) {
  const cap = confidenceCapFor(item.days);
  const riskPenalty = Math.max(0, risk - 5) * 1.8;
  const horizonUncertainty = Math.min(6, Math.sqrt(item.days) * 0.35);
  const baseConfidence = Math.min(Number(item.confidence) || cap, cap - 3);
  const adjusted =
    baseConfidence -
    riskPenalty -
    horizonUncertainty +
    newsConfidenceAdjustment(signal, newsResult);

  return parseFloat(Math.max(30, Math.min(cap, adjusted)).toFixed(1));
}

function horizonLabel(days) {
  const labels = {
    1: "Next Day",
    7: "1 Week",
    14: "2 Weeks",
    30: "1 Month",
    60: "2 Months",
    90: "3 Months",
  };
  return labels[days] || `${days} Days`;
}

function buildFallbackHorizons(symbol, history, horizons) {
  const base = technicalAnalysisPrediction(symbol, history);
  const closes = history.map((day) => day.close);
  const currentPrice = closes[closes.length - 1];
  const volatility = calculateVolatility(closes);
  const oneDayChange = base.priceChangePercent / 100;
  const drift = Math.max(-0.018, Math.min(0.018, oneDayChange * 0.65));

  return horizons.map((days) => {
    const dampening = Math.sqrt(days);
    const projectedChange =
      drift * dampening +
      (base.signal === "BUY" ? 0.0008 : base.signal === "SELL" ? -0.0008 : 0) * days;
    const range = volatility * Math.sqrt(days) * currentPrice;
    const predictedPrice = parseFloat((currentPrice * (1 + projectedChange)).toFixed(2));
    const changePercent = parseFloat(
      (((predictedPrice - currentPrice) / currentPrice) * 100).toFixed(2),
    );

    return {
      days,
      label: horizonLabel(days),
      predictedPrice,
      changePercent,
      direction: directionFor(changePercent),
      confidence: parseFloat(Math.max(35, Math.min(88, base.confidence - days * 0.18)).toFixed(1)),
      expectedRange: {
        low: parseFloat(Math.max(0, predictedPrice - range).toFixed(2)),
        high: parseFloat((predictedPrice + range).toFixed(2)),
      },
      source: "technical_agent",
    };
  });
}

async function marketDataAgent(symbol) {
  const [historical, quoteResult] = await Promise.allSettled([
    getHistoricalData(symbol, "1y"),
    getStockData(symbol),
  ]);

  if (historical.status !== "fulfilled" || !historical.value.history?.length) {
    throw new Error("Historical data unavailable for agent forecast");
  }

  const history = historical.value.history;
  const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
  const closes = history.map((day) => day.close);
  const volumes = history.map((day) => day.volume);

  return {
    agent: "market_data_agent",
    status: "complete",
    symbol,
    quote,
    history,
    features: {
      currentPrice: closes[closes.length - 1],
      rsi: calculateRSI(closes),
      sma20: calculateSMA(closes, 20),
      sma50: calculateSMA(closes, 50),
      sma200: calculateSMA(closes, 200),
      macd: calculateMACD(closes),
      volatility: calculateVolatility(closes),
      volumeRatio: parseFloat((volumes[volumes.length - 1] / calculateSMA(volumes, 20)).toFixed(2)),
    },
  };
}

async function modelPredictionAgent(symbol, history, horizons) {
  const primarySymbol = getPrimarySymbol(symbol);
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/predict/multi-horizon`,
      { symbol: primarySymbol, history: history.slice(-260), horizons },
      { timeout: 20000 },
    );

    return {
      agent: "model_prediction_agent",
      status: "complete",
      source: response.data.source || "ml_service",
      horizons: response.data.horizons,
      modelVersion: response.data.modelVersion || "multi_horizon_v1",
      modelMetadata: response.data.modelMetadata || null,
    };
  } catch (error) {
    return {
      agent: "model_prediction_agent",
      status: "fallback",
      source: "technical_agent",
      message: error.message,
      horizons: buildFallbackHorizons(symbol, history, horizons),
      modelVersion: "technical_fallback_v1",
      modelMetadata: null,
    };
  }
}

function riskAgent(features, horizons) {
  const rsiRisk =
    features.rsi > 75 || features.rsi < 25 ? 1.7 : features.rsi > 68 || features.rsi < 32 ? 0.8 : 0;
  const trendRisk = features.sma20 < features.sma50 ? 0.9 : 0;
  const volatilityRisk = features.volatility * 100;
  const volumeRisk = features.volumeRatio < 0.65 ? 0.8 : 0;
  const baseRisk = Math.min(10, Math.max(1, volatilityRisk + rsiRisk + trendRisk + volumeRisk));

  return {
    agent: "risk_agent",
    status: "complete",
    riskScore: parseFloat(baseRisk.toFixed(1)),
    riskLevel: baseRisk >= 7 ? "HIGH" : baseRisk >= 4 ? "MEDIUM" : "LOW",
    horizonRisks: horizons.map((item) => ({
      days: item.days,
      riskScore: parseFloat(Math.min(10, baseRisk + Math.sqrt(item.days) * 0.18).toFixed(1)),
    })),
    notes: [
      `Daily volatility is ${(features.volatility * 100).toFixed(2)}%.`,
      features.rsi > 70
        ? "RSI is overbought."
        : features.rsi < 30
          ? "RSI is oversold."
          : "RSI is neutral.",
      features.sma20 > features.sma50
        ? "Short-term trend is above medium-term trend."
        : "Short-term trend is below medium-term trend.",
    ],
  };
}

async function newsSentimentAgent(symbol) {
  try {
    const result = await getNewsSentimentForSymbol(symbol);
    return {
      agent: "news_sentiment_agent",
      status:
        result.source === "fallback" ||
        (result.direction === "NEUTRAL" &&
          result.impact === "LOW" &&
          result.sentimentScore === 0 &&
          result.reasoning === FALLBACK_SENTIMENT.reasoning)
          ? "fallback"
          : "complete",
      source: result.source || "gemini_analysis",
      sentimentScore: result.sentimentScore,
      direction: result.direction,
      impact: result.impact,
      keyEvents: result.keyEvents || [],
      signalAdjustment: result.signalAdjustment,
      reasoning: result.reasoning,
    };
  } catch (error) {
    return {
      agent: "news_sentiment_agent",
      status: "fallback",
      sentimentScore: FALLBACK_SENTIMENT.sentimentScore,
      direction: FALLBACK_SENTIMENT.direction,
      impact: FALLBACK_SENTIMENT.impact,
      keyEvents: [],
      signalAdjustment: FALLBACK_SENTIMENT.signalAdjustment,
      reasoning: FALLBACK_SENTIMENT.reasoning,
      message: error.message,
    };
  }
}

function synthesisAgent(symbol, features, modelResult, riskResult, newsResult) {
  let newsInfluenced = false;
  const horizons = modelResult.horizons.map((item) => {
    const risk =
      riskResult.horizonRisks.find((riskItem) => riskItem.days === item.days)?.riskScore ||
      riskResult.riskScore;
    const technicalSignal = signalFor(item.changePercent, risk);
    const signal = applyNewsSignalAdjustment(technicalSignal, newsResult);
    const newsAdjustment = newsConfidenceAdjustment(technicalSignal, newsResult);
    if (signal !== technicalSignal || newsAdjustment !== 0) {
      newsInfluenced = true;
    }

    return {
      ...item,
      technicalSignal,
      signal,
      confidence: honestConfidence(item, risk, technicalSignal, newsResult),
    };
  });

  const primary = horizons.find((item) => item.days === 30) || horizons[0];
  const verdict = primary.signal;
  const trend =
    primary.direction === "UP" ? "BULLISH" : primary.direction === "DOWN" ? "BEARISH" : "NEUTRAL";

  return {
    agent: "synthesis_agent",
    status: "complete",
    symbol,
    verdict,
    trend,
    currentPrice: features.currentPrice,
    primaryHorizon: primary,
    horizons,
    technicalIndicators: {
      rsi: features.rsi,
      sma20: features.sma20,
      sma50: features.sma50,
      sma200: features.sma200,
      macd: features.macd,
      volatility: parseFloat((features.volatility * 100).toFixed(2)),
      volumeRatio: features.volumeRatio,
    },
    risk: riskResult,
    source: modelResult.source,
    modelVersion: modelResult.modelVersion,
    modelMetadata: modelResult.modelMetadata,
    modelStatus: modelResult.source === "trained_multi_horizon_model" ? "TRAINED" : "FALLBACK",
    newsInfluenced,
    newsReasoning: newsResult?.reasoning || FALLBACK_SENTIMENT.reasoning,
    newsSentiment: {
      score: newsResult?.sentimentScore ?? FALLBACK_SENTIMENT.sentimentScore,
      direction: newsResult?.direction || FALLBACK_SENTIMENT.direction,
      impact: newsResult?.impact || FALLBACK_SENTIMENT.impact,
      keyEvents: newsResult?.keyEvents || [],
    },
    summary: `${symbol} is ${trend.toLowerCase()} for ${primary.label.toLowerCase()} with ${primary.confidence}% confidence. Risk is ${riskResult.riskLevel.toLowerCase()}. ${newsResult?.reasoning || FALLBACK_SENTIMENT.reasoning}`,
  };
}

async function runMultiAgentForecast(symbol, requestedHorizons = DEFAULT_HORIZONS) {
  const horizons = requestedHorizons
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 365)
    .slice(0, 8);
  const safeHorizons = horizons.length ? horizons : DEFAULT_HORIZONS;

  // ── Phase 1: Market data + News sentiment run IN PARALLEL ─────────────────
  // These two have no dependency on each other — fire both at once.
  const [market, newsEarly] = await Promise.all([
    marketDataAgent(symbol),
    newsSentimentAgent(symbol),
  ]);

  // ── Phase 2: Model prediction needs market history from Phase 1 ───────────
  const model = await modelPredictionAgent(symbol, market.history, safeHorizons);

  // ── Phase 3: Risk is synchronous — runs instantly ─────────────────────────
  const risk = riskAgent(market.features, model.horizons);

  // ── Phase 4: Synthesise everything ────────────────────────────────────────
  const synthesis = synthesisAgent(symbol, market.features, model, risk, newsEarly);

  const result = {
    ...synthesis,
    agents: [
      { name: market.agent, status: market.status },
      { name: model.agent, status: model.status, source: model.source },
      { name: risk.agent, status: risk.status },
      { name: newsEarly.agent, status: newsEarly.status, source: newsEarly.source },
      { name: synthesis.agent, status: synthesis.status },
    ],
    generatedAt: new Date().toISOString(),
  };

  await savePredictionSnapshot(result);
  return result;
}

module.exports = {
  runMultiAgentForecast,
  DEFAULT_HORIZONS,
};
