import { useState, useEffect } from "react";
import { 
  Brain, 
  RefreshCw, 
  HelpCircle, 
  Info, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle, 
  Newspaper, 
  ExternalLink 
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type StockNewsSentiment } from "@/lib/api";
import { useBeginnerMode } from "@/hooks/useBeginnerMode";

interface NewsSentimentProps {
  symbol: string;
}

export function NewsSentimentRadar({ symbol }: NewsSentimentProps) {
  const [isBeginner] = useBeginnerMode();
  const [data, setData] = useState<StockNewsSentiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSentiment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.predict.newsSentiment(symbol);
      setData(res);
    } catch (err: any) {
      console.warn("Failed to load news sentiment:", err);
      setError(err?.message || "Could not retrieve news sentiment analysis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSentiment();
  }, [symbol]);

  // Color mapping based on direction
  const isBullish = data?.direction === "BULLISH";
  const isBearish = data?.direction === "BEARISH";
  
  const statusColor = isBullish 
    ? "text-bull" 
    : isBearish 
      ? "text-bear" 
      : "text-neon-blue";

  const statusBorder = isBullish 
    ? "border-bull/30 bg-bull/5" 
    : isBearish 
      ? "border-bear/30 bg-bear/5" 
      : "border-neon-blue/30 bg-neon-blue/5";

  const StatusIcon = isBullish 
    ? TrendingUp 
    : isBearish 
      ? TrendingDown 
      : Minus;

  return (
    <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-neon-blue" />
          <span className="font-mono text-sm font-bold tracking-wider">AI NEWS SENTIMENT RADAR</span>
          <span className="rounded-full border border-neon-blue/30 bg-neon-blue/10 px-2 py-0.5 font-mono text-[9px] text-neon-blue">
            CATALYST
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchSentiment} 
            disabled={loading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50 p-1 hover:bg-background/40 rounded transition-colors"
            aria-label="Refresh news sentiment"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground cursor-pointer">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs font-mono text-[10px] leading-relaxed">
                Gemini reads RSS financial feeds, measures impact (-1.0 to +1.0), lists core drivers, and translates stock catalysts into jargon-free explanations.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 font-mono text-xs text-muted-foreground">
          <div className="relative">
            <Brain className="h-8 w-8 text-neon-blue animate-pulse" />
            <div className="absolute inset-0 blur bg-neon-blue/30 animate-pulse rounded-full" />
          </div>
          Reading news headlines...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-bear/20 bg-bear/5 p-4 flex items-start gap-2 font-mono text-xs text-bear">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div>{error}</div>
            <button 
              onClick={fetchSentiment} 
              className="mt-2 underline font-bold cursor-pointer"
            >
              Try Reconnecting
            </button>
          </div>
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Main Catalyst Status */}
          <div className={`rounded-xl border p-4 flex items-center justify-between ${statusBorder}`}>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground tracking-wider">MARKET MOOD</div>
              <div className={`mt-1 flex items-center gap-2 font-mono text-2xl font-black ${statusColor}`}>
                <StatusIcon className="h-6 w-6" />
                {data.direction}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] text-muted-foreground">IMPACT LEVEL</div>
              <div className={`font-mono text-lg font-black ${statusColor}`}>
                {data.impact}
              </div>
            </div>
          </div>

          {/* Conditional View: Beginner Mode */}
          {isBeginner ? (
            <div className="space-y-3">
              {/* Beginner friendly translation */}
              <div className="rounded-xl bg-background/20 border border-border/20 p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-neon-green font-bold">
                  <Sparkles className="h-3.5 w-3.5" />
                  PLAIN-ENGLISH TRANSLATION
                </div>
                <p className="font-mono text-xs leading-relaxed text-foreground/90">
                  {data.beginnerExplanation || data.reasoning}
                </p>
              </div>

              {/* Key news summaries simplified */}
              {data.keyEvents && data.keyEvents.length > 0 && (
                <div className="rounded-xl bg-background/10 p-4 border border-border/10">
                  <div className="mb-2 font-mono text-[10px] text-muted-foreground tracking-wider">CORE DEVELOPMENTS</div>
                  <ul className="space-y-2 font-mono text-[11px] text-muted-foreground">
                    {data.keyEvents.slice(0, 3).map((event, idx) => (
                      <li key={idx} className="flex gap-2 items-start">
                        <span className="text-neon-blue shrink-0 mt-0.5">•</span>
                        <span>{event}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Conditional View: Pro Mode */
            <div className="space-y-4">
              {/* Sentiment Slider Gauge */}
              <div className="space-y-2 rounded-xl bg-background/20 p-4 border border-border/20">
                <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>SENTIMENT SCORE</span>
                  <span className={`font-bold ${statusColor}`}>{data.sentimentScore > 0 ? "+" : ""}{data.sentimentScore.toFixed(2)}</span>
                </div>
                
                {/* Horizontal Bar Gauge */}
                <div className="relative h-2 w-full bg-background rounded-full overflow-hidden border border-border/30">
                  {/* Score pin indicator */}
                  <div 
                    className={`absolute top-0 bottom-0 w-2 rounded-full transition-all duration-500 ${
                      data.sentimentScore > 0.15 ? "bg-bull" : data.sentimentScore < -0.15 ? "bg-bear" : "bg-neon-blue"
                    }`}
                    style={{ left: `${((data.sentimentScore + 1) / 2) * 100}%` }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-muted-foreground/30" /> {/* center mark */}
                </div>
                
                <div className="flex justify-between font-mono text-[9px] text-muted-foreground/60">
                  <span className="text-bear">Bearish (-1.0)</span>
                  <span>Neutral (0.0)</span>
                  <span className="text-bull">Bullish (+1.0)</span>
                </div>
              </div>

              {/* Pro Indicators Summary Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/40 bg-background/30 p-3">
                  <div className="font-mono text-[10px] text-muted-foreground">SIGNAL ADJ</div>
                  <div className="mt-1 font-mono text-sm font-bold text-foreground">
                    {data.signalAdjustment.replace(/_/g, " ")}
                  </div>
                </div>
                <div className="rounded-xl border border-border/40 bg-background/30 p-3">
                  <div className="font-mono text-[10px] text-muted-foreground">AI CATALYST REASON</div>
                  <div className="mt-1 font-mono text-[11px] leading-snug text-muted-foreground">
                    {data.reasoning}
                  </div>
                </div>
              </div>

              {/* Scrollable Headline Feed */}
              {data.news && data.news.length > 0 && (
                <div className="space-y-2">
                  <div className="font-mono text-[10px] text-muted-foreground tracking-wider">LIVE HEADLINE FEED</div>
                  <div className="max-h-48 overflow-y-auto pr-1 space-y-2 border border-border/20 rounded-xl bg-background/10 p-3 custom-scrollbar">
                    {data.news.map((item, idx) => (
                      <div key={idx} className="border-b border-border/10 pb-2 last:border-0 last:pb-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <a 
                            href={item.url || "#"} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-mono text-[11px] font-bold text-foreground hover:text-neon-blue transition-colors flex items-center gap-1 leading-snug"
                          >
                            {item.title}
                            {item.url && <ExternalLink className="h-3 w-3 shrink-0 inline opacity-60" />}
                          </a>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-mono text-muted-foreground/60">
                          <span>{item.source}</span>
                          <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("en-IN") : ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Explanatory Info footer */}
          <div className="flex items-start gap-2 rounded-xl bg-background/10 p-3 text-[10px] font-mono leading-relaxed text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-neon-blue mt-0.5" />
            <div>
              Sentiment scans evaluate headlines within the last 48 hours. Market drivers may shift quickly depending on global signals.
            </div>
          </div>
        </div>
      ) : (
        <div className="font-mono text-xs text-muted-foreground text-center py-4">
          No sentiment data available.
        </div>
      )}
    </div>
  );
}
