/**
 * FundamentalAnalysis — AI-powered fundamental analysis panel
 * Displays financial strength, growth, valuation, risks, and investment signal.
 */
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  BookOpen,
  ShieldCheck,
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  Activity,
  Users,
} from "lucide-react";
import { api, type FundamentalAnalysisResult, type FundamentalMetrics } from "@/lib/api";
import { useBeginnerMode } from "@/hooks/useBeginnerMode";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCr(n: number | null) {
  if (n == null) return "N/A";
  if (Math.abs(n) >= 1e12) return `₹${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `₹${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtPct(n: number | null) {
  return n != null ? `${n.toFixed(2)}%` : "N/A";
}

function fmtNum(n: number | null, decimals = 2) {
  return n != null ? n.toFixed(decimals) : "N/A";
}

function scoreColor(score: number) {
  if (score >= 81) return "text-emerald-400";
  if (score >= 61) return "text-bull";
  if (score >= 41) return "text-yellow-400";
  return "text-bear";
}

function scoreLabel(score: number) {
  if (score >= 81) return "Excellent";
  if (score >= 61) return "Strong";
  if (score >= 41) return "Average";
  return "Weak";
}

function scoreBg(score: number) {
  if (score >= 81) return "bg-emerald-400";
  if (score >= 61) return "bg-bull";
  if (score >= 41) return "bg-yellow-400";
  return "bg-bear";
}

// ─── Metric Row ───────────────────────────────────────────────────────────────

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 py-2 last:border-0">
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[11px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  color = "text-neon-blue",
  children,
}: {
  icon: React.ElementType;
  title: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/30 p-4">
      <div className={`mb-3 flex items-center gap-2 font-mono text-[11px] font-bold tracking-wider ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Metrics Grid ─────────────────────────────────────────────────────────────

function MetricsGrid({ metrics }: { metrics: FundamentalMetrics }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <SectionCard icon={DollarSign} title="VALUATION" color="text-neon-blue">
        <MetricRow label="Market Cap" value={fmtCr(metrics.marketCap)} />
        <MetricRow label="P/E Ratio" value={fmtNum(metrics.peRatio)} />
        <MetricRow label="P/B Ratio" value={fmtNum(metrics.pbRatio)} />
        <MetricRow label="EV/EBITDA" value={fmtNum(metrics.evToEbitda)} />
        <MetricRow label="EPS" value={fmtNum(metrics.eps)} />
        <MetricRow label="Dividend Yield" value={fmtPct(metrics.dividendYield)} />
      </SectionCard>

      <SectionCard icon={Activity} title="PROFITABILITY" color="text-bull">
        <MetricRow label="ROE" value={fmtPct(metrics.roe)} />
        <MetricRow label="ROCE" value={metrics.roce != null ? fmtPct(metrics.roce) : "N/A"} />
        <MetricRow label="Profit Margins" value={fmtPct(metrics.profitMargins)} />
        <MetricRow label="Gross Margins" value={fmtPct(metrics.grossMargins)} />
        <MetricRow label="Operating Margins" value={fmtPct(metrics.operatingMargins)} />
        <MetricRow label="Free Cash Flow" value={fmtCr(metrics.freeCashflow)} />
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="FINANCIAL HEALTH" color="text-neon-green">
        <MetricRow label="Debt/Equity" value={fmtNum(metrics.debtToEquity)} />
        <MetricRow label="Current Ratio" value={fmtNum(metrics.currentRatio)} />
        <MetricRow label="Quick Ratio" value={fmtNum(metrics.quickRatio)} />
        <MetricRow label="Total Cash" value={fmtCr(metrics.totalCash)} />
        <MetricRow label="Total Debt" value={fmtCr(metrics.totalDebt)} />
        <MetricRow label="Beta" value={fmtNum(metrics.beta)} />
      </SectionCard>

      <SectionCard icon={BarChart2} title="GROWTH" color="text-purple-400">
        <MetricRow label="Revenue Growth YoY" value={fmtPct(metrics.revenueGrowth)} />
        <MetricRow label="Earnings Growth YoY" value={fmtPct(metrics.earningsGrowth)} />
        <MetricRow label="Revenue/Share" value={fmtNum(metrics.revenuePerShare)} />
      </SectionCard>

      <SectionCard icon={Users} title="SHAREHOLDING" color="text-orange-400">
        <MetricRow label="Promoter Holding" value={fmtPct(metrics.promoterHolding)} />
        <MetricRow label="Institutional Holding" value={fmtPct(metrics.institutionalHolding)} />
        <MetricRow label="FII Approx. Holding" value={fmtPct(metrics.fiiChange)} />
      </SectionCard>

      {metrics.quarterlyResults.length > 0 && (
        <SectionCard icon={BookOpen} title="QUARTERLY RESULTS" color="text-cyan-400">
          {metrics.quarterlyResults.map((q) => (
            <div key={q.period} className="mb-2 last:mb-0">
              <div className="font-mono text-[10px] font-bold text-muted-foreground">{q.period}</div>
              <div className="grid grid-cols-2 gap-x-2">
                <MetricRow label="Revenue" value={fmtCr(q.revenue)} />
                <MetricRow label="Net Income" value={fmtCr(q.netIncome)} />
              </div>
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FundamentalAnalysis({ symbol }: { symbol: string }) {
  const [isBeginner] = useBeginnerMode();
  const [data, setData] = useState<FundamentalAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimit, setIsRateLimit] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [showMetrics, setShowMetrics] = useState(false);

  // Countdown timer for rate limit
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const t = setTimeout(() => setRetryCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [retryCountdown]);

  const load = useCallback(async () => {
    if (retryCountdown > 0) return;
    setLoading(true);
    setError(null);
    setIsRateLimit(false);
    try {
      const result = await api.predict.fundamentals(symbol);
      setData(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load fundamental analysis";
      setIsRateLimit(false);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [symbol, retryCountdown]);

  // No auto-retry needed — fallback analysis always returns a result
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const analysis = data?.analysis;
  const metrics = data?.metrics;

  const signalColor =
    analysis?.signal === "BUY"
      ? "text-bull"
      : analysis?.signal === "SELL"
        ? "text-bear"
        : "text-neon-blue";
  const signalBorder =
    analysis?.signal === "BUY"
      ? "border-bull/40 bg-bull/5"
      : analysis?.signal === "SELL"
        ? "border-bear/40 bg-bear/5"
        : "border-neon-blue/40 bg-neon-blue/5";
  const SignalIcon =
    analysis?.signal === "BUY"
      ? TrendingUp
      : analysis?.signal === "SELL"
        ? TrendingDown
        : Minus;

  const verdictColor =
    analysis?.valuationAnalysis.verdict === "Undervalued"
      ? "text-bull border-bull/30 bg-bull/10"
      : analysis?.valuationAnalysis.verdict === "Expensive"
        ? "text-bear border-bear/30 bg-bear/10"
        : "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-neon-blue" />
          <span className="font-mono text-sm font-bold tracking-wider">
            AI FUNDAMENTAL ANALYSIS
          </span>
          <span className="rounded-full border border-neon-blue/30 bg-neon-blue/10 px-2 py-0.5 font-mono text-[9px] text-neon-blue">
            GEMINI
          </span>
          {data?.analysis?.source === "rule_based_fallback" && (
            <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 font-mono text-[9px] text-yellow-400">
              RULE-BASED
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading || retryCountdown > 0}
          className="flex items-center gap-1.5 rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-3 py-1.5 font-mono text-[11px] text-neon-blue transition-all hover:bg-neon-blue/20 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {loading
            ? "ANALYZING..."
            : retryCountdown > 0
              ? `RETRY IN ${retryCountdown}s`
              : data
                ? "REFRESH"
                : "ANALYZE"}
        </button>
      </div>

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 bg-background/20 py-12 text-center">
          <BookOpen className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <div className="font-mono text-sm text-muted-foreground">
            Click <span className="text-neon-blue">ANALYZE</span> to run AI fundamental analysis
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground/60">
            Uses live Yahoo Finance data + Google Gemini AI
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-14">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="mb-4 h-8 w-8 rounded-full border-2 border-neon-blue/30 border-t-neon-blue"
          />
          <div className="font-mono text-xs text-muted-foreground">
            Fetching fundamentals &amp; running AI analysis...
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground/60">
            This takes 20–40 seconds — Gemini is reading the data
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className={`rounded-xl border p-4 ${isRateLimit ? "border-yellow-400/30 bg-yellow-400/5" : "border-bear/30 bg-bear/5"}`}>
          <div className={`flex items-start gap-2 font-mono text-xs ${isRateLimit ? "text-yellow-400" : "text-bear"}`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div>{error}</div>
              {isRateLimit && retryCountdown > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-yellow-400/20">
                    <motion.div
                      className="h-full rounded-full bg-yellow-400"
                      initial={{ width: "100%" }}
                      animate={{ width: `${(retryCountdown / 20) * 100}%` }}
                      transition={{ duration: 1 }}
                    />
                  </div>
                  <span className="text-[10px] text-yellow-400/70">
                    Auto-retrying in {retryCountdown}s
                  </span>                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {analysis && metrics && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Company Info */}
            <div className="rounded-xl border border-border/30 bg-background/30 p-4">
              <div className="font-mono text-xs font-bold">{data?.companyName}</div>
              {metrics.sector && (
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {metrics.sector} · {metrics.industry}
                </div>
              )}
              {metrics.companyInfo && (
                <div className="mt-2 line-clamp-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {metrics.companyInfo}
                </div>
              )}
            </div>

            {/* Signal + Score row */}
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Signal */}
              <div className={`rounded-xl border p-4 ${signalBorder}`}>
                <div className="font-mono text-[10px] text-muted-foreground">SIGNAL</div>
                <div className={`mt-1 flex items-center gap-2 font-mono text-3xl font-black ${signalColor}`}>
                  <SignalIcon className="h-6 w-6" />
                  {analysis.signal}
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                  Confidence: <span className={signalColor}>{analysis.confidence}/100</span>
                </div>
              </div>

              {/* Fundamental Score */}
              <div className="rounded-xl border border-border/40 bg-background/30 p-4">
                <div className="font-mono text-[10px] text-muted-foreground">FUNDAMENTAL SCORE</div>
                <div className={`mt-1 font-mono text-3xl font-black ${scoreColor(analysis.fundamentalScore)}`}>
                  {analysis.fundamentalScore}/100
                </div>
                <div className={`mt-1 font-mono text-[10px] ${scoreColor(analysis.fundamentalScore)}`}>
                  {scoreLabel(analysis.fundamentalScore)}
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-background/60">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${analysis.fundamentalScore}%` }}
                    transition={{ duration: 0.8 }}
                    className={`h-full rounded-full ${scoreBg(analysis.fundamentalScore)}`}
                  />
                </div>
              </div>

              {/* Valuation verdict */}
              <div className={`rounded-xl border p-4 ${verdictColor}`}>
                <div className="font-mono text-[10px] text-muted-foreground">VALUATION</div>
                <div className="mt-1 font-mono text-2xl font-black">
                  {analysis.valuationAnalysis.verdict}
                </div>
                <div className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {analysis.valuationAnalysis.sectorComparison}
                </div>
              </div>
            </div>

            {/* One-line summary */}
            <div className="rounded-xl border border-neon-blue/20 bg-neon-blue/5 px-4 py-3 font-mono text-xs leading-relaxed text-neon-blue">
              <span className="font-bold">Summary: </span>
              {analysis.oneLineSummary}
            </div>

            {/* AI Reason */}
            <div className="rounded-xl border border-border/30 bg-background/30 p-4">
              <div className="mb-1 font-mono text-[10px] font-bold tracking-wider text-muted-foreground">
                WHY {analysis.signal}?
              </div>
              <div className="font-mono text-[11px] leading-relaxed text-foreground/90">
                {analysis.reason}
              </div>
            </div>

            {/* Financial Strength, Growth, and Valuation details (technical) */}
            {!isBeginner && (
              <>
                {/* Financial Strength */}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border/30 bg-background/30 p-4">
                    <div className="mb-2 font-mono text-[10px] font-bold tracking-wider text-bull">
                      PROFITABILITY
                    </div>
                    <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {analysis.financialStrength.profitability}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/30 bg-background/30 p-4">
                    <div className="mb-2 font-mono text-[10px] font-bold tracking-wider text-yellow-400">
                      DEBT ANALYSIS
                    </div>
                    <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {analysis.financialStrength.debt}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/30 bg-background/30 p-4">
                    <div className="mb-2 font-mono text-[10px] font-bold tracking-wider text-neon-green">
                      FINANCIAL HEALTH
                    </div>
                    <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {analysis.financialStrength.financialHealth}
                    </div>
                  </div>
                </div>

                {/* Growth Analysis */}
                <div className="rounded-xl border border-border/30 bg-background/30 p-4">
                  <div className="mb-3 font-mono text-[10px] font-bold tracking-wider text-purple-400">
                    GROWTH ANALYSIS
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="font-mono text-[10px] text-muted-foreground">Revenue</div>
                      <div className="mt-1 font-mono text-[11px] leading-relaxed">
                        {analysis.growthAnalysis.revenueGrowth}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-muted-foreground">Profit</div>
                      <div className="mt-1 font-mono text-[11px] leading-relaxed">
                        {analysis.growthAnalysis.profitGrowth}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-muted-foreground">Quarterly Trend</div>
                      <div className="mt-1 font-mono text-[11px] leading-relaxed">
                        {analysis.growthAnalysis.quarterlyConsistency}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Valuation Details */}
                <div className="rounded-xl border border-border/30 bg-background/30 p-4">
                  <div className="mb-2 font-mono text-[10px] font-bold tracking-wider text-neon-blue">
                    VALUATION DETAILS
                  </div>
                  <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {analysis.valuationAnalysis.details}
                  </div>
                </div>
              </>
            )}

            {/* Strengths + Risks */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-bull/20 bg-bull/5 p-4">
                <div className="mb-3 font-mono text-[10px] font-bold tracking-wider text-bull">
                  STRENGTHS
                </div>
                <ul className="space-y-2">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 font-mono text-[11px]">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bull" />
                      <span className="text-muted-foreground">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-bear/20 bg-bear/5 p-4">
                <div className="mb-3 font-mono text-[10px] font-bold tracking-wider text-bear">
                  RISKS
                </div>
                <ul className="space-y-2">
                  {analysis.riskAnalysis.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 font-mono text-[11px]">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bear" />
                      <span className="text-muted-foreground">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Raw Metrics toggle */}
            <div>
              <button
                onClick={() => setShowMetrics((p) => !p)}
                className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-neon-blue"
              >
                <BarChart2 className="h-3 w-3" />
                {showMetrics ? "HIDE" : "SHOW"} RAW METRICS
              </button>
              <AnimatePresence>
                {showMetrics && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <MetricsGrid metrics={metrics} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Disclaimer */}
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3">
              <div className="flex items-start gap-2 font-mono text-[10px] text-yellow-400/80">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Fundamental analysis is for educational purposes only. Always verify with latest
                filings, annual reports, and consult a SEBI-registered advisor before investing.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
