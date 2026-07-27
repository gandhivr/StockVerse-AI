import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, RefreshCw } from "lucide-react";

interface Sector { name: string; change: number; stockCount?: number; }

const FALLBACK: Sector[] = [
  { name: "IT", change: 2.45 }, { name: "Banking", change: 1.82 },
  { name: "Pharma", change: 0.95 }, { name: "Auto", change: 1.34 },
  { name: "FMCG", change: -0.45 }, { name: "Energy", change: 3.12 },
  { name: "Infrastructure", change: 1.56 }, { name: "Finance", change: -0.67 },
  { name: "Consumer", change: 0.78 }, { name: "Utilities", change: -1.28 },
];

export function SectorPerformance() {
  const [sectors, setSectors] = useState<Sector[]>(FALLBACK);
  const [loading, setLoading] = useState(false);

  const fetchSectors = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/market-scan");
      const json = await res.json();
      const sp = json.data?.sectorPerformance;
      if (sp?.length) {
        setSectors(sp.map((s: any) => ({ name: s.sector, change: s.avgChange, stockCount: s.stockCount })));
      }
    } catch { /* keep fallback */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchSectors();
    const t = setInterval(fetchSectors, 60000);
    return () => clearInterval(t);
  }, []);

  const sorted = [...sectors].sort((a, b) => b.change - a.change);
  const maxAbs = Math.max(...sorted.map(s => Math.abs(s.change)), 1);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-neon-blue" />
        <h3 className="font-mono text-sm font-bold tracking-wider">SECTOR PERFORMANCE</h3>
        <div className="ml-auto flex items-center gap-2">
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          <span className="font-mono text-[10px] text-neon-green animate-blink">● LIVE</span>
        </div>
      </div>
      <div className="space-y-2">
        {sorted.map((s, i) => (
          <motion.div key={s.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
            className="flex items-center gap-3">
            <span className="w-20 font-mono text-xs text-muted-foreground truncate">{s.name}</span>
            <div className="flex-1 h-5 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-[1px] bg-border/30" />
              </div>
              <motion.div
                className={`absolute top-0.5 h-4 rounded-sm ${s.change >= 0 ? "bg-bull/60 left-1/2" : "bg-bear/60 right-1/2"}`}
                animate={{ width: `${(Math.abs(s.change) / maxAbs) * 48}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <span className={`w-14 text-right font-mono text-xs font-bold ${s.change >= 0 ? "text-bull" : "text-bear"}`}>
              {s.change >= 0 ? "+" : ""}{s.change.toFixed(2)}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
