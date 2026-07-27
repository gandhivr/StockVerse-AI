import { useState, useMemo, useEffect } from "react";
import { HelpCircle, Info, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";

interface DcfProps {
  symbol: string;
  currentPrice: number;
}

export function DcfCalculator({ symbol, currentPrice }: DcfProps) {
  const [eps, setEps] = useState<number | null>(null);
  const [growth, setGrowth] = useState<number>(8); // default to 8% if loading

  // Fetch metrics dynamically to keep component self-contained
  useEffect(() => {
    let active = true;
    const fetchMetrics = async () => {
      try {
        const res = await api.predict.fundamentals(symbol);
        if (active && res?.metrics) {
          if (res.metrics.eps != null) {
            setEps(res.metrics.eps);
          }
          if (res.metrics.revenueGrowth != null) {
            const parsedGrowth = Math.max(2, Math.min(25, Math.round(res.metrics.revenueGrowth)));
            setGrowth(parsedGrowth);
          }
        }
      } catch (err) {
        console.warn(`DCF failed to load fundamentals for ${symbol}:`, err);
      }
    };
    fetchMetrics();
    return () => {
      active = false;
    };
  }, [symbol]);

  // Compute the DCF intrinsic value
  const { fairPrice, discountPercent, isDiscounted } = useMemo(() => {
    // If EPS is negative, missing, or zero, estimate proxy base EPS assuming a standard 20x price-to-earnings multiple
    const epsBase = eps != null && eps > 0 ? eps : currentPrice / 20;
    const g = growth / 100;
    const r = 0.10; // 10% discount rate
    const terminalPE = 15; // standard terminal PE multiple

    // Project Cash Flows (5 Years)
    let pvFlows = 0;
    let cf = epsBase;
    for (let t = 1; t <= 5; t++) {
      cf = cf * (1 + g);
      pvFlows += cf / Math.pow(1 + r, t);
    }

    // Project Terminal Value at Year 5 discounted to Present Day
    const terminalValue = cf * terminalPE;
    const pvTerminal = terminalValue / Math.pow(1 + r, 5);

    const calculatedFair = pvFlows + pvTerminal;
    const discount = calculatedFair - currentPrice;
    const pct = calculatedFair > 0 ? Math.abs((discount / calculatedFair) * 100) : 0;

    return {
      fairPrice: Math.max(0.01, parseFloat(calculatedFair.toFixed(2))),
      discountPercent: parseFloat(pct.toFixed(1)),
      isDiscounted: discount >= 0,
    };
  }, [currentPrice, eps, growth]);

  return (
    <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neon-green" />
          <span className="font-mono text-sm font-bold tracking-wider">AI VALUE CALCULATOR</span>
          <span className="rounded-full border border-neon-green/30 bg-neon-green/10 px-2 py-0.5 font-mono text-[9px] text-neon-green">
            DCF
          </span>
        </div>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground cursor-pointer">
                <HelpCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs font-mono text-[10px] leading-relaxed">
              Discounted Cash Flow (DCF) finds a stock's "fair price" by summing up all the cash it will earn over the next 5 years, translated into today's money value.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Main Stats Display */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-background/40 p-4 border border-border/20 text-center">
          <div className="font-mono text-[10px] text-muted-foreground tracking-wider">CURRENT PRICE</div>
          <div className="mt-1 font-mono text-2xl font-black text-foreground">
            ₹{currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className={`rounded-xl p-4 border text-center transition-colors duration-300 ${
          isDiscounted ? "border-bull/30 bg-bull/5 text-bull" : "border-bear/30 bg-bear/5 text-bear"
        }`}>
          <div className="font-mono text-[10px] text-muted-foreground tracking-wider">ESTIMATED FAIR VALUE</div>
          <div className="mt-1 font-mono text-2xl font-black">
            ₹{fairPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Verdict Alert */}
      <div className={`rounded-xl border p-4 text-xs font-mono leading-relaxed transition-all duration-300 ${
        isDiscounted 
          ? "border-bull/20 bg-bull/5 text-bull" 
          : "border-yellow-400/20 bg-yellow-400/5 text-yellow-400"
      }`}>
        {isDiscounted ? (
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 shrink-0 mt-0.5 text-bull" />
            <div>
              <strong>💰 Discount: </strong>
              The stock is currently trading at a <strong>{discountPercent}% discount</strong> to its estimated future growth value. This indicates a potential buying opportunity.
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-400" />
            <div>
              <strong>⚠️ Premium: </strong>
              The stock is trading <strong>{discountPercent}% above</strong> its estimated fair value. It requires higher future growth to justify this premium price.
            </div>
          </div>
        )}
      </div>

      {/* Slider Control */}
      <div className="space-y-2 rounded-xl bg-background/20 p-4 border border-border/20">
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>EXPECTED ANNUAL GROWTH (5 YEARS)</span>
          <span className="font-bold text-foreground text-sm">{growth}%</span>
        </div>
        
        <input
          type="range"
          min="2"
          max="25"
          step="1"
          value={growth}
          onChange={(e) => setGrowth(Number(e.target.value))}
          className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-neon-green focus:outline-none"
        />

        <div className="flex justify-between font-mono text-[9px] text-muted-foreground/60">
          <span>Slow & Steady (2%)</span>
          <span>Fast Expansion (25%)</span>
        </div>
      </div>

      {/* Beginner Explanation */}
      <div className="flex items-start gap-2 rounded-xl bg-background/10 p-3 text-[10px] font-mono leading-relaxed text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 text-neon-blue mt-0.5" />
        <div>
          If you expect <strong>{symbol}</strong> to grow its sales and earnings at an average rate of <strong>{growth}%</strong> per year over the next 5 years, today's fair value of its business cash flows is roughly <strong>₹{fairPrice.toFixed(0)}</strong> per share. Move the slider above to see how changing growth expectations affects valuation.
        </div>
      </div>

    </div>
  );
}
