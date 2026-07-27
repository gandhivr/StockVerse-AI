/**
 * Recommendation Service
 * Evaluates stock list against beginner goals (safety, growth, dividends) and risk profiles,
 * and matches the user with the top 3 best fits.
 */

const { getStockData } = require("./stockService");
const { fetchFundamentals } = require("./fundamentalService");
const { generateRecommendationReason, generateComparisonReport } = require("./geminiService");

// Curated stock list representing different categories for beginners
const RECO_POOL = [
  "RELIANCE",     // Mega-cap, stable, diversified
  "TCS",          // IT giant, high cash reserves, excellent dividends
  "INFY",         // IT leader, stable, moderate dividends
  "HDFCBANK",     // Banking giant, highly stable, moderate growth
  "ICICIBANK",    // High-performing bank, strong growth
  "SBIN",         // Public sector bank leader, stable dividends
  "WIPRO",        // Tech, stable, moderate risk
  "BAJFINANCE",   // High growth finance, medium-high risk
  "HINDUNILVR",   // Consumer goods, recession-proof, safe
  "LT",           // Industrial leader, infrastructure growth
  "ITC",          // Consumer/tobacco, excellent dividend yield, safe
  "TATAMOTORS",   // Auto turnaround, high growth, medium-high risk
  "ZOMATO",       // Tech consumer growth, high risk, high reward
];

/**
 * Match stocks based on user questionnaire answers
 * @param {string} goal - "safety" | "growth" | "dividends"
 * @param {string} risk - "low" | "medium" | "high"
 * @param {string} horizon - "short" | "long"
 */
async function getTradersMatch(goal, risk, horizon) {
  const matches = [];

  // Fetch quotes and fundamentals for our pool (in parallel)
  const poolPromises = RECO_POOL.map(async (symbol) => {
    try {
      const quote = await getStockData(symbol);
      let fundamentals = {};
      try {
        fundamentals = await fetchFundamentals(symbol);
      } catch (err) {
        console.warn(`Could not load fundamentals for ${symbol} matching: ${err.message}`);
        // fallback metrics
        fundamentals = {
          symbol,
          companyName: quote.shortName || symbol,
          marketCap: quote.marketCap || 1e11,
          dividendYield: symbol === "ITC" ? 3.8 : symbol === "TCS" ? 2.4 : 1.0,
          roe: 15,
          debtToEquity: symbol === "BAJFINANCE" ? 3.5 : symbol === "TATAMOTORS" ? 1.2 : 0.2,
          revenueGrowth: symbol === "ZOMATO" ? 25 : symbol === "TATAMOTORS" ? 18 : 8,
          beta: symbol === "ZOMATO" ? 1.4 : symbol === "HINDUNILVR" ? 0.6 : 1.0,
        };
      }
      return { symbol, quote, fundamentals };
    } catch (e) {
      console.error(`Failed loading recommendations data for ${symbol}:`, e.message);
      return null;
    }
  });

  const rawPool = (await Promise.all(poolPromises)).filter(Boolean);

  // Score each stock based on criteria
  for (const item of rawPool) {
    const { symbol, quote, fundamentals } = item;
    let score = 50; // baseline

    const beta = fundamentals.beta || 1.0;
    const debt = fundamentals.debtToEquity || 0.5;
    const divYield = fundamentals.dividendYield || 0;
    const growth = fundamentals.revenueGrowth || 0;
    const mcap = fundamentals.marketCap || 0;

    // ─── Goal Alignment ────────────────────────────────────────────────────────
    if (goal === "safety") {
      // Safe stocks have: low beta, low debt, large market cap, consumer staples/utilities
      if (beta < 0.9) score += 20;
      if (beta > 1.2) score -= 20;
      if (debt < 0.5) score += 15;
      if (debt > 1.5) score -= 20;
      if (mcap > 5e11) score += 10; // Mega cap
      if (["HINDUNILVR", "TCS", "HDFCBANK", "ITC", "RELIANCE"].includes(symbol)) {
        score += 15; // Known safe harbors
      }
    } else if (goal === "growth") {
      // Growth stocks have: high revenue growth, positive momentum, tech/finance/auto sectors
      if (growth > 12) score += 20;
      if (growth > 20) score += 10;
      if (growth < 5) score -= 15;
      if (["ZOMATO", "TATAMOTORS", "BAJFINANCE", "LT", "ICICIBANK"].includes(symbol)) {
        score += 15; // Growth leaders
      }
    } else if (goal === "dividends") {
      // Dividend stocks have: high dividend yield, stable cashflow
      if (divYield > 2.5) score += 25;
      if (divYield > 1.5) score += 15;
      if (divYield < 0.5) score -= 20;
      if (["ITC", "TCS", "INFY", "SBIN"].includes(symbol)) {
        score += 15; // Dividend champions
      }
    }

    // ─── Risk Profile Adjustment ────────────────────────────────────────────────
    if (risk === "low") {
      // Reject high beta or highly leveraged stocks
      if (beta > 1.1) score -= 25;
      if (beta < 0.8) score += 15;
      if (debt > 1.0) score -= 20;
    } else if (risk === "high") {
      // Favor volatile, high-return stocks, ignore high debt/beta warnings
      if (beta > 1.2) score += 15;
      if (beta < 0.8) score -= 10;
      if (symbol === "ZOMATO" || symbol === "TATAMOTORS") score += 15;
    } else { // medium risk
      // Standard balanced score
      if (beta > 1.4) score -= 15;
      if (beta < 0.6) score -= 5; // maybe too slow for medium
    }

    // ─── Time Horizon Alignment ─────────────────────────────────────────────────
    if (horizon === "short") {
      // short-term: favor volatility and volume (momentum)
      if (quote.changePercent && Math.abs(quote.changePercent) > 1.0) score += 10;
    } else {
      // long-term: favor large cap and sound balance sheet
      if (mcap > 2e11) score += 10;
      if (debt < 0.8) score += 10;
    }

    matches.push({
      symbol,
      companyName: fundamentals.companyName || quote.shortName || symbol,
      currentPrice: quote.currentPrice,
      changePercent: quote.changePercent,
      score,
      riskRating: beta > 1.2 ? "High Risk" : beta > 0.8 ? "Medium Risk" : "Low Risk",
      metrics: {
        marketCap: fundamentals.marketCap,
        dividendYield: divYield,
        revenueGrowth: growth,
        debtToEquity: debt,
      }
    });
  }

  // Sort by score descending and select top 3
  const top3 = matches.sort((a, b) => b.score - a.score).slice(0, 3);

  // Generate plain English explanations using Gemini
  const enrichedTop3 = await Promise.all(
    top3.map(async (match, idx) => {
      const reason = await generateRecommendationReason(
        match.symbol,
        match.companyName,
        goal,
        risk,
        match.metrics
      );

      // Determine a beginner badge
      let badge = "⭐️ Top Pick";
      if (goal === "safety") badge = idx === 0 ? "🛡️ Ultimate Safety" : "🔒 Secure Choice";
      if (goal === "growth") badge = idx === 0 ? "🚀 High Growth" : "📈 Rising Star";
      if (goal === "dividends") badge = idx === 0 ? "💰 Cash flow King" : "💵 Steady Payout";

      return {
        symbol: match.symbol,
        companyName: match.companyName,
        currentPrice: match.currentPrice,
        changePercent: match.changePercent,
        riskRating: match.riskRating,
        badge,
        reason,
      };
    })
  );

  return enrichedTop3;
}

/**
 * Compare two stocks side-by-side (metrics + AI report)
 */
async function compareStocks(symbol1, symbol2) {
  const upper1 = symbol1.toUpperCase();
  const upper2 = symbol2.toUpperCase();

  // Fetch details for stock 1
  const q1 = await getStockData(upper1);
  let f1 = {};
  try {
    f1 = await fetchFundamentals(upper1);
  } catch (err) {
    f1 = {
      symbol: upper1,
      companyName: q1.shortName || upper1,
      sector: "Other",
      industry: "Other",
      marketCap: q1.marketCap || 1e11,
      dividendYield: upper1 === "ITC" ? 3.8 : upper1 === "TCS" ? 2.4 : 1.0,
      revenueGrowth: upper1 === "ZOMATO" ? 25 : 8,
      debtToEquity: upper1 === "BAJFINANCE" ? 3.5 : 0.2,
    };
  }

  // Fetch details for stock 2
  const q2 = await getStockData(upper2);
  let f2 = {};
  try {
    f2 = await fetchFundamentals(upper2);
  } catch (err) {
    f2 = {
      symbol: upper2,
      companyName: q2.shortName || upper2,
      sector: "Other",
      industry: "Other",
      marketCap: q2.marketCap || 1e11,
      dividendYield: upper2 === "ITC" ? 3.8 : upper2 === "TCS" ? 2.4 : 1.0,
      revenueGrowth: upper2 === "ZOMATO" ? 25 : 8,
      debtToEquity: upper2 === "BAJFINANCE" ? 3.5 : 0.2,
    };
  }

  // Enforce structured details for Gemini report
  const s1 = {
    symbol: upper1,
    companyName: f1.companyName || q1.shortName || upper1,
    sector: f1.sector || "Other",
    industry: f1.industry || "Other",
    metrics: {
      marketCap: f1.marketCap || q1.marketCap,
      dividendYield: f1.dividendYield,
      revenueGrowth: f1.revenueGrowth,
      debtToEquity: f1.debtToEquity,
    }
  };

  const s2 = {
    symbol: upper2,
    companyName: f2.companyName || q2.shortName || upper2,
    sector: f2.sector || "Other",
    industry: f2.industry || "Other",
    metrics: {
      marketCap: f2.marketCap || q2.marketCap,
      dividendYield: f2.dividendYield,
      revenueGrowth: f2.revenueGrowth,
      debtToEquity: f2.debtToEquity,
    }
  };

  // Get Gemini side-by-side comparison report
  const report = await generateComparisonReport(s1, s2);

  return {
    stock1: {
      symbol: s1.symbol,
      companyName: s1.companyName,
      price: q1.currentPrice,
      changePercent: q1.changePercent,
      metrics: s1.metrics,
    },
    stock2: {
      symbol: s2.symbol,
      companyName: s2.companyName,
      price: q2.currentPrice,
      changePercent: q2.changePercent,
      metrics: s2.metrics,
    },
    comparison: report,
  };
}

module.exports = { getTradersMatch, compareStocks };
