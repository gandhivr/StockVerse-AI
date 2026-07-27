const { getStockData, getMultipleStocks, getHistoricalData, DEFAULT_SYMBOLS } = require("../services/stockService");

/**
 * GET /api/stocks/search?q=RELIANCE
 * Search any Indian stock — fuzzy match against 550+ NSE symbols
 * Works offline, instant response, no external API needed
 */
exports.searchStocks = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return res.status(400).json({ success: false, message: "q query param required" });
    }

    const { NSE_SYMBOLS } = require("../data/nseSymbols");
    const query = q.trim().toUpperCase();
    const queryLower = query.toLowerCase();

    const INDEX_SYMBOLS = ["NIFTY50","BANKNIFTY","SENSEX","NIFTYMIDCAP","NIFTYIT","NIFTYPHARMA","NIFTYAUTO","NIFTYFMCG","NIFTYMETAL","NIFTYREALTY","NIFTYENERGY","NIFTYINFRA","NIFTYPSE","NIFTYSMALLCAP","NIFTYMIDCAP150"];

    // Score each match: exact symbol = 100, starts with = 80, symbol contains = 60, name starts with = 40, name contains = 20
    const scored = Object.entries(NSE_SYMBOLS)
      .map(([symbol, name]) => {
        const nameLower = name.toLowerCase();
        let score = 0;
        if (symbol === query) score = 100;
        else if (symbol.startsWith(query)) score = 80;
        else if (symbol.includes(query)) score = 60;
        else if (nameLower.startsWith(queryLower)) score = 40;
        else if (nameLower.includes(queryLower)) score = 20;
        return { symbol, name, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 25)
      .map(({ symbol, name }) => {
        const isBseNumeric = /^\d{6}$/.test(symbol);
        const isBseExplicit = symbol.endsWith(".BO");
        const yahooSymbol = INDEX_SYMBOLS.includes(symbol)
          ? symbol
          : (isBseNumeric ? `${symbol}.BO` : isBseExplicit ? symbol : `${symbol}.NS`);
        const exchange = INDEX_SYMBOLS.includes(symbol)
          ? "NSE Index"
          : (isBseNumeric || isBseExplicit ? "BSE" : "NSE");
        return {
          appSymbol: symbol,
          yahooSymbol,
          shortName: name,
          exchange,
          type: INDEX_SYMBOLS.includes(symbol) ? "INDEX" : "EQUITY",
        };
      });

    // Check if the query itself is a valid ticker candidate and not already matched in the suggestions
    const isBseNumericQuery = /^\d{6}$/.test(query);
    const isBseExplicitQuery = query.endsWith(".BO");
    const isNseExplicitQuery = query.endsWith(".NS");
    const isAlphaQuery = /^[A-Z]{2,12}$/.test(query);

    const isTickerCandidate = isBseNumericQuery || isBseExplicitQuery || isNseExplicitQuery || isAlphaQuery;
    
    if (isTickerCandidate) {
      // Clean symbol name (remove suffix)
      const cleanQuery = query.replace(/\.(NS|BO)$/, "");
      const alreadyHasMatch = scored.some(item => item.appSymbol === cleanQuery);
      
      if (!alreadyHasMatch) {
        const yahooSymbol = INDEX_SYMBOLS.includes(query)
          ? query
          : (isBseNumericQuery || isBseExplicitQuery ? (isBseExplicitQuery ? query : `${query}.BO`) : (isNseExplicitQuery ? query : `${query}.NS`));
        
        const exchange = INDEX_SYMBOLS.includes(query)
          ? "NSE Index"
          : (isBseNumericQuery || isBseExplicitQuery ? "BSE" : "NSE");
          
        const directMatch = {
          appSymbol: cleanQuery,
          yahooSymbol,
          shortName: `${cleanQuery} (Direct AI Lookup)`,
          exchange,
          type: INDEX_SYMBOLS.includes(query) ? "INDEX" : "EQUITY"
        };
        
        // Prepend it to the scored list
        scored.unshift(directMatch);
      }
    }

    res.json({ success: true, count: scored.length, data: scored });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stocks
 * Returns live data for all default Indian stocks
 */
exports.getAllStocks = async (req, res, next) => {
  try {
    const symbols = req.query.symbols
      ? req.query.symbols.split(",").map((s) => s.trim().toUpperCase())
      : DEFAULT_SYMBOLS;

    const stocks = await getMultipleStocks(symbols);

    res.json({
      success: true,
      count: stocks.length,
      data: stocks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stocks/:symbol
 * Returns live data for a single stock
 */
exports.getStock = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const data = await getStockData(symbol.toUpperCase());

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stocks/:symbol/history
 * Returns historical OHLCV data
 */
exports.getStockHistory = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const range = req.query.range || "3mo";

    const validRanges = ["1mo", "3mo", "6mo", "1y", "2y"];
    if (!validRanges.includes(range)) {
      return res.status(400).json({ success: false, message: `Invalid range. Use: ${validRanges.join(", ")}` });
    }

    const data = await getHistoricalData(symbol.toUpperCase(), range);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
