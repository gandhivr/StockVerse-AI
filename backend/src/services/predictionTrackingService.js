const fs = require("fs");
const path = require("path");
const PredictionRecord = require("../models/PredictionRecord");
const { getHistoricalData } = require("./stockService");
const { NSE_SYMBOLS } = require("../data/nseSymbols");

const MODEL_DIR = path.resolve(__dirname, "../../python-ml-service/models/multi_horizon");
const TRAINING_LOG = path.resolve(__dirname, "../../python-ml-service/logs/train-all-stocks.log");

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function latestCloseOnOrAfter(history, targetDate) {
  const target = targetDate.toISOString().slice(0, 10);
  return history.find((item) => String(item.date).slice(0, 10) >= target);
}

async function savePredictionSnapshot(forecast) {
  try {
    const generatedAt = new Date(forecast.generatedAt || Date.now());
    await PredictionRecord.create({
      symbol: forecast.symbol,
      currentPrice: forecast.currentPrice,
      verdict: forecast.verdict,
      trend: forecast.trend,
      source: forecast.source,
      modelVersion: forecast.modelVersion,
      modelMetadata: forecast.modelMetadata,
      riskScore: forecast.risk?.riskScore,
      riskLevel: forecast.risk?.riskLevel,
      generatedAt,
      horizons: forecast.horizons.map((item) => ({
        days: item.days,
        label: item.label,
        predictedPrice: item.predictedPrice,
        changePercent: item.changePercent,
        direction: item.direction,
        signal: item.signal,
        confidence: item.confidence,
        source: item.source,
        targetDate: addDays(generatedAt, item.days),
      })),
    });
  } catch (error) {
    // Tracking should never break user-facing predictions.
  }
}

async function reconcileDuePredictions(limit = 250) {
  const now = new Date();
  const records = await PredictionRecord.find({
    horizons: {
      $elemMatch: {
        targetDate: { $lte: now },
        resolvedAt: { $exists: false },
      },
    },
  })
    .sort({ generatedAt: 1 })
    .limit(limit);

  let resolved = 0;
  for (const record of records) {
    let changed = false;
    let history;
    try {
      history = (await getHistoricalData(record.symbol, "1y")).history || [];
    } catch (error) {
      continue;
    }

    for (const horizon of record.horizons) {
      if (horizon.resolvedAt || !horizon.targetDate || horizon.targetDate > now) continue;
      const actual = latestCloseOnOrAfter(history, horizon.targetDate);
      if (!actual?.close) continue;

      const actualChangePercent =
        ((actual.close - record.currentPrice) / record.currentPrice) * 100;
      const actualDirection =
        actualChangePercent > 0.35 ? "UP" : actualChangePercent < -0.35 ? "DOWN" : "FLAT";

      horizon.actualPrice = Number(actual.close.toFixed(2));
      horizon.actualChangePercent = Number(actualChangePercent.toFixed(2));
      horizon.absoluteError = Number(Math.abs(horizon.predictedPrice - actual.close).toFixed(2));
      horizon.absolutePercentError = Number(
        Math.abs(((horizon.predictedPrice - actual.close) / actual.close) * 100).toFixed(2),
      );
      horizon.directionCorrect = horizon.direction === actualDirection;
      horizon.resolvedAt = now;
      resolved += 1;
      changed = true;
    }

    if (changed) await record.save();
  }

  return { checkedRecords: records.length, resolved };
}

async function getAccuracySummary() {
  const records = await PredictionRecord.find({ "horizons.resolvedAt": { $exists: true } })
    .sort({ generatedAt: -1 })
    .limit(2000)
    .lean();

  const buckets = new Map();
  for (const record of records) {
    for (const horizon of record.horizons || []) {
      if (!horizon.resolvedAt) continue;
      const key = String(horizon.days);
      const current = buckets.get(key) || {
        days: horizon.days,
        label: horizon.label,
        count: 0,
        mae: 0,
        mape: 0,
        directionCorrect: 0,
      };
      current.count += 1;
      current.mae += horizon.absoluteError || 0;
      current.mape += horizon.absolutePercentError || 0;
      current.directionCorrect += horizon.directionCorrect ? 1 : 0;
      buckets.set(key, current);
    }
  }

  const horizons = [...buckets.values()]
    .map((item) => ({
      ...item,
      mae: Number((item.mae / item.count).toFixed(2)),
      mape: Number((item.mape / item.count).toFixed(2)),
      directionAccuracy: Number(((item.directionCorrect / item.count) * 100).toFixed(1)),
    }))
    .sort((a, b) => a.days - b.days);

  return {
    trackedPredictions: records.length,
    resolvedHorizons: horizons.reduce((sum, item) => sum + item.count, 0),
    horizons,
    recent: records.slice(0, 30),
  };
}

function getModelCoverage() {
  const symbols = Object.keys(NSE_SYMBOLS);
  const trained = fs.existsSync(MODEL_DIR)
    ? fs
        .readdirSync(MODEL_DIR)
        .filter((name) => name.endsWith("_multi_horizon.joblib"))
        .map((name) => name.replace("_multi_horizon.joblib", ""))
    : [];
  const trainedSet = new Set(trained);
  const missing = symbols.filter((symbol) => !trainedSet.has(symbol));

  return {
    totalSymbols: symbols.length,
    trainedCount: trained.length,
    fallbackCount: missing.length,
    trained,
    fallback: missing,
  };
}

function getTrainingSummary() {
  if (!fs.existsSync(TRAINING_LOG)) return null;
  const text = fs.readFileSync(TRAINING_LOG, "utf8");
  const marker = "Training Summary";
  const start = text.lastIndexOf(marker);
  const slice = start >= 0 ? text.slice(start) : text;
  const jsonStart = slice.indexOf("{");
  const jsonEnd = slice.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0) return null;
  try {
    return JSON.parse(slice.slice(jsonStart, jsonEnd + 1));
  } catch (error) {
    return null;
  }
}

module.exports = {
  savePredictionSnapshot,
  reconcileDuePredictions,
  getAccuracySummary,
  getModelCoverage,
  getTrainingSummary,
};
