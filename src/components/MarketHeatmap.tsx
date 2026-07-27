import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";

const DEFAULT_STOCKS = [
  "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","SBIN",
  "BHARTIARTL","ITC","LT","WIPRO","ADANIENT","TATAMOTORS",
  "AXISBANK","MARUTI","HCLTECH","SUNPHARMA","BAJFINANCE","ASIANPAINT",
  "NESTLEIND","TITAN","POWERGRID","ULTRACEMCO","ONGC","NTPC",
];

interface HeatItem { symbol: string; change: number; price: number; }

function heatColor(c: number) {
  const intensity = Math.min(Math.abs(c) / 4, 1);
  if (c >= 0) return `oklch(0.7 ${0.15 + intensity * 0.15} 150 / ${0.3 + intensity * 0.7})`;
  return `oklch(0.6 ${0.15 + intensity * 0.15} 25 / ${0.3 + intensity * 0.7})`;
}

export function MarketHeatmap() {
  const [items, setItems] = useState<HeatItem[]>(
    DEFAULT_STOCKS.map(s => ({ symbol: s, change: (Math.random() - 0.48) * 4, price: 0 }))
  );

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/stocks?symbols=${DEFAULT_STOCKS.join(",")}`);
        const json = await res.json();
        if (json.data?.length) {
          setItems(json.data.map((d: any) => ({
            symbol: d.appSymbol || d.symbol?.replace(/\.(NS|BO)$/, ""),
            change: d.changePercent,
            price: d.currentPrice,
          })));
        }
      } catch { /* keep existing */ }
    };
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {items.map((s, i) => (
        <Link key={s.symbol} to="/stocks/$symbol" params={{ symbol: s.symbol }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.02 }}
            whileHover={{ scale: 1.08, zIndex: 10 }}
            className="relative aspect-square cursor-pointer rounded-lg p-2 backdrop-blur-sm transition-shadow hover:shadow-lg"
            style={{ background: heatColor(s.change), boxShadow: `0 0 12px ${heatColor(s.change)}` }}
          >
            <div className="font-mono text-[9px] font-bold text-foreground/90 leading-tight">{s.symbol.slice(0, 7)}</div>
            <div className="absolute bottom-1 right-1 font-mono text-[10px] font-bold text-foreground">
              {s.change >= 0 ? "+" : ""}{s.change.toFixed(2)}%
            </div>
          </motion.div>
        </Link>
      ))}
    </div>
  );
}
