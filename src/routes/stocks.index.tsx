import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, RefreshCw, Star, StarOff, X,
  TrendingUp, TrendingDown, ArrowUpDown, Loader2,
} from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Navbar } from "@/components/Navbar";
import { StockTicker } from "@/components/StockTicker";
import type { StockQuote } from "@/lib/api";

export const Route = createFileRoute("/stocks/")({
  head: () => ({
    meta: [
      { title: "Stock Search — StockVerse AI" },
      { name: "description", content: "Search any Indian stock on NSE/BSE with live AI-powered insights." },
    ],
  }),
  component: StocksPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SYMBOLS = [
  "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN",
  "WIPRO", "BAJFINANCE", "HINDUNILVR", "KOTAKBANK", "LT", "AXISBANK",
  "ASIANPAINT", "MARUTI", "SUNPHARMA", "TITAN", "ULTRACEMCO",
  "NESTLEIND", "POWERGRID", "NTPC",
];

const SECTOR_MAP: Record<string, string> = {
  RELIANCE: "Energy", TCS: "IT", INFY: "IT", WIPRO: "IT",
  HDFCBANK: "Banking", ICICIBANK: "Banking", SBIN: "Banking",
  KOTAKBANK: "Banking", AXISBANK: "Banking",
  BAJFINANCE: "Finance", LT: "Infrastructure",
  HINDUNILVR: "FMCG", NESTLEIND: "FMCG",
  MARUTI: "Auto", TITAN: "Consumer",
  SUNPHARMA: "Pharma", ASIANPAINT: "Consumer",
  ULTRACEMCO: "Cement", POWERGRID: "Utilities", NTPC: "Utilities",
};

const SECTORS = ["All", "IT", "Banking", "Finance", "Energy", "Pharma", "Auto", "FMCG", "Infrastructure", "Consumer", "Utilities", "Cement"];

interface SearchSuggestion {
  appSymbol: string;
  yahooSymbol: string;
  shortName: string;
  exchange: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

function StocksPage() {
  const navigate = useNavigate();

  // Default dashboard stocks
  const [stocks, setStocks] = useState<StockQuote[]>([]);
  const [loadingDefault, setLoadingDefault] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [sector, setSector] = useState("All");
  const [sortBy, setSortBy] = useState<"change" | "price" | "volume">("change");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("watchlist") || "[]"); } catch { return []; }
  });
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);

  // ── Fetch default stocks ──────────────────────────────────────────────────
  const fetchStocks = useCallback(async (silent = false) => {
    if (!silent) setLoadingDefault(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/stocks?symbols=${DEFAULT_SYMBOLS.join(",")}`);
      const json = await res.json();
      setStocks(json.data || []);
    } catch { /* keep existing */ }
    finally { setLoadingDefault(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);
  useEffect(() => {
    const t = setInterval(() => fetchStocks(true), 60000); // poll every 60s
    return () => clearInterval(t);
  }, [fetchStocks]);

  // ── Search autocomplete ───────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(trimmed)}`);
        const json = await res.json();
        setSuggestions(json.data || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [query]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSuggestionClick = (sym: string) => {
    setShowSuggestions(false);
    setQuery("");
    navigate({ to: "/stocks/$symbol", params: { symbol: sym } });
  };

  // ── Watchlist ─────────────────────────────────────────────────────────────
  const toggleWatchlist = (symbol: string, e: React.MouseEvent) => {
    e.preventDefault();
    setWatchlist((prev) => {
      const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol];
      localStorage.setItem("watchlist", JSON.stringify(next));
      return next;
    });
  };

  // ── Filter + sort default stocks ──────────────────────────────────────────
  const filtered = stocks
    .filter((s) => {
      const sym = s.appSymbol || s.symbol?.replace(/\.(NS|BO)$/, "");
      const matchSector = sector === "All" || SECTOR_MAP[sym] === sector;
      const matchWatchlist = !showWatchlistOnly || watchlist.includes(sym);
      return matchSector && matchWatchlist;
    })
    .sort((a, b) => {
      const va = sortBy === "change" ? a.changePercent : sortBy === "price" ? a.currentPrice : a.volume;
      const vb = sortBy === "change" ? b.changePercent : sortBy === "price" ? b.currentPrice : b.volume;
      return sortDir === "desc" ? vb - va : va - vb;
    });

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const gainers = stocks.filter((s) => s.changePercent > 0).length;
  const losers = stocks.filter((s) => s.changePercent < 0).length;

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 pt-28 pb-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <span className="font-mono text-xs text-neon-green">// STOCK DISCOVERY</span>
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">
            <span className="gradient-text">Stock</span> Search
          </h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            Search any NSE/BSE listed stock · 2000+ Indian stocks · Live data
          </p>
        </motion.div>

        {/* Ticker */}
        <div className="mb-6 overflow-hidden rounded-xl">
          <StockTicker />
        </div>

        {/* ── SEARCH BAR ─────────────────────────────────────────────────── */}
        <div ref={searchRef} className="relative mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim() && setShowSuggestions(true)}
              placeholder="Search any Indian stock — RELIANCE, TATAMOTORS, ADANIENT, ZOMATO..."
              className="w-full rounded-2xl border border-neon-green/40 bg-background/60 pl-12 pr-12 py-4 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-neon-green focus:shadow-[0_0_20px_oklch(0.88_0.27_150/0.2)] transition-all"
            />
            {searchLoading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neon-green" />
            )}
            {query && !searchLoading && (
              <button onClick={() => { setQuery(""); setSuggestions([]); setShowSuggestions(false); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute z-50 mt-2 w-full rounded-2xl border border-neon-green/30 bg-background/95 backdrop-blur-xl shadow-[0_8px_40px_oklch(0.88_0.27_150/0.15)] overflow-hidden"
              >
                <div className="px-4 py-2 border-b border-border/30 font-mono text-[10px] text-muted-foreground tracking-widest">
                  {suggestions.length} RESULTS FOR "{query.toUpperCase()}"
                </div>
                {suggestions.map((s, i) => (
                  <motion.button
                    key={s.appSymbol}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => handleSuggestionClick(s.appSymbol)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-neon-green/10 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-green/10 font-mono text-[10px] font-bold text-neon-green">
                        {s.appSymbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-mono text-sm font-bold group-hover:text-neon-green transition-colors">
                          {s.appSymbol}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">{s.shortName}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-neon-blue/30 bg-neon-blue/5 px-2 py-0.5 font-mono text-[9px] text-neon-blue">
                        {s.exchange}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground group-hover:text-neon-green transition-colors">
                        VIEW →
                      </span>
                    </div>
                  </motion.button>
                ))}
                <div className="px-4 py-2 border-t border-border/30 font-mono text-[10px] text-muted-foreground">
                  Click any stock to see live price, chart & AI prediction
                </div>
              </motion.div>
            )}
            {showSuggestions && !searchLoading && suggestions.length === 0 && query.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute z-50 mt-2 w-full rounded-2xl border border-border/40 bg-background/95 backdrop-blur-xl p-6 text-center"
              >
                <div className="font-mono text-sm text-muted-foreground">
                  No results for "<span className="text-foreground">{query}</span>"
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                  Try the exact NSE symbol — e.g. ZOMATO, PAYTM, NYKAA
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Market summary */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 glass rounded-xl p-4 grid grid-cols-2 gap-4 md:grid-cols-4 font-mono text-sm">
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">ADVANCING</div>
            <div className="text-xl font-bold text-bull">{gainers}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">DECLINING</div>
            <div className="text-xl font-bold text-bear">{losers}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">UNCHANGED</div>
            <div className="text-xl font-bold">{stocks.length - gainers - losers}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">WATCHLIST</div>
            <div className="text-xl font-bold text-neon-blue">{watchlist.length}</div>
          </div>
        </motion.div>

        {/* Filters row */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Watchlist toggle */}
          <button
            onClick={() => setShowWatchlistOnly((v) => !v)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-xs transition-colors ${
              showWatchlistOnly ? "border-neon-blue bg-neon-blue/10 text-neon-blue" : "border-border text-muted-foreground hover:border-neon-blue/50"
            }`}
          >
            <Star className="h-3.5 w-3.5" /> WATCHLIST
          </button>

          {/* Sort buttons */}
          {(["change", "price", "volume"] as const).map((col) => (
            <button
              key={col}
              onClick={() => toggleSort(col)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-xs transition-colors ${
                sortBy === col ? "border-neon-green bg-neon-green/10 text-neon-green" : "border-border text-muted-foreground hover:border-neon-green/40"
              }`}
            >
              <ArrowUpDown className="h-3 w-3" />
              {col.toUpperCase()} {sortBy === col ? (sortDir === "desc" ? "↓" : "↑") : ""}
            </button>
          ))}

          <button
            onClick={() => fetchStocks(true)}
            disabled={refreshing}
            className="ml-auto flex items-center gap-2 rounded-xl border border-border px-4 py-2 font-mono text-xs text-muted-foreground hover:border-neon-green/50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> REFRESH
          </button>
        </div>

        {/* Sector pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          {SECTORS.map((s) => (
            <button
              key={s}
              onClick={() => setSector(s)}
              className={`rounded-full border px-3 py-1 font-mono text-[10px] transition-colors ${
                sector === s ? "border-neon-green bg-neon-green/10 text-neon-green" : "border-border text-muted-foreground hover:border-neon-green/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ── STOCKS TABLE ──────────────────────────────────────────────── */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 border-b border-border/50 px-4 py-3 font-mono text-[10px] tracking-widest text-muted-foreground">
            <div className="col-span-1" />
            <div className="col-span-3">SYMBOL</div>
            <div className="col-span-2 text-right">PRICE</div>
            <div className="col-span-2 text-right">CHANGE</div>
            <div className="col-span-2 text-right hidden md:block">VOLUME</div>
            <div className="col-span-2 text-right hidden md:block">SECTOR</div>
          </div>

          {loadingDefault ? (
            <div className="flex items-center justify-center py-20 font-mono text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-neon-green" /> Fetching live market data...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center font-mono text-sm text-muted-foreground">
              No stocks match your filters.
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((stock, i) => {
                const sym = stock.appSymbol || stock.symbol?.replace(/\.(NS|BO)$/, "");
                const isUp = stock.changePercent >= 0;
                const inWL = watchlist.includes(sym);
                return (
                  <motion.div
                    key={sym}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="group grid grid-cols-12 gap-2 items-center border-b border-border/20 px-4 py-3 hover:bg-neon-green/5 transition-colors"
                  >
                    <div className="col-span-1">
                      <button onClick={(e) => toggleWatchlist(sym, e)} className="text-muted-foreground hover:text-neon-blue transition-colors">
                        {inWL
                          ? <Star className="h-3.5 w-3.5 fill-neon-blue text-neon-blue" />
                          : <StarOff className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" />}
                      </button>
                    </div>
                    <Link to="/stocks/$symbol" params={{ symbol: sym }} className="col-span-3">
                      <div className="font-mono text-sm font-bold hover:text-neon-green transition-colors">{sym}</div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">{stock.shortName || sym}</div>
                    </Link>
                    <div className="col-span-2 text-right font-mono text-sm font-bold">
                      ₹{stock.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`col-span-2 text-right font-mono text-sm font-bold ${isUp ? "text-bull" : "text-bear"}`}>
                      <div>{isUp ? "▲" : "▼"} {Math.abs(stock.changePercent).toFixed(2)}%</div>
                      <div className="text-[10px] font-normal">{isUp ? "+" : ""}{stock.change.toFixed(2)}</div>
                    </div>
                    <div className="col-span-2 text-right font-mono text-xs text-muted-foreground hidden md:block">
                      {stock.volume > 1_000_000 ? `${(stock.volume / 1_000_000).toFixed(1)}M`
                        : stock.volume > 1_000 ? `${(stock.volume / 1_000).toFixed(0)}K`
                        : stock.volume}
                    </div>
                    <div className="col-span-2 text-right hidden md:block">
                      <span className="rounded-full border border-neon-blue/30 bg-neon-blue/5 px-2 py-0.5 font-mono text-[9px] text-neon-blue">
                        {SECTOR_MAP[sym] || "Other"}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <div className="mt-4 font-mono text-[10px] text-muted-foreground text-center">
          Showing {filtered.length} default stocks · Search above to find any of 2000+ NSE/BSE stocks · Auto-refreshes every 30s
        </div>
      </div>
    </div>
  );
}
