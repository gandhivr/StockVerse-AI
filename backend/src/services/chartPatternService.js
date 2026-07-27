const { getHistoricalData, DEFAULT_SYMBOLS } = require("./stockService");
const { calculateRSI, calculateSMA, calculateMACD } = require("./predictionService");

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits));
}

function calculateVolatility(closes) {
  if (closes.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

function pivotLevels(history, lookback = 80) {
  const slice = history.slice(-lookback);
  const lows = slice.map((item) => item.low).filter(Number.isFinite).sort((a, b) => a - b);
  const highs = slice.map((item) => item.high).filter(Number.isFinite).sort((a, b) => a - b);
  if (!lows.length || !highs.length) return { support: 0, resistance: 0 };

  const supportIndex = Math.max(0, Math.floor(lows.length * 0.18));
  const resistanceIndex = Math.min(highs.length - 1, Math.floor(highs.length * 0.82));
  return {
    support: round(lows[supportIndex]),
    resistance: round(highs[resistanceIndex]),
  };
}

function detectCandlestickPatterns(history) {
  const patterns = [];
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  if (!last || !prev) return patterns;

  const body = Math.abs(last.close - last.open);
  const range = Math.max(0.01, last.high - last.low);
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const bullish = last.close > last.open;
  const prevBearish = prev.close < prev.open;
  const prevBullish = prev.close > prev.open;

  if (body / range < 0.16) {
    patterns.push({
      name: "Doji",
      bias: "NEUTRAL",
      strength: 4,
      description: "Small real body shows indecision near the current price.",
    });
  }

  if (lowerWick > body * 2 && upperWick < body * 1.2 && bullish) {
    patterns.push({
      name: "Hammer",
      bias: "BULLISH",
      strength: 7,
      description: "Long lower wick suggests buyers defended lower prices.",
    });
  }

  if (upperWick > body * 2 && lowerWick < body * 1.2 && !bullish) {
    patterns.push({
      name: "Shooting Star",
      bias: "BEARISH",
      strength: 7,
      description: "Long upper wick suggests sellers rejected higher prices.",
    });
  }

  if (
    bullish &&
    prevBearish &&
    last.open <= prev.close &&
    last.close >= prev.open
  ) {
    patterns.push({
      name: "Bullish Engulfing",
      bias: "BULLISH",
      strength: 8,
      description: "Latest candle fully reversed the previous bearish body.",
    });
  }

  if (
    !bullish &&
    prevBullish &&
    last.open >= prev.close &&
    last.close <= prev.open
  ) {
    patterns.push({
      name: "Bearish Engulfing",
      bias: "BEARISH",
      strength: 8,
      description: "Latest candle fully reversed the previous bullish body.",
    });
  }

  return patterns.slice(0, 4);
}

function trendStructure(history) {
  const recent = history.slice(-28);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last) {
    return { direction: "SIDEWAYS", description: "Not enough bars to define trend structure." };
  }

  const mid = recent[Math.floor(recent.length / 2)];
  const higherHigh = last.high > mid.high && mid.high > first.high;
  const higherLow = last.low > mid.low && mid.low > first.low;
  const lowerHigh = last.high < mid.high && mid.high < first.high;
  const lowerLow = last.low < mid.low && mid.low < first.low;

  if (higherHigh && higherLow) {
    return { direction: "UPTREND", description: "Recent bars show higher highs and higher lows." };
  }
  if (lowerHigh && lowerLow) {
    return { direction: "DOWNTREND", description: "Recent bars show lower highs and lower lows." };
  }
  return { direction: "SIDEWAYS", description: "Trend structure is mixed or range-bound." };
}

function buildSetup({ currentPrice, support, resistance, atrLike, signal }) {
  const upside = resistance ? ((resistance - currentPrice) / currentPrice) * 100 : 0;
  const downside = support ? ((currentPrice - support) / currentPrice) * 100 : 0;
  const stopLoss =
    signal === "BUY"
      ? Math.max(0, Math.min(support || currentPrice * 0.96, currentPrice - atrLike * 1.2))
      : signal === "SELL"
        ? Math.max(resistance || currentPrice * 1.04, currentPrice + atrLike * 1.2)
        : support || currentPrice - atrLike;
  const target =
    signal === "BUY"
      ? Math.max(resistance || currentPrice * 1.03, currentPrice + atrLike * 1.8)
      : signal === "SELL"
        ? Math.min(support || currentPrice * 0.97, currentPrice - atrLike * 1.8)
        : resistance || currentPrice + atrLike;

  return {
    support,
    resistance,
    stopLoss: round(stopLoss),
    target: round(target),
    upsidePercent: round(upside),
    downsidePercent: round(downside),
    riskReward:
      Math.abs(currentPrice - stopLoss) > 0
        ? round(Math.abs(target - currentPrice) / Math.abs(currentPrice - stopLoss))
        : 0,
  };
}

function scoreSignal({ rsi, macd, sma20, sma50, sma200, volumeRatio, currentPrice, support, resistance, patterns, trend }) {
  let score = 0;
  const reasons = [];
  const warnings = [];

  if (rsi < 30) {
    score += 18;
    reasons.push("RSI is oversold, which can support a reversal.");
  } else if (rsi > 70) {
    score -= 18;
    warnings.push("RSI is overbought, so upside may be stretched.");
  } else if (rsi > 52) {
    score += 8;
    reasons.push("RSI is above neutral, showing buyer control.");
  } else if (rsi < 48) {
    score -= 8;
    warnings.push("RSI is below neutral, showing seller pressure.");
  }

  if (macd > 0) {
    score += 14;
    reasons.push("MACD is positive, confirming bullish momentum.");
  } else {
    score -= 14;
    warnings.push("MACD is negative, confirming weak momentum.");
  }

  if (sma20 > sma50) {
    score += 14;
    reasons.push("SMA20 is above SMA50, supporting short-term trend.");
  } else {
    score -= 14;
    warnings.push("SMA20 is below SMA50, showing a weaker short-term trend.");
  }

  if (sma50 > sma200) {
    score += 10;
    reasons.push("SMA50 is above SMA200, keeping the broader trend constructive.");
  } else if (sma200) {
    score -= 10;
    warnings.push("SMA50 is below SMA200, so long-term trend is still cautious.");
  }

  if (volumeRatio > 1.35) {
    score += 8;
    reasons.push("Volume is above average, confirming participation.");
  } else if (volumeRatio < 0.75) {
    score -= 5;
    warnings.push("Volume is below average, so the signal has weaker confirmation.");
  }

  if (resistance && currentPrice > resistance * 1.003) {
    score += 16;
    reasons.push("Price is breaking above recent resistance.");
  } else if (resistance) {
    const distanceToResistance = ((resistance - currentPrice) / currentPrice) * 100;
    if (distanceToResistance > 0 && distanceToResistance < 1.5) {
      warnings.push("Price is close to resistance; wait for breakout confirmation.");
    }
  }

  if (support && currentPrice < support * 0.997) {
    score -= 16;
    warnings.push("Price has broken below recent support.");
  } else if (support) {
    const distanceToSupport = ((currentPrice - support) / currentPrice) * 100;
    if (distanceToSupport > 0 && distanceToSupport < 1.5) {
      reasons.push("Price is close to support, improving risk control.");
    }
  }

  patterns.forEach((pattern) => {
    if (pattern.bias === "BULLISH") {
      score += pattern.strength;
      reasons.push(`${pattern.name}: ${pattern.description}`);
    } else if (pattern.bias === "BEARISH") {
      score -= pattern.strength;
      warnings.push(`${pattern.name}: ${pattern.description}`);
    }
  });

  if (trend.direction === "UPTREND") score += 8;
  if (trend.direction === "DOWNTREND") score -= 8;

  const signal = score >= 22 ? "BUY" : score <= -22 ? "SELL" : "HOLD";
  const confidence = Math.max(35, Math.min(86, 48 + Math.abs(score) * 0.75));
  return { score: round(score, 1), signal, confidence: round(confidence, 1), reasons, warnings };
}

async function analyzeChart(symbol, range = "1y") {
  const { history } = await getHistoricalData(symbol, range);
  if (!history || history.length < 35) {
    throw new Error("Not enough chart history for pattern analysis");
  }

  const closes = history.map((item) => Number(item.close)).filter(Number.isFinite);
  const volumes = history.map((item) => Number(item.volume)).filter(Number.isFinite);
  const current = history[history.length - 1];
  const currentPrice = Number(current.close);
  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const avgVolume = calculateSMA(volumes, 20) || 1;
  const volumeRatio = Number(current.volume || 0) / avgVolume;
  const volatility = calculateVolatility(closes);
  const atrLike = Math.max(currentPrice * volatility * 1.8, currentPrice * 0.008);
  const { support, resistance } = pivotLevels(history);
  const patterns = detectCandlestickPatterns(history);
  const trend = trendStructure(history);
  const scored = scoreSignal({
    rsi,
    macd,
    sma20,
    sma50,
    sma200,
    volumeRatio,
    currentPrice,
    support,
    resistance,
    patterns,
    trend,
  });
  const setup = buildSetup({
    currentPrice,
    support,
    resistance,
    atrLike,
    signal: scored.signal,
  });

  return {
    symbol: symbol.toUpperCase(),
    range,
    signal: scored.signal,
    confidence: scored.confidence,
    score: scored.score,
    currentPrice: round(currentPrice),
    trend,
    levels: setup,
    indicators: {
      rsi,
      macd,
      sma20,
      sma50,
      sma200,
      volumeRatio: round(volumeRatio),
      volatility: round(volatility * 100),
    },
    patterns,
    reasons: scored.reasons.slice(0, 6),
    warnings: scored.warnings.slice(0, 5),
    generatedAt: new Date().toISOString(),
    disclaimer: "Chart intelligence is educational research, not financial advice.",
  };
}

function buildTradePlan(analysis) {
  const price = analysis.currentPrice;
  const longSetup = analysis.signal !== "SELL";
  const risk = Math.abs(price - analysis.levels.stopLoss);
  const firstTarget = analysis.levels.target;
  const secondTarget = longSetup
    ? Math.max(firstTarget, price + risk * 2)
    : Math.min(firstTarget, price - risk * 2);
  const entryLow = longSetup ? Math.min(price, price * 0.995) : Math.min(price, price * 1.005);
  const entryHigh = longSetup ? Math.max(price, price * 1.005) : Math.max(price, price * 0.995);

  return {
    planType:
      analysis.signal === "BUY"
        ? "LONG_CONTINUATION"
        : analysis.signal === "SELL"
          ? "AVOID_OR_SHORT_BIAS"
          : "WAIT_FOR_CONFIRMATION",
    entryZone: { low: round(entryLow), high: round(entryHigh) },
    entryTrigger:
      analysis.signal === "BUY"
        ? `Break and hold above Rs.${round(analysis.levels.resistance)} with volume confirmation.`
        : analysis.signal === "SELL"
          ? `Avoid fresh longs unless price reclaims Rs.${round(analysis.levels.resistance)}.`
          : `Wait for a close above Rs.${round(analysis.levels.resistance)} or bounce from Rs.${round(analysis.levels.support)}.`,
    target1: round(firstTarget),
    target2: round(secondTarget),
    stopLoss: round(analysis.levels.stopLoss),
    invalidIf:
      analysis.signal === "SELL"
        ? `Bearish view weakens above Rs.${round(analysis.levels.resistance)}.`
        : `Setup fails below Rs.${round(analysis.levels.stopLoss)}.`,
    riskReward: analysis.levels.riskReward,
    notes: [
      analysis.confidence < 55 ? "Confidence is modest; reduce size or wait for confirmation." : "Signal agreement is acceptable for a planned setup.",
      analysis.levels.riskReward < 1.5 ? "Risk/reward is tight; avoid chasing entries." : "Risk/reward is workable if entry is controlled.",
    ],
  };
}

function calculatePositionSizing({ capital, riskPercent, entry, stopLoss }) {
  const accountCapital = Math.max(0, Number(capital) || 100000);
  const riskPct = Math.min(5, Math.max(0.1, Number(riskPercent) || 1));
  const riskAmount = accountCapital * (riskPct / 100);
  const riskPerShare = Math.abs(Number(entry) - Number(stopLoss));
  const quantity = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
  const deployedCapital = quantity * Number(entry);

  return {
    capital: round(accountCapital, 0),
    riskPercent: round(riskPct, 2),
    maxLoss: round(riskAmount),
    riskPerShare: round(riskPerShare),
    quantity,
    deployedCapital: round(deployedCapital),
    capitalUsagePercent: accountCapital ? round((deployedCapital / accountCapital) * 100) : 0,
  };
}

async function analyzeMultiTimeframe(symbol) {
  const ranges = ["1mo", "3mo", "6mo", "1y"];
  const settled = await Promise.allSettled(ranges.map((range) => analyzeChart(symbol, range)));
  const timeframes = settled.map((result, index) => {
    if (result.status !== "fulfilled") {
      return {
        range: ranges[index],
        signal: "HOLD",
        confidence: 0,
        trend: "SIDEWAYS",
        score: 0,
        available: false,
      };
    }
    const data = result.value;
    return {
      range: ranges[index],
      signal: data.signal,
      confidence: data.confidence,
      trend: data.trend.direction,
      score: data.score,
      available: true,
    };
  });
  const available = timeframes.filter((item) => item.available);
  const buyVotes = available.filter((item) => item.signal === "BUY").length;
  const sellVotes = available.filter((item) => item.signal === "SELL").length;
  const dominantSignal = buyVotes > sellVotes ? "BUY" : sellVotes > buyVotes ? "SELL" : "HOLD";
  const agreement = available.length
    ? (available.filter((item) => item.signal === dominantSignal).length / available.length) * 100
    : 0;

  return {
    dominantSignal,
    agreement: round(agreement),
    verdict:
      agreement >= 75
        ? "Strong timeframe alignment"
        : agreement >= 50
          ? "Mixed but usable alignment"
          : "Low alignment, wait for clarity",
    timeframes,
  };
}

function scoreHistoricalWindow(history, index) {
  const slice = history.slice(0, index + 1);
  const closes = slice.map((item) => Number(item.close)).filter(Number.isFinite);
  const current = slice[slice.length - 1];
  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const trend = trendStructure(slice);
  const { support, resistance } = pivotLevels(slice, 60);
  const patterns = detectCandlestickPatterns(slice);
  return scoreSignal({
    rsi,
    macd,
    sma20,
    sma50,
    sma200,
    volumeRatio: 1,
    currentPrice: Number(current.close),
    support,
    resistance,
    patterns,
    trend,
  });
}

async function backtestChartSetup(symbol, range = "2y") {
  const { history } = await getHistoricalData(symbol, range);
  if (!history || history.length < 90) {
    return {
      symbol: symbol.toUpperCase(),
      totalSignals: 0,
      winRate: 0,
      averageGain: 0,
      averageLoss: 0,
      averageReturn: 0,
      maxDrawdown: 0,
      holdingPeriodDays: 10,
      recentSignals: [],
    };
  }

  const trades = [];
  for (let i = 70; i < history.length - 10; i += 1) {
    const scored = scoreHistoricalWindow(history, i);
    if (scored.signal === "HOLD" || scored.confidence < 55) continue;
    const entry = Number(history[i].close);
    const exit = Number(history[i + 10].close);
    const direction = scored.signal === "BUY" ? 1 : -1;
    const returnPercent = ((exit - entry) / entry) * 100 * direction;
    trades.push({
      date: history[i].date,
      signal: scored.signal,
      confidence: scored.confidence,
      entry: round(entry),
      exit: round(exit),
      returnPercent: round(returnPercent),
      won: returnPercent > 0,
    });
  }

  const wins = trades.filter((trade) => trade.won);
  const losses = trades.filter((trade) => !trade.won);
  const avg = (items) =>
    items.length ? items.reduce((sum, item) => sum + item.returnPercent, 0) / items.length : 0;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  trades.forEach((trade) => {
    equity += trade.returnPercent;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  });

  return {
    symbol: symbol.toUpperCase(),
    totalSignals: trades.length,
    winRate: trades.length ? round((wins.length / trades.length) * 100) : 0,
    averageGain: round(avg(wins)),
    averageLoss: round(avg(losses)),
    averageReturn: round(avg(trades)),
    maxDrawdown: round(Math.abs(maxDrawdown)),
    holdingPeriodDays: 10,
    recentSignals: trades.slice(-5).reverse(),
  };
}

async function buildTraderToolkit(symbol, options = {}) {
  const chart = await analyzeChart(symbol, "1y");
  const tradePlan = buildTradePlan(chart);
  const positionSizing = calculatePositionSizing({
    capital: options.capital,
    riskPercent: options.riskPercent,
    entry: chart.currentPrice,
    stopLoss: tradePlan.stopLoss,
  });
  const [multiTimeframe, backtest] = await Promise.all([
    analyzeMultiTimeframe(symbol),
    backtestChartSetup(symbol),
  ]);

  return {
    symbol: symbol.toUpperCase(),
    chart,
    tradePlan,
    positionSizing,
    multiTimeframe,
    backtest,
    generatedAt: new Date().toISOString(),
    disclaimer: "Trader toolkit is educational research. Use your own risk rules before placing trades.",
  };
}

async function buildRiskDashboard(symbols = DEFAULT_SYMBOLS.slice(3, 15)) {
  const selected = symbols.slice(0, 12).map((symbol) => String(symbol).toUpperCase());
  const settled = await Promise.allSettled(selected.map((symbol) => analyzeChart(symbol, "6mo")));
  const setups = settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((a, b) => b.confidence - a.confidence);

  return {
    scanned: setups.length,
    generatedAt: new Date().toISOString(),
    breakoutCandidates: setups
      .filter((item) => item.signal === "BUY" && item.levels.riskReward >= 1.4)
      .slice(0, 5),
    breakdownRisks: setups
      .filter((item) => item.signal === "SELL" || item.indicators.rsi < 42)
      .slice(0, 5),
    overbought: setups
      .filter((item) => item.indicators.rsi >= 68)
      .slice(0, 5),
    watchlist: setups.slice(0, 8).map((item) => ({
      symbol: item.symbol,
      signal: item.signal,
      confidence: item.confidence,
      price: item.currentPrice,
      riskReward: item.levels.riskReward,
      trend: item.trend.direction,
    })),
  };
}

module.exports = {
  analyzeChart,
  buildTraderToolkit,
  buildRiskDashboard,
};
