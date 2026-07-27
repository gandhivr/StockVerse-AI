import type { Prediction } from "@/lib/api";

export function explainPrediction(prediction: Prediction) {
  const indicators = prediction.technicalIndicators;
  const reasons: string[] = [];

  if (indicators.rsi < 30) reasons.push("RSI is oversold, which can support a bounce.");
  else if (indicators.rsi > 70) reasons.push("RSI is overbought, so upside may be stretched.");
  else reasons.push("RSI is in a neutral trading range.");

  if (indicators.sma20 > indicators.sma50) {
    reasons.push("SMA20 is above SMA50, showing positive short-term momentum.");
  } else {
    reasons.push("SMA20 is below SMA50, showing weaker short-term momentum.");
  }

  if (indicators.macd > 0) reasons.push("MACD is positive, adding bullish confirmation.");
  else reasons.push("MACD is negative, adding bearish pressure.");

  if ((indicators.volumeRatio || 0) > 1.4) {
    reasons.push("Volume is above average, so the move has stronger participation.");
  }

  if (prediction.riskScore >= 7) reasons.push("Risk score is elevated; position sizing should be conservative.");
  else if (prediction.riskScore <= 3) reasons.push("Risk score is relatively low for this setup.");

  return reasons.slice(0, 4);
}
