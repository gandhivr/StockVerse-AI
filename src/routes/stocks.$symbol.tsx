// StockVerse AI — Stock Detail Page
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  RefreshCw,
  Star,
  StarOff,
  BarChart3,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  Activity,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Info,
  MessageSquare,
  Calendar,
  Bell,
  BookOpen,
} from "lucide-react";
import {
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
  BarChart,
  ReferenceLine,
  ComposedChart,
  Line,
  Area,
  Cell,
} from "recharts";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Navbar } from "@/components/Navbar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FundamentalAnalysis } from "@/components/FundamentalAnalysis";
import { DcfCalculator } from "@/components/DcfCalculator";
import { NewsSentimentRadar } from "@/components/NewsSentimentRadar";
import { useBeginnerMode } from "@/hooks/useBeginnerMode";
import type { StockQuote, OHLCV, Prediction, MultiAgentForecast, ChartIntelligence, TraderToolkit } from "@/lib/api";

interface ForecastPoint {
  days: number;
  label: string;
  predictedPrice: number;
  changePercent: number;
  direction: string;
}
interface ForecastSeries {
  date: string;
  actual: number | null;
  forecast: number | null;
  type: string;
}

export const Route = createFileRoute("/stocks/$symbol")({
  head: ({ params }) => ({ meta: [{ title: `${params.symbol} — StockVerse AI` }] }),
  component: StockDetailPage,
});

const RANGES = ["1mo", "3mo", "6mo", "1y"] as const;
type Range = (typeof RANGES)[number];
type ChartTab = "PRICE" | "RSI" | "MACD";
const API = "";
const fmtY = (v: unknown) =>
  Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}K` : Number(v).toFixed(0);

interface ChartPayload {
  dataKey: string;
  color?: string;
  name?: string;
  value: number;
}

function sma(d: number[], p: number): (number | null)[] {
  return d.map((_, i) =>
    i < p - 1 ? null : d.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p,
  );
}
function ema(d: number[], p: number): number[] {
  const k = 2 / (p + 1);
  const e: number[] = [];
  d.forEach((v, i) => e.push(i === 0 ? v : v * k + e[i - 1] * (1 - k)));
  return e;
}
function calcRSI(c: number[], p = 14): (number | null)[] {
  const r: (number | null)[] = new Array(c.length).fill(null);
  if (c.length < p + 1) return r;
  let g = 0,
    l = 0;
  for (let i = 1; i <= p; i++) {
    const d = c[i] - c[i - 1];
    if (d > 0) g += d;
    else l -= d;
  }
  let ag = g / p,
    al = l / p;
  r[p] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = p + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    ag = (ag * (p - 1) + Math.max(d, 0)) / p;
    al = (al * (p - 1) + Math.max(-d, 0)) / p;
    r[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return r;
}
function calcMACD(c: number[]) {
  const e12 = ema(c, 12),
    e26 = ema(c, 26);
  const ml = e12.map((v, i) => v - e26[i]);
  const sig = ema(ml, 9);
  return { ml, sig, hist: ml.map((v, i) => v - sig[i]) };
}

function confidenceExplanation(confidence: number, riskScore: number, modelStatus?: string) {
  if (modelStatus !== "TRAINED") {
    return "Fallback forecast: confidence is reduced because no trained artifact is available for this symbol.";
  }
  if (riskScore >= 7)
    return "High market risk is reducing confidence. Use smaller position sizing.";
  if (confidence >= 80)
    return "High confidence: trained model, stable risk, and aligned technical signals.";
  if (confidence >= 60)
    return "Medium confidence: useful signal, but price/risk conditions are mixed.";
  return "Low confidence: model signal is weak or market volatility is elevated.";
}

function confidenceBarClass(confidence: number) {
  if (confidence > 60) return "bg-bull";
  if (confidence >= 50) return "bg-yellow-400";
  return "bg-bear";
}

function confidenceTextClass(confidence: number) {
  if (confidence > 60) return "text-bull";
  if (confidence >= 50) return "text-yellow-400";
  return "text-bear";
}

function newsBadgeClass(direction?: string) {
  if (direction === "BULLISH") return "border-bull/30 bg-bull/10 text-bull";
  if (direction === "BEARISH") return "border-bear/30 bg-bear/10 text-bear";
  return "border-neon-blue/30 bg-neon-blue/10 text-neon-blue";
}

function technicalStrength(indicators?: MultiAgentForecast["technicalIndicators"]) {
  const rsi = Number(indicators?.rsi) || 50;
  const macd = Number(indicators?.macd) || 0;
  const sma20 = Number(indicators?.sma20) || 0;
  const sma50 = Number(indicators?.sma50) || 0;
  let score = 50;
  const notes: string[] = [];

  if (rsi < 30) {
    score += 18;
    notes.push("RSI is oversold");
  } else if (rsi > 70) {
    score -= 18;
    notes.push("RSI is overbought");
  } else {
    notes.push("RSI is neutral");
  }

  if (macd > 0) {
    score += 16;
    notes.push("MACD is positive");
  } else {
    score -= 16;
    notes.push("MACD is negative");
  }

  if (sma20 && sma50) {
    if (sma20 > sma50) {
      score += 16;
      notes.push("SMA20 is above SMA50");
    } else {
      score -= 16;
      notes.push("SMA20 is below SMA50");
    }
  }

  return { score: Math.max(0, Math.min(100, score)), notes };
}

function flipConditions(signal: "BUY" | "SELL" | "HOLD") {
  if (signal === "BUY") {
    return "RSI crossing 70, MACD turning negative, price losing SMA50, or negative earnings/FII news.";
  }
  if (signal === "SELL") {
    return "RSI dropping below 30, MACD crossing positive, price reclaiming SMA50, or positive FII/earnings news.";
  }
  return "A clean SMA crossover, stronger MACD momentum, and high-impact news in one direction.";
}

function Tip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-neon-green/30 bg-background/95 p-3 font-mono text-xs shadow-xl backdrop-blur-xl">
      <div className="mb-1 text-muted-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name ?? p.dataKey}:</span>
          <span className="font-bold" style={{ color: p.color }}>
            {p.dataKey === "volume"
              ? p.value > 1e6
                ? `${(p.value / 1e6).toFixed(2)}M`
                : `${(p.value / 1000).toFixed(0)}K`
              : `₹${Number(p.value).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
          </span>
        </div>
      ))}
    </div>
  );
}

function VerdictCard({
  pred,
  quote,
  targetLabel = "AI TARGET (1D)",
}: {
  pred: Prediction;
  quote: StockQuote | null;
  targetLabel?: string;
}) {
  const buy = pred.signal === "BUY",
    sell = pred.signal === "SELL";
  const vc = buy ? "text-bull" : sell ? "text-bear" : "text-neon-blue";
  const vb = buy ? "border-bull/40" : sell ? "border-bear/40" : "border-neon-blue/40";
  const vbg = buy ? "bg-bull/5" : sell ? "bg-bear/5" : "bg-neon-blue/5";
  const VI = buy ? TrendingUp : sell ? TrendingDown : Minus;
  const ti = pred.technicalIndicators ?? {};
  const r = Number(ti.rsi) || 50,
    m = Number(ti.macd) || 0;
  const s20 = Number(ti.sma20) || 0,
    s50 = Number(ti.sma50) || 0;
  const conf = Number(pred.confidence) || 0,
    risk = Number(pred.riskScore) || 0;
  const displayCurrentPrice = Number(quote?.currentPrice) || Number(pred.currentPrice) || 0;
  const pp = Number(pred.predictedPrice) || 0,
    cp = displayCurrentPrice;
  const pc = pp - cp;
  const pcp = cp ? (pc / cp) * 100 : Number(pred.priceChangePercent) || 0;
  const reasons = [
    r < 30
      ? { t: `RSI ${r.toFixed(1)} — Oversold, potential reversal`, p: true }
      : r > 70
        ? { t: `RSI ${r.toFixed(1)} — Overbought, caution`, p: false }
        : { t: `RSI ${r.toFixed(1)} — Neutral zone`, p: true },
    m > 0
      ? { t: `MACD ${m.toFixed(2)} — Bullish momentum`, p: true }
      : { t: `MACD ${m.toFixed(2)} — Bearish momentum`, p: false },
    ...(s20 && s50
      ? [
          s20 > s50
            ? { t: "SMA20 > SMA50 — Golden cross", p: true }
            : { t: "SMA20 < SMA50 — Death cross", p: false },
        ]
      : []),
    pcp > 0
      ? { t: `AI predicts +${pcp.toFixed(2)}% next session`, p: true }
      : { t: `AI predicts ${pcp.toFixed(2)}% next session`, p: false },
    ...(risk < 4
      ? [{ t: `Low risk ${risk.toFixed(1)}/10`, p: true }]
      : risk > 6
        ? [{ t: `High risk ${risk.toFixed(1)}/10 — use stop-loss`, p: false }]
        : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass depth-panel rounded-2xl border-2 ${vb} ${vbg} p-6`}
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
            AI VERDICT
          </div>
          <div className={`flex items-center gap-2 font-mono text-5xl font-black ${vc}`}>
            <VI className="h-10 w-10" />
            {pred.signal}
          </div>
          <div className={`mt-1 font-mono text-sm font-bold ${vc}`}>{pred.trend}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] text-muted-foreground">CONFIDENCE</div>
          <div className={`font-mono text-3xl font-black ${vc}`}>{conf.toFixed(0)}%</div>
        </div>
      </div>
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-background/60">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${conf}%` }}
          transition={{ duration: 1 }}
          className={`h-full rounded-full ${buy ? "bg-bull" : sell ? "bg-bear" : "bg-neon-blue"}`}
        />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-background/40 p-3">
          <div className="font-mono text-[10px] text-muted-foreground">CURRENT</div>
          <div className="font-mono text-lg font-bold">
            ₹{cp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl bg-background/40 p-3">
          <div className="font-mono text-[10px] text-muted-foreground">{targetLabel}</div>
          <div className={`font-mono text-lg font-bold ${pc >= 0 ? "text-bull" : "text-bear"}`}>
            ₹{pp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className={`font-mono text-[10px] ${pc >= 0 ? "text-bull" : "text-bear"}`}>
            {pc >= 0 ? "+" : ""}
            {pcp.toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="mb-4">
        <div className="mb-2 font-mono text-[10px] tracking-widest text-muted-foreground">
          WHY {pred.signal}?
        </div>
        <div className="space-y-2">
          {reasons.map((reason, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className={`flex items-start gap-2 rounded-lg border p-2.5 font-mono text-[11px] ${
                reason.p
                  ? "border-bull/20 bg-bull/5 text-bull"
                  : "border-bear/20 bg-bear/5 text-bear"
              }`}
            >
              {reason.p ? (
                <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              )}
              {reason.t}
            </motion.div>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-background/30 p-3">
        <div className="mb-2 flex items-center justify-between font-mono text-[10px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Shield className="h-3 w-3" /> RISK
          </span>
          <span className={risk > 6 ? "text-bear" : risk > 4 ? "text-yellow-400" : "text-bull"}>
            {risk.toFixed(1)}/10
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-background/60">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${risk * 10}%` }}
            transition={{ duration: 0.8 }}
            className={`h-full rounded-full ${risk > 6 ? "bg-bear" : risk > 4 ? "bg-yellow-400" : "bg-bull"}`}
          />
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          {risk < 4
            ? "Low risk — conservative investors"
            : risk < 7
              ? "Medium risk — use position sizing"
              : "High risk — set strict stop-loss"}
        </div>
      </div>
      <div className="mt-3 font-mono text-[9px] text-muted-foreground">
        ⚠ Educational only. Source: {pred.source ?? "technical_analysis"} ·{" "}
        {pred.cached ? "Cached" : "Fresh"}
      </div>
    </motion.div>
  );
}

function PredictionDisclaimer() {
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem("stockverse_prediction_disclaimer_seen") !== "1";
    } catch {
      return true;
    }
  });

  if (!visible) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem("stockverse_prediction_disclaimer_seen", "1");
    } catch {
      // ignore storage failures
    }
    setVisible(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-xl border border-yellow-400/25 bg-yellow-400/10 p-4 shadow-lg backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
        <div className="min-w-0 flex-1 font-mono text-xs leading-relaxed text-yellow-100/90">
          <div className="font-bold text-yellow-300">
            AI predictions use historical price patterns + news sentiment.
          </div>
          <div className="mt-1 text-yellow-100/75">
            Directional accuracy is ~55-60%. Never trade based solely on this. Always verify with
            fundamentals and current news before investing.
          </div>
        </div>
        <button
          onClick={dismiss}
          className="rounded-md border border-yellow-400/30 px-2 py-1 font-mono text-[10px] text-yellow-300 hover:bg-yellow-400/10"
        >
          HIDE
        </button>
      </div>
    </motion.div>
  );
}

function SignalConfidenceBreakdown({ forecast }: { forecast: MultiAgentForecast }) {
  const tech = technicalStrength(forecast.technicalIndicators);
  const news = forecast.newsSentiment;
  const primary = forecast.primaryHorizon;
  const confidence = Number(primary.confidence) || 0;
  const events = news?.keyEvents?.slice(0, 3) || [];
  const combinedReason =
    forecast.newsReasoning ||
    (forecast.newsInfluenced
      ? "Recent news changed the combined signal."
      : "Recent news did not materially change the technical signal.");

  return (
    <div className="mt-4 rounded-xl border border-border/40 bg-background/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-xs font-bold tracking-wider">
          SIGNAL CONFIDENCE BREAKDOWN
        </div>
        <TooltipProvider delayDuration={120}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="inline-flex items-center gap-1 rounded-md border border-border/50 px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-neon-blue">
                <Info className="h-3 w-3" /> CONFIDENCE
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Confidence reflects agreement between technical indicators and recent news. Higher =
              more signals agree.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-border/30 bg-background/35 p-3">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px]">
            <span className="text-muted-foreground">Technical strength</span>
            <span className={confidenceTextClass(tech.score)}>{Math.round(tech.score)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-background/70">
            <div
              className={`h-full ${confidenceBarClass(tech.score)}`}
              style={{ width: `${tech.score}%` }}
            />
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">
            {tech.notes.join(" · ")}
          </div>
        </div>

        <div className="rounded-lg border border-border/30 bg-background/35 p-3">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px]">
            <span className="text-muted-foreground">News sentiment</span>
            <span className={`rounded-full border px-2 py-0.5 ${newsBadgeClass(news?.direction)}`}>
              {news?.direction || "NEUTRAL"}
            </span>
          </div>
          <div className="font-mono text-lg font-black">
            {news?.score != null ? news.score.toFixed(2) : "0.00"}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            Impact {news?.impact || "LOW"}
          </div>
        </div>

        <div className="rounded-lg border border-border/30 bg-background/35 p-3">
          <div className="font-mono text-[10px] text-muted-foreground">Combined signal</div>
          <div className={`font-mono text-lg font-black ${confidenceTextClass(confidence)}`}>
            {primary.technicalSignal || forecast.verdict} {"->"} {primary.signal}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-background/70">
            <div
              className={`h-full ${confidenceBarClass(confidence)}`}
              style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
            />
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">{combinedReason}</div>
        </div>
      </div>

      {events.length > 0 && (
        <div className="mt-3 rounded-lg border border-neon-blue/20 bg-neon-blue/5 p-3">
          <div className="mb-2 font-mono text-[10px] font-bold text-neon-blue">KEY NEWS EVENTS</div>
          <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
            {events.map((event) => (
              <li key={event} className="flex gap-2">
                <span className="text-neon-blue">-</span>
                <span>{event}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3 font-mono text-[11px] text-muted-foreground">
        <span className="font-bold text-yellow-400">What could change this prediction: </span>
        {flipConditions(forecast.verdict)}
      </div>
    </div>
  );
}

function ChartIntelligencePanel({
  analysis,
  loading,
  onRefresh,
}: {
  analysis: ChartIntelligence | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const signalClass =
    analysis?.signal === "BUY"
      ? "text-bull border-bull/40 bg-bull/10"
      : analysis?.signal === "SELL"
        ? "text-bear border-bear/40 bg-bear/10"
        : "text-neon-blue border-neon-blue/40 bg-neon-blue/10";
  const SignalIcon =
    analysis?.signal === "BUY" ? TrendingUp : analysis?.signal === "SELL" ? TrendingDown : Minus;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-neon-blue" />
          <span className="font-mono text-sm font-bold tracking-wider">
            CHART INTELLIGENCE ENGINE
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-neon-green/40 hover:text-foreground disabled:opacity-50"
          aria-label="Refresh chart intelligence"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !analysis ? (
        <div className="flex h-40 items-center justify-center gap-2 font-mono text-xs text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin text-neon-green" />
          Reading chart structure...
        </div>
      ) : analysis ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className={`rounded-xl border p-4 ${signalClass}`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">SETUP</span>
                <SignalIcon className="h-4 w-4" />
              </div>
              <div className="mt-2 font-mono text-2xl font-black">{analysis.signal}</div>
              <div className="font-mono text-[10px]">{analysis.confidence.toFixed(0)}% confidence</div>
            </div>
            {[
              { label: "SUPPORT", value: `Rs.${analysis.levels.support.toFixed(2)}` },
              { label: "RESISTANCE", value: `Rs.${analysis.levels.resistance.toFixed(2)}` },
              { label: "RISK/REWARD", value: `${analysis.levels.riskReward.toFixed(2)}x` },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border/40 bg-background/30 p-4">
                <div className="font-mono text-[10px] text-muted-foreground">{item.label}</div>
                <div className="mt-2 font-mono text-lg font-bold">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-bull/20 bg-bull/5 p-4">
              <div className="mb-2 font-mono text-[10px] font-bold text-bull">TARGET PLAN</div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div>
                  <div className="text-muted-foreground">Target</div>
                  <div className="font-bold text-bull">Rs.{analysis.levels.target.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stop-loss</div>
                  <div className="font-bold text-bear">Rs.{analysis.levels.stopLoss.toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-neon-blue/20 bg-neon-blue/5 p-4">
              <div className="mb-2 font-mono text-[10px] font-bold text-neon-blue">TREND STRUCTURE</div>
              <div className="font-mono text-sm font-bold">{analysis.trend.direction}</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                {analysis.trend.description}
              </div>
            </div>
          </div>

          {analysis.patterns.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {analysis.patterns.map((pattern) => (
                <span
                  key={pattern.name}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[10px] ${
                    pattern.bias === "BULLISH"
                      ? "border-bull/30 bg-bull/10 text-bull"
                      : pattern.bias === "BEARISH"
                        ? "border-bear/30 bg-bear/10 text-bear"
                        : "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                  }`}
                >
                  {pattern.name} · {pattern.bias}
                </span>
              ))}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/30 bg-background/30 p-4">
              <div className="mb-2 font-mono text-[10px] font-bold text-bull">BULLISH EVIDENCE</div>
              <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
                {(analysis.reasons.length ? analysis.reasons : ["No strong bullish confirmation yet."]).map((reason) => (
                  <li key={reason}>+ {reason}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border/30 bg-background/30 p-4">
              <div className="mb-2 font-mono text-[10px] font-bold text-bear">RISKS / WARNINGS</div>
              <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
                {(analysis.warnings.length ? analysis.warnings : ["No major chart warning detected."]).map((warning) => (
                  <li key={warning}>- {warning}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-muted-foreground sm:grid-cols-4">
            <div>RSI: <span className="text-foreground">{analysis.indicators.rsi.toFixed(1)}</span></div>
            <div>MACD: <span className="text-foreground">{analysis.indicators.macd.toFixed(2)}</span></div>
            <div>Vol: <span className="text-foreground">{analysis.indicators.volumeRatio.toFixed(2)}x</span></div>
            <div>ATR Risk: <span className="text-foreground">{analysis.indicators.volatility.toFixed(2)}%</span></div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-background/30 p-4 font-mono text-xs text-muted-foreground">
          Chart intelligence is unavailable for this symbol.
        </div>
      )}
    </div>
  );
}

function TraderToolkitPanel({
  symbol,
  toolkit,
  loading,
  capital,
  riskPercent,
  onCapitalChange,
  onRiskChange,
  onRefresh,
}: {
  symbol: string;
  toolkit: TraderToolkit | null;
  loading: boolean;
  capital: number;
  riskPercent: number;
  onCapitalChange: (value: number) => void;
  onRiskChange: (value: number) => void;
  onRefresh: () => void;
}) {
  const saveAlert = () => {
    if (!toolkit) return;
    const alerts = JSON.parse(localStorage.getItem("stockverse_alerts") || "[]");
    alerts.unshift({
      id: Date.now(),
      symbol,
      type: toolkit.chart.signal,
      trigger: toolkit.tradePlan.entryTrigger,
      stopLoss: toolkit.tradePlan.stopLoss,
      target: toolkit.tradePlan.target1,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("stockverse_alerts", JSON.stringify(alerts.slice(0, 50)));
  };

  const addJournal = () => {
    if (!toolkit) return;
    const journal = JSON.parse(localStorage.getItem("stockverse_journal") || "[]");
    journal.unshift({
      id: Date.now(),
      symbol,
      signal: toolkit.chart.signal,
      entry: toolkit.chart.currentPrice,
      stopLoss: toolkit.tradePlan.stopLoss,
      target: toolkit.tradePlan.target1,
      note: toolkit.tradePlan.entryTrigger,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("stockverse_journal", JSON.stringify(journal.slice(0, 100)));
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-neon-green" />
          <span className="font-mono text-sm font-bold tracking-wider">TRADER TOOLKIT</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-neon-green/40 hover:text-foreground disabled:opacity-50"
          aria-label="Refresh trader toolkit"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="rounded-xl border border-border/40 bg-background/30 p-3 font-mono text-[10px] text-muted-foreground">
          CAPITAL
          <input
            type="number"
            value={capital}
            min={1000}
            step={1000}
            onChange={(event) => onCapitalChange(Number(event.target.value))}
            className="mt-2 w-full rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs text-foreground outline-none focus:border-neon-green/50"
          />
        </label>
        <label className="rounded-xl border border-border/40 bg-background/30 p-3 font-mono text-[10px] text-muted-foreground">
          RISK %
          <input
            type="number"
            value={riskPercent}
            min={0.1}
            max={5}
            step={0.1}
            onChange={(event) => onRiskChange(Number(event.target.value))}
            className="mt-2 w-full rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs text-foreground outline-none focus:border-neon-green/50"
          />
        </label>
      </div>

      {loading && !toolkit ? (
        <div className="flex h-36 items-center justify-center gap-2 font-mono text-xs text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin text-neon-green" />
          Building trade plan...
        </div>
      ) : toolkit ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: "ENTRY", value: `Rs.${toolkit.tradePlan.entryZone.low}-${toolkit.tradePlan.entryZone.high}` },
              { label: "TARGET 1", value: `Rs.${toolkit.tradePlan.target1.toFixed(2)}`, cls: "text-bull" },
              { label: "STOP", value: `Rs.${toolkit.tradePlan.stopLoss.toFixed(2)}`, cls: "text-bear" },
              { label: "QTY", value: toolkit.positionSizing.quantity.toString(), cls: "text-neon-blue" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border/40 bg-background/30 p-4">
                <div className="font-mono text-[10px] text-muted-foreground">{item.label}</div>
                <div className={`mt-2 font-mono text-sm font-bold ${item.cls || ""}`}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 p-4">
            <div className="mb-1 font-mono text-[10px] font-bold text-neon-green">TRADE PLAN</div>
            <div className="font-mono text-xs text-muted-foreground">{toolkit.tradePlan.entryTrigger}</div>
            <div className="mt-2 font-mono text-[11px] text-muted-foreground">
              Target 2 Rs.{toolkit.tradePlan.target2.toFixed(2)} | Max loss Rs.
              {toolkit.positionSizing.maxLoss.toFixed(2)} | {toolkit.tradePlan.invalidIf}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/30 bg-background/30 p-4">
              <div className="mb-3 font-mono text-[10px] font-bold">MULTI-TIMEFRAME CONFIRMATION</div>
              <div className="mb-2 flex items-center justify-between font-mono text-xs">
                <span className="text-muted-foreground">{toolkit.multiTimeframe.verdict}</span>
                <span className="text-neon-green">{toolkit.multiTimeframe.agreement.toFixed(0)}%</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {toolkit.multiTimeframe.timeframes.map((frame) => (
                  <div key={frame.range} className="rounded-lg border border-border/30 bg-background/40 p-2 text-center font-mono">
                    <div className="text-[10px] text-muted-foreground">{frame.range}</div>
                    <div className={frame.signal === "BUY" ? "text-bull" : frame.signal === "SELL" ? "text-bear" : "text-neon-blue"}>
                      {frame.signal}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/30 bg-background/30 p-4">
              <div className="mb-3 font-mono text-[10px] font-bold">SETUP BACKTEST</div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div>Win rate: <span className="text-bull">{toolkit.backtest.winRate.toFixed(0)}%</span></div>
                <div>Signals: <span className="text-foreground">{toolkit.backtest.totalSignals}</span></div>
                <div>Avg return: <span className="text-foreground">{toolkit.backtest.averageReturn.toFixed(2)}%</span></div>
                <div>Drawdown: <span className="text-bear">{toolkit.backtest.maxDrawdown.toFixed(2)}%</span></div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={saveAlert} className="inline-flex items-center gap-2 rounded-lg border border-neon-blue/30 bg-neon-blue/10 px-3 py-2 font-mono text-xs text-neon-blue">
              <Bell className="h-3.5 w-3.5" /> Save Alert
            </button>
            <button onClick={addJournal} className="inline-flex items-center gap-2 rounded-lg border border-neon-green/30 bg-neon-green/10 px-3 py-2 font-mono text-xs text-neon-green">
              <BookOpen className="h-3.5 w-3.5" /> Add Journal
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-background/30 p-4 font-mono text-xs text-muted-foreground">
          Trader toolkit is unavailable for this symbol.
        </div>
      )}
    </div>
  );
}

function StockDetailPage() {
  const { symbol } = Route.useParams();
  const [isBeginner] = useBeginnerMode();
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [history, setHistory] = useState<OHLCV[]>([]);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [range, setRange] = useState<Range>("3mo");
  const [loading, setLoading] = useState(true);
  const [predLoading, setPredLoading] = useState(false);
  const [tab, setTab] = useState<ChartTab>("PRICE");
  const [forecast, setForecast] = useState<{
    forecast: ForecastPoint[];
    forecastSeries: ForecastSeries[];
    narrative: string | null;
  } | null>(null);
  const [agentForecast, setAgentForecast] = useState<MultiAgentForecast | null>(null);
  const [chartIntel, setChartIntel] = useState<ChartIntelligence | null>(null);
  const [chartIntelLoading, setChartIntelLoading] = useState(false);
  const [traderToolkit, setTraderToolkit] = useState<TraderToolkit | null>(null);
  const [toolkitLoading, setToolkitLoading] = useState(false);
  const [capital, setCapital] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [fcLoading, setFcLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sid = useRef(`s_${Date.now()}`);
  const [wl, setWl] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("watchlist") || "[]").includes(symbol);
    } catch {
      return false;
    }
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, h] = await Promise.all([
        fetch(`${API}/api/stocks/${symbol}?t=${Date.now()}`, { cache: "no-store" }).then((r) =>
          r.json(),
        ),
        fetch(`${API}/api/stocks/${symbol}/history?range=${range}`).then((r) => r.json()),
      ]);
      setQuote(q.data);
      setHistory(h.data?.history || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [symbol, range]);

  const loadPred = useCallback(async () => {
    setPredLoading(true);
    try {
      const r = await fetch(`${API}/api/predict/${symbol}`);
      const j = await r.json();
      setPred(j.data);
    } catch {
      // ignore
    } finally {
      setPredLoading(false);
    }
  }, [symbol]);

  const loadFc = useCallback(async () => {
    setFcLoading(true);
    try {
      const [classic, agents] = await Promise.allSettled([
        fetch(`${API}/api/predict/${symbol}/forecast`).then((r) => r.json()),
        fetch(`${API}/api/predict/${symbol}/agents?horizons=1,7,30,60,90`).then((r) => r.json()),
      ]);
      if (classic.status === "fulfilled") setForecast(classic.value.data);
      if (agents.status === "fulfilled") setAgentForecast(agents.value.data);
    } catch {
      // ignore
    } finally {
      setFcLoading(false);
    }
  }, [symbol]);

  const loadChartIntel = useCallback(async () => {
    setChartIntelLoading(true);
    try {
      const r = await fetch(`${API}/api/predict/${symbol}/chart-intelligence?range=1y`);
      const j = await r.json();
      if (j.data) setChartIntel(j.data);
    } catch {
      // ignore
    } finally {
      setChartIntelLoading(false);
    }
  }, [symbol]);

  const loadTraderToolkit = useCallback(async () => {
    setToolkitLoading(true);
    try {
      const r = await fetch(
        `${API}/api/predict/${symbol}/trader-toolkit?capital=${capital}&risk=${riskPercent}`,
      );
      const j = await r.json();
      if (j.data) setTraderToolkit(j.data);
    } catch {
      // ignore
    } finally {
      setToolkitLoading(false);
    }
  }, [symbol, capital, riskPercent]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadPred();
  }, [loadPred]);
  useEffect(() => {
    loadFc();
  }, [loadFc]);
  useEffect(() => {
    loadChartIntel();
  }, [loadChartIntel]);
  useEffect(() => {
    loadTraderToolkit();
  }, [loadTraderToolkit]);

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/stocks/${symbol}?t=${Date.now()}`, { cache: "no-store" });
        const j = await r.json();
        setQuote(j.data);
      } catch {
        // ignore
      }
    }, 5000);
    return () => clearInterval(t);
  }, [symbol]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, thinking]);

  const sendChat = async (m?: string) => {
    const text = (m ?? chatInput).trim();
    if (!text) return;
    setMsgs((x) => [...x, { role: "user", text }]);
    setChatInput("");
    setThinking(true);
    try {
      const r = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sid.current }),
      });
      const j = await r.json();
      setMsgs((x) => [...x, { role: "ai", text: j.data?.message || "No response." }]);
    } catch {
      setMsgs((x) => [...x, { role: "ai", text: "Backend unavailable." }]);
    } finally {
      setThinking(false);
    }
  };

  const openChat = () => {
    if (!chatOpen) {
      setChatOpen(true);
      if (msgs.length === 0)
        sendChat(`Analyze ${symbol}. Should I buy, sell, or hold? Give price targets and risks.`);
    } else {
      setChatOpen(false);
    }
  };

  const toggleWl = () => {
    const s: string[] = JSON.parse(localStorage.getItem("watchlist") || "[]");
    const n = wl ? s.filter((x) => x !== symbol) : [...s, symbol];
    localStorage.setItem("watchlist", JSON.stringify(n));
    setWl(!wl);
  };

  const isUp = (quote?.changePercent ?? 0) >= 0;

  const agentVerdictPrediction = useMemo<Prediction | null>(() => {
    if (!agentForecast?.primaryHorizon) return null;
    const target = agentForecast.primaryHorizon;
    const currentPrice = Number(quote?.currentPrice) || Number(agentForecast.currentPrice) || 0;
    const priceChange = Number((target.predictedPrice - currentPrice).toFixed(2));
    const priceChangePercent = currentPrice
      ? Number(((priceChange / currentPrice) * 100).toFixed(2))
      : target.changePercent;

    return {
      symbol,
      predictedPrice: target.predictedPrice,
      signal: agentForecast.verdict,
      confidence: target.confidence,
      riskScore: agentForecast.risk.riskScore,
      trend: agentForecast.trend,
      currentPrice,
      priceChange,
      priceChangePercent,
      technicalIndicators: {
        rsi: agentForecast.technicalIndicators?.rsi ?? 50,
        macd: agentForecast.technicalIndicators?.macd ?? 0,
        sma20: agentForecast.technicalIndicators?.sma20 ?? 0,
        sma50: agentForecast.technicalIndicators?.sma50 ?? 0,
        volumeRatio: agentForecast.technicalIndicators?.volumeRatio,
      },
      source: agentForecast.modelVersion,
      cached: false,
    };
  }, [agentForecast, quote?.currentPrice, symbol]);

  const displayedPrediction = agentVerdictPrediction || pred;
  const displayedTargetLabel = agentForecast?.primaryHorizon
    ? `AI TARGET (${agentForecast.primaryHorizon.label.toUpperCase()})`
    : "AI TARGET (1D)";

  const { cd, rd, md, vd } = useMemo(() => {
    if (!history.length) return { cd: [], rd: [], md: [], vd: [] };
    const closes = history.map((d) => d.close);
    const s20 = sma(closes, 20),
      s50 = sma(closes, 50);
    const ri = calcRSI(closes, 14);
    const { ml, sig, hist } = calcMACD(closes);
    const pp = !agentForecast && pred ? Number(pred.predictedPrice) || 0 : 0;
    const cd = history.map((d, i) => ({
      date: d.date.slice(5),
      price: d.close,
      sma20: s20[i] != null ? +s20[i]!.toFixed(2) : null,
      sma50: s50[i] != null ? +s50[i]!.toFixed(2) : null,
    }));
    if (pp > 0 && cd.length > 0) {
      const ld = history[history.length - 1]?.date;
      cd.push({
        date: ld ? `${ld.slice(5)} →` : "Next",
        price: pp,
        sma20: cd[cd.length - 1]?.sma20 ?? null,
        sma50: cd[cd.length - 1]?.sma50 ?? null,
      });
    }
    const rd = history.map((d, i) => ({
      date: d.date.slice(5),
      rsi: ri[i] != null ? +ri[i]!.toFixed(2) : null,
    }));
    const md = history.map((d, i) => ({
      date: d.date.slice(5),
      macd: +ml[i].toFixed(4),
      signal: +sig[i].toFixed(4),
      histogram: +hist[i].toFixed(4),
    }));
    const vd = history.map((d) => ({
      date: d.date.slice(5),
      volume: d.volume,
      up: d.close >= d.open,
    }));
    return { cd, rd, md, vd };
  }, [agentForecast, history, pred]);

  const tabs: ChartTab[] = ["PRICE", "RSI", "MACD"];

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 pt-28 pb-16">
        <Link
          to="/stocks"
          className="mb-6 inline-flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-neon-green transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> BACK TO STOCKS
        </Link>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <div className="relative">
              <Brain className="h-12 w-12 text-neon-green animate-pulse" />
              <div className="absolute inset-0 blur-xl bg-neon-green/30 animate-pulse" />
            </div>
            <div className="font-mono text-sm text-muted-foreground">Loading {symbol}...</div>
          </div>
        ) : (
          <div className="depth-scene">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="depth-panel holo-slab mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-neon-green/20 bg-background/35 p-5"
            >
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-mono text-5xl font-black md:text-6xl">
                    <span className="gradient-text">{symbol}</span>
                  </h1>
                  <button onClick={toggleWl}>
                    {wl ? (
                      <Star className="h-7 w-7 fill-neon-blue text-neon-blue" />
                    ) : (
                      <StarOff className="h-7 w-7 text-muted-foreground hover:text-neon-blue transition-colors" />
                    )}
                  </button>
                </div>
                <div className="font-mono text-base text-muted-foreground">{quote?.shortName}</div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="rounded border border-border px-1.5 py-0.5">
                    {quote?.exchange || "NSE"}
                  </span>
                  <span
                    className={`flex items-center gap-1 ${quote?.marketState === "REGULAR" ? "text-bull" : "text-yellow-500"}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                    {quote?.marketState === "REGULAR" ? "OPEN" : quote?.marketState || "CLOSED"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <motion.div
                  key={quote?.currentPrice}
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1 }}
                  className="dimensional-price font-mono text-5xl font-black"
                >
                  {quote
                    ? `Rs.${quote.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "�"}
                </motion.div>
                <div className={`font-mono text-xl font-bold ${isUp ? "text-bull" : "text-bear"}`}>
                  {isUp ? (
                    <ChevronUp className="inline h-5 w-5" />
                  ) : (
                    <ChevronDown className="inline h-5 w-5" />
                  )}
                  {isUp ? "+" : ""}
                  {quote?.change.toFixed(2)} ({Math.abs(quote?.changePercent ?? 0).toFixed(2)}%)
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  Prev Rs.{quote?.previousClose.toFixed(2)}
                </div>
              </div>
            </motion.div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "HIGH",
                  value: quote ? `Rs.${quote.high.toFixed(2)}` : "�",
                  color: "text-bull",
                },
                {
                  label: "LOW",
                  value: quote ? `Rs.${quote.low.toFixed(2)}` : "�",
                  color: "text-bear",
                },
                { label: "OPEN", value: quote ? `Rs.${quote.open.toFixed(2)}` : "�", color: "" },
                {
                  label: "VOLUME",
                  value: quote?.volume
                    ? quote.volume > 1e6
                      ? `${(quote.volume / 1e6).toFixed(2)}M`
                      : `${(quote.volume / 1000).toFixed(0)}K`
                    : "�",
                  color: "text-neon-blue",
                },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="glass depth-panel depth-hover rounded-xl p-4"
                >
                  <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
                    {s.label}
                  </div>
                  <div className={`mt-1 font-mono text-xl font-bold ${s.color}`}>{s.value}</div>
                </motion.div>
              ))}
            </div>

            <PredictionDisclaimer />

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <div className="glass depth-panel rounded-2xl p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-neon-green" />
                      <span className="font-mono text-sm font-bold tracking-wider">
                        {symbol} CHART
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isBeginner && (
                        <div className="flex gap-1">
                          {tabs.map((t) => (
                            <button
                              key={t}
                              onClick={() => setTab(t)}
                              className={`rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors ${tab === t ? "border-neon-green bg-neon-green/10 text-neon-green" : "border-border text-muted-foreground hover:border-neon-green/40"}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1">
                        {RANGES.map((r) => (
                          <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`rounded-md border px-2 py-1 font-mono text-[10px] transition-colors ${range === r ? "border-neon-green text-neon-green" : "border-border text-muted-foreground"}`}
                          >
                            {r.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {cd.length > 0 ? (
                    <>
                      {tab === "PRICE" && (
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={cd}>
                            <defs>
                              <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,197,94,0.07)" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "#94a3b8", fontSize: 9 }}
                              stroke="rgba(34,197,94,0.15)"
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              tick={{ fill: "#94a3b8", fontSize: 9 }}
                              stroke="rgba(34,197,94,0.15)"
                              domain={["auto", "auto"]}
                              width={60}
                              tickFormatter={fmtY}
                            />
                            <RTooltip content={<Tip />} />
                            <Area
                              type="monotone"
                              dataKey="price"
                              stroke="#22c55e"
                              strokeWidth={2}
                              fill="url(#pg)"
                              dot={false}
                              name="Price"
                            />
                            {!isBeginner && (
                              <>
                                <Line
                                  type="monotone"
                                  dataKey="sma20"
                                  stroke="#60a5fa"
                                  strokeWidth={1.5}
                                  dot={false}
                                  strokeDasharray="4 2"
                                  name="SMA20"
                                />
                                <Line
                                  type="monotone"
                                  dataKey="sma50"
                                  stroke="#c084fc"
                                  strokeWidth={1.5}
                                  dot={false}
                                  strokeDasharray="2 3"
                                  name="SMA50"
                                />
                              </>
                            )}
                          </ComposedChart>
                        </ResponsiveContainer>
                      )}
                      {tab === "RSI" && (
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={rd}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,197,94,0.07)" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "#94a3b8", fontSize: 9 }}
                              stroke="rgba(34,197,94,0.15)"
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              domain={[0, 100]}
                              tick={{ fill: "#94a3b8", fontSize: 9 }}
                              stroke="rgba(34,197,94,0.15)"
                              width={35}
                            />
                            <RTooltip />
                            <ReferenceLine
                              y={70}
                              stroke="rgba(239,68,68,0.6)"
                              strokeDasharray="4 2"
                              label={{
                                value: "70",
                                fill: "#ef4444",
                                fontSize: 9,
                                fontFamily: "monospace",
                              }}
                            />
                            <ReferenceLine
                              y={30}
                              stroke="rgba(34,197,94,0.6)"
                              strokeDasharray="4 2"
                              label={{
                                value: "30",
                                fill: "#22c55e",
                                fontSize: 9,
                                fontFamily: "monospace",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="rsi"
                              stroke="#60a5fa"
                              strokeWidth={2}
                              dot={false}
                              name="RSI"
                              connectNulls
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      )}
                      {tab === "MACD" && (
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={md}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,197,94,0.07)" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "#94a3b8", fontSize: 9 }}
                              stroke="rgba(34,197,94,0.15)"
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              tick={{ fill: "#94a3b8", fontSize: 9 }}
                              stroke="rgba(34,197,94,0.15)"
                              width={50}
                            />
                            <RTooltip />
                            <ReferenceLine y={0} stroke="rgba(148,163,184,0.5)" />
                            <Bar dataKey="histogram" name="Histogram">
                              {md.map((d, i) => (
                                <Cell
                                  key={i}
                                  fill={
                                    d.histogram >= 0 ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)"
                                  }
                                />
                              ))}
                            </Bar>
                            <Line
                              type="monotone"
                              dataKey="macd"
                              stroke="#22c55e"
                              strokeWidth={2}
                              dot={false}
                              name="MACD"
                            />
                            <Line
                              type="monotone"
                              dataKey="signal"
                              stroke="#c084fc"
                              strokeWidth={1.5}
                              dot={false}
                              strokeDasharray="4 2"
                              name="Signal"
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      )}
                      {!isBeginner && (
                        <>
                          <div className="mt-1">
                            <ResponsiveContainer width="100%" height={50}>
                              <BarChart data={vd}>
                                <Bar dataKey="volume">
                                  {vd.map((d, i) => (
                                    <Cell
                                      key={i}
                                      fill={d.up ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}
                                    />
                                  ))}
                                </Bar>
                                <XAxis dataKey="date" hide />
                                <YAxis hide />
                              </BarChart>
                            </ResponsiveContainer>
                            <div className="font-mono text-[9px] text-muted-foreground text-center">
                              VOLUME
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-4 rounded bg-green-500/70" /> Price
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="h-0.5 w-4 border-t-2 border-dashed border-blue-400" />{" "}
                              SMA20
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="h-0.5 w-4 border-t-2 border-dashed border-purple-400" />{" "}
                              SMA50
                            </span>
                          </div>
                        </>
                      )}
                      {isBeginner && (
                        <div className="mt-2 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-4 rounded bg-green-500/70" /> Stock Price Trajectory
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex h-64 items-center justify-center font-mono text-sm text-muted-foreground">
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin text-neon-green" /> Loading
                      chart...
                    </div>
                  )}
                </div>

                {displayedPrediction && !isBeginner && (
                  <div className="glass rounded-2xl p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-neon-green" />
                      <span className="font-mono text-sm font-bold tracking-wider">
                        TECHNICAL INDICATORS
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {(() => {
                        const ti = displayedPrediction.technicalIndicators ?? {};
                        const r = Number(ti.rsi) || 50,
                          m = Number(ti.macd) || 0;
                        const s20 = Number(ti.sma20) || 0,
                          s50 = Number(ti.sma50) || 0;
                        return [
                          {
                            label: "RSI (14)",
                            value: r.toFixed(1),
                            status: r > 70 ? "OVERBOUGHT" : r < 30 ? "OVERSOLD" : "NEUTRAL",
                            color: r > 70 ? "text-bear" : r < 30 ? "text-bull" : "text-yellow-400",
                          },
                          {
                            label: "MACD",
                            value: m.toFixed(2),
                            status: m > 0 ? "BULLISH" : "BEARISH",
                            color: m > 0 ? "text-bull" : "text-bear",
                          },
                          {
                            label: "SMA 20",
                            value: s20 ? `Rs.${s20.toFixed(0)}` : "�",
                            status:
                              quote && s20 ? (quote.currentPrice > s20 ? "ABOVE" : "BELOW") : "�",
                            color:
                              quote && s20
                                ? quote.currentPrice > s20
                                  ? "text-bull"
                                  : "text-bear"
                                : "",
                          },
                          {
                            label: "SMA 50",
                            value: s50 ? `Rs.${s50.toFixed(0)}` : "�",
                            status: s20 && s50 ? (s20 > s50 ? "GOLDEN X" : "DEATH X") : "�",
                            color: s20 && s50 ? (s20 > s50 ? "text-bull" : "text-bear") : "",
                          },
                        ].map((ind) => (
                          <div
                            key={ind.label}
                            className="depth-hover rounded-xl border border-border/40 bg-background/30 p-3"
                          >
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {ind.label}
                            </div>
                            <div className="font-mono text-lg font-bold">{ind.value}</div>
                            <div className={`font-mono text-[10px] font-bold ${ind.color}`}>
                              {ind.status}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {!isBeginner && (
                  <>
                    <ChartIntelligencePanel
                      analysis={chartIntel}
                      loading={chartIntelLoading}
                      onRefresh={loadChartIntel}
                    />
                    <TraderToolkitPanel
                      symbol={symbol}
                      toolkit={traderToolkit}
                      loading={toolkitLoading}
                      capital={capital}
                      riskPercent={riskPercent}
                      onCapitalChange={setCapital}
                      onRiskChange={setRiskPercent}
                      onRefresh={loadTraderToolkit}
                    />
                  </>
                )}
                <FundamentalAnalysis symbol={symbol} />
                {quote && (
                  <DcfCalculator symbol={symbol} currentPrice={quote.currentPrice} />
                )}
                <NewsSentimentRadar symbol={symbol} />
              </div>

              <div className="space-y-4">
                {predLoading && !displayedPrediction ? (
                  <div className="glass depth-panel rounded-2xl p-8 flex flex-col items-center gap-4">
                    <div className="relative">
                      <Brain className="h-10 w-10 text-neon-green animate-pulse" />
                      <div className="absolute inset-0 blur-lg bg-neon-green/40 animate-pulse" />
                    </div>
                    <div className="font-mono text-sm text-muted-foreground text-center">
                      AI analyzing {symbol}...
                    </div>
                  </div>
                ) : displayedPrediction ? (
                  <VerdictCard
                    pred={displayedPrediction}
                    quote={quote}
                    targetLabel={displayedTargetLabel}
                  />
                ) : (
                  <div className="glass depth-panel rounded-2xl p-6 text-center font-mono text-sm text-muted-foreground">
                    Prediction unavailable
                  </div>
                )}
                <div className="glass depth-panel rounded-2xl p-4 space-y-2">
                  <button
                    onClick={loadPred}
                    disabled={predLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-green to-neon-blue py-3 font-mono text-xs font-bold text-background transition-transform hover:scale-105 disabled:opacity-50"
                  >
                    <Brain className="h-4 w-4" />
                    {predLoading ? "ANALYZING..." : "REFRESH AI ANALYSIS"}
                  </button>
                  <button
                    onClick={openChat}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl border py-3 font-mono text-xs font-bold transition-colors ${chatOpen ? "border-neon-green bg-neon-green/10 text-neon-green" : "border-border text-muted-foreground hover:border-neon-green/50"}`}
                  >
                    <MessageSquare className="h-4 w-4" />
                    {chatOpen ? "CLOSE AI CHAT" : "ASK AI ABOUT THIS STOCK"}
                  </button>
                  <button
                    onClick={toggleWl}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl border py-3 font-mono text-xs transition-colors ${wl ? "border-neon-blue/40 bg-neon-blue/10 text-neon-blue" : "border-border text-muted-foreground hover:border-neon-blue/40"}`}
                  >
                    {wl ? (
                      <Star className="h-4 w-4 fill-current" />
                    ) : (
                      <StarOff className="h-4 w-4" />
                    )}
                    {wl ? "REMOVE FROM WATCHLIST" : "ADD TO WATCHLIST"}
                  </button>
                </div>
              </div>
            </div>

            {!isBeginner && (
              <div className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-neon-green">// AI FUTURE PREDICTION</span>
                  <h2 className="text-2xl font-black">
                    <span className="gradient-text">Future</span> Forecast
                  </h2>
                </div>
                <button
                  onClick={loadFc}
                  disabled={fcLoading}
                  className="flex items-center gap-2 rounded-xl border border-neon-green/40 bg-neon-green/10 px-4 py-2 font-mono text-xs text-neon-green hover:bg-neon-green/20 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${fcLoading ? "animate-spin" : ""}`} />
                  {fcLoading ? "COMPUTING..." : "REFRESH"}
                </button>
              </div>
              {fcLoading && !forecast && !agentForecast ? (
                <div className="glass depth-panel rounded-2xl p-12 flex flex-col items-center gap-4">
                  <Brain className="h-12 w-12 text-neon-green animate-pulse" />
                  <div className="font-mono text-sm text-muted-foreground">
                    Computing future price trajectory...
                  </div>
                </div>
              ) : forecast || agentForecast ? (
                <div className="space-y-6">
                  {agentForecast && (
                    <div className="glass depth-panel rounded-2xl p-6 border border-neon-blue/20">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-neon-blue" />
                            <span className="font-mono text-sm font-bold tracking-wider">
                              MULTI-AGENT FORECAST
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 font-mono text-[9px] ${
                                agentForecast.modelStatus === "TRAINED"
                                  ? "border-bull/30 bg-bull/10 text-bull"
                                  : "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                              }`}
                            >
                              {agentForecast.modelStatus === "TRAINED"
                                ? "TRAINED MODEL"
                                : "FALLBACK MODEL"}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">
                            {agentForecast.summary}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div
                            className={`text-2xl font-black ${agentForecast.verdict === "BUY" ? "text-bull" : agentForecast.verdict === "SELL" ? "text-bear" : "text-neon-blue"}`}
                          >
                            {agentForecast.verdict}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Risk {agentForecast.risk.riskScore}/10 · {agentForecast.risk.riskLevel}
                          </div>
                          <div className="mt-1 text-[9px] text-muted-foreground">
                            {agentForecast.modelVersion}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                        {agentForecast.horizons.map((h, i) => {
                          const up = h.direction === "UP";
                          const down = h.direction === "DOWN";
                          return (
                            <motion.div
                              key={h.days}
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.06 }}
                              className={`rounded-xl border bg-background/30 p-3 ${up ? "border-bull/30" : down ? "border-bear/30" : "border-neon-blue/30"}`}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {h.label.toUpperCase()}
                                </span>
                                {up ? (
                                  <TrendingUp className="h-4 w-4 text-bull" />
                                ) : down ? (
                                  <TrendingDown className="h-4 w-4 text-bear" />
                                ) : (
                                  <Minus className="h-4 w-4 text-neon-blue" />
                                )}
                              </div>
                              <div className="font-mono text-lg font-black">
                                Rs.
                                {h.predictedPrice.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                              <div
                                className={`font-mono text-sm font-bold ${up ? "text-bull" : down ? "text-bear" : "text-neon-blue"}`}
                              >
                                {h.changePercent >= 0 ? "+" : ""}
                                {h.changePercent}%
                              </div>
                              <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                                <span>{h.signal}</span>
                                <TooltipProvider delayDuration={120}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className={`cursor-help ${confidenceTextClass(h.confidence)}`}
                                      >
                                        {Math.round(h.confidence)}%
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Confidence reflects agreement between technical indicators and
                                      recent news. Higher = more signals agree.
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/70">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${Math.min(100, Math.max(0, h.confidence))}%`,
                                  }}
                                  transition={{ delay: 0.2 + i * 0.05, duration: 0.7 }}
                                  className={`h-full ${confidenceBarClass(h.confidence)}`}
                                />
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                      <SignalConfidenceBreakdown forecast={agentForecast} />
                      <div className="mt-4 flex flex-wrap gap-2">
                        {agentForecast.agents.map((agent) => (
                          <span
                            key={agent.name}
                            className="rounded-full border border-neon-blue/20 bg-neon-blue/5 px-2.5 py-1 font-mono text-[10px] text-neon-blue"
                          >
                            {agent.name.replace(/_/g, " ")} · {agent.status}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 rounded-xl border border-neon-blue/20 bg-neon-blue/5 p-3 font-mono text-[11px] text-muted-foreground">
                        <span className="font-bold text-neon-blue">Confidence explanation: </span>
                        {confidenceExplanation(
                          agentForecast.primaryHorizon.confidence,
                          agentForecast.risk.riskScore,
                          agentForecast.modelStatus,
                        )}{" "}
                        Forecasts are educational only and should be checked against market context,
                        liquidity, news, and your own risk rules.
                      </div>
                    </div>
                  )}
                  {forecast && !agentForecast && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {forecast.forecast.map((f, i) => (
                        <motion.div
                          key={f.days}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className={`glass rounded-2xl p-4 border ${f.direction === "UP" ? "border-bull/30" : "border-bear/30"}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {f.label.toUpperCase()}
                            </span>
                            {f.direction === "UP" ? (
                              <TrendingUp className="h-4 w-4 text-bull" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-bear" />
                            )}
                          </div>
                          <div className="font-mono text-lg font-black">
                            Rs.
                            {f.predictedPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </div>
                          <div
                            className={`font-mono text-sm font-bold ${f.direction === "UP" ? "text-bull" : "text-bear"}`}
                          >
                            {f.changePercent >= 0 ? "+" : ""}
                            {f.changePercent}%
                          </div>
                          <div className="mt-2 h-1 rounded-full bg-background/60 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${Math.min(100, Math.abs(f.changePercent) * 10)}%`,
                              }}
                              transition={{ delay: 0.3 + i * 0.08, duration: 0.8 }}
                              className={`h-full rounded-full ${f.direction === "UP" ? "bg-bull" : "bg-bear"}`}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  {forecast && !agentForecast && (
                    <div className="glass rounded-2xl p-6">
                      <div className="mb-4 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-neon-green" />
                        <span className="font-mono text-sm font-bold tracking-wider">
                          30-DAY PRICE FORECAST
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart data={forecast.forecastSeries}>
                          <defs>
                            <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,197,94,0.07)" />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: "#94a3b8", fontSize: 9 }}
                            stroke="rgba(34,197,94,0.15)"
                            interval={3}
                          />
                          <YAxis
                            tick={{ fill: "#94a3b8", fontSize: 9 }}
                            stroke="rgba(34,197,94,0.15)"
                            domain={["auto", "auto"]}
                            width={60}
                            tickFormatter={fmtY}
                          />
                          <RTooltip content={<Tip />} />
                          <ReferenceLine
                            x={forecast.forecastSeries.find((s) => s.type === "forecast")?.date}
                            stroke="rgba(96,165,250,0.5)"
                            strokeDasharray="4 4"
                            label={{
                              value: "TODAY",
                              fill: "#60a5fa",
                              fontSize: 8,
                              fontFamily: "monospace",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="actual"
                            stroke="#22c55e"
                            strokeWidth={2}
                            fill="url(#ag)"
                            dot={false}
                            connectNulls={false}
                            name="actual"
                          />
                          <Line
                            type="monotone"
                            dataKey="forecast"
                            stroke="#60a5fa"
                            strokeWidth={2}
                            strokeDasharray="5 3"
                            dot={false}
                            connectNulls={false}
                            name="forecast"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div className="mt-2 flex gap-4 font-mono text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-4 rounded bg-green-500/70" /> Historical
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-0.5 w-4 border-t-2 border-dashed border-blue-400" /> AI
                          Forecast
                        </span>
                      </div>
                    </div>
                  )}
                  {forecast?.narrative && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass rounded-2xl p-6 border border-neon-green/20"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <Brain className="h-5 w-5 text-neon-green" />
                        <span className="font-mono text-sm font-bold tracking-wider">
                          GEMINI AI NARRATIVE
                        </span>
                        <span className="ml-auto rounded-full bg-neon-green/10 border border-neon-green/30 px-2 py-0.5 font-mono text-[9px] text-neon-green">
                          GEMINI 1.5 FLASH
                        </span>
                      </div>
                      <div
                        className="font-mono text-xs leading-relaxed text-muted-foreground"
                        dangerouslySetInnerHTML={{
                          __html: forecast.narrative
                            .replace(
                              /\*\*(.+?)\*\*/g,
                              "<strong class='text-foreground'>$1</strong>",
                            )
                            .replace(/\n/g, "<br/>"),
                        }}
                      />
                    </motion.div>
                  )}
                  <div className="font-mono text-[9px] text-muted-foreground text-center">
                    AI forecasts use technical analysis + momentum modeling. Not financial advice.
                  </div>
                </div>
              ) : null}
            </div>
            )}

            <AnimatePresence>
              {chatOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 overflow-hidden"
                >
                  <div className="glass flex h-[500px] flex-col rounded-2xl">
                    <div className="flex items-center gap-2 border-b border-neon-green/20 p-4">
                      <Brain className="h-5 w-5 text-neon-green animate-pulse" />
                      <div>
                        <div className="font-mono text-sm font-bold">AI ANALYST � {symbol}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          Powered by Gemini 1.5 Flash
                        </div>
                      </div>
                      <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-neon-green">
                        <span className="h-1.5 w-1.5 rounded-full bg-neon-green animate-blink" />{" "}
                        LIVE
                      </span>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                      {msgs.map((msg, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
                        >
                          {msg.role === "ai" && (
                            <Brain className="mt-1 h-4 w-4 shrink-0 text-neon-green" />
                          )}
                          <div
                            className={`max-w-[85%] rounded-xl px-3 py-2 font-mono text-xs leading-relaxed ${msg.role === "ai" ? "border border-neon-green/30 bg-neon-green/5" : "border border-neon-blue/30 bg-neon-blue/10"}`}
                            dangerouslySetInnerHTML={{
                              __html: msg.text
                                .replace(
                                  /\*\*(.+?)\*\*/g,
                                  "<strong class='text-neon-green'>$1</strong>",
                                )
                                .replace(/\n/g, "<br/>"),
                            }}
                          />
                        </motion.div>
                      ))}
                      {thinking && (
                        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                          <Brain className="h-4 w-4 text-neon-green" />
                          <span className="flex gap-1">
                            {[0, 0.2, 0.4].map((d) => (
                              <span
                                key={d}
                                className="h-1.5 w-1.5 rounded-full bg-neon-green animate-blink"
                                style={{ animationDelay: `${d}s` }}
                              />
                            ))}
                          </span>
                          analyzing {symbol}...
                        </div>
                      )}
                      <div ref={bottomRef} />
                    </div>
                    <div className="flex flex-wrap gap-1 border-t border-neon-green/10 px-3 pt-2">
                      {[`Buy ${symbol}?`, "Price target?", "Key risks?", "Fundamentals?"].map(
                        (q) => (
                          <button
                            key={q}
                            onClick={() => sendChat(q)}
                            className="rounded-lg border border-neon-green/20 bg-neon-green/5 px-2 py-1 font-mono text-[10px] text-neon-green hover:bg-neon-green/15 transition-colors"
                          >
                            {q}
                          </button>
                        ),
                      )}
                    </div>
                    <div className="flex gap-2 border-t border-neon-green/10 p-3">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendChat()}
                        placeholder={`Ask anything about ${symbol}...`}
                        className="flex-1 rounded-lg border border-neon-green/30 bg-background/50 px-3 py-2 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-neon-green"
                      />
                      <button
                        onClick={() => sendChat()}
                        className="rounded-lg bg-gradient-to-r from-neon-green to-neon-blue px-4 font-mono text-xs font-bold text-background hover:scale-105 transition-transform"
                      >
                        SEND
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
