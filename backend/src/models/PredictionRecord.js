const mongoose = require("mongoose");

const horizonPredictionSchema = new mongoose.Schema(
  {
    days: Number,
    label: String,
    predictedPrice: Number,
    changePercent: Number,
    direction: { type: String, enum: ["UP", "DOWN", "FLAT"] },
    signal: { type: String, enum: ["BUY", "SELL", "HOLD"] },
    confidence: Number,
    source: String,
    targetDate: Date,
    actualPrice: Number,
    actualChangePercent: Number,
    absoluteError: Number,
    absolutePercentError: Number,
    directionCorrect: Boolean,
    resolvedAt: Date,
  },
  { _id: false },
);

const predictionRecordSchema = new mongoose.Schema({
  symbol: { type: String, required: true, uppercase: true, index: true },
  currentPrice: Number,
  verdict: String,
  trend: String,
  source: String,
  modelVersion: String,
  modelMetadata: mongoose.Schema.Types.Mixed,
  riskScore: Number,
  riskLevel: String,
  horizons: [horizonPredictionSchema],
  generatedAt: { type: Date, default: Date.now, index: true },
});

predictionRecordSchema.index({ symbol: 1, generatedAt: -1 });
predictionRecordSchema.index({ "horizons.targetDate": 1, "horizons.resolvedAt": 1 });

module.exports = mongoose.model("PredictionRecord", predictionRecordSchema);
