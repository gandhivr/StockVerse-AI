/**
 * Fundamental Analysis Service
 * Fetches fundamental metrics via the Python ML microservice (yfinance),
 * then passes them to Gemini for AI-powered analysis.
 *
 * Why Python? Yahoo Finance's v10 quoteSummary API now requires crumb/cookie
 * auth that yfinance handles automatically; direct axios calls return 401.
 */

const axios = require("axios");
const { analyzeFundamentals, analyzeFundamentalsLocally } = require("./geminiService");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

// ── In-memory cache for Gemini fundamental analysis (TTL: 30 min) ─────────────
const analysisCache = new Map(); // symbol -> { result, expiresAt }
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch fundamental metrics from the Python ML service (yfinance under the hood).
 */
async function fetchFundamentals(appSymbol) {
  const upper = appSymbol.toUpperCase();

  try {
    const response = await axios.get(`${ML_SERVICE_URL}/fundamentals/${upper}`, {
      timeout: 20000,
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail || error.message;

    if (status === 502) {
      throw new Error(`Could not fetch fundamentals for ${upper}: ${detail}`);
    }
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      throw new Error(
        "Python ML service is not running. Please start it with: python -m uvicorn main:app --reload --port 8000"
      );
    }
    throw new Error(`Fundamental data fetch failed: ${detail}`);
  }
}

function generateSimulatedFundamentals(symbol) {
  const isBseNumeric = /^\d{6}$/.test(symbol);
  const { NSE_SYMBOLS } = require("../data/nseSymbols");
  const companyName = NSE_SYMBOLS[symbol] || (isBseNumeric ? `${symbol} (BSE Stock)` : `${symbol} Corp`);
  return {
    symbol,
    yahooSymbol: isBseNumeric ? `${symbol}.BO` : `${symbol}.NS`,
    companyName,
    companyInfo: `${companyName} is an Indian listed enterprise with stable business operations and regional presence.`,
    sector: "Financial Services",
    industry: "Capital Markets",
    marketCap: 25000000000,
    peRatio: 18.5,
    pbRatio: 2.3,
    eps: 12.4,
    evToEbitda: 11.2,
    dividendYield: 1.5,
    beta: 0.9,
    roe: 14.5,
    roce: 16.2,
    profitMargins: 10.5,
    grossMargins: 25.0,
    ebitdaMargins: 18.0,
    operatingMargins: 14.0,
    revenueGrowth: 8.5,
    earningsGrowth: 12.0,
    revenuePerShare: 85.0,
    currentRatio: 1.8,
    debtToEquity: 35.0,
    quickRatio: 1.4,
    totalCash: 1500000000,
    totalDebt: 800000000,
    freeCashflow: 1200000000,
    promoterHolding: 55.4,
    institutionalHolding: 22.1,
    fiiChange: null,
    diiChange: null,
    sectorPE: 22.0,
    sectorROE: 12.5,
    quarterlyResults: [
      { period: "2025-12-31", revenue: 6500000000, netIncome: 680000000, ebitda: 1100000000, eps: 3.1 },
      { period: "2025-09-30", revenue: 6200000000, netIncome: 630000000, ebitda: 1050000000, eps: 2.9 }
    ]
  };
}

/**
 * Run full fundamental analysis for a stock symbol.
 * Returns both raw metrics and the Gemini AI analysis.
 * Results are cached for 30 minutes to avoid hammering Gemini.
 */
async function getFundamentalAnalysis(appSymbol) {
  const upper = appSymbol.toUpperCase();

  // Return cached result if still fresh
  const cached = analysisCache.get(upper);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`Fundamental analysis cache hit for ${upper}`);
    return { ...cached.result, cached: true };
  }

  let metrics;
  let aiAnalysis;
  let isFallback = false;

  try {
    metrics = await fetchFundamentals(upper);
    try {
      aiAnalysis = await analyzeFundamentals(metrics);
    } catch (aiError) {
      console.warn(`Gemini AI analysis failed for ${upper}: ${aiError.message}. Falling back to rule-based analysis.`);
      aiAnalysis = analyzeFundamentalsLocally(metrics);
      isFallback = true;
    }
  } catch (error) {
    console.warn(`Fundamental fetch failed for ${upper}: ${error.message}. Using simulated fallback.`);
    metrics = generateSimulatedFundamentals(upper);
    aiAnalysis = analyzeFundamentalsLocally(metrics);
    isFallback = true;
  }

  const { NSE_SYMBOLS } = require("../data/nseSymbols");
  if (metrics && (!metrics.companyName || metrics.companyName === upper || metrics.companyName === metrics.symbol)) {
    metrics.companyName = NSE_SYMBOLS[upper] || metrics.companyName;
  }

  const result = {
    symbol: metrics.symbol,
    companyName: metrics.companyName,
    metrics,
    analysis: aiAnalysis,
    generatedAt: new Date().toISOString(),
    isFallback,
  };

  // Cache the result
  analysisCache.set(upper, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return result;
}

module.exports = { getFundamentalAnalysis, fetchFundamentals };
