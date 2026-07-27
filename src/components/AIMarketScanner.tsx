import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Radar, TrendingUp, TrendingDown, Minus, Shield, Zap, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface ScanResult {
  symbol: string;
  signal: string;
  confidence: number;
  reason: string;
  price: number;
}

interface SectorPerf {
  sector: string;
  avgChange: number;
  trend: string;
}

interface MarketSummary {
  advancing: number;
  declining: number;
  marketMood: string;
  avgChange: number;
}

const actionStyles = {
  BUY:  { color: "text-bull",     bg: "bg-bull/10",     border: "border-bull/40",     icon: TrendingUp },
  SELL: { color: "text-bear",     bg: "bg-bear/10",     border: "border-bear/40",     icon: TrendingDown },
  HOLD: { color: "text-neon-blue",bg: "bg-neon-blue/10",border: "border-neon-blue/40",icon: Minus },
};

export function AIMarketScanner() {
  const [scanning, setScanning] = useState(true);
  const [scanProgress, setScanProgress] = useState(0);
  const [bullish, setBullish] = useState<ScanResult[]>([]);
  const [bearish, setBearish] = useState<ScanResult[]>([]);
  const [sectors, setSectors] = useState<SectorPerf[]>([]);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [lastScan, setLastScan] = useState<string>("");

  const runScan = async () => {
    setScanning(true);
    setScanProgress(0);

    // Animate progress bar
    const prog = setInterval(() => {
      setScanProgress(p => {
        if (p >= 90) { clearInterval(prog); return 90; }
        return p + 3;
      });
    }, 40);

    try {
      const res = await fetch("/api/market-scan");
      const json = await res.json();
      const d = json.data;

      clearInterval(prog);
      setScanProgress(100);

      setTimeout(() => {
        setBullish(d.bullishSignals || []);
        setBearish(d.bearishSignals || []);
        setSectors(d.sectorPerformance || []);
        setSummary(d.marketSummary || null);
        setLastScan(new Date().toLocaleTimeString("en-IN"));
        setScanning(false);
      }, 300);
    } catch {
      clearInterval(prog);
      setScanProgress(100);
      setScanning(false);
    }
  };

  useEffect(() => {
    runScan();
    const t = setInterval(runScan, 60000); // rescan every minute
    return () => clearInterval(t);
  }, []);

  // Combine bullish + bearish into display cards
  const allSignals = [
    ...bullish.map(s => ({ ...s, action: s.signal as "BUY" | "SELL" | "HOLD" })),
    ...bearish.map(s => ({ ...s, action: s.signal as "BUY" | "SELL" | "HOLD" })),
  ].slice(0, 6);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radar className={`h-6 w-6 text-neon-green ${scanning ? "animate-spin-slow" : ""}`} />
            {scanning && <div className="absolute inset-0 blur-md bg-neon-green/50 animate-pulse" />}
          </div>
          <div>
            <h3 className="font-mono text-sm font-bold tracking-wider">AI MARKET SCANNER</h3>
            <p className="font-mono text-[10px] text-muted-foreground">
              {summary ? `${summary.advancing + summary.declining} stocks · ${summary.marketMood}` : "Neural network scanning NSE stocks"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastScan && <span className="font-mono text-[10px] text-muted-foreground">Last: {lastScan}</span>}
          <button onClick={runScan} disabled={scanning}
            className="flex items-center gap-1 rounded-lg border border-neon-green/30 px-2 py-1 font-mono text-[10px] text-neon-green hover:bg-neon-green/10 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${scanning ? "animate-spin" : ""}`} /> SCAN
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {scanning && (
        <div className="mb-6">
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full bg-gradient-to-r from-neon-green via-neon-blue to-neon-green"
              style={{ width: `${scanProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>Analyzing RSI, MACD, volume, momentum...</span>
            <span>{scanProgress}%</span>
          </div>
        </div>
      )}

      {/* Market summary bar */}
      {summary && !scanning && (
        <div className="mb-5 grid grid-cols-4 gap-3 rounded-xl bg-background/30 p-3">
          {[
            { label: "ADVANCING", value: summary.advancing, color: "text-bull" },
            { label: "DECLINING", value: summary.declining, color: "text-bear" },
            { label: "AVG CHANGE", value: `${summary.avgChange >= 0 ? "+" : ""}${summary.avgChange}%`, color: summary.avgChange >= 0 ? "text-bull" : "text-bear" },
            { label: "MOOD", value: summary.marketMood, color: summary.marketMood === "BULLISH" ? "text-bull" : summary.marketMood === "BEARISH" ? "text-bear" : "text-yellow-400" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="font-mono text-[9px] text-muted-foreground">{s.label}</div>
              <div className={`font-mono text-sm font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Signal cards */}
      {!scanning && allSignals.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allSignals.map((r, i) => {
            const style = actionStyles[r.action] || actionStyles.HOLD;
            const Icon = style.icon;
            return (
              <motion.div
                key={r.symbol}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className={`rounded-xl border ${style.border} ${style.bg} p-4 backdrop-blur-sm`}
              >
                <Link to="/stocks/$symbol" params={{ symbol: r.symbol }} className="block">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-sm font-bold">{r.symbol}</span>
                    <div className={`flex items-center gap-1 font-mono text-lg font-black ${style.color}`}>
                      <Icon className="h-4 w-4" /> {r.action}
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground mb-1">
                    ₹{Number(r.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="flex items-center gap-1 text-muted-foreground"><Brain className="h-3 w-3" /> Confidence</span>
                      <span className={style.color}>{Math.round(r.confidence)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-background/60 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${r.confidence}%` }}
                        transition={{ delay: 0.3 + i * 0.07, duration: 0.8 }}
                        className={`h-full rounded-full ${r.action === "BUY" ? "bg-bull" : r.action === "SELL" ? "bg-bear" : "bg-neon-blue"}`} />
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-background/40 p-2">
                    <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                      <span className="text-neon-green">AI:</span> {r.reason}
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Sector performance */}
      {!scanning && sectors.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {sectors.slice(0, 8).map((s, i) => (
            <motion.div key={s.sector} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
              className={`rounded-lg border p-2 text-center ${s.avgChange >= 0 ? "border-bull/20 bg-bull/5" : "border-bear/20 bg-bear/5"}`}>
              <div className="font-mono text-[10px] text-muted-foreground">{s.sector}</div>
              <div className={`font-mono text-sm font-bold ${s.avgChange >= 0 ? "text-bull" : "text-bear"}`}>
                {s.avgChange >= 0 ? "+" : ""}{s.avgChange}%
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
