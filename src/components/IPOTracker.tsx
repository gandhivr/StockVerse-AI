import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, RefreshCw, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Opportunity = {
  symbol: string;
  label: string;
  price: number;
  changePercent: number;
  status: "BULLISH" | "BEARISH" | "TRENDING";
  detail: string;
};

const statusColor = {
  BULLISH: "text-bull border-bull/40 bg-bull/10",
  BEARISH: "text-bear border-bear/40 bg-bear/10",
  TRENDING: "text-neon-blue border-neon-blue/40 bg-neon-blue/10",
};

export function IPOTracker() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/market-scan");
      const json = await res.json();
      const data = json.data;

      const bullish = (data?.bullishSignals || []).slice(0, 2).map((item: any) => ({
        symbol: item.symbol,
        label: item.reason || "AI bullish setup",
        price: Number(item.price || 0),
        changePercent: Number(item.confidence || 0),
        status: "BULLISH" as const,
        detail: `${Math.round(Number(item.confidence || 0))}% confidence`,
      }));

      const bearish = (data?.bearishSignals || []).slice(0, 1).map((item: any) => ({
        symbol: item.symbol,
        label: item.reason || "AI bearish setup",
        price: Number(item.price || 0),
        changePercent: Number(item.confidence || 0),
        status: "BEARISH" as const,
        detail: `${Math.round(Number(item.confidence || 0))}% confidence`,
      }));

      const trending = (data?.trending || []).slice(0, 2).map((item: any) => ({
        symbol: item.symbol,
        label: item.name || "Trending on market scan",
        price: Number(item.price || 0),
        changePercent: Number(item.changePercent || 0),
        status: "TRENDING" as const,
        detail: `${Number(item.changePercent || 0) >= 0 ? "+" : ""}${Number(item.changePercent || 0).toFixed(2)}% today`,
      }));

      setItems([...bullish, ...bearish, ...trending].slice(0, 5));
      setLastUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
    const timer = window.setInterval(loadOpportunities, 60000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-neon-blue" />
          <h3 className="font-mono text-sm font-bold tracking-wider">MARKET OPPORTUNITY TRACKER</h3>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
              {lastUpdated}
            </span>
          )}
          <button
            onClick={loadOpportunities}
            disabled={loading}
            className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-neon-green/40 hover:text-foreground disabled:opacity-50"
            aria-label="Refresh market opportunities"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => {
          const Icon =
            item.status === "BULLISH" ? TrendingUp : item.status === "BEARISH" ? TrendingDown : Sparkles;
          return (
            <Link key={`${item.symbol}-${item.status}`} to="/stocks/$symbol" params={{ symbol: item.symbol }}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-xl border border-border/50 bg-background/30 p-4 transition-colors hover:border-neon-green/40"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-mono text-sm font-bold">{item.symbol}</h4>
                    <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> {item.label}
                    </div>
                  </div>
                  <span
                    className={`flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${statusColor[item.status]}`}
                  >
                    <Icon className="h-3 w-3" />
                    {item.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px] sm:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground">Price</span>
                    <br />
                    <span className="font-bold">INR {item.price.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Signal</span>
                    <br />
                    <span className="font-bold">{item.detail}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Source</span>
                    <br />
                    <span className="font-bold text-neon-green">Market scan</span>
                  </div>
                </div>
              </motion.div>
            </Link>
          );
        })}
        {!items.length && (
          <div className="rounded-xl border border-border/50 bg-background/30 p-4 font-mono text-xs text-muted-foreground">
            {loading ? "Loading live opportunities..." : "No market opportunities returned by the scanner yet."}
          </div>
        )}
      </div>
    </div>
  );
}
