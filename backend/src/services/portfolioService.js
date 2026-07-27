/**
 * Portfolio Analysis Service
 */

const { getStockData } = require("./stockService");

/**
 * Analyze a portfolio of holdings
 * @param {Array} holdings - [{symbol, quantity, buyPrice, sector}]
 */
async function analyzePortfolio(holdings) {
  if (!holdings || holdings.length === 0) {
    return { error: "No holdings provided" };
  }

  // Fetch current prices for all holdings
  const pricePromises = holdings.map((h) => getStockData(h.symbol));
  const priceResults = await Promise.allSettled(pricePromises);

  let totalInvested = 0;
  let totalCurrentValue = 0;
  const analyzedHoldings = [];
  const sectorMap = {};

  holdings.forEach((holding, i) => {
    const priceResult = priceResults[i];
    const currentPrice = priceResult.status === "fulfilled"
      ? priceResult.value.currentPrice
      : holding.buyPrice; // fallback to buy price

    const invested = holding.quantity * holding.buyPrice;
    const currentValue = holding.quantity * currentPrice;
    const pnl = currentValue - invested;
    const pnlPercent = (pnl / invested) * 100;

    totalInvested += invested;
    totalCurrentValue += currentValue;

    const sector = holding.sector || "Unknown";
    sectorMap[sector] = (sectorMap[sector] || 0) + currentValue;

    analyzedHoldings.push({
      symbol: holding.symbol,
      name: holding.name || holding.symbol,
      quantity: holding.quantity,
      buyPrice: holding.buyPrice,
      currentPrice,
      invested: parseFloat(invested.toFixed(2)),
      currentValue: parseFloat(currentValue.toFixed(2)),
      pnl: parseFloat(pnl.toFixed(2)),
      pnlPercent: parseFloat(pnlPercent.toFixed(2)),
      sector,
      weight: 0, // calculated below
    });
  });

  // Calculate weights
  analyzedHoldings.forEach((h) => {
    h.weight = parseFloat(((h.currentValue / totalCurrentValue) * 100).toFixed(2));
  });

  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPercent = (totalPnL / totalInvested) * 100;

  // Diversification score (0-100)
  const sectorCount = Object.keys(sectorMap).length;
  const maxWeight = Math.max(...analyzedHoldings.map((h) => h.weight));
  const diversificationScore = Math.min(100, Math.round(
    (sectorCount * 10) + (100 - maxWeight) * 0.5
  ));

  // Risk score (0-10)
  const avgPnLPercent = analyzedHoldings.reduce((a, h) => a + Math.abs(h.pnlPercent), 0) / analyzedHoldings.length;
  const riskScore = parseFloat(Math.min(10, (avgPnLPercent / 10) + (maxWeight > 40 ? 3 : 0) + (sectorCount < 3 ? 2 : 0)).toFixed(1));

  // Suggestions
  const suggestions = generateSuggestions(analyzedHoldings, sectorMap, diversificationScore, riskScore);

  return {
    summary: {
      totalInvested: parseFloat(totalInvested.toFixed(2)),
      totalCurrentValue: parseFloat(totalCurrentValue.toFixed(2)),
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      totalPnLPercent: parseFloat(totalPnLPercent.toFixed(2)),
      diversificationScore,
      riskScore,
      holdingsCount: holdings.length,
      sectorsCount: sectorCount,
    },
    holdings: analyzedHoldings.sort((a, b) => b.currentValue - a.currentValue),
    sectorAllocation: Object.entries(sectorMap).map(([sector, value]) => ({
      sector,
      value: parseFloat(value.toFixed(2)),
      percent: parseFloat(((value / totalCurrentValue) * 100).toFixed(2)),
    })).sort((a, b) => b.value - a.value),
    suggestions,
    analyzedAt: new Date().toISOString(),
  };
}

function generateSuggestions(holdings, sectorMap, diversificationScore, riskScore) {
  const suggestions = [];
  const sectorCount = Object.keys(sectorMap).length;
  const maxWeightHolding = holdings.reduce((a, b) => a.weight > b.weight ? a : b);

  if (maxWeightHolding.weight > 30) {
    suggestions.push({
      type: "WARNING",
      message: `${maxWeightHolding.symbol} represents ${maxWeightHolding.weight}% of your portfolio. Consider reducing concentration risk.`,
    });
  }

  if (sectorCount < 3) {
    suggestions.push({
      type: "SUGGESTION",
      message: "Your portfolio is concentrated in few sectors. Consider diversifying across IT, Banking, Pharma, and FMCG.",
    });
  }

  const losers = holdings.filter((h) => h.pnlPercent < -15);
  if (losers.length > 0) {
    suggestions.push({
      type: "ALERT",
      message: `${losers.map((l) => l.symbol).join(", ")} ${losers.length > 1 ? "are" : "is"} down more than 15%. Review your stop-loss strategy.`,
    });
  }

  if (diversificationScore > 70) {
    suggestions.push({
      type: "POSITIVE",
      message: "Good diversification! Your portfolio is well-spread across sectors.",
    });
  }

  if (riskScore < 4) {
    suggestions.push({
      type: "POSITIVE",
      message: "Low risk portfolio. Consider adding some growth stocks for better returns.",
    });
  }

  return suggestions;
}

module.exports = { analyzePortfolio };
