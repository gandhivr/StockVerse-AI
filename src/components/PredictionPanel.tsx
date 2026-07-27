import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  Info,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { explainPrediction } from "@/lib/prediction-explain";
import type { Prediction } from "@/lib/api";

const SYMBOLS = ["RELIANCE", "TCS", "INFY", "SBIN", "HDFCBANK", "WIPRO"];

interface PredResult {
  s: string;
  action: string;
  conf: number;
  target: string;
  change: number;
  color: "bull" | "bear" | "neon-blue";
  reasons: string[];
  source: string;
  riskScore: number;
}

const colorMap = {
  bull: "text-bull border-bull/40 bg-bull/10",
  bear: "text-bear border-bear/40 bg-bear/10",
  "neon-blue": "text-neon-blue border-neon-blue/40 bg-neon-blue/10",
};

const pendingPrediction = (symbol: string): PredResult => ({
  s: symbol,
  action: "WAIT",
  conf: 0,
  target: "pending",
  change: 0,
  color: "neon-blue",
  reasons: ["Waiting for backend prediction data."],
  source: "pending",
  riskScore: 0,
});

export function PredictionPanel() {
  const [predictions, setPredictions] = useState<PredResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPredictions = async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.allSettled(
        SYMBOLS.map((s) => fetch(`/api/predict/${s}`).then((r) => r.json())),
      );
      const parsed: PredResult[] = results
        .map((r, i) => {
          if (r.status !== "fulfilled") return null;
          const d = r.value?.data as Prediction | undefined;
          if (!d) return null;
          const action = d.signal || "HOLD";
          return {
            s: SYMBOLS[i],
            action,
            conf: Math.round(Number(d.confidence) || 60),
            target: `INR ${Number(d.predictedPrice || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
            change: Number(d.priceChangePercent) || 0,
            color: action === "BUY" ? "bull" : action === "SELL" ? "bear" : "neon-blue",
            reasons: explainPrediction(d),
            source: d.cached ? `${d.source} cache` : d.source,
            riskScore: Number(d.riskScore) || 0,
          } as PredResult;
        })
        .filter(Boolean) as PredResult[];

      if (parsed.length) setPredictions(parsed);
      else setError("Prediction service did not return usable results. Check backend and ML status.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction service is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, []);

  const IconFor = (action: string) =>
    action === "BUY" ? TrendingUp : action === "SELL" ? TrendingDown : Minus;
  const visiblePredictions = predictions.length ? predictions : SYMBOLS.map(pendingPrediction);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 animate-pulse-glow text-neon-green" />
          <h3 className="font-mono text-sm font-bold tracking-wider">AI PREDICTION ENGINE</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPredictions}
            disabled={loading}
            className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-neon-green/40 hover:text-foreground disabled:opacity-50"
            aria-label="Refresh predictions"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <span className="flex items-center gap-1 font-mono text-[10px] text-neon-green">
            <span className="h-2 w-2 animate-blink rounded-full bg-neon-green" /> LIVE
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-3 font-mono text-xs text-yellow-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visiblePredictions.map((p, i) => {
          const Icon = IconFor(p.action);
          return (
            <motion.div
              key={p.s}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className={`cursor-pointer rounded-xl border p-4 backdrop-blur-sm ${colorMap[p.color]}`}
            >
              <Link to="/stocks/$symbol" params={{ symbol: p.s }} className="block">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{p.s}</span>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-2 font-mono text-2xl font-bold">{p.action}</div>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-muted-foreground">Confidence</span>
                    <span>{p.conf}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-background/60">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.conf}%` }}
                      transition={{ delay: 0.3 + i * 0.08, duration: 0.8 }}
                      className="h-full bg-current"
                    />
                  </div>
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-muted-foreground">Target</span>
                    <span className="font-bold">{p.target}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-muted-foreground">Risk</span>
                    <span className="font-bold">{p.riskScore ? `${p.riskScore}/10` : "pending"}</span>
                  </div>
                  {p.change !== 0 && (
                    <div
                      className={`font-mono text-[10px] font-bold ${p.change >= 0 ? "text-bull" : "text-bear"}`}
                    >
                      {p.change >= 0 ? "+" : ""}
                      {p.change.toFixed(2)}%
                    </div>
                  )}
                  <div className="rounded-lg bg-background/30 p-2">
                    <div className="mb-1 flex items-center gap-1 font-mono text-[10px] font-bold">
                      <Info className="h-3 w-3" /> WHY
                    </div>
                    <ul className="space-y-1">
                      {p.reasons.slice(0, 3).map((reason) => (
                        <li
                          key={reason}
                          className="font-mono text-[10px] leading-relaxed text-muted-foreground"
                        >
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Source: {p.source}
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
