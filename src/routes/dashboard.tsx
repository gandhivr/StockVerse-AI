import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Gauge,
  RefreshCw,
  Shield,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Navbar } from "@/components/Navbar";
import { StockTicker } from "@/components/StockTicker";
import { StockChart } from "@/components/StockChart";
import { PredictionPanel } from "@/components/PredictionPanel";
import { AIChat } from "@/components/AIChat";
import { MarketHeatmap } from "@/components/MarketHeatmap";
import { RotatingGlobe } from "@/components/RotatingGlobe";
import { AIMarketScanner } from "@/components/AIMarketScanner";
import { FearGreedIndex } from "@/components/FearGreedIndex";
import { TrendingStocks } from "@/components/TrendingStocks";
import { SectorPerformance } from "@/components/SectorPerformance";
import { AISentiment } from "@/components/AISentiment";
import { IPOTracker } from "@/components/IPOTracker";
import { VoiceButton } from "@/components/VoiceButton";
import { SystemStatus } from "@/components/SystemStatus";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "AI Dashboard - StockVerse AI" },
      {
        name: "description",
        content:
          "Real-time Indian stock market dashboard with AI predictions, live charts, sentiment analysis, and an AI trading co-pilot.",
      },
      { property: "og:title", content: "StockVerse AI Dashboard" },
      { property: "og:description", content: "Real-time NSE/BSE intelligence powered by neural AI." },
    ],
  }),
  component: Dashboard,
});

type DashboardStat = {
  label: string;
  value: number;
  change: number;
  up: boolean;
  icon: typeof TrendingUp;
  kind: "price" | "count";
};

type DashboardMover = {
  symbol: string;
  price: number;
  changePercent: number;
  up: boolean;
};

type RiskScanItem = {
  symbol: string;
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  price: number;
  riskReward: number;
  trend: string;
};

function formatValue(stat: DashboardStat) {
  if (stat.kind === "count") return stat.value.toLocaleString("en-IN");
  return stat.value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function TraderRiskDashboard() {
  const [items, setItems] = useState<RiskScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState("");

  const fetchRisk = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/predict/risk-dashboard");
      const json = await res.json();
      setItems(json.data?.watchlist || []);
      setUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisk();
  }, []);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-neon-green" />
          <h3 className="font-mono text-sm font-bold tracking-wider">TRADER RISK DASHBOARD</h3>
        </div>
        <button
          onClick={fetchRisk}
          disabled={loading}
          className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-neon-green/40 hover:text-foreground disabled:opacity-50"
          aria-label="Refresh trader risk dashboard"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {(items.length ? items : Array.from({ length: 4 })).slice(0, 8).map((item: any, index) => {
          const signal = item?.signal || "HOLD";
          const bullish = signal === "BUY";
          const bearish = signal === "SELL";
          return (
            <Link
              key={item?.symbol || index}
              to={item?.symbol ? "/stocks/$symbol" : "/stocks"}
              params={item?.symbol ? { symbol: item.symbol } : undefined}
              className="rounded-xl border border-border/40 bg-background/30 p-4 transition-all hover:border-neon-green/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold">{item?.symbol || "SCANNING"}</span>
                {bearish ? (
                  <AlertTriangle className="h-4 w-4 text-bear" />
                ) : bullish ? (
                  <TrendingUp className="h-4 w-4 text-bull" />
                ) : (
                  <Activity className="h-4 w-4 text-neon-blue" />
                )}
              </div>
              <div className={`mt-2 font-mono text-lg font-black ${bullish ? "text-bull" : bearish ? "text-bear" : "text-neon-blue"}`}>
                {loading && !items.length ? "..." : signal}
              </div>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                Confidence {Number(item?.confidence || 0).toFixed(0)}% | RR {Number(item?.riskReward || 0).toFixed(2)}x
              </div>
            </Link>
          );
        })}
      </div>
      <div className="mt-3 font-mono text-[10px] text-muted-foreground">
        Educational scanner based on chart structure and risk/reward. {updated && `Updated ${updated}`}
      </div>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [movers, setMovers] = useState<DashboardMover[]>([]);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketMood, setMarketMood] = useState("SYNCING");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchLiveData = async () => {
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const [idxRes, scanRes] = await Promise.all([
        fetch("/api/stocks?symbols=NIFTY50,SENSEX,BANKNIFTY"),
        fetch("/api/market-scan"),
      ]);
      const idxJson = await idxRes.json();
      const scanJson = await scanRes.json();
      const scan = scanJson.data;

      const indexStats: DashboardStat[] = (idxJson.data || []).map((live: any) => {
        const label =
          live.appSymbol === "NIFTY50"
            ? "NIFTY 50"
            : live.appSymbol === "BANKNIFTY"
              ? "BANK NIFTY"
              : live.appSymbol || live.symbol;
        return {
          label,
          value: Number(live.currentPrice || 0),
          change: Number(live.changePercent || 0),
          up: Number(live.changePercent || 0) >= 0,
          icon: Number(live.changePercent || 0) >= 0 ? TrendingUp : TrendingDown,
          kind: "price",
        };
      });

      const breadthStat: DashboardStat | null = scan?.marketSummary
        ? {
            label: "MARKET BREADTH",
            value: Number(scan.marketSummary.advancing || 0),
            change: Number(scan.marketSummary.avgChange || 0),
            up: Number(scan.marketSummary.avgChange || 0) >= 0,
            icon: Gauge,
            kind: "count",
          }
        : null;

      setStats(breadthStat ? [...indexStats.slice(0, 3), breadthStat] : indexStats.slice(0, 4));
      setMarketOpen((idxJson.data || []).some((d: any) => d.marketState === "REGULAR"));
      setMarketMood(scan?.marketSummary?.marketMood || "NEUTRAL");

      const gainers = (scan?.topGainers || []).slice(0, 3).map((g: any) => ({
        symbol: g.symbol,
        price: Number(g.price || 0),
        changePercent: Number(g.changePercent || 0),
        up: true,
      }));
      const losers = (scan?.topLosers || []).slice(0, 2).map((l: any) => ({
        symbol: l.symbol,
        price: Number(l.price || 0),
        changePercent: Number(l.changePercent || 0),
        up: false,
      }));
      setMovers([...gainers, ...losers]);
      setLastUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Live dashboard data is unavailable.");
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
    const timer = window.setInterval(fetchLiveData, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const displayedStats = stats.length
    ? stats
    : Array.from({ length: 4 }, () => ({
        label: dashboardLoading ? "LOADING LIVE DATA" : "DATA UNAVAILABLE",
        value: 0,
        change: 0,
        up: true,
        icon: Activity,
        kind: "count" as const,
      }));

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 pt-28 pb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <span className="font-mono text-xs text-neon-green">// COMMAND CENTER</span>
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              <span className="gradient-text">AI</span> Dashboard
            </h1>
          </div>
          <div className="glass flex flex-wrap items-center gap-3 rounded-xl px-4 py-2 font-mono text-xs">
            <Activity className="h-4 w-4 animate-pulse text-neon-green" />
            <span className="text-muted-foreground">MARKET:</span>
            <span className={marketOpen ? "text-bull" : "text-yellow-400"}>
              {marketOpen ? "OPEN" : "CLOSED"}
            </span>
            <span className="text-muted-foreground">MOOD:</span>
            <span
              className={
                marketMood === "BULLISH"
                  ? "text-bull"
                  : marketMood === "BEARISH"
                    ? "text-bear"
                    : "text-yellow-400"
              }
            >
              {marketMood}
            </span>
            {lastUpdated && <span className="text-muted-foreground">Updated {lastUpdated}</span>}
            <button
              onClick={fetchLiveData}
              disabled={dashboardLoading}
              className="rounded-md border border-border/60 p-1 text-muted-foreground transition-colors hover:border-neon-green/40 hover:text-foreground disabled:opacity-50"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${dashboardLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </motion.div>

        <div className="mb-6 overflow-hidden rounded-xl">
          <StockTicker />
        </div>

        <div className="mb-6">
          <SystemStatus />
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {displayedStats.map((stat, i) => (
            <motion.div
              key={`${stat.label}-${i}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -4 }}
              className="glass relative overflow-hidden rounded-2xl p-5 transition-shadow hover:neon-border"
            >
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-neon-green/10 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  {stat.label}
                </span>
                <stat.icon className={`h-4 w-4 ${stat.up ? "text-bull" : "text-bear"}`} />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold">
                {dashboardLoading && !stats.length ? "..." : formatValue(stat)}
              </div>
              <div className={`mt-1 font-mono text-xs ${stat.up ? "text-bull" : "text-bear"}`}>
                {stat.up ? "UP" : "DOWN"} {stat.change >= 0 ? "+" : ""}
                {stat.change.toFixed(2)}%
              </div>
            </motion.div>
          ))}
        </div>

        {dashboardError && (
          <div className="mb-6 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-4 font-mono text-xs text-yellow-200">
            {dashboardError}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <StockChart />
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-mono text-sm font-bold tracking-wider">TOP MOVERS</h3>
              <Link to="/stocks" className="font-mono text-[10px] text-neon-green hover:underline">
                VIEW ALL
              </Link>
            </div>
            <div className="space-y-3">
              {movers.map((mover, i) => (
                <Link key={mover.symbol} to="/stocks/$symbol" params={{ symbol: mover.symbol }}>
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-3 transition-all hover:border-neon-green/40 hover:shadow-[0_0_15px_oklch(0.88_0.27_150/0.15)]"
                  >
                    <div>
                      <div className="font-mono text-sm font-bold">{mover.symbol}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        INR {mover.price.toFixed(2)}
                      </div>
                    </div>
                    <div className={`font-mono text-sm font-bold ${mover.up ? "text-bull" : "text-bear"}`}>
                      {mover.up ? "UP" : "DOWN"} {mover.changePercent >= 0 ? "+" : ""}
                      {mover.changePercent.toFixed(2)}%
                    </div>
                  </motion.div>
                </Link>
              ))}
              {!movers.length && (
                <div className="rounded-lg border border-border/50 bg-background/30 p-4 font-mono text-xs text-muted-foreground">
                  {dashboardLoading ? "Loading live movers..." : "Top movers are unavailable right now."}
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-center">
              <RotatingGlobe size={180} />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <AIMarketScanner />
        </div>

        <div className="mt-6">
          <PredictionPanel />
        </div>

        <div className="mt-6">
          <TraderRiskDashboard />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TrendingStocks />
          </div>
          <FearGreedIndex />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <SectorPerformance />
          <AISentiment />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="glass rounded-2xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-mono text-sm font-bold tracking-wider">SECTOR HEATMAP</h3>
                <span className="font-mono text-[10px] text-neon-green animate-blink">LIVE</span>
              </div>
              <MarketHeatmap />
            </div>
          </div>
          <AIChat />
        </div>

        <div className="mt-6">
          <IPOTracker />
        </div>

        <div className="mt-8 glass rounded-xl p-4 font-mono text-[10px] text-muted-foreground">
          <div className="grid gap-2 md:grid-cols-4">
            <div>
              DATA_MODE: <span className="text-neon-green">LIVE API</span>
            </div>
            <div>
              API_PROXY: <span className="text-foreground">/api</span>
            </div>
            <div>
              LAST_REFRESH: <span className="text-foreground">{lastUpdated || "PENDING"}</span>
            </div>
            <div>
              MARKET_MOOD: <span className="text-neon-green">{marketMood}</span>
            </div>
          </div>
        </div>
      </div>

      <VoiceButton />
    </div>
  );
}
