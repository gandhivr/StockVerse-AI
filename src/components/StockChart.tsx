import { useState, useEffect, useCallback, useRef } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { RefreshCw, Search, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

// Quick-access pinned symbols
const PINNED = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN", "WIPRO"];

interface ChartPoint { date: string; price: number; sma?: number; }
interface Quote { price: number; change: number; changePercent: number; name: string; }
interface Suggestion { appSymbol: string; shortName: string; }

export function StockChart() {
  const [selected, setSelected] = useState("RELIANCE");
  const [range, setRange] = useState("3mo");
  const [data, setData] = useState<ChartPoint[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Fetch chart data ──────────────────────────────────────────────────────
  const fetchChart = useCallback(async () => {
    setLoading(true);
    try {
      const [histRes, quoteRes] = await Promise.all([
        fetch(`/api/stocks/${selected}/history?range=${range}`),
        fetch(`/api/stocks/${selected}`),
      ]);
      const histJson = await histRes.json();
      const quoteJson = await quoteRes.json();
      const history = histJson.data?.history || [];
      const q = quoteJson.data;
      if (q) setQuote({ price: q.currentPrice, change: q.change, changePercent: q.changePercent, name: q.shortName || selected });
      if (history.length) {
        setData(history.map((d: any, i: number) => {
          const slice = history.slice(Math.max(0, i - 19), i + 1);
          const sma = slice.reduce((a: number, b: any) => a + b.close, 0) / slice.length;
          return { date: d.date.slice(5), price: d.close, sma: parseFloat(sma.toFixed(2)) };
        }));
      }
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  }, [selected, range]);

  useEffect(() => { fetchChart(); }, [fetchChart]);

  // ── Search autocomplete ───────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQuery.trim();
    if (!q) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setSuggestions((json.data || []).slice(0, 8));
        setShowSuggestions(true);
      } catch { setSuggestions([]); }
      finally { setSearchLoading(false); }
    }, 280);
  }, [searchQuery]);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selectSymbol = (sym: string) => {
    setSelected(sym.toUpperCase());
    setSearchQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setQuote(null);
    setData([]);
  };

  const isUp = (quote?.changePercent ?? 0) >= 0;

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Search any stock */}
          <div ref={searchRef} className="relative mb-3">
            <div className="flex items-center gap-2 rounded-xl border border-neon-green/30 bg-background/50 px-3 py-2 focus-within:border-neon-green transition-colors">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
                placeholder="Search any NSE stock — ZOMATO, PAYTM, ADANIENT..."
                className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
              />
              {searchLoading && <RefreshCw className="h-3 w-3 animate-spin text-neon-green shrink-0" />}
              {searchQuery && !searchLoading && (
                <button onClick={() => { setSearchQuery(""); setShowSuggestions(false); }}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-xl border border-neon-green/20 bg-background/98 backdrop-blur-xl shadow-xl overflow-hidden">
                {suggestions.map(s => (
                  <button key={s.appSymbol} onClick={() => selectSymbol(s.appSymbol)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-neon-green/10 transition-colors text-left">
                    <div>
                      <div className="font-mono text-sm font-bold">{s.appSymbol}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{s.shortName}</div>
                    </div>
                    <span className="font-mono text-[10px] text-neon-green">VIEW →</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pinned quick-access */}
          <div className="flex flex-wrap gap-1 mb-2">
            {PINNED.map(s => (
              <button key={s} onClick={() => selectSymbol(s)}
                className={`rounded-md border px-2 py-1 font-mono text-[10px] transition-colors ${selected === s ? "border-neon-green bg-neon-green/10 text-neon-green" : "border-border text-muted-foreground hover:border-neon-green/40"}`}>
                {s}
              </button>
            ))}
          </div>

          {/* Current stock info */}
          <Link to="/stocks/$symbol" params={{ symbol: selected }}>
            <h3 className="font-mono text-sm font-bold tracking-wider text-muted-foreground hover:text-neon-green transition-colors">
              {selected}.NS ↗
            </h3>
          </Link>
          {quote ? (
            <div className="flex items-baseline gap-3 mt-0.5">
              <span className="font-mono text-3xl font-bold gradient-text">
                ₹{quote.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <span className={`font-mono text-sm font-bold ${isUp ? "text-bull" : "text-bear"}`}>
                {isUp ? "▲" : "▼"} {isUp ? "+" : ""}{quote.changePercent.toFixed(2)}%
              </span>
              {quote.name && <span className="font-mono text-xs text-muted-foreground hidden sm:block">{quote.name}</span>}
            </div>
          ) : (
            <div className="mt-1 h-9 w-48 rounded bg-background/40 animate-pulse" />
          )}
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-2 shrink-0">
          {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <div className="flex gap-1 font-mono text-[10px]">
            {["1mo", "3mo", "6mo", "1y"].map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`rounded-md border px-2 py-1 transition-colors ${range === r ? "border-neon-green text-neon-green bg-neon-green/10" : "border-border text-muted-foreground hover:border-neon-green/40"}`}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {data.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.88 0.27 150)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.88 0.27 150)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.85 0.25 150 / 0.08)" />
              <XAxis dataKey="date" tick={{ fill: "oklch(0.7 0.05 220)", fontSize: 9 }} stroke="oklch(0.85 0.25 150 / 0.2)" interval="preserveStartEnd" />
              <YAxis tick={{ fill: "oklch(0.7 0.05 220)", fontSize: 9 }} stroke="oklch(0.85 0.25 150 / 0.2)" domain={["auto", "auto"]}
                width={65} tickFormatter={v => `₹${Number(v).toLocaleString("en-IN")}`} />
              <Tooltip
                contentStyle={{ background: "oklch(0.16 0.04 260 / 0.95)", border: "1px solid oklch(0.88 0.27 150 / 0.4)", borderRadius: 8, fontFamily: "monospace", fontSize: 11 }}
                formatter={(v: any, name: any) => [`₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, name === "price" ? "Price" : "SMA 20"]}
              />
              <Area type="monotone" dataKey="price" stroke="oklch(0.88 0.27 150)" strokeWidth={2} fill="url(#chartGrad)" dot={false} name="price" />
              <Line type="monotone" dataKey="sma" stroke="oklch(0.78 0.2 230)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="sma" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-4 font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-neon-green/70" /> Price</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ borderTop: "2px dashed oklch(0.78 0.2 230)" }} /> SMA 20</span>
            </div>
            <Link to="/stocks/$symbol" params={{ symbol: selected }}
              className="font-mono text-[10px] text-neon-green hover:underline">
              Full Analysis + AI Forecast →
            </Link>
          </div>
        </>
      ) : (
        <div className="flex h-64 items-center justify-center gap-3 font-mono text-sm text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin text-neon-green" />
          Loading {selected} chart...
        </div>
      )}
    </div>
  );
}
