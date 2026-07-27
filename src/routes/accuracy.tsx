import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, BarChart3, Brain, CheckCircle, RefreshCw } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Navbar } from "@/components/Navbar";
import { api, type AccuracyDashboard } from "@/lib/api";

export const Route = createFileRoute("/accuracy")({
  head: () => ({ meta: [{ title: "Accuracy - StockVerse AI" }] }),
  component: AccuracyPage,
});

function pct(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function AccuracyPage() {
  const [data, setData] = useState<AccuracyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.accuracy.get());
    } finally {
      setLoading(false);
    }
  };

  const reconcile = async () => {
    setReconciling(true);
    try {
      await api.accuracy.reconcile();
      await load();
    } finally {
      setReconciling(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const skipped = useMemo(() => data?.coverage.fallback.slice(0, 80) || [], [data]);

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-28">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="font-mono text-xs text-neon-green">// MODEL TRUST CENTER</span>
            <h1 className="text-4xl font-black md:text-5xl">
              <span className="gradient-text">Backtesting</span> Accuracy
            </h1>
            <p className="mt-2 max-w-3xl font-mono text-sm text-muted-foreground">
              Track trained model coverage, saved predictions, after-close actual comparison, and
              fallback symbols.
            </p>
          </div>
          <button
            onClick={reconcile}
            disabled={reconciling}
            className="flex items-center gap-2 rounded-xl border border-neon-green/40 bg-neon-green/10 px-4 py-2 font-mono text-xs text-neon-green disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${reconciling ? "animate-spin" : ""}`} />
            COMPARE ACTUALS NOW
          </button>
        </div>

        {loading ? (
          <div className="glass flex items-center justify-center gap-3 rounded-2xl p-12 font-mono text-sm text-muted-foreground">
            <Brain className="h-5 w-5 animate-pulse text-neon-green" /> Loading accuracy data...
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              {[
                {
                  label: "TRAINED MODELS",
                  value: data.coverage.trainedCount,
                  icon: CheckCircle,
                  color: "text-bull",
                },
                {
                  label: "FALLBACK SYMBOLS",
                  value: data.coverage.fallbackCount,
                  icon: AlertTriangle,
                  color: "text-yellow-400",
                },
                {
                  label: "TRACKED RUNS",
                  value: data.accuracy.trackedPredictions,
                  icon: Activity,
                  color: "text-neon-blue",
                },
                {
                  label: "RESOLVED HORIZONS",
                  value: data.accuracy.resolvedHorizons,
                  icon: BarChart3,
                  color: "text-neon-green",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-2xl p-5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.label}
                    </span>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div className={`font-mono text-3xl font-black ${item.color}`}>{item.value}</div>
                </motion.div>
              ))}
            </div>

            <section className="glass rounded-2xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-neon-green" />
                <h2 className="font-mono text-sm font-bold tracking-wider">HORIZON ACCURACY</h2>
              </div>
              {data.accuracy.horizons.length ? (
                <div className="grid gap-3 md:grid-cols-5">
                  {data.accuracy.horizons.map((horizon) => (
                    <div
                      key={horizon.days}
                      className="rounded-xl border border-border/40 bg-background/30 p-4"
                    >
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {horizon.label}
                      </div>
                      <div className="mt-2 font-mono text-lg font-bold text-neon-green">
                        {pct(horizon.directionAccuracy)}
                      </div>
                      <div className="mt-2 space-y-1 font-mono text-[10px] text-muted-foreground">
                        <div>Direction accuracy</div>
                        <div>MAE Rs.{horizon.mae}</div>
                        <div>MAPE {pct(horizon.mape)}</div>
                        <div>{horizon.count} checked</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 font-mono text-xs text-muted-foreground">
                  No resolved predictions yet. The after-close comparison job will fill this after
                  predictions mature.
                </div>
              )}
            </section>

            <section className="glass rounded-2xl border border-yellow-400/20 p-6">
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <h2 className="font-mono text-sm font-bold tracking-wider">MODEL LIMITATIONS</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-bull/20 bg-bull/5 p-4">
                  <div className="mb-2 font-mono text-[10px] font-bold text-bull">
                    WHAT IT CAN READ
                  </div>
                  <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                    Technical momentum, trend continuation, volatility, volume shifts, and moving
                    average structure from historical prices.
                  </p>
                </div>
                <div className="rounded-xl border border-bear/20 bg-bear/5 p-4">
                  <div className="mb-2 font-mono text-[10px] font-bold text-bear">
                    WHAT IT CANNOT KNOW
                  </div>
                  <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                    Future news events, earnings surprises, regulatory decisions, macro shocks, or
                    sudden liquidity changes before they appear in data.
                  </p>
                </div>
                <div className="rounded-xl border border-neon-blue/20 bg-neon-blue/5 p-4">
                  <div className="mb-2 font-mono text-[10px] font-bold text-neon-blue">
                    BACKTESTED REALITY
                  </div>
                  <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                    {data.accuracy.resolvedHorizons} resolved horizons across{" "}
                    {data.accuracy.trackedPredictions} tracked prediction runs. Use the live
                    reconcile control above to POST /api/accuracy/reconcile and refresh settled
                    comparisons.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="glass rounded-2xl p-6">
                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-bull" />
                  <h2 className="font-mono text-sm font-bold tracking-wider">
                    TRAINED VS FALLBACK
                  </h2>
                </div>
                <div className="mb-4 h-3 overflow-hidden rounded-full bg-background/60">
                  <div
                    className="h-full bg-bull"
                    style={{
                      width: `${(data.coverage.trainedCount / data.coverage.totalSymbols) * 100}%`,
                    }}
                  />
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {data.coverage.trainedCount} of {data.coverage.totalSymbols} symbols use trained
                  artifacts. The remaining symbols use live fallback models until Yahoo mappings or
                  data coverage are fixed.
                </div>
              </div>

              <div className="glass rounded-2xl p-6">
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  <h2 className="font-mono text-sm font-bold tracking-wider">SKIPPED SYMBOLS</h2>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-border/40 bg-background/30 p-3">
                  <div className="flex flex-wrap gap-2">
                    {skipped.map((symbol) => (
                      <Link
                        key={symbol}
                        to="/stocks/$symbol"
                        params={{ symbol }}
                        className="rounded-full border border-yellow-400/20 bg-yellow-400/5 px-2 py-1 font-mono text-[10px] text-yellow-400"
                      >
                        {symbol}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="glass rounded-2xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-neon-blue" />
                <h2 className="font-mono text-sm font-bold tracking-wider">RECENT COMPARISONS</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] font-mono text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="p-2">Symbol</th>
                      <th className="p-2">Model</th>
                      <th className="p-2">Generated</th>
                      <th className="p-2">Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accuracy.recent.map((record) => (
                      <tr
                        key={`${record.symbol}-${record.generatedAt}`}
                        className="border-t border-border/30"
                      >
                        <td className="p-2 text-neon-green">{record.symbol}</td>
                        <td className="p-2 text-muted-foreground">{record.modelVersion}</td>
                        <td className="p-2 text-muted-foreground">
                          {new Date(record.generatedAt).toLocaleString()}
                        </td>
                        <td className="p-2">
                          {record.horizons.filter((horizon) => horizon.resolvedAt).length}/
                          {record.horizons.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
