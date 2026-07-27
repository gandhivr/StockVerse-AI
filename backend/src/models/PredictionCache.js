const mongoose = require("mongoose");

const predictionCacheSchema = new mongoose.Schema({
  symbol: { type: String, required: true, uppercase: true },
  prediction: {
    predictedPrice: Number,
    signal: { type: String, enum: ["BUY", "SELL", "HOLD"] },
    confidence: Number,
    riskScore: Number,
    trend: { type: String, enum: ["BULLISH", "BEARISH", "NEUTRAL"] },
    currentPrice: Number,
    priceChange: Number,
    priceChangePercent: Number,
    // Store full technical indicators so they survive caching
    technicalIndicators: {
      rsi: Number,
      macd: Number,
      sma20: Number,
      sma50: Number,
      volumeRatio: Number,
      bbUpper: Number,
      bbLower: Number,
    },
    signals: [String],
    source: String,
  },
  generatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 60 * 60 * 1000) },
});

predictionCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
predictionCacheSchema.index({ symbol: 1 }, { unique: true });

module.exports = mongoose.model("PredictionCache", predictionCacheSchema);
