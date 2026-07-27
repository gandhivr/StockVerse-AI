/**
 * StockVerse AI — API client
 * All calls go to the Express backend at localhost:5000
 */

const BASE = import.meta.env.VITE_API_URL || "";
const DEFAULT_TIMEOUT_MS = 15000;

function withTimeout(options?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  return {
    options: { ...options, signal: controller.signal },
    done: () => window.clearTimeout(timeout),
  };
}

async function request<T>(path: string, options?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const timed = withTimeout(options, timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...timed.options,
    });
    if (!res.ok && res.status !== 207) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.userMessage || err.message || "API error");
    }
    const json = await res.json();
    return json.data ?? json;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The request timed out. Check that the local servers are running.");
    }
    throw error;
  } finally {
    timed.done();
  }
}

// ─── Stocks ──────────────────────────────────────────────────────────────────

export const api = {
  system: {
    health: () => request<SystemHealth>("/api/system/health"),
  },
  stocks: {
    getAll: (symbols?: string) =>
      request<StockQuote[]>(`/api/stocks${symbols ? `?symbols=${symbols}` : ""}`),
    get: (symbol: string) => request<StockQuote>(`/api/stocks/${symbol}`),
    history: (symbol: string, range = "3mo") =>
      request<{ symbol: string; range: string; history: OHLCV[] }>(
        `/api/stocks/${symbol}/history?range=${range}`,
      ),
  },
  predict: {
    get: (symbol: string) => request<Prediction>(`/api/predict/${symbol}`),
    agents: (symbol: string, horizons = "1,7,30,60,90") =>
      request<MultiAgentForecast>(`/api/predict/${symbol}/agents?horizons=${horizons}`),
    chartIntelligence: (symbol: string, range = "1y") =>
      request<ChartIntelligence>(`/api/predict/${symbol}/chart-intelligence?range=${range}`),
    traderToolkit: (symbol: string, capital = 100000, risk = 1) =>
      request<TraderToolkit>(
        `/api/predict/${symbol}/trader-toolkit?capital=${capital}&risk=${risk}`,
      ),
    riskDashboard: (symbols?: string) =>
      request<RiskDashboard>(`/api/predict/risk-dashboard${symbols ? `?symbols=${symbols}` : ""}`),
    post: (symbol: string) =>
      request<Prediction>("/api/predict", { method: "POST", body: JSON.stringify({ symbol }) }),
    fundamentals: (symbol: string) =>
      request<FundamentalAnalysisResult>(`/api/predict/${symbol}/fundamentals`, undefined, 90000),
    newsSentiment: (symbol: string) =>
      request<StockNewsSentiment>(`/api/predict/${symbol}/news-sentiment`, undefined, 90000),
  },
  chat: {
    send: (message: string, sessionId?: string) =>
      request<{ sessionId: string; message: string; timestamp: string }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message, sessionId }),
      }),
    history: (sessionId: string) =>
      request<{ sessionId: string; messages: ChatMessage[] }>(`/api/chat/history/${sessionId}`),
  },
  portfolio: {
    analyze: (holdings: Holding[]) =>
      request<PortfolioAnalysis>("/api/portfolio/analyze", {
        method: "POST",
        body: JSON.stringify({ holdings }),
      }),
  },
  marketScan: {
    get: () => request<MarketScan>("/api/market-scan"),
  },
  accuracy: {
    get: () => request<AccuracyDashboard>("/api/accuracy"),
    coverage: () => request<ModelCoverage>("/api/accuracy/coverage"),
    reconcile: () =>
      request<{ checkedRecords: number; resolved: number }>("/api/accuracy/reconcile", {
        method: "POST",
      }),
  },
  news: {
    getSentiment: (topic?: string) =>
      request<NewsSentiment>(`/api/news-sentiment${topic ? `?topic=${topic}` : ""}`),
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StockQuote {
  appSymbol: string;
  symbol: string;
  shortName: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  high: number;
  low: number;
  open: number;
  currency: string;
  exchange: string;
  marketState: string;
  timestamp: string;
}

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Prediction {
  symbol: string;
  predictedPrice: number;
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  riskScore: number;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  technicalIndicators: {
    rsi: number;
    macd: number;
    sma20: number;
    sma50: number;
    volumeRatio?: number;
    bbUpper?: number;
    bbLower?: number;
  };
  signals?: string[];
  source: string;
  aiInsight?: string;
  cached?: boolean;
}

export interface ForecastHorizon {
  days: number;
  label: string;
  predictedPrice: number;
  changePercent: number;
  direction: "UP" | "DOWN" | "FLAT";
  technicalSignal?: "BUY" | "SELL" | "HOLD";
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  expectedRange?: { low: number; high: number };
  source: string;
}

export interface MultiAgentForecast {
  symbol: string;
  verdict: "BUY" | "SELL" | "HOLD";
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  currentPrice: number;
  primaryHorizon: ForecastHorizon;
  horizons: ForecastHorizon[];
  technicalIndicators?: {
    rsi: number;
    sma20: number;
    sma50: number;
    sma200: number;
    macd: number;
    volatility: number;
    volumeRatio: number;
  };
  risk: {
    riskScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    notes: string[];
    horizonRisks?: { days: number; riskScore: number }[];
  };
  newsInfluenced: boolean;
  newsReasoning?: string;
  newsSentiment?: {
    score: number;
    direction: "BULLISH" | "BEARISH" | "NEUTRAL";
    impact: "HIGH" | "MEDIUM" | "LOW";
    keyEvents: string[];
  };
  agents: { name: string; status: string; source?: string }[];
  source: string;
  modelVersion: string;
  modelStatus?: "TRAINED" | "FALLBACK";
  modelMetadata?: {
    trainedAt?: string;
    trainingRows?: number;
    validationMae?: Record<string, number>;
    trainedHorizons?: number[];
  } | null;
  summary: string;
  generatedAt: string;
}

export interface ChartIntelligence {
  symbol: string;
  range: string;
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  score: number;
  currentPrice: number;
  trend: {
    direction: "UPTREND" | "DOWNTREND" | "SIDEWAYS";
    description: string;
  };
  levels: {
    support: number;
    resistance: number;
    stopLoss: number;
    target: number;
    upsidePercent: number;
    downsidePercent: number;
    riskReward: number;
  };
  indicators: {
    rsi: number;
    macd: number;
    sma20: number;
    sma50: number;
    sma200: number;
    volumeRatio: number;
    volatility: number;
  };
  patterns: {
    name: string;
    bias: "BULLISH" | "BEARISH" | "NEUTRAL";
    strength: number;
    description: string;
  }[];
  reasons: string[];
  warnings: string[];
  generatedAt: string;
  disclaimer: string;
}

export interface TraderToolkit {
  symbol: string;
  chart: ChartIntelligence;
  tradePlan: {
    planType: string;
    entryZone: { low: number; high: number };
    entryTrigger: string;
    target1: number;
    target2: number;
    stopLoss: number;
    invalidIf: string;
    riskReward: number;
    notes: string[];
  };
  positionSizing: {
    capital: number;
    riskPercent: number;
    maxLoss: number;
    riskPerShare: number;
    quantity: number;
    deployedCapital: number;
    capitalUsagePercent: number;
  };
  multiTimeframe: {
    dominantSignal: "BUY" | "SELL" | "HOLD";
    agreement: number;
    verdict: string;
    timeframes: {
      range: string;
      signal: "BUY" | "SELL" | "HOLD";
      confidence: number;
      trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS";
      score: number;
      available: boolean;
    }[];
  };
  backtest: {
    symbol: string;
    totalSignals: number;
    winRate: number;
    averageGain: number;
    averageLoss: number;
    averageReturn: number;
    maxDrawdown: number;
    holdingPeriodDays: number;
    recentSignals: {
      date: string;
      signal: "BUY" | "SELL" | "HOLD";
      confidence: number;
      entry: number;
      exit: number;
      returnPercent: number;
      won: boolean;
    }[];
  };
  generatedAt: string;
  disclaimer: string;
}

export interface RiskDashboard {
  scanned: number;
  generatedAt: string;
  breakoutCandidates: ChartIntelligence[];
  breakdownRisks: ChartIntelligence[];
  overbought: ChartIntelligence[];
  watchlist: {
    symbol: string;
    signal: "BUY" | "SELL" | "HOLD";
    confidence: number;
    price: number;
    riskReward: number;
    trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS";
  }[];
}

export interface AccuracyDashboard {
  accuracy: {
    trackedPredictions: number;
    resolvedHorizons: number;
    horizons: AccuracyHorizon[];
    recent: PredictionRecord[];
  };
  coverage: ModelCoverage;
  trainingSummary: Record<string, unknown> | null;
}

export interface AccuracyHorizon {
  days: number;
  label: string;
  count: number;
  mae: number;
  mape: number;
  directionAccuracy: number;
}

export interface PredictionRecord {
  symbol: string;
  currentPrice: number;
  verdict: string;
  source: string;
  modelVersion: string;
  generatedAt: string;
  horizons: {
    days: number;
    label: string;
    predictedPrice: number;
    actualPrice?: number;
    absoluteError?: number;
    absolutePercentError?: number;
    directionCorrect?: boolean;
    resolvedAt?: string;
  }[];
}

export interface ModelCoverage {
  totalSymbols: number;
  trainedCount: number;
  fallbackCount: number;
  trained: string[];
  fallback: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Holding {
  symbol: string;
  name?: string;
  quantity: number;
  buyPrice: number;
  sector?: string;
}

export interface PortfolioAnalysis {
  summary: {
    totalInvested: number;
    totalCurrentValue: number;
    totalPnL: number;
    totalPnLPercent: number;
    diversificationScore: number;
    riskScore: number;
    holdingsCount: number;
    sectorsCount: number;
  };
  holdings: AnalyzedHolding[];
  sectorAllocation: { sector: string; value: number; percent: number }[];
  suggestions: { type: string; message: string }[];
  analyzedAt: string;
}

export interface AnalyzedHolding {
  symbol: string;
  name: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  sector: string;
  weight: number;
}

export interface MarketScan {
  topGainers: ScanStock[];
  topLosers: ScanStock[];
  trending: ScanStock[];
  sectorPerformance: { sector: string; avgChange: number; stockCount: number; trend: string }[];
  bullishSignals: AISignal[];
  bearishSignals: AISignal[];
  marketSummary: {
    advancing: number;
    declining: number;
    unchanged: number;
    avgChange: number;
    marketMood: string;
  };
  scannedAt: string;
  totalStocksScanned: number;
}

export interface ScanStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  sector: string;
}

export interface AISignal {
  symbol: string;
  price: number;
  signal: string;
  reason: string;
  confidence: number;
}

export interface NewsSentiment {
  news: NewsItem[];
  sentiment: SentimentResult;
  source: string;
  fetchedAt?: string;
}

export interface NewsItem {
  title: string;
  description: string;
  publishedAt: string;
  url?: string;
  source: string;
}

export interface SentimentResult {
  overallSentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  sentimentScore: number;
  marketImpact: string;
  summary: string;
  keyThemes: string[];
  bullishFactors: string[];
  bearishFactors: string[];
  newsAnalysis: { headline: string; sentiment: string; impact: string }[];
}

export interface SystemHealth {
  success: boolean;
  status: "online" | "degraded" | "offline";
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  checks: {
    backend: HealthCheck;
    database: HealthCheck;
    mlService: HealthCheck;
    configuration: HealthCheck & { missingOptional?: string[] };
  };
}

export interface HealthCheck {
  status: "online" | "degraded" | "offline";
  message: string;
  latencyMs?: number | null;
}

// ─── Fundamental Analysis ─────────────────────────────────────────────────────

export interface FundamentalMetrics {
  symbol: string;
  yahooSymbol: string;
  companyName: string;
  companyInfo: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  eps: number | null;
  evToEbitda: number | null;
  dividendYield: number | null;
  beta: number | null;
  roe: number | null;
  roce: number | null;
  profitMargins: number | null;
  grossMargins: number | null;
  ebitdaMargins: number | null;
  operatingMargins: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  revenuePerShare: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
  quickRatio: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  freeCashflow: number | null;
  promoterHolding: number | null;
  institutionalHolding: number | null;
  fiiChange: number | null;
  diiChange: number | null;
  sectorPE: number | null;
  sectorROE: number | null;
  quarterlyResults: {
    period: string;
    revenue: number | null;
    netIncome: number | null;
    ebitda: number | null;
    eps: number | null;
  }[];
}

export interface FundamentalAnalysis {
  financialStrength: {
    profitability: string;
    debt: string;
    financialHealth: string;
  };
  growthAnalysis: {
    revenueGrowth: string;
    profitGrowth: string;
    quarterlyConsistency: string;
  };
  valuationAnalysis: {
    verdict: "Expensive" | "Fair" | "Undervalued";
    details: string;
    sectorComparison: string;
  };
  riskAnalysis: string[];
  strengths: string[];
  fundamentalScore: number;
  signal: "BUY" | "HOLD" | "SELL";
  confidence: number;
  reason: string;
  oneLineSummary: string;
  source?: string;
}

export interface FundamentalAnalysisResult {
  symbol: string;
  companyName: string;
  metrics: FundamentalMetrics;
  analysis: FundamentalAnalysis;
  generatedAt: string;
}

export interface StockNewsSentiment {
  sentimentScore: number;
  impact: "HIGH" | "MEDIUM" | "LOW";
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  keyEvents: string[];
  signalAdjustment: string;
  reasoning: string;
  beginnerExplanation?: string;
  news: NewsItem[];
  fetchedAt: string;
}
