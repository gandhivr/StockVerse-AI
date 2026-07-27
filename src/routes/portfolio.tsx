import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Brain,
  TrendingUp,
  TrendingDown,
  PieChart,
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  BarChart3,
  Info,
} from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Navbar } from "@/components/Navbar";
import { type Holding, type PortfolioAnalysis } from "@/lib/api";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio Analyzer — StockVerse AI" },
      {
        name: "description",
        content: "AI-powered portfolio analysis with risk scoring and diversification insights.",
      },
    ],
  }),
  component: PortfolioPage,
});

const SECTOR_OPTIONS = [
  "IT",
  "Banking",
  "Finance",
  "Energy",
  "Pharma",
  "Auto",
  "FMCG",
  "Infrastructure",
  "Consumer",
  "Utilities",
  "Cement",
  "Other",
];
const NEON_COLORS = [
  "oklch(0.88 0.27 150)",
  "oklch(0.78 0.2 230)",
  "oklch(0.85 0.25 320)",
  "oklch(0.8 0.2 60)",
  "oklch(0.75 0.2 25)",
  "oklch(0.82 0.18 280)",
  "oklch(0.78 0.22 190)",
];

const DEMO_HOLDINGS: Holding[] = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries",
    quantity: 10,
    buyPrice: 2600,
    sector: "Energy",
  },
  { symbol: "TCS", name: "Tata Consultancy Services", quantity: 5, buyPrice: 3700, sector: "IT" },
  { symbol: "HDFCBANK", name: "HDFC Bank", quantity: 20, buyPrice: 1550, sector: "Banking" },
  { symbol: "INFY", name: "Infosys", quantity: 15, buyPrice: 1600, sector: "IT" },
];

const FORM_FIELDS: {
  key: keyof Holding;
  label: string;
  placeholder: string;
  type: "text" | "number";
}[] = [
  { key: "symbol", label: "SYMBOL", placeholder: "RELIANCE", type: "text" },
  { key: "name", label: "COMPANY NAME", placeholder: "Reliance Industries", type: "text" },
  { key: "quantity", label: "QUANTITY", placeholder: "10", type: "number" },
  { key: "buyPrice", label: "BUY PRICE (â‚¹)", placeholder: "2600", type: "number" },
];

function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>(DEMO_HOLDINGS);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Holding>({
    symbol: "",
    name: "",
    quantity: 0,
    buyPrice: 0,
    sector: "IT",
  });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const addHolding = () => {
    if (!form.symbol || form.quantity <= 0 || form.buyPrice <= 0) {
      setError("Symbol, quantity, and buy price are required.");
      return;
    }
    setHoldings((prev) => [...prev, { ...form, symbol: form.symbol.toUpperCase() }]);
    setForm({ symbol: "", name: "", quantity: 0, buyPrice: 0, sector: "IT" });
    setShowForm(false);
    setError("");
    setAnalysis(null);
  };

  const removeHolding = (i: number) => {
    setHoldings((prev) => prev.filter((_, idx) => idx !== i));
    setAnalysis(null);
  };

  const analyze = async () => {
    if (holdings.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portfolio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setAnalysis(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const totalInvested = holdings.reduce((a, h) => a + h.quantity * h.buyPrice, 0);
  const bestPerformer = analysis?.holdings.reduce(
    (best, h) => (h.pnlPercent > best.pnlPercent ? h : best),
    analysis.holdings[0],
  );
  const worstPerformer = analysis?.holdings.reduce(
    (worst, h) => (h.pnlPercent < worst.pnlPercent ? h : worst),
    analysis.holdings[0],
  );
  const largestPosition = analysis?.holdings.reduce(
    (largest, h) => (h.weight > largest.weight ? h : largest),
    analysis.holdings[0],
  );

  const suggestionIcon = (type: string) => {
    if (type === "WARNING" || type === "ALERT")
      return <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />;
    if (type === "POSITIVE") return <CheckCircle className="h-4 w-4 text-bull shrink-0" />;
    return <Info className="h-4 w-4 text-neon-blue shrink-0" />;
  };

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 pt-28 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <span className="font-mono text-xs text-neon-green">// PORTFOLIO INTELLIGENCE</span>
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">
            <span className="gradient-text">Portfolio</span> Analyzer
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            AI-powered P&L analysis · Risk scoring · Diversification insights
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Holdings list */}
          <div className="lg:col-span-2 space-y-4">
            {/* Holdings table */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-neon-green" />
                  <span className="font-mono text-sm font-bold tracking-wider">MY HOLDINGS</span>
                  <span className="rounded-full bg-neon-green/10 px-2 py-0.5 font-mono text-[10px] text-neon-green">
                    {holdings.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowForm((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-neon-green/40 bg-neon-green/10 px-3 py-1.5 font-mono text-xs text-neon-green hover:bg-neon-green/20 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> ADD STOCK
                </button>
              </div>

              {/* Add form */}
              <AnimatePresence>
                {showForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-border/50 bg-background/30 px-6 py-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {FORM_FIELDS.map(({ key, label, placeholder, type }) => (
                        <div key={key}>
                          <label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                            {label}
                          </label>
                          <input
                            type={type}
                            placeholder={placeholder}
                            value={String(form[key] ?? "")}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                [key]:
                                  type === "number"
                                    ? parseFloat(e.target.value) || 0
                                    : e.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-neon-green/30 bg-background/50 px-3 py-2 font-mono text-sm outline-none focus:border-neon-green"
                          />
                        </div>
                      ))}
                      <div>
                        <label className="font-mono text-[10px] tracking-widest text-muted-foreground">
                          SECTOR
                        </label>
                        <select
                          value={form.sector}
                          onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-neon-green/30 bg-background/50 px-3 py-2 font-mono text-sm outline-none focus:border-neon-green"
                        >
                          {SECTOR_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {error && <p className="mt-2 font-mono text-xs text-bear">{error}</p>}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={addHolding}
                        className="rounded-lg bg-gradient-to-r from-neon-green to-neon-blue px-4 py-2 font-mono text-xs font-bold text-background hover:scale-105 transition-transform"
                      >
                        ADD HOLDING
                      </button>
                      <button
                        onClick={() => setShowForm(false)}
                        className="rounded-lg border border-border px-4 py-2 font-mono text-xs text-muted-foreground hover:border-neon-green/40 transition-colors"
                      >
                        CANCEL
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Holdings rows */}
              {holdings.length === 0 ? (
                <div className="py-12 text-center font-mono text-sm text-muted-foreground">
                  No holdings yet. Add stocks to analyze your portfolio.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-12 gap-2 border-b border-border/30 px-6 py-2 font-mono text-[9px] tracking-widest text-muted-foreground">
                    <div className="col-span-3">SYMBOL</div>
                    <div className="col-span-2 text-right">QTY</div>
                    <div className="col-span-2 text-right">BUY PRICE</div>
                    <div className="col-span-2 text-right">INVESTED</div>
                    <div className="col-span-2 text-right">SECTOR</div>
                    <div className="col-span-1" />
                  </div>
                  {holdings.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="grid grid-cols-12 gap-2 items-center border-b border-border/20 px-6 py-3 hover:bg-neon-green/5 transition-colors"
                    >
                      <div className="col-span-3">
                        <Link
                          to="/stocks/$symbol"
                          params={{ symbol: h.symbol }}
                          className="font-mono text-sm font-bold hover:text-neon-green transition-colors"
                        >
                          {h.symbol}
                        </Link>
                        <div className="font-mono text-[10px] text-muted-foreground truncate">
                          {h.name}
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-mono text-sm">{h.quantity}</div>
                      <div className="col-span-2 text-right font-mono text-sm">
                        ₹{h.buyPrice.toLocaleString("en-IN")}
                      </div>
                      <div className="col-span-2 text-right font-mono text-sm">
                        ₹{(h.quantity * h.buyPrice).toLocaleString("en-IN")}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="rounded-full border border-neon-blue/30 bg-neon-blue/5 px-2 py-0.5 font-mono text-[9px] text-neon-blue">
                          {h.sector}
                        </span>
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          onClick={() => removeHolding(i)}
                          className="text-muted-foreground hover:text-bear transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  <div className="flex items-center justify-between px-6 py-3 font-mono text-xs">
                    <span className="text-muted-foreground">
                      Total invested:{" "}
                      <span className="text-foreground font-bold">
                        ₹{totalInvested.toLocaleString("en-IN")}
                      </span>
                    </span>
                    <button
                      onClick={analyze}
                      disabled={loading}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-green to-neon-blue px-5 py-2.5 font-mono text-xs font-bold text-background transition-transform hover:scale-105 disabled:opacity-50"
                    >
                      {loading ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Brain className="h-3.5 w-3.5" />
                      )}
                      {loading ? "ANALYZING..." : "RUN AI ANALYSIS"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Analysis results */}
            <AnimatePresence>
              {analysis && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      {
                        label: "TOTAL VALUE",
                        value: `₹${analysis.summary.totalCurrentValue.toLocaleString("en-IN")}`,
                        color: "",
                      },
                      {
                        label: "TOTAL P&L",
                        value: `${analysis.summary.totalPnL >= 0 ? "+" : ""}₹${Math.abs(analysis.summary.totalPnL).toLocaleString("en-IN")}`,
                        color: analysis.summary.totalPnL >= 0 ? "text-bull" : "text-bear",
                      },
                      {
                        label: "RETURNS",
                        value: `${analysis.summary.totalPnLPercent >= 0 ? "+" : ""}${analysis.summary.totalPnLPercent.toFixed(2)}%`,
                        color: analysis.summary.totalPnLPercent >= 0 ? "text-bull" : "text-bear",
                      },
                      {
                        label: "RISK SCORE",
                        value: `${analysis.summary.riskScore}/10`,
                        color:
                          analysis.summary.riskScore > 6
                            ? "text-bear"
                            : analysis.summary.riskScore > 4
                              ? "text-yellow-400"
                              : "text-bull",
                      },
                    ].map((s) => (
                      <div key={s.label} className="glass rounded-xl p-4">
                        <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
                          {s.label}
                        </div>
                        <div className={`mt-1 font-mono text-lg font-bold ${s.color}`}>
                          {s.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {bestPerformer && worstPerformer && largestPosition && (
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        {
                          label: "BEST PERFORMER",
                          value: bestPerformer.symbol,
                          detail: `${bestPerformer.pnlPercent >= 0 ? "+" : ""}${bestPerformer.pnlPercent.toFixed(2)}%`,
                          color: bestPerformer.pnlPercent >= 0 ? "text-bull" : "text-bear",
                        },
                        {
                          label: "WEAKEST HOLDING",
                          value: worstPerformer.symbol,
                          detail: `${worstPerformer.pnlPercent >= 0 ? "+" : ""}${worstPerformer.pnlPercent.toFixed(2)}%`,
                          color: worstPerformer.pnlPercent >= 0 ? "text-bull" : "text-bear",
                        },
                        {
                          label: "LARGEST WEIGHT",
                          value: largestPosition.symbol,
                          detail: `${largestPosition.weight.toFixed(1)}% of portfolio`,
                          color: largestPosition.weight > 35 ? "text-yellow-400" : "text-neon-blue",
                        },
                      ].map((item) => (
                        <div key={item.label} className="glass rounded-xl p-4">
                          <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
                            {item.label}
                          </div>
                          <div className="mt-1 flex items-end justify-between gap-3">
                            <span className="font-mono text-lg font-bold">{item.value}</span>
                            <span className={`font-mono text-xs font-bold ${item.color}`}>
                              {item.detail}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Holdings analysis table */}
                  <div className="glass rounded-2xl overflow-hidden">
                    <div className="border-b border-border/50 px-6 py-4 font-mono text-sm font-bold tracking-wider">
                      HOLDINGS ANALYSIS
                    </div>
                    <div className="grid grid-cols-12 gap-2 border-b border-border/30 px-6 py-2 font-mono text-[9px] tracking-widest text-muted-foreground">
                      <div className="col-span-2">SYMBOL</div>
                      <div className="col-span-2 text-right">CUR. PRICE</div>
                      <div className="col-span-2 text-right">VALUE</div>
                      <div className="col-span-2 text-right">P&L</div>
                      <div className="col-span-2 text-right">P&L %</div>
                      <div className="col-span-2 text-right">WEIGHT</div>
                    </div>
                    {analysis.holdings.map((h, i) => (
                      <motion.div
                        key={h.symbol}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="grid grid-cols-12 gap-2 items-center border-b border-border/20 px-6 py-3 hover:bg-neon-green/5 transition-colors"
                      >
                        <div className="col-span-2 font-mono text-sm font-bold">{h.symbol}</div>
                        <div className="col-span-2 text-right font-mono text-xs">
                          ₹{h.currentPrice.toFixed(2)}
                        </div>
                        <div className="col-span-2 text-right font-mono text-xs">
                          ₹{h.currentValue.toLocaleString("en-IN")}
                        </div>
                        <div
                          className={`col-span-2 text-right font-mono text-xs font-bold ${h.pnl >= 0 ? "text-bull" : "text-bear"}`}
                        >
                          {h.pnl >= 0 ? "+" : ""}₹{Math.abs(h.pnl).toLocaleString("en-IN")}
                        </div>
                        <div
                          className={`col-span-2 text-right font-mono text-xs font-bold ${h.pnlPercent >= 0 ? "text-bull" : "text-bear"}`}
                        >
                          {h.pnlPercent >= 0 ? "+" : ""}
                          {h.pnlPercent.toFixed(2)}%
                        </div>
                        <div className="col-span-2 text-right font-mono text-xs text-muted-foreground">
                          {h.weight.toFixed(1)}%
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* AI Suggestions */}
                  {analysis.suggestions.length > 0 && (
                    <div className="glass rounded-2xl p-6">
                      <div className="mb-4 flex items-center gap-2">
                        <Brain className="h-4 w-4 text-neon-green" />
                        <span className="font-mono text-sm font-bold tracking-wider">
                          AI RECOMMENDATIONS
                        </span>
                      </div>
                      <div className="space-y-3">
                        {analysis.suggestions.map((s, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/30 p-3"
                          >
                            {suggestionIcon(s.type)}
                            <p className="font-mono text-xs leading-relaxed">{s.message}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Diversification score */}
            <div className="glass rounded-2xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-neon-green" />
                <span className="font-mono text-sm font-bold tracking-wider">DIVERSIFICATION</span>
              </div>
              {analysis ? (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative h-24 w-24">
                      <svg viewBox="0 0 100 100" className="w-full -rotate-90">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="oklch(0.2 0.04 260)"
                          strokeWidth="10"
                        />
                        <motion.circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="oklch(0.88 0.27 150)"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                          animate={{
                            strokeDashoffset:
                              2 * Math.PI * 40 * (1 - analysis.summary.diversificationScore / 100),
                          }}
                          transition={{ duration: 1 }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-mono text-2xl font-black text-neon-green">
                          {analysis.summary.diversificationScore}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground">/100</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs text-center">
                    <div className="rounded-lg bg-background/30 p-2">
                      <div className="text-muted-foreground text-[10px]">HOLDINGS</div>
                      <div className="font-bold">{analysis.summary.holdingsCount}</div>
                    </div>
                    <div className="rounded-lg bg-background/30 p-2">
                      <div className="text-muted-foreground text-[10px]">SECTORS</div>
                      <div className="font-bold">{analysis.summary.sectorsCount}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center font-mono text-xs text-muted-foreground">
                  Run analysis to see diversification score
                </div>
              )}
            </div>

            {/* Sector allocation pie */}
            {analysis && analysis.sectorAllocation.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <div className="mb-4 flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-neon-green" />
                  <span className="font-mono text-sm font-bold tracking-wider">
                    SECTOR ALLOCATION
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <RechartsPie>
                    <Pie
                      data={analysis.sectorAllocation}
                      dataKey="percent"
                      nameKey="sector"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                    >
                      {analysis.sectorAllocation.map((_, i) => (
                        <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.16 0.04 260 / 0.95)",
                        border: "1px solid oklch(0.88 0.27 150 / 0.3)",
                        borderRadius: 8,
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                      formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, ""]}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1">
                  {analysis.sectorAllocation.map((s, i) => (
                    <div
                      key={s.sector}
                      className="flex items-center justify-between font-mono text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: NEON_COLORS[i % NEON_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{s.sector}</span>
                      </div>
                      <span>{s.percent.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="glass rounded-2xl p-4 space-y-2">
              <div className="font-mono text-[10px] tracking-widest text-muted-foreground mb-3">
                QUICK LINKS
              </div>
              <Link
                to="/stocks"
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 font-mono text-xs text-muted-foreground hover:border-neon-green/40 hover:text-foreground transition-colors"
              >
                <BarChart3 className="h-3.5 w-3.5" /> Browse All Stocks
              </Link>
              <Link
                to="/dashboard"
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 font-mono text-xs text-muted-foreground hover:border-neon-green/40 hover:text-foreground transition-colors"
              >
                <Zap className="h-3.5 w-3.5" /> AI Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
