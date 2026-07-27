/**
 * Prediction Service
 * Calls the Python ML microservice for LSTM predictions
 * Falls back to technical analysis if ML service is unavailable
 */

const axios = require("axios");
const { getHistoricalData, getPrimarySymbol } = require("./stockService");
const PredictionCache = require("../models/PredictionCache");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * Calculate RSI (Relative Strength Index)
 */
function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / period).toFixed(2));
}

/**
 * Calculate MACD
 */
function calculateMACD(closes) {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12 - ema26;
  return parseFloat(macdLine.toFixed(2));
}

function calculateEMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * Technical analysis-based prediction (fallback when ML service is down)
 */
function technicalAnalysisPrediction(symbol, history) {
  const closes = history.map((d) => d.close);
  const volumes = history.map((d) => d.volume);
  const currentPrice = closes[closes.length - 1];

  const rsi = calculateRSI(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const macd = calculateMACD(closes);
  const avgVolume = calculateSMA(volumes, 20);
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / avgVolume;

  // Scoring system: +1 bullish, -1 bearish
  let score = 0;
  const signals = [];

  // RSI signals
  if (rsi < 30) { score += 2; signals.push("RSI oversold (bullish)"); }
  else if (rsi > 70) { score -= 2; signals.push("RSI overbought (bearish)"); }
  else if (rsi > 50) { score += 0.5; }

  // Moving average crossover
  if (sma20 > sma50) { score += 1; signals.push("Golden cross (bullish)"); }
  else { score -= 1; signals.push("Death cross (bearish)"); }

  // Price vs SMA
  if (currentPrice > sma20) { score += 0.5; signals.push("Price above SMA20"); }
  else { score -= 0.5; }

  // MACD
  if (macd > 0) { score += 1; signals.push("MACD positive (bullish)"); }
  else { score -= 1; signals.push("MACD negative (bearish)"); }

  // Volume confirmation
  if (volumeRatio > 1.5) { score += 0.5; signals.push("High volume confirmation"); }

  // Determine signal
  let signal, trend;
  if (score >= 2) { signal = "BUY"; trend = "BULLISH"; }
  else if (score <= -2) { signal = "SELL"; trend = "BEARISH"; }
  else { signal = "HOLD"; trend = "NEUTRAL"; }

  // Predict next day price using momentum
  const recentChange = (closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6];
  const predictedChange = recentChange * 0.3 + (score * 0.002); // dampened momentum
  const predictedPrice = parseFloat((currentPrice * (1 + predictedChange)).toFixed(2));

  // Confidence based on signal strength
  const confidence = Math.min(95, Math.max(45, Math.abs(score) * 15 + 40));

  // Risk score (0-10, higher = riskier)
  const volatility = calculateVolatility(closes);
  const riskScore = parseFloat(Math.min(10, volatility * 100 + (rsi > 70 || rsi < 30 ? 2 : 0)).toFixed(1));

  return {
    symbol,
    predictedPrice,
    signal,
    confidence: parseFloat(confidence.toFixed(1)),
    riskScore,
    trend,
    currentPrice,
    priceChange: parseFloat((predictedPrice - currentPrice).toFixed(2)),
    priceChangePercent: parseFloat(((predictedPrice - currentPrice) / currentPrice * 100).toFixed(2)),
    technicalIndicators: { rsi, sma20, sma50, macd, volumeRatio: parseFloat(volumeRatio.toFixed(2)) },
    signals,
    source: "technical_analysis",
    generatedAt: new Date().toISOString(),
  };
}

function calculateVolatility(closes) {
  if (closes.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

/**
 * Main prediction function — tries ML service first, falls back to TA
 */
async function getPrediction(symbol) {
  // Check cache first
  try {
    const cached = await PredictionCache.findOne({ symbol: symbol.toUpperCase() });
    if (cached && cached.expiresAt > new Date()) {
      return { ...cached.prediction, symbol, cached: true };
    }
  } catch (e) {
    // DB not available, skip cache
  }

  // Get historical data
  const { history } = await getHistoricalData(symbol, "3mo");

  let prediction;
  const primarySymbol = getPrimarySymbol(symbol);

  // Try ML microservice first
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
      symbol: primarySymbol,
      history: history.slice(-60), // last 60 days
    }, { timeout: 15000 });

    prediction = { ...response.data, symbol, source: "lstm_model" };
  } catch (mlError) {
    console.warn(`⚠️  ML service unavailable: ${mlError.message}. Using technical analysis.`);
    prediction = technicalAnalysisPrediction(symbol, history);
  }

  // Cache the result
  try {
    await PredictionCache.findOneAndUpdate(
      { symbol: symbol.toUpperCase() },
      {
        symbol: symbol.toUpperCase(),
        prediction,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      { upsert: true, new: true }
    );
  } catch (e) {
    // DB not available, skip caching
  }

  return prediction;
}

/**
 * Full future forecast — multi-day predictions + Gemini narrative
 */
async function getFutureForecast(symbol) {
  const { history } = await getHistoricalData(symbol, "6mo");

  if (!history || history.length < 30) {
    throw new Error("Insufficient historical data for forecast");
  }

  const closes = history.map(d => d.close);
  const volumes = history.map(d => d.volume);
  const currentPrice = closes[closes.length - 1];

  // Technical indicators
  const rsi = calculateRSI(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const macd = calculateMACD(closes);
  const volatility = calculateVolatility(closes);
  const avgVolume = calculateSMA(volumes, 20);
  const volumeRatio = volumes[volumes.length - 1] / avgVolume;

  // Score for direction
  let score = 0;
  if (rsi < 30) score += 2;
  else if (rsi > 70) score -= 2;
  if (sma20 > sma50) score += 1; else score -= 1;
  if (currentPrice > sma20) score += 0.5; else score -= 0.5;
  if (macd > 0) score += 1; else score -= 1;
  if (volumeRatio > 1.5) score += 0.5;

  const signal = score >= 2 ? "BUY" : score <= -2 ? "SELL" : "HOLD";
  const trend = score >= 2 ? "BULLISH" : score <= -2 ? "BEARISH" : "NEUTRAL";

  // Multi-timeframe forecast
  const forecast = generateForecast(closes, signal, score, volatility);

  // 30-day chart series
  const forecastSeries = buildForecastSeries(closes, score, volatility);

  // Gemini narrative forecast
  let narrative = null;
  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    if (process.env.GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      const f7 = forecast.find(f => f.days === 7);
      const f30 = forecast.find(f => f.days === 30);
      const f90 = forecast.find(f => f.days === 90);

      const prompt = `You are an expert Indian stock market analyst. Provide a detailed future outlook for ${symbol} stock.

Current Data:
- Price: ₹${currentPrice.toFixed(2)}
- RSI: ${rsi} (${rsi > 70 ? "Overbought" : rsi < 30 ? "Oversold" : "Neutral"})
- MACD: ${macd} (${macd > 0 ? "Bullish" : "Bearish"})
- SMA20: ₹${sma20} | SMA50: ₹${sma50} (${sma20 > sma50 ? "Golden Cross" : "Death Cross"})
- Volume Ratio: ${volumeRatio.toFixed(2)}x average
- AI Signal: ${signal} | Trend: ${trend}
- Volatility: ${(volatility * 100).toFixed(2)}% daily

AI Price Targets:
- 1 Week: ₹${f7?.predictedPrice} (${f7?.changePercent}%)
- 1 Month: ₹${f30?.predictedPrice} (${f30?.changePercent}%)
- 3 Months: ₹${f90?.predictedPrice} (${f90?.changePercent}%)

Provide a structured forecast with:
1. **Short-term outlook (1-2 weeks)**: What to expect
2. **Medium-term outlook (1 month)**: Key levels and catalysts
3. **Long-term outlook (3 months)**: Trend direction and targets
4. **Key risks**: What could invalidate this forecast
5. **Investment verdict**: Should investors buy, hold, or sell now?

Be specific with price levels. Use ₹ for prices. Keep it under 300 words.`;

      const modelNames = [
        process.env.GEMINI_MODEL,
        "gemini-2.0-flash",
        "gemini-2.5-flash",
      ].filter(Boolean);
      let lastError = null;
      for (const modelName of modelNames) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          narrative = result.response.text();
          break;
        } catch (error) {
          lastError = error;
          if (!String(error?.message || "").includes("not found")) throw error;
        }
      }
      if (!narrative && lastError) throw lastError;
    }
  } catch (e) {
    console.warn("Gemini forecast narrative failed:", e.message);
  }

  return {
    symbol,
    currentPrice,
    signal,
    trend,
    technicalIndicators: { rsi, sma20, sma50, macd, volumeRatio: parseFloat(volumeRatio.toFixed(2)), volatility: parseFloat((volatility * 100).toFixed(2)) },
    forecast,
    forecastSeries,
    narrative,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate multi-day price forecast using momentum + volatility simulation
 * Returns predicted prices for 7, 30, and 90 days
 */
function generateForecast(closes, signal, score, volatility) {
  const currentPrice = closes[closes.length - 1];
  const dailyDrift = score * 0.0008; // directional bias from TA score
  const dailyVol = volatility || 0.012;

  const forecast = [];
  let price = currentPrice;

  for (let day = 1; day <= 90; day++) {
    // Dampened random walk with trend bias
    const randomShock = (Math.random() - 0.5) * dailyVol * 2;
    const trendDecay = Math.exp(-day / 60); // trend fades over time
    price = price * (1 + dailyDrift * trendDecay + randomShock * 0.3);
    price = parseFloat(price.toFixed(2));

    if ([7, 14, 30, 60, 90].includes(day)) {
      const change = parseFloat(((price - currentPrice) / currentPrice * 100).toFixed(2));
      forecast.push({
        days: day,
        label: day === 7 ? "1 Week" : day === 14 ? "2 Weeks" : day === 30 ? "1 Month" : day === 60 ? "2 Months" : "3 Months",
        predictedPrice: price,
        changePercent: change,
        direction: change >= 0 ? "UP" : "DOWN",
      });
    }
  }

  return forecast;
}

/**
 * Build a daily forecast series for charting (30 days)
 */
function buildForecastSeries(closes, score, volatility) {
  const currentPrice = closes[closes.length - 1];
  const dailyDrift = score * 0.0008;
  const dailyVol = volatility || 0.012;

  const series = [];
  let price = currentPrice;

  // Seed with last 10 actual prices for context
  const historySlice = closes.slice(-10);
  historySlice.forEach((p, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (10 - i));
    series.push({
      date: d.toISOString().slice(5, 10),
      actual: parseFloat(p.toFixed(2)),
      forecast: null,
      type: "history",
    });
  });

  // Add 30 forecast days
  for (let day = 1; day <= 30; day++) {
    const randomShock = (Math.random() - 0.5) * dailyVol * 2;
    const trendDecay = Math.exp(-day / 45);
    price = price * (1 + dailyDrift * trendDecay + randomShock * 0.25);
    price = parseFloat(price.toFixed(2));

    const d = new Date();
    d.setDate(d.getDate() + day);
    // Skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    series.push({
      date: d.toISOString().slice(5, 10),
      actual: null,
      forecast: price,
      type: "forecast",
    });
  }

  return series;
}

module.exports = {
  getPrediction,
  getFutureForecast,
  technicalAnalysisPrediction,
  calculateRSI,
  calculateSMA,
  calculateMACD,
};
