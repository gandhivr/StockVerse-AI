/**
 * Stock Service
 * Fetches Indian stock data via Yahoo Finance API
 * Yahoo Finance uses ".NS" suffix for NSE stocks and ".BO" for BSE
 */

const axios = require("axios");

// ─── In-memory quote cache (TTL: 60 seconds) ─────────────────────────────────
const quoteCache = new Map(); // symbol -> { data, expiresAt }
const CACHE_TTL_MS = 5 * 1000; // 5 seconds

function getCached(symbol) {
  const entry = quoteCache.get(symbol);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  return null;
}

function setCache(symbol, data) {
  quoteCache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Indian Stock Symbol Map ──────────────────────────────────────────────────
// Yahoo Finance symbol overrides — some NSE symbols differ from Yahoo tickers
const INDIAN_STOCKS = {
  // Indices
  NIFTY50: "^NSEI",
  BANKNIFTY: "^NSEBANK",
  SENSEX: "^BSESN",
  // NIFTY 50
  RELIANCE: "RELIANCE.NS",
  TCS: "TCS.NS",
  INFY: "INFY.NS",
  HDFCBANK: "HDFCBANK.NS",
  ICICIBANK: "ICICIBANK.NS",
  SBIN: "SBIN.NS",
  WIPRO: "WIPRO.NS",
  BAJFINANCE: "BAJFINANCE.NS",
  HINDUNILVR: "HINDUNILVR.NS",
  KOTAKBANK: "KOTAKBANK.NS",
  LT: "LT.NS",
  AXISBANK: "AXISBANK.NS",
  ASIANPAINT: "ASIANPAINT.NS",
  MARUTI: "MARUTI.NS",
  SUNPHARMA: "SUNPHARMA.NS",
  TITAN: "TITAN.NS",
  ULTRACEMCO: "ULTRACEMCO.NS",
  NESTLEIND: "NESTLEIND.NS",
  POWERGRID: "POWERGRID.NS",
  NTPC: "NTPC.NS",
  HCLTECH: "HCLTECH.NS",
  TECHM: "TECHM.NS",
  ONGC: "ONGC.NS",
  COALINDIA: "COALINDIA.NS",
  TATAMOTORS: "TMCV.NS", // Tata Motors — Yahoo uses TMCV after restructuring
  ZOMATO: "ETERNAL.NS", // Zomato rebranded to Eternal Ltd in 2025
  TATASTEEL: "TATASTEEL.NS",
  JSWSTEEL: "JSWSTEEL.NS",
  HINDALCO: "HINDALCO.NS",
  ADANIENT: "ADANIENT.NS",
  ADANIPORTS: "ADANIPORTS.NS",
  BAJAJFINSV: "BAJAJFINSV.NS",
  BAJAJ_AUTO: "BAJAJ-AUTO.NS", // Yahoo uses hyphen not underscore
  HEROMOTOCO: "HEROMOTOCO.NS",
  EICHERMOT: "EICHERMOT.NS",
  DRREDDY: "DRREDDY.NS",
  CIPLA: "CIPLA.NS",
  DIVISLAB: "DIVISLAB.NS",
  APOLLOHOSP: "APOLLOHOSP.NS",
  BRITANNIA: "BRITANNIA.NS",
  ITC: "ITC.NS",
  GRASIM: "GRASIM.NS",
  INDUSINDBK: "INDUSINDBK.NS",
  MM: "M%26M.NS", // Yahoo uses M%26M for M&M
  TATACONSUM: "TATACONSUM.NS",
  BPCL: "BPCL.NS",
  IOC: "IOC.NS",
  SHRIRAMFIN: "SHRIRAMFIN.NS",
  BEL: "BEL.NS",
  TRENT: "TRENT.NS",
  HAL: "HAL.NS",
  // IT
  MPHASIS: "MPHASIS.NS",
  LTIM: "LTIM.NS",
  LTTS: "LTTS.NS",
  PERSISTENT: "PERSISTENT.NS",
  COFORGE: "COFORGE.NS",
  KPITTECH: "KPITTECH.NS",
  TATAELXSI: "TATAELXSI.NS",
  HAPPSTMNDS: "HAPPSTMNDS.NS",
  INFOEDGE: "NAUKRI.NS", // Info Edge trades as NAUKRI on Yahoo
  // Banking
  FEDERALBNK: "FEDERALBNK.NS",
  IDFCFIRSTB: "IDFCFIRSTB.NS",
  BANDHANBNK: "BANDHANBNK.NS",
  RBLBANK: "RBLBANK.NS",
  YESBANK: "YESBANK.NS",
  PNB: "PNB.NS",
  BANKBARODA: "BANKBARODA.NS",
  CANBK: "CANBK.NS",
  UNIONBANK: "UNIONBANK.NS",
  AUBANK: "AUBANK.NS",
  // Finance
  MUTHOOTFIN: "MUTHOOTFIN.NS",
  CHOLAFIN: "CHOLAFIN.NS",
  SBILIFE: "SBILIFE.NS",
  HDFCLIFE: "HDFCLIFE.NS",
  ICICIPRULI: "ICICIPRULI.NS",
  ICICIGI: "ICICIGI.NS",
  SBICARD: "SBICARD.NS",
  PAYTM: "PAYTM.NS",
  NYKAA: "NYKAA.NS",
  POLICYBZR: "POLICYBZR.NS",
  DELHIVERY: "DELHIVERY.NS",
  IRCTC: "IRCTC.NS",
  RVNL: "RVNL.NS",
  IRFC: "IRFC.NS",
  RECLTD: "RECLTD.NS",
  PFC: "PFC.NS",
  NHPC: "NHPC.NS",
  TATAPOWER: "TATAPOWER.NS",
  SUZLON: "SUZLON.NS",
  ADANIGREEN: "ADANIGREEN.NS",
  ADANIPOWER: "ADANIPOWER.NS",
  LICI: "LICI.NS",
  HAL: "HAL.NS",
  COCHINSHIP: "COCHINSHIP.NS",
  MAZAGON: "MAZDOCK.NS", // Yahoo uses MAZDOCK for Mazagon Dock
  GRSE: "GRSE.NS",
  BDL: "BDL.NS",
  BEML: "BEML.NS",
  // Symbols with non-standard Yahoo tickers
  TEJAS: "TEJASNET.NS", // Tejas Networks — Yahoo uses TEJASNET.NS
  JIOFIN: "JIOFIN.NS", // Jio Financial Services
  JIOFINANCE: "JIOFIN.NS",
  LICI: "LICI.NS", // LIC India
  STARHEALTH: "STARHEALTH.NS",
  ATGL: "ATGL.NS", // Adani Total Gas
  AWL: "AWL.NS", // Adani Wilmar
  TATACOMM: "TATACOMM.NS",
  RAILTEL: "RAILTEL.NS",
  IRCON: "IRCON.NS",
  RITES: "RITES.NS",
  NBCC: "NBCC.NS",
  HUDCO: "HUDCO.NS",
  SJVN: "SJVN.NS",
  NHPC: "NHPC.NS",
  CESC: "CESC.NS",
  TORNTPOWER: "TORNTPOWER.NS",
  JSWENERGY: "JSWENERGY.NS",
  INOXWIND: "INOXWIND.NS",
  SUZLON: "SUZLON.NS",
  WAAREEENER: "WAAREEENER.NS",
  PREMIER: "PREMIERENE.NS", // Premier Energies — Yahoo uses PREMIERENE
  DMART: "DMART.NS",
  NAUKRI: "NAUKRI.NS", // Info Edge trades as NAUKRI
  INFOEDGE: "NAUKRI.NS",
  // Pharma
  AUROPHARMA: "AUROPHARMA.NS",
  LUPIN: "LUPIN.NS",
  BIOCON: "BIOCON.NS",
  TORNTPHARM: "TORNTPHARM.NS",
  ALKEM: "ALKEM.NS",
  GLENMARK: "GLENMARK.NS",
  LAURUSLABS: "LAURUSLABS.NS",
  FORTIS: "FORTIS.NS",
  MAXHEALTH: "MAXHEALTH.NS",
  // Auto
  ASHOKLEY: "ASHOKLEY.NS",
  TVSMOTOR: "TVSMOTOR.NS",
  MOTHERSON: "MOTHERSON.NS",
  BOSCHLTD: "BOSCHLTD.NS",
  BHARATFORG: "BHARATFORG.NS",
  BALKRISIND: "BALKRISIND.NS",
  APOLLOTYRE: "APOLLOTYRE.NS",
  MRF: "MRF.NS",
  ESCORTS: "ESCORTS.NS",
  // Metals
  VEDL: "VEDL.NS",
  NMDC: "NMDC.NS",
  SAIL: "SAIL.NS",
  NATIONALUM: "NATIONALUM.NS",
  HINDCOPPER: "HINDCOPPER.NS",
  // Cement
  SHREECEM: "SHREECEM.NS",
  AMBUJACEM: "AMBUJACEM.NS",
  ACC: "ACC.NS",
  ULTRACEMCO: "ULTRACEMCO.NS",
  // Real Estate
  DLF: "DLF.NS",
  GODREJPROP: "GODREJPROP.NS",
  OBEROIRLTY: "OBEROIRLTY.NS",
  PRESTIGE: "PRESTIGE.NS",
  // Oil & Gas
  GAIL: "GAIL.NS",
  PETRONET: "PETRONET.NS",
  HINDPETRO: "HINDPETRO.NS",
  IGL: "IGL.NS",
  MGL: "MGL.NS",
  // Chemicals
  PIDILITIND: "PIDILITIND.NS",
  AARTI: "AARTI.NS",
  DEEPAKNTR: "DEEPAKNTR.NS",
  NAVINFLUOR: "NAVINFLUOR.NS",
  TATACHEM: "TATACHEM.NS",
  COROMANDEL: "COROMANDEL.NS",
  // Infra & Capital Goods
  BHEL: "BHEL.NS",
  SIEMENS: "SIEMENS.NS",
  ABB: "ABB.NS",
  HAVELLS: "HAVELLS.NS",
  POLYCAB: "POLYCAB.NS",
  VOLTAS: "VOLTAS.NS",
  CROMPTON: "CROMPTON.NS",
  // Consumer
  MARICO: "MARICO.NS",
  DABUR: "DABUR.NS",
  COLPAL: "COLPAL.NS",
  GODREJCP: "GODREJCP.NS",
  EMAMILTD: "EMAMILTD.NS",
  VBLLTD: "VBL.NS", // Yahoo uses VBL for Varun Beverages
  DMART: "DMART.NS",
  TRENT: "TRENT.NS",
  ABFRL: "ABFRL.NS",
  // Media
  ZEEL: "ZEEL.NS",
  SUNTV: "SUNTV.NS",
  PVRINOX: "PVRINOX.NS",
  // Hospitality
  INDHOTEL: "INDHOTEL.NS",
  LEMONTREE: "LEMONTREE.NS",
  // Telecom
  IDEA: "IDEA.NS",
  TATACOMM: "TATACOMM.NS",
  HFCL: "HFCL.NS",
  INDUS: "INDUSTOWER.NS", // Yahoo uses INDUSTOWER for Indus Towers
};

// Default stocks to show on dashboard
const DEFAULT_SYMBOLS = [
  "NIFTY50",
  "BANKNIFTY",
  "SENSEX",
  "RELIANCE",
  "TCS",
  "INFY",
  "HDFCBANK",
  "ICICIBANK",
  "SBIN",
  "WIPRO",
  "BAJFINANCE",
  "HINDUNILVR",
];

/**
 * Fetch quote data from Yahoo Finance for a single symbol
 */
async function fetchYahooQuote(yahooSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
  const response = await axios.get(url, {
    params: { interval: "1m", range: "1d" },
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    timeout: 8000,
  });

  const result = response.data?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${yahooSymbol}`);

  const meta = result.meta;
  const quote = result.indicators?.quote?.[0] || {};
  const latestIndex = Array.isArray(quote.close)
    ? quote.close
        .map((value, index) => (value ? index : -1))
        .filter((index) => index >= 0)
        .pop()
    : null;
  const latestClose = latestIndex != null ? quote.close?.[latestIndex] : null;
  const latestOpen = latestIndex != null ? quote.open?.[latestIndex] : null;
  const latestHigh = latestIndex != null ? quote.high?.[latestIndex] : null;
  const latestLow = latestIndex != null ? quote.low?.[latestIndex] : null;
  const latestVolume = latestIndex != null ? quote.volume?.[latestIndex] : null;
  const currentPrice = meta.regularMarketPrice || latestClose || meta.chartPreviousClose;
  // Yahoo sometimes omits previousClose — fall back to chartPreviousClose
  const previousClose = meta.previousClose || meta.chartPreviousClose || currentPrice;
  const change = parseFloat((currentPrice - previousClose).toFixed(2));
  const changePercent = previousClose ? parseFloat(((change / previousClose) * 100).toFixed(2)) : 0;

  if (!currentPrice || currentPrice <= 0) throw new Error(`Invalid price data for ${yahooSymbol}`);

  return {
    symbol: meta.symbol,
    shortName: meta.shortName || meta.symbol,
    currentPrice: parseFloat(currentPrice.toFixed(2)),
    previousClose: parseFloat(previousClose.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    volume: meta.regularMarketVolume || latestVolume || 0,
    marketCap: meta.marketCap || null,
    high: meta.regularMarketDayHigh || latestHigh || currentPrice,
    low: meta.regularMarketDayLow || latestLow || currentPrice,
    open: meta.regularMarketOpen || latestOpen || currentPrice,
    currency: meta.currency || "INR",
    exchange: meta.exchangeName || "NSE",
    marketState: meta.marketState || "CLOSED",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get stock data for a given app symbol (e.g. "RELIANCE")
 * Uses in-memory cache (5s TTL) to avoid hammering Yahoo Finance
 */
async function getStockData(appSymbol) {
  const upperSymbol = appSymbol.toUpperCase();

  // Return cached data if fresh
  const cached = getCached(upperSymbol);
  if (cached) return cached;

  const isBseNumeric = /^\d{6}$/.test(upperSymbol);
  const isBseExplicit = upperSymbol.endsWith(".BO");
  const yahooSymbol = INDIAN_STOCKS[upperSymbol] || 
    (isBseNumeric ? `${upperSymbol}.BO` : isBseExplicit ? upperSymbol : `${upperSymbol}.NS`);

  try {
    const data = await fetchYahooQuote(yahooSymbol);
    const result = { ...data, appSymbol: upperSymbol };
    if (isBseNumeric && (!result.shortName || result.shortName === result.symbol || result.shortName === upperSymbol)) {
      const { NSE_SYMBOLS } = require("../data/nseSymbols");
      result.shortName = NSE_SYMBOLS[upperSymbol] || `${upperSymbol} (BSE Stock)`;
    }
    setCache(upperSymbol, result);
    return result;
  } catch (error) {
    console.warn(
      `⚠️  Yahoo Finance failed for ${upperSymbol}: ${error.message}. Using simulated data.`,
    );
    const simulated = generateSimulatedData(upperSymbol);
    setCache(upperSymbol, simulated); // cache simulated too to avoid retry storms
    return simulated;
  }
}

/**
 * Get multiple stocks — fetches in small batches to avoid Yahoo rate limits
 */
async function getMultipleStocks(symbols = DEFAULT_SYMBOLS) {
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 200;
  const results = [];

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map((sym) => getStockData(sym)));
    batchResults.forEach((result, j) => {
      results.push(result.status === "fulfilled" ? result.value : generateSimulatedData(batch[j]));
    });
    // Small delay between batches to be polite to Yahoo Finance
    if (i + BATCH_SIZE < symbols.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return results;
}

/**
 * Get historical OHLCV data for a stock
 * @param {string} appSymbol - e.g. "RELIANCE"
 * @param {string} range - "1mo" | "3mo" | "6mo" | "1y" | "2y"
 */
async function getHistoricalData(appSymbol, range = "3mo") {
  const upperSymbol = appSymbol.toUpperCase();
  const isBseNumeric = /^\d{6}$/.test(upperSymbol);
  const isBseExplicit = upperSymbol.endsWith(".BO");
  const yahooSymbol = INDIAN_STOCKS[upperSymbol] || 
    (isBseNumeric ? `${upperSymbol}.BO` : isBseExplicit ? upperSymbol : `${upperSymbol}.NS`);

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
    const response = await axios.get(url, {
      params: { interval: "1d", range },
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000,
    });

    const result = response.data?.chart?.result?.[0];
    if (!result || !result.timestamp || result.timestamp.length === 0) {
      throw new Error("No historical data available");
    }

    const timestamps = result.timestamp;
    const ohlcv = result.indicators?.quote?.[0] || {};

    const history = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split("T")[0],
        open: parseFloat((ohlcv.open?.[i] || 0).toFixed(2)),
        high: parseFloat((ohlcv.high?.[i] || 0).toFixed(2)),
        low: parseFloat((ohlcv.low?.[i] || 0).toFixed(2)),
        close: parseFloat((ohlcv.close?.[i] || 0).toFixed(2)),
        volume: ohlcv.volume?.[i] || 0,
      }))
      .filter((d) => d.close > 0);

    if (history.length < 35) {
      throw new Error(`Filtered history has too few data points (${history.length} items, need at least 35)`);
    }

    return { symbol: upperSymbol, range, history };
  } catch (error) {
    console.warn(`⚠️  Historical data failed for ${upperSymbol}: ${error.message}`);
    let historyDays = 90;
    if (range === "1mo") historyDays = 30;
    else if (range === "3mo") historyDays = 90;
    else if (range === "6mo") historyDays = 180;
    else if (range === "1y") historyDays = 365;
    else if (range === "2y") historyDays = 730;

    return { symbol: upperSymbol, range, history: generateSimulatedHistory(upperSymbol, historyDays) };
  }
}

/**
 * Simulated data fallback — realistic Indian stock prices (May 2026 approximate)
 */
const BASE_PRICES = {
  NIFTY50: 24500,
  BANKNIFTY: 52000,
  SENSEX: 80500,
  RELIANCE: 1435,
  TCS: 2394,
  INFY: 1179,
  HDFCBANK: 1780,
  ICICIBANK: 1245,
  SBIN: 812,
  WIPRO: 467,
  BAJFINANCE: 8950,
  HINDUNILVR: 2340,
  KOTAKBANK: 2150,
  LT: 3480,
  AXISBANK: 1185,
  ASIANPAINT: 2280,
  MARUTI: 11800,
  SUNPHARMA: 1847,
  TITAN: 3290,
  ULTRACEMCO: 11200,
  NESTLEIND: 2280,
  POWERGRID: 298,
  NTPC: 348,
  HCLTECH: 1620,
  TECHM: 1485,
  ONGC: 262,
  COALINDIA: 395,
  TATAMOTORS: 680,
  TATASTEEL: 152,
  JSWSTEEL: 1020,
  HINDALCO: 672,
  ADANIENT: 2380,
  ADANIPORTS: 1285,
  BAJAJFINSV: 1920,
  BAJAJ_AUTO: 8950,
  HEROMOTOCO: 4250,
  EICHERMOT: 5100,
  DRREDDY: 1285,
  CIPLA: 1520,
  DIVISLAB: 5850,
  APOLLOHOSP: 6780,
  BRITANNIA: 5120,
  ITC: 428,
  GRASIM: 2780,
  INDUSINDBK: 1320,
  MM: 2980,
  TATACONSUM: 1020,
  BPCL: 298,
  IOC: 142,
  SHRIRAMFIN: 3280,
  BEL: 298,
  TRENT: 5850,
  ZOMATO: 248,
  PAYTM: 890,
  NYKAA: 178,
  DMART: 4250,
  IRCTC: 785,
  RVNL: 398,
  RECLTD: 478,
  PFC: 452,
  TATAPOWER: 398,
  SUZLON: 58,
  ADANIGREEN: 1285,
  ADANIPOWER: 548,
  LICI: 985,
  HAL: 4250,
  COCHINSHIP: 1485,
  MAZAGON: 2850,
};

function getPrimarySymbol(symbol) {
  const upper = String(symbol || "").toUpperCase();
  const isBseNumeric = /^\d{6}$/.test(upper);
  const isBseExplicit = upper.endsWith(".BO");
  if (!isBseNumeric && !isBseExplicit) return upper;

  const cleanSymbol = upper.replace(/\.BO$/, "");
  const { NSE_SYMBOLS } = require("../data/nseSymbols");
  const companyName = NSE_SYMBOLS[cleanSymbol];
  if (!companyName) return upper;

  // Find the alphabetical NSE key that has the exact same company name
  const match = Object.entries(NSE_SYMBOLS).find(([key, val]) => {
    return val === companyName && !/^\d{6}$/.test(key) && !key.endsWith(".BO") && key !== "ETERNAL";
  });

  return match ? match[0] : upper;
}

function getSeededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

function generateSimulatedData(symbol) {
  const base = BASE_PRICES[symbol] || 1000;
  
  // Seed based on symbol and date (YYYY-MM-DD)
  const dateStr = new Date().toISOString().split("T")[0];
  const rand = getSeededRandom(symbol + "_" + dateStr);
  
  const changePercent = (rand - 0.48) * 4; // slight upward bias
  const change = parseFloat(((base * changePercent) / 100).toFixed(2));
  const currentPrice = parseFloat((base + change).toFixed(2));

  const isBseNumeric = /^\d{6}$/.test(symbol);
  const isBseExplicit = symbol.endsWith(".BO");
  const fallbackSymbol = INDIAN_STOCKS[symbol] || 
    (isBseNumeric ? `${symbol}.BO` : isBseExplicit ? symbol : `${symbol}.NS`);

  const { NSE_SYMBOLS } = require("../data/nseSymbols");
  let shortName = NSE_SYMBOLS[symbol] || symbol;
  if (isBseNumeric && shortName === symbol) {
    shortName = `${symbol} (BSE Stock)`;
  } else if (isBseExplicit && shortName === symbol) {
    const baseSym = symbol.slice(0, -3);
    shortName = NSE_SYMBOLS[baseSym] || `${baseSym} (BSE Stock)`;
  }

  const exchange = (isBseNumeric || isBseExplicit) ? "BSE" : "NSE";

  return {
    appSymbol: symbol,
    symbol: fallbackSymbol,
    shortName,
    currentPrice,
    previousClose: base,
    change,
    changePercent: parseFloat(changePercent.toFixed(2)),
    volume: Math.floor(rand * 5000000) + 500000,
    high: parseFloat((currentPrice * 1.015).toFixed(2)),
    low: parseFloat((currentPrice * 0.985).toFixed(2)),
    open: parseFloat((base * (1 + (rand - 0.5) * 0.01)).toFixed(2)),
    currency: "INR",
    exchange,
    marketState: "SIMULATED",
    timestamp: new Date().toISOString(),
  };
}

function generateSimulatedHistory(symbol, days = 90) {
  const base = BASE_PRICES[symbol] || 1000;
  const history = [];
  let price = base * 0.85;
  const dateStr = new Date().toISOString().split("T")[0];

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];
    
    // Seed based on symbol, historical day date, and today's date
    const rand = getSeededRandom(symbol + "_" + dateKey + "_" + dateStr);
    
    const dailyChange = (rand - 0.47) * 0.025;
    price = price * (1 + dailyChange);
    const open = price * (1 + (rand - 0.5) * 0.005);
    const high = Math.max(price, open) * (1 + rand * 0.01);
    const low = Math.min(price, open) * (1 - rand * 0.01);

    history.push({
      date: dateKey,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(price.toFixed(2)),
      volume: Math.floor(rand * 3000000) + 200000,
    });
  }
  return history;
}

module.exports = {
  getStockData,
  getMultipleStocks,
  getHistoricalData,
  generateSimulatedData,
  getPrimarySymbol,
  INDIAN_STOCKS,
  DEFAULT_SYMBOLS,
};
