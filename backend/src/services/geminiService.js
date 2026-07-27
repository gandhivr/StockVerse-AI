/**
 * Google Gemini AI Service
 * Powers the AI chatbot and news sentiment analysis
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;
// Only models confirmed available on v1beta for this key's region.
// gemini-2.0-flash-lite has the highest free-tier RPM — try first.
const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
].filter(Boolean);
// De-duplicate while preserving order
const seen = new Set();
const GEMINI_MODELS_DEDUP = GEMINI_MODELS.filter((m) => {
  if (seen.has(m)) return false;
  seen.add(m);
  return true;
});
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 25000);

// ─── Global rate-limit queue (max 12 req/min = 1 per 5s) ─────────────────────
// Free tier is 15 RPM. We stay at 12 to leave headroom.
// All Gemini calls go through this queue to avoid simultaneous 429s.
const RATE_LIMIT_INTERVAL_MS = 5000; // 12 req/min
let _lastCallAt = 0;
let _queueRunning = false;
const _queue = [];

function enqueueGeminiCall(fn) {
  return new Promise((resolve, reject) => {
    _queue.push({ fn, resolve, reject });
    if (!_queueRunning) _drainQueue();
  });
}

async function _drainQueue() {
  _queueRunning = true;
  while (_queue.length > 0) {
    const now = Date.now();
    const wait = Math.max(0, _lastCallAt + RATE_LIMIT_INTERVAL_MS - now);
    if (wait > 0) await sleep(wait);

    const item = _queue.shift();
    if (!item) break;
    _lastCallAt = Date.now();
    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    }
  }
  _queueRunning = false;
}

function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

function isModelUnavailable(error) {
  const message = error?.message || "";
  return (
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("not supported") ||
    message.includes("not available")
  );
}

function isRateLimited(error) {
  const message = error?.message || "";
  const status = error?.status || error?.httpStatus || error?.code;
  return (
    status === 429 ||
    status === 503 ||
    message.includes("429") ||
    message.includes("503") ||
    message.includes("quota") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("Too Many Requests") ||
    message.includes("rate limit") ||
    message.includes("high demand") ||
    message.includes("Service Unavailable") ||
    message.includes("temporarily")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs = GEMINI_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Gemini request timed out")), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function tryGeminiModels(run, { maxRetries = 1, retryDelayMs = 2000 } = {}) {
  // All Gemini calls go through the rate-limit queue
  return enqueueGeminiCall(() => _tryModels(run, { maxRetries, retryDelayMs }));
}

async function _tryModels(run, { maxRetries = 1, retryDelayMs = 2000 } = {}) {
  let lastError;
  let anyRateLimited = false;

  for (const modelName of GEMINI_MODELS_DEDUP) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await run(modelName);
      } catch (error) {
        lastError = error;

        if (isModelUnavailable(error)) {
          console.warn(`Gemini model ${modelName} unavailable: ${error.message}`);
          break; // skip to next model
        }

        if (isRateLimited(error)) {
          anyRateLimited = true;
          if (attempt < maxRetries) {
            const delay = retryDelayMs * Math.pow(2, attempt);
            console.warn(
              `Gemini rate limited on ${modelName} (attempt ${attempt + 1}). Retrying in ${delay}ms...`,
            );
            await sleep(delay);
            continue;
          }
          console.warn(`Gemini rate limit on ${modelName}, trying next model.`);
          break;
        }

        // Any other error — throw immediately
        throw error;
      }
    }
  }

  // Surface a clear rate-limit error if any model was quota-blocked
  if (anyRateLimited) {
    const err = new Error("Gemini API rate limit reached. Please wait a moment and try again.");
    err.isRateLimit = true;
    throw err;
  }

  throw lastError || new Error("No Gemini model is configured");
}

function getGenerativeModel(modelName, options = {}) {
  return getGenAI().getGenerativeModel({
    model: modelName,
    ...options,
  });
}

// ─── System Prompt for Finance Domain ────────────────────────────────────────
const FINANCE_SYSTEM_PROMPT = `You are StockVerse AI, an expert Indian stock market analyst and financial advisor assistant.

Your expertise includes:
- NSE/BSE listed Indian stocks (NIFTY 50, SENSEX, BANKNIFTY)
- Technical analysis (RSI, MACD, Moving Averages, Bollinger Bands)
- Fundamental analysis (P/E ratio, EPS, revenue growth)
- Sector analysis (IT, Banking, Pharma, Auto, FMCG, Energy)
- Portfolio management and risk assessment
- Market trends and macroeconomic factors affecting Indian markets
- RBI monetary policy, FII/DII flows, global market impact

Guidelines:
- Always mention that predictions are for educational purposes only
- Use INR (₹) for prices
- Reference Indian market hours: 9:15 AM - 3:30 PM IST
- Be concise but insightful
- Use bullet points for clarity
- Include risk warnings when suggesting trades
- Format numbers in Indian style (lakhs, crores)`;

/**
 * Send a chat message to Gemini with conversation history
 * @param {string} userMessage - Current user message
 * @param {Array} history - Previous messages [{role, content}]
 * @returns {string} AI response
 */
async function chat(userMessage, history = []) {
  // Convert history to Gemini format
  const geminiHistory = history.slice(-10).map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  return tryGeminiModels(async (modelName) => {
    const model = getGenerativeModel(modelName, {
      systemInstruction: FINANCE_SYSTEM_PROMPT,
    });
    const chat = model.startChat({ history: geminiHistory });
    const result = await withTimeout(chat.sendMessage(userMessage));
    return result.response.text();
  });
}

/**
 * Analyze news sentiment using Gemini
 * @param {Array} newsItems - Array of {title, description} objects
 * @returns {Object} Sentiment analysis result
 */
async function analyzeNewsSentiment(newsItems) {
  const newsText = newsItems
    .slice(0, 10)
    .map((n, i) => `${i + 1}. ${n.title}: ${n.description || ""}`)
    .join("\n");

  const prompt = `Analyze the following Indian stock market news headlines and provide sentiment analysis.

NEWS:
${newsText}

Respond in this exact JSON format:
{
  "overallSentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "sentimentScore": <number between -1 and 1>,
  "marketImpact": "HIGH" | "MEDIUM" | "LOW",
  "summary": "<2-3 sentence market summary>",
  "keyThemes": ["theme1", "theme2", "theme3"],
  "bullishFactors": ["factor1", "factor2"],
  "bearishFactors": ["factor1", "factor2"],
  "newsAnalysis": [
    {
      "headline": "<shortened headline>",
      "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
      "impact": "<brief impact description>"
    }
  ]
}`;

  const text = await tryGeminiModels(async (modelName) => {
    const model = getGenerativeModel(modelName);
    const result = await withTimeout(model.generateContent(prompt));
    return result.response.text();
  });

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Invalid sentiment response format");

  return JSON.parse(jsonMatch[0]);
}

/**
 * Analyze stock-specific news sentiment using Gemini
 * @param {string} symbol - Stock symbol
 * @param {Array} newsItems - Array of {title, description} objects
 * @returns {Object} Stock-specific sentiment analysis result
 */
async function analyzeStockNewsSentiment(symbol, newsItems) {
  const headlines = newsItems
    .slice(0, 10)
    .map((item, index) => `${index + 1}. ${item.title}${item.description ? `: ${item.description}` : ""}`)
    .join("\n");

  const prompt = `Analyze these news headlines for ${symbol} stock and return JSON:
{
  "sentimentScore": <-1.0 to 1.0>,
  "impact": "HIGH" | "MEDIUM" | "LOW",
  "direction": "BULLISH" | "BEARISH" | "NEUTRAL",
  "keyEvents": ["event1", "event2"],
  "signalAdjustment": "UPGRADE" | "DOWNGRADE" | "HOLD_SIGNAL",
  "reasoning": "one sentence",
  "beginnerExplanation": "one friendly, jargon-free sentence explaining what this news trend means for a beginner trader with zero financial knowledge, without any technical terms"
}

HEADLINES:
${headlines}`;

  const text = await tryGeminiModels(async (modelName) => {
    const model = getGenerativeModel(modelName);
    const result = await withTimeout(model.generateContent(prompt));
    return result.response.text();
  });
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Invalid stock news sentiment response format");

  return JSON.parse(jsonMatch[0]);
}

/**
 * Generate AI market summary for a specific stock
 * @param {Object} stockData - Current stock data
 * @param {Object} prediction - ML prediction result
 */
async function generateStockInsight(stockData, prediction) {
  const prompt = `Provide a brief AI insight for ${stockData.appSymbol || stockData.symbol}:
- Current Price: ₹${stockData.currentPrice}
- Change: ${stockData.changePercent}%
- Volume: ${stockData.volume?.toLocaleString("en-IN")}
- AI Signal: ${prediction?.signal || "N/A"}
- Predicted Price: ₹${prediction?.predictedPrice || "N/A"}
- Confidence: ${prediction?.confidence || "N/A"}%

Give a 2-3 sentence insight about this stock's current situation and outlook. Be specific and actionable.`;

  return tryGeminiModels(async (modelName) => {
    const model = getGenerativeModel(modelName);
    const result = await withTimeout(model.generateContent(prompt));
    return result.response.text();
  });
}

/**
 * Math-based fundamental analysis fallback — no Gemini required.
 * Scores each metric against known good/bad thresholds for Indian stocks.
 */
function analyzeFundamentalsLocally(metrics) {
  let score = 50; // start neutral
  const strengths = [];
  const risks = [];
  const notes = {};

  // ── Profitability ─────────────────────────────────────────────────────────
  const roe = metrics.roe;
  const pm = metrics.profitMargins;
  const om = metrics.operatingMargins;

  if (roe != null) {
    if (roe >= 20) { score += 8; strengths.push(`Strong ROE of ${roe.toFixed(1)}% indicates excellent capital efficiency`); }
    else if (roe >= 12) { score += 4; strengths.push(`Healthy ROE of ${roe.toFixed(1)}%`); }
    else if (roe < 8) { score -= 5; risks.push(`Low ROE of ${roe.toFixed(1)}% suggests weak returns on equity`); }
    notes.profitability = `ROE is ${roe.toFixed(1)}%${pm != null ? `, profit margin is ${pm.toFixed(1)}%` : ""}.`;
  } else {
    notes.profitability = "ROE data unavailable.";
  }

  if (pm != null) {
    if (pm >= 15) { score += 5; }
    else if (pm < 5) { score -= 4; risks.push(`Thin profit margin of ${pm.toFixed(1)}% leaves little buffer`); }
  }

  // ── Debt ─────────────────────────────────────────────────────────────────
  const de = metrics.debtToEquity;
  const cr = metrics.currentRatio;

  if (de != null) {
    if (de < 30) { score += 6; strengths.push(`Low debt-to-equity ratio of ${de.toFixed(1)} — strong balance sheet`); }
    else if (de < 80) { score += 2; }
    else { score -= 6; risks.push(`High debt-to-equity of ${de.toFixed(1)} increases financial risk`); }
    notes.debt = `Debt/Equity: ${de.toFixed(1)}.${cr != null ? ` Current ratio: ${cr.toFixed(2)}.` : ""}`;
  } else {
    notes.debt = "Debt data unavailable.";
  }

  if (cr != null) {
    if (cr >= 1.5) { score += 4; strengths.push(`Current ratio of ${cr.toFixed(2)} indicates good liquidity`); }
    else if (cr < 1) { score -= 4; risks.push(`Current ratio below 1 — potential short-term liquidity stress`); }
  }

  // ── Growth ────────────────────────────────────────────────────────────────
  const rg = metrics.revenueGrowth;
  const eg = metrics.earningsGrowth;

  if (rg != null) {
    if (rg >= 15) { score += 7; strengths.push(`Strong revenue growth of ${rg.toFixed(1)}% YoY`); }
    else if (rg >= 8) { score += 4; }
    else if (rg < 0) { score -= 5; risks.push(`Revenue declined ${Math.abs(rg).toFixed(1)}% YoY`); }
    notes.revenueGrowth = `Revenue grew ${rg.toFixed(1)}% YoY.`;
  } else {
    notes.revenueGrowth = "Revenue growth data unavailable.";
  }

  if (eg != null) {
    if (eg >= 20) { score += 6; strengths.push(`Earnings growing at ${eg.toFixed(1)}% YoY — positive momentum`); }
    else if (eg >= 10) { score += 3; }
    else if (eg < 0) { score -= 5; risks.push(`Earnings declined ${Math.abs(eg).toFixed(1)}% YoY`); }
    notes.profitGrowth = `Earnings grew ${eg.toFixed(1)}% YoY.`;
  } else {
    notes.profitGrowth = "Earnings growth data unavailable.";
  }

  // ── Valuation ─────────────────────────────────────────────────────────────
  const pe = metrics.peRatio;
  const pb = metrics.pbRatio;
  let valuationVerdict = "Fair";

  if (pe != null) {
    if (pe < 15) { score += 5; valuationVerdict = "Undervalued"; }
    else if (pe > 40) { score -= 4; valuationVerdict = "Expensive"; risks.push(`High PE ratio of ${pe.toFixed(1)}x — stock may be overvalued`); }
    else { valuationVerdict = "Fair"; }
  }
  if (pb != null && pb > 5) { score -= 2; }

  // ── Shareholding ──────────────────────────────────────────────────────────
  const ph = metrics.promoterHolding;
  if (ph != null) {
    if (ph >= 50) { score += 4; strengths.push(`High promoter holding of ${ph.toFixed(1)}% shows management confidence`); }
    else if (ph < 30) { risks.push(`Low promoter holding of ${ph.toFixed(1)}% may signal weak insider confidence`); }
  }

  // ── FCF ───────────────────────────────────────────────────────────────────
  const fcf = metrics.freeCashflow;
  if (fcf != null) {
    if (fcf > 0) { score += 4; strengths.push("Positive free cash flow — company generates real cash"); }
    else { score -= 3; risks.push("Negative free cash flow — company is burning cash"); }
  }

  // ── Ensure minimum items in strengths/risks ───────────────────────────────
  if (strengths.length === 0) strengths.push("Fundamental data is limited — analysis based on available metrics only");
  if (risks.length === 0) risks.push("Insufficient data to fully assess risks");
  risks.push("Sector PE and ROE benchmarks unavailable — sector comparison not possible");

  // ── Clamp score ───────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── Signal ────────────────────────────────────────────────────────────────
  let signal = "HOLD";
  if (score >= 65 && (rg == null || rg >= 0) && (de == null || de < 100)) signal = "BUY";
  else if (score <= 35) signal = "SELL";

  const confidence = Math.max(30, Math.min(70, score)); // cap at 70 for rule-based

  const scoreLabel = score >= 81 ? "Excellent" : score >= 61 ? "Strong" : score >= 41 ? "Average" : "Weak";

  return {
    financialStrength: {
      profitability: notes.profitability || "Profitability data unavailable.",
      debt: notes.debt || "Debt data unavailable.",
      financialHealth: cr != null
        ? `Current ratio ${cr.toFixed(2)}${fcf != null ? `, FCF ${fcf > 0 ? "positive" : "negative"}` : ""}. ${score >= 55 ? "Balance sheet appears reasonably healthy." : "Financial health needs monitoring."}`
        : "Financial health data unavailable.",
    },
    growthAnalysis: {
      revenueGrowth: notes.revenueGrowth || "Revenue growth data unavailable.",
      profitGrowth: notes.profitGrowth || "Profit growth data unavailable.",
      quarterlyConsistency: metrics.quarterlyResults?.length
        ? `${metrics.quarterlyResults.length} quarters of data available. Trend analysis based on reported figures.`
        : "Quarterly data unavailable.",
    },
    valuationAnalysis: {
      verdict: valuationVerdict,
      details: pe != null
        ? `PE ratio is ${pe.toFixed(1)}x${pb != null ? `, PB ratio is ${pb.toFixed(2)}x` : ""}. ${valuationVerdict === "Undervalued" ? "Stock appears attractively valued." : valuationVerdict === "Expensive" ? "Premium valuation requires strong growth to justify." : "Valuation appears reasonable."}`
        : "Valuation data unavailable — PE ratio not reported.",
      sectorComparison: "Sector PE and ROE benchmarks unavailable — sector comparison not possible.",
    },
    riskAnalysis: risks.slice(0, 4),
    strengths: strengths.slice(0, 4),
    fundamentalScore: score,
    signal,
    confidence,
    reason: `Rule-based score of ${score}/100 (${scoreLabel}). Signal is ${signal} based on: ROE ${roe != null ? roe.toFixed(1)+"%" : "N/A"}, PE ${pe != null ? pe.toFixed(1)+"x" : "N/A"}, D/E ${de != null ? de.toFixed(1) : "N/A"}, Revenue growth ${rg != null ? rg.toFixed(1)+"%" : "N/A"}. Gemini AI was unavailable; this analysis uses rule-based scoring only.`,
    oneLineSummary: `${metrics.companyName || metrics.symbol} scores ${score}/100 — ${signal} signal based on available fundamentals.`,
    source: "rule_based_fallback",
  };
}

/**
 * Fundamental Analysis — tries Gemini AI first, falls back to rule-based scoring.
 * @param {Object} metrics - Raw fundamental metrics from fundamentalService
 * @returns {Object} Parsed fundamental analysis result
 */
async function analyzeFundamentals(metrics) {
  // ── Try Gemini first ───────────────────────────────────────────────────────
  try {
    const na = (val) => (val != null ? String(val) : "Data unavailable");
    const pct = (val) => (val != null ? `${val}%` : "Data unavailable");
    const cr = (val) => (val != null ? `₹${Number(val).toLocaleString("en-IN")}` : "Data unavailable");

    const qStr = metrics.quarterlyResults?.length
      ? metrics.quarterlyResults
          .map((q) => `Period: ${q.period} | Revenue: ${cr(q.revenue)} | Net Income: ${cr(q.netIncome)} | EPS: ${na(q.eps)}`)
          .join("\n")
      : "Quarterly data unavailable";

    const prompt = `You are an expert Indian stock market fundamental analyst specialized in NSE-listed companies.
Analyze the stock ONLY using the provided data. Never invent missing values.

Rules:
- Use only supplied metrics
- Do not hallucinate
- Be objective and explain reasoning
- Mention risks clearly
- Avoid guaranteed returns
- Focus on long-term fundamentals

Input:
Symbol: ${na(metrics.symbol)}
Company: ${na(metrics.companyName)}
Sector: ${na(metrics.sector)} | Industry: ${na(metrics.industry)}

Fundamental Metrics:
ROE: ${pct(metrics.roe)}
ROCE: ${na(metrics.roce)}
PE Ratio: ${na(metrics.peRatio)}
PB Ratio: ${na(metrics.pbRatio)}
EV/EBITDA: ${na(metrics.evToEbitda)}
Debt to Equity: ${na(metrics.debtToEquity)}
EPS: ${na(metrics.eps)}
Revenue Growth YoY: ${pct(metrics.revenueGrowth)}
Profit/Earnings Growth YoY: ${pct(metrics.earningsGrowth)}
Current Ratio: ${na(metrics.currentRatio)}
Quick Ratio: ${na(metrics.quickRatio)}
Dividend Yield: ${pct(metrics.dividendYield)}
Profit Margins: ${pct(metrics.profitMargins)}
Gross Margins: ${pct(metrics.grossMargins)}
Operating Margins: ${pct(metrics.operatingMargins)}
Free Cash Flow: ${cr(metrics.freeCashflow)}
Promoter Holding: ${pct(metrics.promoterHolding)}
Institutional Holding: ${pct(metrics.institutionalHolding)}
FII Holding (approx): ${pct(metrics.fiiChange)}
Market Cap: ${cr(metrics.marketCap)}

Sector Metrics:
Sector PE: ${na(metrics.sectorPE)}
Sector ROE: ${na(metrics.sectorROE)}

Quarterly Data:
${qStr}

Generate the output in this EXACT JSON format (never add keys outside this schema):
{
  "financialStrength": {
    "profitability": "string",
    "debt": "string",
    "financialHealth": "string"
  },
  "growthAnalysis": {
    "revenueGrowth": "string",
    "profitGrowth": "string",
    "quarterlyConsistency": "string"
  },
  "valuationAnalysis": {
    "verdict": "Expensive" | "Fair" | "Undervalued",
    "details": "string",
    "sectorComparison": "string"
  },
  "riskAnalysis": ["risk1", "risk2", "risk3"],
  "strengths": ["strength1", "strength2", "strength3"],
  "fundamentalScore": <integer 0-100>,
  "signal": "BUY" | "HOLD" | "SELL",
  "confidence": <integer 0-100>,
  "reason": "string — explain why this signal was generated using provided metrics only",
  "oneLineSummary": "string — max 25 words"
}`;

    const text = await tryGeminiModels(async (modelName) => {
      const model = getGenerativeModel(modelName);
      const result = await withTimeout(model.generateContent(prompt), 60000);
      return result.response.text();
    }, { maxRetries: 1, retryDelayMs: 2000 });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Fundamental analysis response was not valid JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    parsed.source = "gemini_ai";
    return parsed;

  } catch (err) {
    // ── Gemini unavailable — use rule-based fallback ───────────────────────
    const isQuotaError = err.isRateLimit || isRateLimited(err);
    console.warn(`Fundamental Gemini ${isQuotaError ? "rate-limited" : "failed"} — using rule-based fallback: ${err.message}`);
    return analyzeFundamentalsLocally(metrics);
  }
}

/**
 * Generate a friendly, jargon-free summary for beginners explaining why a stock is recommended.
 */
async function generateRecommendationReason(symbol, companyName, goal, risk, metrics) {
  const goalText = goal === "safety" ? "safety and wealth preservation" : goal === "growth" ? "strong capital growth" : "regular dividend income";
  const prompt = `You are StockVerse AI, a friendly guide for absolute beginner stock traders.
Explain in exactly one simple, jargon-free sentence why ${companyName} (${symbol}) is a good buy for a beginner whose goal is "${goalText}" and who wants "${risk} risk".
Use the company's real products, sector, or business model for context if possible. 
CRITICAL: Do NOT use technical jargon (e.g. PE ratio, beta, debt-to-equity, profit margins, CAGR, support/resistance).
Instead, use beginner phrases like "steady earnings", "high demand for their services", "very little debt", or "solid payouts to shareholders".

Here are the company's metrics:
- Market Cap: ${metrics.marketCap ? "Rs." + (metrics.marketCap / 1e7).toFixed(1) + " Cr" : "Stable"}
- Dividend Yield: ${metrics.dividendYield ? metrics.dividendYield.toFixed(2) + "%" : "N/A"}
- Revenue Growth YoY: ${metrics.revenueGrowth ? metrics.revenueGrowth.toFixed(2) + "%" : "N/A"}
- Debt to Equity: ${metrics.debtToEquity != null ? metrics.debtToEquity.toFixed(2) : "Low"}

Beginner friendly explanation:`;

  try {
    return await tryGeminiModels(async (modelName) => {
      const model = getGenerativeModel(modelName);
      const result = await withTimeout(model.generateContent(prompt), 15000);
      return result.response.text().trim().replace(/^"|"$/g, ""); // strip quotes
    });
  } catch (err) {
    console.warn("Gemini recommendation reason failed, using fallback description", err);
    if (goal === "safety") {
      return `${companyName} is a large, established company with stable operations and strong financial reserves, making it ideal for protecting your savings.`;
    } else if (goal === "growth") {
      return `${companyName} is showing strong sales growth and momentum, making it a great candidate for increasing your capital over time.`;
    } else {
      return `${companyName} has a solid track record of sharing profits with investors through dividends, providing you with a regular source of extra income.`;
    }
  }
}

/**
 * Generate a friendly, side-by-side plain-English stock comparison for beginners.
 */
async function generateComparisonReport(s1, s2) {
  const na = (val) => (val != null ? String(val) : "Stable / Average");
  const pct = (val) => (val != null ? `${val}%` : "N/A");

  const prompt = `You are StockVerse AI, a friendly guide for absolute beginner stock traders.
Compare these two companies side-by-side ONLY using the provided metrics.
Do NOT use jargon like P/E ratio, beta, debt-to-equity, capital expenditures, or CAGR.
Instead, use everyday phrases like "stable cash flow", "low debt load", "growth momentum", or "profit payouts".

Company 1:
- Symbol: ${s1.symbol}
- Name: ${s1.companyName}
- Sector/Industry: ${s1.sector} · ${s1.industry}
- Market Cap: Rs. ${s1.metrics.marketCap ? (s1.metrics.marketCap / 1e7).toFixed(1) + " Cr" : "N/A"}
- Dividend Yield: ${pct(s1.metrics.dividendYield)}
- Revenue Growth: ${pct(s1.metrics.revenueGrowth)}
- Debt to Equity: ${na(s1.metrics.debtToEquity)}

Company 2:
- Symbol: ${s2.symbol}
- Name: ${s2.companyName}
- Sector/Industry: ${s2.sector} · ${s2.industry}
- Market Cap: Rs. ${s2.metrics.marketCap ? (s2.metrics.marketCap / 1e7).toFixed(1) + " Cr" : "N/A"}
- Dividend Yield: ${pct(s2.metrics.dividendYield)}
- Revenue Growth: ${pct(s2.metrics.revenueGrowth)}
- Debt to Equity: ${na(s2.metrics.debtToEquity)}

Respond in this exact JSON format:
{
  "safetyComparison": "One simple sentence comparing which company is safer/has less debt risk.",
  "growthComparison": "One simple sentence comparing which company is expanding and growing its sales faster.",
  "dividendComparison": "One simple sentence comparing which company shares more cash payouts with investors.",
  "verdict": "One short summary sentence (max 25 words) showing who wins for safety vs who wins for growth."
}`;

  try {
    const text = await tryGeminiModels(async (modelName) => {
      const model = getGenerativeModel(modelName);
      const result = await withTimeout(model.generateContent(prompt), 20000);
      return result.response.text();
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Comparison response was not valid JSON");
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn("Comparison prompt failed, returning local fallbacks", err);
    // Simple math/rule based fallback
    const y1 = s1.metrics.dividendYield || 0;
    const y2 = s2.metrics.dividendYield || 0;
    const g1 = s1.metrics.revenueGrowth || 0;
    const g2 = s2.metrics.revenueGrowth || 0;
    const d1 = s1.metrics.debtToEquity || 0.5;
    const d2 = s2.metrics.debtToEquity || 0.5;

    return {
      safetyComparison: d1 < d2
        ? `${s1.companyName} has a lower debt load than ${s2.companyName}, indicating a more secure financial foundation.`
        : `${s2.companyName} runs with less debt than ${s1.companyName}, making its balance sheet safer.`,
      growthComparison: g1 > g2
        ? `${s1.companyName} is expanding faster with sales growth of ${g1.toFixed(1)}% compared to ${s2.companyName}'s ${g2.toFixed(1)}%.`
        : `${s2.companyName} is growing faster with sales growth of ${g2.toFixed(1)}% compared to ${s1.companyName}'s ${g1.toFixed(1)}%.`,
      dividendComparison: y1 > y2
        ? `${s1.companyName} offers a superior dividend yield of ${y1.toFixed(1)}%, putting more regular cash in your pocket than ${s2.companyName} (${y2.toFixed(1)}%).`
        : `${s2.companyName} offers a superior dividend yield of ${y2.toFixed(1)}%, putting more regular cash in your pocket than ${s1.companyName} (${y1.toFixed(1)}%).`,
      verdict: g1 > g2
        ? `Buy ${s1.companyName} for growth and sales expansion, or choose ${s2.companyName} for safety.`
        : `Buy ${s2.companyName} for growth, and choose ${s1.companyName} for stable safety.`
    };
  }
}

module.exports = {
  chat,
  analyzeNewsSentiment,
  analyzeStockNewsSentiment,
  generateStockInsight,
  analyzeFundamentals,
  analyzeFundamentalsLocally,
  generateRecommendationReason,
  generateComparisonReport,
};
