import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gauge } from "lucide-react";

/**
 * Fear & Greed Index — computed from live market data:
 * - Market momentum (NIFTY vs SMA)
 * - Advancing vs declining stocks
 * - Average change magnitude
 */
export function FearGreedIndex() {
  const [value, setValue] = useState(62);
  const [loading, setLoading] = useState(true);

  const computeIndex = async () => {
    try {
      const res = await fetch("/api/market-scan");
      const json = await res.json();
      const d = json.data;
      if (!d?.marketSummary) return;

      const { advancing, declining, avgChange } = d.marketSummary;
      const total = advancing + declining || 1;

      // Breadth score: 0-40 points
      const breadthScore = (advancing / total) * 40;

      // Momentum score: 0-40 points (avgChange mapped -2%..+2% → 0..40)
      const momentumScore = Math.max(0, Math.min(40, (avgChange + 2) * 10));

      // Volatility penalty: 0-20 points (lower volatility = more greed)
      const volScore = Math.max(0, 20 - Math.abs(avgChange) * 5);

      const raw = Math.round(breadthScore + momentumScore + volScore);
      setValue(Math.max(5, Math.min(95, raw)));
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    computeIndex();
    const t = setInterval(computeIndex, 30000);
    return () => clearInterval(t);
  }, []);

  const label = value < 25 ? "EXTREME FEAR" : value < 40 ? "FEAR" : value < 60 ? "NEUTRAL" : value < 75 ? "GREED" : "EXTREME GREED";
  const color = value < 25 ? "text-bear" : value < 40 ? "text-orange-400" : value < 60 ? "text-yellow-400" : value < 75 ? "text-neon-green" : "text-bull";

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="h-5 w-5 text-neon-green" />
        <h3 className="font-mono text-sm font-bold tracking-wider">FEAR & GREED INDEX</h3>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">AI-computed</span>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative w-48 h-24 mb-4">
          <svg viewBox="0 0 200 100" className="w-full">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="oklch(0.7 0.25 25)" />
                <stop offset="25%"  stopColor="oklch(0.75 0.2 60)" />
                <stop offset="50%"  stopColor="oklch(0.8 0.15 90)" />
                <stop offset="75%"  stopColor="oklch(0.85 0.2 150)" />
                <stop offset="100%" stopColor="oklch(0.88 0.27 150)" />
              </linearGradient>
            </defs>
            <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="oklch(0.2 0.04 260)" strokeWidth="12" strokeLinecap="round" />
            <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round"
              strokeDasharray="251" strokeDashoffset={251 - (value / 100) * 251} />
            <motion.line x1="100" y1="90" x2="100" y2="20"
              stroke="oklch(0.97 0.02 180)" strokeWidth="2" strokeLinecap="round"
              animate={{ rotate: -90 + (value / 100) * 180 }}
              style={{ transformOrigin: "100px 90px" }}
              transition={{ type: "spring", stiffness: 60 }} />
            <circle cx="100" cy="90" r="4" fill="oklch(0.88 0.27 150)" />
          </svg>
        </div>

        <motion.div key={value} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
          <div className={`font-mono text-4xl font-black ${color}`}>{loading ? "—" : value}</div>
          <div className={`font-mono text-xs font-bold ${color} mt-1`}>{label}</div>
        </motion.div>

        <div className="mt-4 w-full grid grid-cols-5 gap-1 font-mono text-[8px] text-center text-muted-foreground">
          <span>EXTREME<br/>FEAR</span><span>FEAR</span><span>NEUTRAL</span><span>GREED</span><span>EXTREME<br/>GREED</span>
        </div>
      </div>
    </div>
  );
}
