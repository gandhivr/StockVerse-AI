const { fetchGoogleFinanceNews } = require("./newsService");
const { analyzeStockNewsSentiment } = require("./geminiService");
const { getStockData } = require("./stockService");

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

const FALLBACK_SENTIMENT = {
  sentimentScore: 0,
  impact: "LOW",
  direction: "NEUTRAL",
  keyEvents: [],
  signalAdjustment: "HOLD_SIGNAL",
  reasoning: "Recent news sentiment is unavailable, so the technical signal is unchanged.",
  source: "fallback",
};

const POSITIVE_TERMS = [
  "beat",
  "beats",
  "growth",
  "gain",
  "gains",
  "rally",
  "surge",
  "surges",
  "record",
  "profit",
  "profits",
  "upgrade",
  "upgraded",
  "buy",
  "bullish",
  "strong",
  "higher",
  "wins",
  "inflow",
  "inflows",
  "expansion",
  "order",
  "deal",
  "approval",
];

const NEGATIVE_TERMS = [
  "miss",
  "misses",
  "fall",
  "falls",
  "drop",
  "drops",
  "decline",
  "declines",
  "loss",
  "losses",
  "downgrade",
  "downgraded",
  "sell",
  "bearish",
  "weak",
  "lower",
  "outflow",
  "outflows",
  "probe",
  "penalty",
  "fraud",
  "lawsuit",
  "warning",
  "cuts",
  "slump",
];

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(-1, Math.min(1, score));
}

function cleanEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeSentiment(result) {
  return {
    sentimentScore: clampScore(result?.sentimentScore),
    impact: cleanEnum(result?.impact, ["HIGH", "MEDIUM", "LOW"], "LOW"),
    direction: cleanEnum(result?.direction, ["BULLISH", "BEARISH", "NEUTRAL"], "NEUTRAL"),
    keyEvents: Array.isArray(result?.keyEvents) ? result.keyEvents.slice(0, 5) : [],
    signalAdjustment: cleanEnum(
      result?.signalAdjustment,
      ["UPGRADE", "DOWNGRADE", "HOLD_SIGNAL"],
      "HOLD_SIGNAL",
    ),
    reasoning: result?.reasoning || FALLBACK_SENTIMENT.reasoning,
    source: result?.source || "gemini_analysis",
  };
}

function keywordScore(text) {
  const normalized = ` ${String(text || "").toLowerCase()} `;
  const positiveHits = POSITIVE_TERMS.reduce(
    (count, term) => count + (normalized.includes(` ${term} `) ? 1 : 0),
    0,
  );
  const negativeHits = NEGATIVE_TERMS.reduce(
    (count, term) => count + (normalized.includes(` ${term} `) ? 1 : 0),
    0,
  );

  return positiveHits - negativeHits;
}

function analyzeHeadlinesLocally(news) {
  const scored = news.slice(0, 10).map((item) => ({
    title: item.title,
    score: keywordScore(`${item.title} ${item.description || ""}`),
  }));
  const totalScore = scored.reduce((sum, item) => sum + item.score, 0);
  const sentimentScore = clampScore(totalScore / Math.max(4, scored.length * 2));
  const direction =
    sentimentScore > 0.12 ? "BULLISH" : sentimentScore < -0.12 ? "BEARISH" : "NEUTRAL";
  const impact =
    Math.abs(sentimentScore) >= 0.45 ? "HIGH" : Math.abs(sentimentScore) >= 0.18 ? "MEDIUM" : "LOW";

  return normalizeSentiment({
    sentimentScore,
    impact,
    direction,
    keyEvents: news.slice(0, 3).map((item) => item.title),
    signalAdjustment:
      direction === "BULLISH" ? "UPGRADE" : direction === "BEARISH" ? "DOWNGRADE" : "HOLD_SIGNAL",
    reasoning:
      direction === "NEUTRAL"
        ? "Recent headlines are mixed, so the technical signal is unchanged."
        : `Recent headlines lean ${direction.toLowerCase()}, so confidence is adjusted cautiously.`,
    source: "basic_analysis",
  });
}

async function analyzeHeadlinesWithGemini(symbol, headlines) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  return normalizeSentiment(await analyzeStockNewsSentiment(symbol, headlines));
}

function isRecentNews(item) {
  const publishedAt = Date.parse(item.publishedAt || "");
  if (!Number.isFinite(publishedAt)) return true;
  return Date.now() - publishedAt <= 7 * 24 * 60 * 60 * 1000;
}

async function getNewsSentimentForSymbol(symbol) {
  const safeSymbol = String(symbol || "")
    .trim()
    .toUpperCase();
  const cached = cache.get(safeSymbol);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    let queryName = safeSymbol;
    try {
      const stock = await getStockData(safeSymbol);
      if (stock && stock.shortName) {
        queryName = stock.shortName;
      }
    } catch (stockError) {
      console.warn(`Could not resolve name for ${safeSymbol}: ${stockError.message}`);
    }

    const news = (await fetchGoogleFinanceNews(`${queryName} stock NSE BSE`)).filter(isRecentNews);

    if (!news.length) {
      return FALLBACK_SENTIMENT;
    }

    let sentiment;
    try {
      sentiment = await analyzeHeadlinesWithGemini(safeSymbol, news);
    } catch (geminiError) {
      console.warn("News sentiment Gemini unavailable, using basic analysis:", geminiError.message);
      sentiment = analyzeHeadlinesLocally(news);
    }

    const value = {
      ...sentiment,
      keyEvents: sentiment.keyEvents.length
        ? sentiment.keyEvents
        : news.slice(0, 3).map((item) => item.title),
    };
    cache.set(safeSymbol, { value, cachedAt: Date.now() });
    return value;
  } catch (error) {
    console.warn("News sentiment agent fallback:", error.message);
    return FALLBACK_SENTIMENT;
  }
}

module.exports = {
  getNewsSentimentForSymbol,
  FALLBACK_SENTIMENT,
};
