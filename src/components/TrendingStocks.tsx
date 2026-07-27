import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Sparkles, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  aiPick: boolean;
}

const FALLBACK: Stock[] = [
  { symbol: "ADANIENT",  name: "Adani Enterprises",  price: 2876.10, change: 3.45, volume: "12.4M", aiPick: true },
  { symbol: "RELIANCE",  name: "Reliance Industries", price: 2840.50, change: 1.24, volume: "8.7M",  aiPick: true },
  { symbol: "INFY",      name: "Infosys",             price: 1845.30, change: 2.15, volume: "6.2M",  aiPick: true },
  { symbol: "TATAMOTORS",name: "Tata Motors",         price: 945.80,  change: 1.92, volume: "15.1M", aiPick: false },
  { symbol: "LT",        name: "Larsen & Toubro",     price: 3678.50, change: 1.80, volume: "4.8M",  aiPick: false },
  { symbol: "BHARTIARTL",name: "Bharti Airtel",       price: 1564.90, change: 1.45, volume: "5.3M",  aiPick: true },
  { symbol: "HDFCBANK",  name: "HDFC Bank",           price: 1678.20, change: 0.87, volume: "9.1M",  aiPick: false },
  { symbol: "WIPRO",     name: "Wipro",               price: 567.20,  change: 2.34, volume: "7.6M",  aiPick: false },
];

export function TrendingStocks() {
  const [stocks, setStocks] = useState<Stock[]>(FALLBACK);
  const [loading, setLoading] = useState(false);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/market-scan");
      const json = await res.json();
      const d = json.data;

      // Merge trending + bullish signals for AI picks
      const trending: string[] = (d?.trending || []).map((t: any) => t.symbol);
      const bullishSyms: string[] = (d?.bullishSignals || []).map((b: any) => b.symbol);

      if (trending.length >= 4) {
        // Fetch live prices for trending stocks
        const syms = trending.slice(0, 8).join(",");
        const priceRes = await fetch(`/api/stocks?symbols=${syms}`);
        const priceJson = await priceRes.json();

        if (priceJson.data?.length) {
          const mapped: Stock[] = priceJson.data.map((s: any) => {
            const sym = s.appSymbol || s.symbol?.replace(/\.(NS|BO)$/, "");
            const vol = s.volume > 1e6 ? `${(s.volume / 1e6).toFixed(1)}M` : `${(s.volume / 1e3).toFixed(0)}K`;
            return {
              symbol: sym,
              name: s.shortName || sym,
              price: s.currentPrice,
              change: s.changePercent,
              volume: vol,
              aiPick: bullishSyms.includes(sym),
            };
          });
          setStocks(mapped);
        }
      }
    } catch { /* keep fallback */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchTrending();
    const t = setInterval(fetchTrending, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="h-5 w-5 text-orange-400" />
        <h3 className="font-mono text-sm font-bold tracking-wider">TRENDING INDIAN STOCKS</h3>
        <div className="ml-auto flex items-center gap-2">
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          <span className="font-mono text-[10px] text-neon-green animate-blink">● LIVE</span>
        </div>
      </div>
      <div className="space-y-2">
        {stocks.map((s, i) => (
          <motion.div key={s.symbol} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            whileHover={{ x: 4 }} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-neon-green/5">
            <span className="w-6 text-center font-mono text-[10px] text-muted-foreground">#{i + 1}</span>
            <Link to="/stocks/$symbol" params={{ symbol: s.symbol }} className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold hover:text-neon-green transition-colors">{s.symbol}</span>
                {s.aiPick && (
                  <span className="flex items-center gap-0.5 rounded bg-neon-green/10 px-1.5 py-0.5 font-mono text-[8px] text-neon-green border border-neon-green/30">
                    <Sparkles className="h-2.5 w-2.5" /> AI PICK
                  </span>
                )}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground truncate block">{s.name}</span>
            </Link>
            <div className="text-right">
              <div className="font-mono text-sm font-bold">₹{s.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className={`font-mono text-[10px] font-bold ${s.change >= 0 ? "text-bull" : "text-bear"}`}>
                {s.change >= 0 ? "▲" : "▼"} {Math.abs(s.change).toFixed(2)}%
              </div>
            </div>
            <div className="hidden sm:flex h-8 items-end gap-0.5">
              {Array.from({ length: 8 }, (_, j) => (
                <div key={j} className={`w-1 rounded-sm ${s.change >= 0 ? "bg-bull/50" : "bg-bear/50"}`}
                  style={{ height: `${25 + ((j * 13 + i * 7) % 75)}%` }} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
