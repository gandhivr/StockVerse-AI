/**
 * Market Scanner Service
 * Scans all tracked stocks and identifies opportunities
 */

const { getMultipleStocks, DEFAULT_SYMBOLS } = require("./stockService");
const { getPrediction } = require("./predictionService");

// Sector mapping for Indian stocks
const SECTOR_MAP = {
  RELIANCE: "Energy", TCS: "IT", INFY: "IT", WIPRO: "IT",
  HDFCBANK: "Banking", ICICIBANK: "Banking", SBIN: "Banking",
  KOTAKBANK: "Banking", AXISBANK: "Banking",
  BAJFINANCE: "Finance", LT: "Infrastructure",
  HINDUNILVR: "FMCG", NESTLEIND: "FMCG",
  MARUTI: "Auto", TITAN: "Consumer",
  SUNPHARMA: "Pharma", ASIANPAINT: "Consumer",
  ULTRACEMCO: "Cement", POWERGRID: "Utilities", NTPC: "Utilities",
};

/**
 * Full market scan — returns gainers, losers, trending, AI signals
 */
async function scanMarket() {
  const stockSymbols = DEFAULT_SYMBOLS.filter(
    (s) => !["NIFTY50", "BANKNIFTY", "SENSEX"].includes(s)
  );

  const stocks = await getMultipleStocks(stockSymbols);

  // Sort by change percent
  const sorted = [...stocks].sort((a, b) => b.changePercent - a.changePercent);

  const topGainers = sorted.slice(0, 5).map(formatScanResult);
  const topLosers = sorted.slice(-5).reverse().map(formatScanResult);

  // Trending = highest volume relative to average (simulated here)
  const trending = [...stocks]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5)
    .map(formatScanResult);

  // Sector performance
  const sectorPerformance = calculateSectorPerformance(stocks);

  // AI signals (quick TA-based, no ML call to keep it fast)
  const { bullishSignals, bearishSignals } = generateAISignals(stocks);

  return {
    topGainers,
    topLosers,
    trending,
    sectorPerformance,
    bullishSignals,
    bearishSignals,
    marketSummary: generateMarketSummary(stocks),
    scannedAt: new Date().toISOString(),
    totalStocksScanned: stocks.length,
  };
}

function formatScanResult(stock) {
  return {
    symbol: stock.appSymbol || stock.symbol,
    name: stock.shortName || stock.appSymbol,
    price: stock.currentPrice,
    change: stock.change,
    changePercent: stock.changePercent,
    volume: stock.volume,
    sector: SECTOR_MAP[stock.appSymbol] || "Other",
  };
}

function calculateSectorPerformance(stocks) {
  const sectorData = {};

  stocks.forEach((stock) => {
    const sector = SECTOR_MAP[stock.appSymbol] || "Other";
    if (!sectorData[sector]) {
      sectorData[sector] = { changes: [], count: 0 };
    }
    sectorData[sector].changes.push(stock.changePercent);
    sectorData[sector].count++;
  });

  return Object.entries(sectorData).map(([sector, data]) => ({
    sector,
    avgChange: parseFloat((data.changes.reduce((a, b) => a + b, 0) / data.changes.length).toFixed(2)),
    stockCount: data.count,
    trend: data.changes.reduce((a, b) => a + b, 0) / data.changes.length > 0 ? "UP" : "DOWN",
  })).sort((a, b) => b.avgChange - a.avgChange);
}

function generateAISignals(stocks) {
  const bullishSignals = [];
  const bearishSignals = [];

  stocks.forEach((stock) => {
    const change = stock.changePercent;
    const volumeSignal = stock.volume > 1000000 ? "High Volume" : "Normal Volume";

    if (change > 2) {
      bullishSignals.push({
        symbol: stock.appSymbol,
        price: stock.currentPrice,
        signal: "STRONG BUY",
        reason: `Up ${change}% with ${volumeSignal}`,
        confidence: Math.min(90, 60 + change * 5),
      });
    } else if (change > 0.5) {
      bullishSignals.push({
        symbol: stock.appSymbol,
        price: stock.currentPrice,
        signal: "BUY",
        reason: `Positive momentum +${change}%`,
        confidence: Math.min(75, 50 + change * 8),
      });
    } else if (change < -2) {
      bearishSignals.push({
        symbol: stock.appSymbol,
        price: stock.currentPrice,
        signal: "STRONG SELL",
        reason: `Down ${Math.abs(change)}% with ${volumeSignal}`,
        confidence: Math.min(90, 60 + Math.abs(change) * 5),
      });
    } else if (change < -0.5) {
      bearishSignals.push({
        symbol: stock.appSymbol,
        price: stock.currentPrice,
        signal: "SELL",
        reason: `Negative momentum ${change}%`,
        confidence: Math.min(75, 50 + Math.abs(change) * 8),
      });
    }
  });

  return {
    bullishSignals: bullishSignals.slice(0, 5),
    bearishSignals: bearishSignals.slice(0, 5),
  };
}

function generateMarketSummary(stocks) {
  const advancing = stocks.filter((s) => s.changePercent > 0).length;
  const declining = stocks.filter((s) => s.changePercent < 0).length;
  const avgChange = stocks.reduce((a, s) => a + s.changePercent, 0) / stocks.length;

  return {
    advancing,
    declining,
    unchanged: stocks.length - advancing - declining,
    avgChange: parseFloat(avgChange.toFixed(2)),
    marketMood: avgChange > 0.5 ? "BULLISH" : avgChange < -0.5 ? "BEARISH" : "NEUTRAL",
  };
}

module.exports = { scanMarket };
