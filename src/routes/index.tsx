import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Globe,
  LineChart,
  RefreshCw,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Navbar } from "@/components/Navbar";
import { StockTicker } from "@/components/StockTicker";
import { FloatingStockCards } from "@/components/FloatingStockCards";
import { RotatingGlobe } from "@/components/RotatingGlobe";
import { MarketHeatmap } from "@/components/MarketHeatmap";
import { BootSequence } from "@/components/BootSequence";
import { AIMarketScanner } from "@/components/AIMarketScanner";
import { FearGreedIndex } from "@/components/FearGreedIndex";
import { TrendingStocks } from "@/components/TrendingStocks";
import { SectorPerformance } from "@/components/SectorPerformance";
import { AISentiment } from "@/components/AISentiment";
import { VoiceButton } from "@/components/VoiceButton";
import { SystemStatus } from "@/components/SystemStatus";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StockVerse AI - Indian Stock Market Intelligence" },
      {
        name: "description",
        content:
          "Live NSE/BSE dashboard with market scanner, AI predictions, news sentiment, portfolio intelligence, and risk signals.",
      },
      { property: "og:title", content: "StockVerse AI" },
      { property: "og:description", content: "Live Indian stock market intelligence powered by AI." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [booted, setBooted] = useState(false);
  const [heroStats, setHeroStats] = useState([
    { value: "...", label: "STOCKS SCANNED" },
    { value: "...", label: "ADVANCING" },
    { value: "...", label: "DECLINING" },
    { value: "SYNC", label: "MARKET MOOD" },
  ]);
  const [homeStatus, setHomeStatus] = useState("SYNCING");
  const [lastUpdated, setLastUpdated] = useState("");
  const handleBootComplete = useCallback(() => setBooted(true), []);

  useEffect(() => {
    const loadHomeSnapshot = async () => {
      try {
        const [scanRes, healthRes] = await Promise.all([
          fetch("/api/market-scan"),
          fetch("/api/system/health"),
        ]);
        const scanJson = await scanRes.json();
        const healthJson = await healthRes.json();
        const summary = scanJson.data?.marketSummary;

        setHeroStats([
          {
            value: Number(scanJson.data?.totalStocksScanned || 0).toLocaleString("en-IN"),
            label: "STOCKS SCANNED",
          },
          { value: Number(summary?.advancing || 0).toLocaleString("en-IN"), label: "ADVANCING" },
          { value: Number(summary?.declining || 0).toLocaleString("en-IN"), label: "DECLINING" },
          { value: summary?.marketMood || "NEUTRAL", label: "MARKET MOOD" },
        ]);
        setHomeStatus(healthJson.status === "online" ? "SYSTEM ONLINE" : "DEGRADED MODE");
        setLastUpdated(new Date().toLocaleTimeString("en-IN"));
      } catch {
        setHomeStatus("LIMITED DATA");
      }
    };

    loadHomeSnapshot();
    const timer = window.setInterval(loadHomeSnapshot, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative min-h-screen">
      {!booted && <BootSequence onComplete={handleBootComplete} />}
      <AnimatedBackground />
      <Navbar />

      <section className="relative overflow-hidden px-4 pt-28 pb-16">
        <FloatingStockCards />
        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-2 font-mono text-xs"
          >
            <span className="h-2 w-2 rounded-full bg-neon-green animate-blink" />
            <span className="text-muted-foreground">{homeStatus} · NSE/BSE LIVE FEED</span>
            <Activity className="h-3 w-3 text-neon-blue" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl font-black leading-[1.05] tracking-tight md:text-7xl lg:text-8xl"
          >
            <span className="block gradient-text">StockVerse AI</span>
            <span className="block text-foreground">Live Market Command</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg"
          >
            Track live Indian market breadth, AI signals, sentiment, portfolio risk, and
            multi-horizon predictions from one operational dashboard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex flex-wrap justify-center gap-4"
          >
            <Link
              to="/dashboard"
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-green to-neon-blue px-6 py-3 font-mono text-sm font-bold text-background neon-border animate-pulse-glow transition-shadow hover:shadow-[0_0_50px_oklch(0.88_0.27_150/0.6)]"
            >
              ENTER DASHBOARD
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#scanner"
              className="glass flex items-center gap-2 rounded-xl px-6 py-3 font-mono text-sm font-bold text-foreground transition-all hover:border-neon-green/40 hover:bg-neon-green/10"
            >
              VIEW LIVE SCANNER
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4"
          >
            {heroStats.map((stat) => (
              <div key={stat.label} className="glass rounded-xl p-4 transition-shadow hover:neon-border">
                <div className="font-mono text-2xl font-bold gradient-text">{stat.value}</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
          {lastUpdated && (
            <div className="mt-3 font-mono text-[10px] text-muted-foreground">
              Live snapshot refreshed at {lastUpdated}
            </div>
          )}
        </div>
      </section>

      <StockTicker />

      <section className="px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <SystemStatus />
        </div>
      </section>

      <section id="scanner" className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="font-mono text-xs text-neon-green">// AI SCANNER</span>
              <h2 className="mt-2 text-4xl font-bold md:text-5xl">
                Real-Time <span className="gradient-text">Market Intelligence</span>
              </h2>
            </div>
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
          </div>
          <AIMarketScanner />
        </div>
      </section>

      <section className="relative px-4 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="font-mono text-xs text-neon-green">// DASHBOARD MODULES</span>
            <h2 className="mt-2 text-4xl font-bold leading-tight md:text-5xl">
              Every core workflow is <span className="gradient-text">one click away</span>
            </h2>
            <div className="mt-6 grid gap-3 font-mono text-xs sm:grid-cols-2">
              {[
                { label: "Live charts", icon: LineChart },
                { label: "Prediction engine", icon: Brain },
                { label: "Portfolio analyzer", icon: Shield },
                { label: "News sentiment", icon: Globe },
                { label: "Market scanner", icon: Zap },
                { label: "System health", icon: BarChart3 },
              ].map((item) => (
                <div
                  key={item.label}
                  className="glass flex items-center justify-between rounded-lg px-3 py-2 transition-shadow hover:neon-border"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <item.icon className="h-3.5 w-3.5 text-neon-green" />
                    {item.label}
                  </span>
                  <span className="text-bull">ACTIVE</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex justify-center"
          >
            <RotatingGlobe size={360} />
          </motion.div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TrendingStocks />
          </div>
          <FearGreedIndex />
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-2">
          <SectorPerformance />
          <AISentiment />
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <span className="font-mono text-xs text-neon-green">// MARKET HEATMAP</span>
              <h2 className="mt-2 text-3xl font-bold md:text-4xl">NIFTY Watchlist</h2>
            </div>
            <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-neon-green animate-blink" />
              LIVE
            </span>
          </div>
          <div className="glass rounded-2xl p-6">
            <MarketHeatmap />
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="glass relative overflow-hidden rounded-3xl p-12 text-center neon-border">
            <div className="absolute inset-0 bg-gradient-to-br from-neon-green/10 via-transparent to-neon-blue/10" />
            <div className="relative">
              <Sparkles className="mx-auto mb-4 h-8 w-8 text-neon-green" />
              <h2 className="text-4xl font-bold md:text-5xl">
                Open the <span className="gradient-text">live dashboard</span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                Continue into charts, predictions, scanner signals, sentiment, and portfolio tools.
              </p>
              <Link
                to="/dashboard"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-green to-neon-blue px-8 py-4 font-mono text-sm font-bold text-background neon-border animate-pulse-glow transition-shadow hover:shadow-[0_0_60px_oklch(0.88_0.27_150/0.6)]"
              >
                LAUNCH DASHBOARD <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/30 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="glass rounded-xl p-4 font-mono text-[10px] text-muted-foreground">
            <div className="grid gap-2 md:grid-cols-4">
              <div>
                STATUS: <span className="text-neon-green">{homeStatus}</span>
              </div>
              <div>
                SNAPSHOT: <span className="text-foreground">{lastUpdated || "PENDING"}</span>
              </div>
              <div>
                DATA: <span className="text-foreground">BACKEND API</span>
              </div>
              <div>
                MODE: <span className="text-neon-green">LIVE DASHBOARD</span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center font-mono text-[10px] text-muted-foreground">
            StockVerse AI - market intelligence for research and analysis.
          </p>
        </div>
      </footer>

      <VoiceButton />
    </div>
  );
}
