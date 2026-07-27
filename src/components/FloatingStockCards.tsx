import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";

// Fallback prices — updated to current approximate values (May 2026)
const FALLBACK = [
  { s: "RELIANCE", p: 1435, c: -0.07 },
  { s: "TCS",      p: 2394, c: -0.29 },
  { s: "INFY",     p: 1179, c:  1.42 },
  { s: "ADANIENT", p: 2505, c:  0.85 },
];

// Positions: left column (far left) and right column (far right)
// Never overlap the center hero text
const POSITIONS = [
  { x: "1%",  y: "8%",  d: 0   },  // top-left
  { x: "78%", y: "8%",  d: 0.4 },  // top-right
  { x: "1%",  y: "58%", d: 0.8 },  // bottom-left
  { x: "78%", y: "58%", d: 1.2 },  // bottom-right
];

interface CardData { s: string; p: number; c: number; }

export function FloatingStockCards() {
  const [cards, setCards] = useState<CardData[]>(FALLBACK);

  useEffect(() => {
    const symbols = FALLBACK.map(f => f.s).join(",");
    fetch(`/api/stocks?symbols=${symbols}`)
      .then(r => r.json())
      .then(json => {
        const data: any[] = json.data || [];
        if (data.length) {
          setCards(data.map(d => ({
            s: d.appSymbol || d.symbol?.replace(/\.(NS|BO)$/, ""),
            p: d.currentPrice,
            c: d.changePercent,
          })));
        }
      })
      .catch(() => {/* keep fallback */});
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 hidden xl:block">
      {cards.map((card, idx) => {
        const pos = POSITIONS[idx];
        const up = card.c >= 0;
        // Stable bar heights per card (seeded by index, not random on each render)
        const bars = Array.from({ length: 12 }, (_, i) =>
          30 + ((idx * 17 + i * 31) % 60)
        );
        return (
          <motion.div
            key={card.s}
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 0.92, scale: 1, y: 0 }}
            transition={{ delay: pos.d, duration: 0.7, ease: "easeOut" }}
            style={{ left: pos.x, top: pos.y }}
            className="absolute"
          >
            <div
              className="glass animate-float rounded-xl p-4 w-[170px] border border-neon-green/10"
              style={{ animationDelay: `${pos.d}s` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[11px] font-bold text-muted-foreground tracking-wider">
                  {card.s}
                </span>
                {up
                  ? <TrendingUp className="h-3.5 w-3.5 text-bull" />
                  : <TrendingDown className="h-3.5 w-3.5 text-bear" />}
              </div>
              <div className="font-mono text-base font-black text-foreground">
                ₹{card.p.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`font-mono text-[11px] font-semibold ${up ? "text-bull" : "text-bear"}`}>
                {up ? "+" : ""}{card.c.toFixed(2)}%
              </div>
              <div className="mt-2 flex h-7 items-end gap-[2px]">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${up ? "bg-bull/60" : "bg-bear/60"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
