import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";

const FALLBACK = [
  { s: "RELIANCE", p: 2840.50, c: 1.24 }, { s: "TCS", p: 4012.80, c: -0.45 },
  { s: "HDFCBANK", p: 1678.20, c: 0.87 }, { s: "INFY", p: 1845.30, c: 2.15 },
  { s: "ICICIBANK", p: 1245.60, c: 1.05 }, { s: "SBIN", p: 812.40, c: -1.20 },
  { s: "BHARTIARTL", p: 1564.90, c: 0.65 }, { s: "ITC", p: 478.30, c: -0.30 },
  { s: "LT", p: 3678.50, c: 1.80 }, { s: "WIPRO", p: 567.20, c: 0.92 },
  { s: "ADANIENT", p: 2876.10, c: 3.45 }, { s: "TATAMOTORS", p: 945.80, c: -0.78 },
];

export function StockTicker() {
  const [stocks, setStocks] = useState(FALLBACK);
  const fetchedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/stocks?symbols=RELIANCE,TCS,HDFCBANK,INFY,ICICIBANK,SBIN,BHARTIARTL,ITC,LT,WIPRO,ADANIENT,TATAMOTORS");
        const json = await res.json();
        if (json.data?.length) {
          setStocks(json.data.map((d: any) => ({
            s: d.appSymbol || d.symbol?.replace(/\.(NS|BO)$/, ""),
            p: d.currentPrice,
            c: d.changePercent,
          })));
          fetchedRef.current = true;
        }
      } catch { /* keep fallback */ }
    };
    load();
    const t = setInterval(load, 60000); // poll every 60s to avoid Yahoo rate limits
    return () => clearInterval(t);
  }, []);

  const list = [...stocks, ...stocks];
  return (
    <div className="relative overflow-hidden border-y border-neon-green/20 bg-background/50 py-3 backdrop-blur">
      <div className="flex gap-8 animate-ticker whitespace-nowrap font-mono text-sm">
        {list.map((s, i) => (
          <Link key={i} to="/stocks/$symbol" params={{ symbol: s.s }} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-muted-foreground">{s.s}</span>
            <span className="text-foreground">₹{s.p.toFixed(2)}</span>
            <span className={s.c >= 0 ? "text-bull" : "text-bear"}>
              {s.c >= 0 ? "▲" : "▼"} {Math.abs(s.c).toFixed(2)}%
            </span>
            <span className="text-neon-green/30">|</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
