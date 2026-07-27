import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowUpDown,
  Brain,
  Shield,
  TrendingUp,
  DollarSign,
  Info,
  RefreshCw,
  Award,
  ChevronRight,
  TrendingDown
} from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Navbar } from "@/components/Navbar";
import { useBeginnerMode } from "@/hooks/useBeginnerMode";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Stock Comparison — StockVerse AI" },
      { name: "description", content: "Compare any two Indian stocks side-by-side with AI metrics." },
    ],
  }),
  component: ComparePage,
});

const COMPARE_STOCKS = [
  { symbol: "RELIANCE", name: "Reliance Industries" },
  { symbol: "TCS", name: "Tata Consultancy Services" },
  { symbol: "INFY", name: "Infosys" },
  { symbol: "HDFCBANK", name: "HDFC Bank" },
  { symbol: "ICICIBANK", name: "ICICI Bank" },
  { symbol: "SBIN", name: "State Bank of India" },
  { symbol: "WIPRO", name: "Wipro" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever" },
  { symbol: "LT", name: "Larsen & Toubro" },
  { symbol: "ITC", name: "ITC Limited" },
  { symbol: "TATAMOTORS", name: "Tata Motors" },
  { symbol: "ZOMATO", name: "Zomato" },
];

interface ComparisonResult {
  stock1: {
    symbol: string;
    companyName: string;
    price: number;
    changePercent: number;
    metrics: {
      marketCap: number | null;
      dividendYield: number | null;
      revenueGrowth: number | null;
      debtToEquity: number | null;
    };
  };
  stock2: {
    symbol: string;
    companyName: string;
    price: number;
    changePercent: number;
    metrics: {
      marketCap: number | null;
      dividendYield: number | null;
      revenueGrowth: number | null;
      debtToEquity: number | null;
    };
  };
  comparison: {
    safetyComparison: string;
    growthComparison: string;
    dividendComparison: string;
    verdict: string;
  };
}

function ComparePage() {
  const navigate = useNavigate();
  const [isBeginner] = useBeginnerMode();

  const [symbol1, setSymbol1] = useState("TCS");
  const [symbol2, setSymbol2] = useState("INFY");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (symbol1 === symbol2) {
      setError("Please choose two different stocks to compare.");
      return;
    }
    setError(null);
    setLoading(true);
    setLoadingText("Fetching real-time stock quotes...");

    const steps = [
      "Gathering balance sheets...",
      "Reading dividend track records...",
      "Running AI comparison prompts...",
      "Finalizing side-by-side cards..."
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setLoadingText(steps[currentStep]);
        currentStep++;
      } else {
        clearInterval(interval);
      }
    }, 700);

    try {
      const res = await fetch("/api/recommendations/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol1, symbol2 }),
      });
      const json = await res.json();
      
      clearInterval(interval);

      if (json.success && json.data) {
        setResult(json.data);
      } else {
        setError(json.message || "Failed to compare selected stocks.");
      }
    } catch {
      clearInterval(interval);
      setError("Unable to connect to the comparison engine.");
    } finally {
      setLoading(false);
    }
  };

  // Run initial comparison when mounting
  useEffect(() => {
    handleCompare();
  }, []);

  const fmtCr = (n: number | null) => {
    if (n == null) return "N/A";
    if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(1)} Cr`;
    return `₹${n.toLocaleString("en-IN")}`;
  };

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Navbar />

      <div className="mx-auto max-w-5xl px-4 pt-28 pb-16">
        
        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <span className="font-mono text-xs text-neon-green">// DYNAMIC HEAD-TO-HEAD</span>
          <h1 className="text-4xl font-black mt-1">
            Stock <span className="gradient-text">Comparison</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Compare any two stocks side-by-side in simplified cards (Beginner) or technical sheets (Pro).
          </p>
        </div>

        {/* Stock Selectors Panel */}
        <div className="glass rounded-2xl p-6 border border-border/40 mb-8 grid gap-4 sm:grid-cols-3 items-end">
          <div className="space-y-2">
            <label className="font-mono text-[10px] text-muted-foreground tracking-widest">STOCK 1</label>
            <select
              value={symbol1}
              onChange={(e) => setSymbol1(e.target.value)}
              className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 font-mono text-xs text-foreground outline-none focus:border-neon-blue"
            >
              {COMPARE_STOCKS.map((s) => (
                <option key={s.symbol} value={s.symbol} disabled={s.symbol === symbol2}>
                  {s.symbol} ({s.name})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center pb-2 hidden sm:flex text-muted-foreground">
            <ArrowUpDown className="h-5 w-5 rotate-90" />
          </div>

          <div className="space-y-2">
            <label className="font-mono text-[10px] text-muted-foreground tracking-widest">STOCK 2</label>
            <select
              value={symbol2}
              onChange={(e) => setSymbol2(e.target.value)}
              className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 font-mono text-xs text-foreground outline-none focus:border-neon-blue"
            >
              {COMPARE_STOCKS.map((s) => (
                <option key={s.symbol} value={s.symbol} disabled={s.symbol === symbol1}>
                  {s.symbol} ({s.name})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCompare}
            disabled={loading}
            className="sm:col-span-3 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-green to-neon-blue py-3.5 font-mono text-xs font-bold text-background transition-transform hover:scale-[1.01]"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            {loading ? "COMPARING..." : "RUN HEAD-TO-HEAD COMPARISON"}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-bear/30 bg-bear/5 p-4 text-xs text-bear text-center">
            ⚠️ {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="glass rounded-3xl border border-border/40 p-16 text-center shadow-2xl flex flex-col items-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="h-10 w-10 rounded-full border-2 border-neon-blue/20 border-t-neon-blue mb-4"
            />
            <h3 className="font-mono text-sm font-bold text-foreground">Analyzing stock profiles...</h3>
            <p className="font-mono text-[11px] text-muted-foreground mt-2">{loadingText}</p>
          </div>
        )}

        {/* Comparison Result Section */}
        <AnimatePresence mode="wait">
          {result && !loading && (
            <motion.div
              key={`${result.stock1.symbol}-${result.stock2.symbol}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              
              {/* Core summary card */}
              <div className="glass rounded-3xl border border-neon-blue/30 bg-neon-blue/5 p-6 flex items-start gap-4 shadow-lg">
                <Award className="h-8 w-8 text-neon-blue shrink-0 mt-1" />
                <div>
                  <div className="font-mono text-[10px] font-bold text-neon-blue tracking-widest mb-1">
                    AI COMPARISON VERDICT
                  </div>
                  <p className="text-sm font-bold text-foreground leading-relaxed">
                    {result.comparison.verdict}
                  </p>
                </div>
              </div>

              {/* Dynamic Comparison rendering */}
              {isBeginner ? (
                /* BEGINNER MODE VIEW */
                <div className="grid gap-6">
                  
                  {/* Stock Header Cards */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[result.stock1, result.stock2].map((st) => {
                      const isUp = st.changePercent >= 0;
                      return (
                        <div key={st.symbol} className="glass rounded-2xl p-5 border border-border/30">
                          <h3 className="text-xl font-bold flex items-baseline gap-2">
                            <span className="text-foreground">{st.companyName}</span>
                            <span className="font-mono text-xs text-muted-foreground">({st.symbol})</span>
                          </h3>
                          <div className="mt-1 flex items-baseline gap-2 font-mono">
                            <span className="text-base font-bold">₹{st.price.toFixed(2)}</span>
                            <span className={`text-xs ${isUp ? "text-bull" : "text-bear"}`}>
                              {isUp ? "▲" : "▼"} {Math.abs(st.changePercent).toFixed(2)}%
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              navigate({ to: "/stocks/$symbol", params: { symbol: st.symbol } });
                            }}
                            className="mt-4 flex items-center gap-1 font-mono text-[10px] text-neon-green hover:underline cursor-pointer"
                          >
                            View Simple Analytics <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Beginner Comparison Cards */}
                  {[
                    {
                      label: "🛡️ BALANCE SHEET SECURITY",
                      desc: result.comparison.safetyComparison,
                      color: "border-emerald-400/20 bg-emerald-400/5 text-emerald-400"
                    },
                    {
                      label: "🚀 SALES GROWTH & EXPANSION",
                      desc: result.comparison.growthComparison,
                      color: "border-neon-blue/20 bg-neon-blue/5 text-neon-blue"
                    },
                    {
                      label: "💰 PROFIT SHARING (DIVIDENDS)",
                      desc: result.comparison.dividendComparison,
                      color: "border-purple-400/20 bg-purple-400/5 text-purple-400"
                    }
                  ].map((card, i) => (
                    <motion.div
                      key={card.label}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`glass rounded-2xl border p-5 ${card.color.split(" ")[0]} ${card.color.split(" ")[1]}`}
                    >
                      <div className={`font-mono text-[10px] font-bold tracking-widest ${card.color.split(" ")[2]} mb-1.5`}>
                        {card.label}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                        {card.desc}
                      </p>
                    </motion.div>
                  ))}
                  
                </div>
              ) : (
                /* PRO MODE VIEW (METRICS SHEET) */
                <div className="glass rounded-2xl overflow-hidden border border-border/40">
                  <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-background/50 px-6 py-4 font-mono text-[10px] font-bold tracking-widest text-muted-foreground">
                    <div className="col-span-4">KEY METRIC</div>
                    <div className="col-span-4 text-center font-bold text-foreground">
                      {result.stock1.companyName} ({result.stock1.symbol})
                    </div>
                    <div className="col-span-4 text-center font-bold text-foreground">
                      {result.stock2.companyName} ({result.stock2.symbol})
                    </div>
                  </div>

                  <div className="divide-y divide-border/20">
                    {[
                      {
                        label: "Current Price",
                        v1: `₹${result.stock1.price.toFixed(2)}`,
                        v2: `₹${result.stock2.price.toFixed(2)}`,
                        comp: result.stock1.price > result.stock2.price
                      },
                      {
                        label: "Daily Change",
                        v1: `${result.stock1.changePercent >= 0 ? "+" : ""}${result.stock1.changePercent.toFixed(2)}%`,
                        v2: `${result.stock2.changePercent >= 0 ? "+" : ""}${result.stock2.changePercent.toFixed(2)}%`,
                        comp: result.stock1.changePercent > result.stock2.changePercent
                      },
                      {
                        label: "Market Cap",
                        v1: fmtCr(result.stock1.metrics.marketCap),
                        v2: fmtCr(result.stock2.metrics.marketCap),
                        comp: (result.stock1.metrics.marketCap || 0) > (result.stock2.metrics.marketCap || 0)
                      },
                      {
                        label: "Dividend Yield",
                        v1: result.stock1.metrics.dividendYield ? `${result.stock1.metrics.dividendYield.toFixed(2)}%` : "0.00%",
                        v2: result.stock2.metrics.dividendYield ? `${result.stock2.metrics.dividendYield.toFixed(2)}%` : "0.00%",
                        comp: (result.stock1.metrics.dividendYield || 0) > (result.stock2.metrics.dividendYield || 0)
                      },
                      {
                        label: "Revenue Growth YoY",
                        v1: result.stock1.metrics.revenueGrowth ? `${result.stock1.metrics.revenueGrowth.toFixed(2)}%` : "N/A",
                        v2: result.stock2.metrics.revenueGrowth ? `${result.stock2.metrics.revenueGrowth.toFixed(2)}%` : "N/A",
                        comp: (result.stock1.metrics.revenueGrowth || 0) > (result.stock2.metrics.revenueGrowth || 0)
                      },
                      {
                        label: "Debt to Equity",
                        v1: result.stock1.metrics.debtToEquity != null ? result.stock1.metrics.debtToEquity.toFixed(2) : "N/A",
                        v2: result.stock2.metrics.debtToEquity != null ? result.stock2.metrics.debtToEquity.toFixed(2) : "N/A",
                        // lower debt is better
                        comp: (result.stock1.metrics.debtToEquity || 999) < (result.stock2.metrics.debtToEquity || 999)
                      }
                    ].map((row, index) => (
                      <div
                        key={row.label}
                        className={`grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-background/20 transition-colors font-mono text-xs`}
                      >
                        <div className="col-span-4 font-bold text-muted-foreground">{row.label}</div>
                        <div className={`col-span-4 text-center ${row.comp ? "text-neon-green font-bold" : "text-foreground"}`}>
                          {row.v1}
                        </div>
                        <div className={`col-span-4 text-center ${!row.comp ? "text-neon-green font-bold" : "text-foreground"}`}>
                          {row.v2}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
