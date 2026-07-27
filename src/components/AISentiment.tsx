import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, ExternalLink } from "lucide-react";

interface NewsItem {
  title: string;
  source: string;
  publishedAt: string;
  url?: string;
}

interface SentimentData {
  overallSentiment: string;
  sentimentScore: number;
  marketImpact: string;
  summary: string;
  bullishFactors: string[];
  bearishFactors: string[];
  newsAnalysis: { headline: string; sentiment: string; impact: string }[];
}

const sentimentColor = { POSITIVE: "text-bull", NEGATIVE: "text-bear", NEUTRAL: "text-neon-blue" };
const sentimentIcon = { POSITIVE: TrendingUp, NEGATIVE: TrendingDown, NEUTRAL: Minus };

export function AISentiment() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [overallScore, setOverallScore] = useState(65);

  const fetchSentiment = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/news-sentiment");
      const json = await res.json();
      const d = json.data;
      if (d?.news?.length) setNews(d.news.slice(0, 6));
      if (d?.sentiment) {
        setSentiment(d.sentiment);
        const score = d.sentiment.sentimentScore;
        setOverallScore(Math.round((score + 1) * 50)); // -1..1 → 0..100
      }
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchSentiment();
    const t = setInterval(fetchSentiment, 120000); // refresh every 2 min
    return () => clearInterval(t);
  }, []);

  const sentLabel = overallScore > 60 ? "BULLISH" : overallScore < 40 ? "BEARISH" : "NEUTRAL";
  const sentCol = overallScore > 60 ? "text-bull" : overallScore < 40 ? "text-bear" : "text-yellow-400";

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-neon-green" />
          <h3 className="font-mono text-sm font-bold tracking-wider">AI NEWS SENTIMENT</h3>
        </div>
        <div className="flex items-center gap-3">
          {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">OVERALL:</span>
            <span className={`font-mono text-sm font-bold ${sentCol}`}>{overallScore}% {sentLabel}</span>
          </div>
        </div>
      </div>

      {/* Sentiment summary */}
      {sentiment?.summary && (
        <div className="mb-4 rounded-xl border border-neon-green/20 bg-neon-green/5 p-3">
          <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{sentiment.summary}</p>
        </div>
      )}

      {/* Bullish / Bearish factors */}
      {sentiment && (sentiment.bullishFactors?.length > 0 || sentiment.bearishFactors?.length > 0) && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          {sentiment.bullishFactors?.length > 0 && (
            <div className="rounded-xl border border-bull/20 bg-bull/5 p-3">
              <div className="font-mono text-[10px] text-bull mb-1.5">▲ BULLISH</div>
              {sentiment.bullishFactors.slice(0, 2).map((f, i) => (
                <div key={i} className="font-mono text-[10px] text-muted-foreground">• {f}</div>
              ))}
            </div>
          )}
          {sentiment.bearishFactors?.length > 0 && (
            <div className="rounded-xl border border-bear/20 bg-bear/5 p-3">
              <div className="font-mono text-[10px] text-bear mb-1.5">▼ BEARISH</div>
              {sentiment.bearishFactors.slice(0, 2).map((f, i) => (
                <div key={i} className="font-mono text-[10px] text-muted-foreground">• {f}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* News items */}
      <div className="space-y-2">
        {(news.length ? news : Array(4).fill(null)).map((n, i) => {
          if (!n) return (
            <div key={i} className="h-14 rounded-lg bg-background/20 animate-pulse" />
          );
          const analysis = sentiment?.newsAnalysis?.[i];
          const sent = analysis?.sentiment || "NEUTRAL";
          const Icon = sentimentIcon[sent as keyof typeof sentimentIcon] || Minus;
          const col = sentimentColor[sent as keyof typeof sentimentColor] || "text-neon-blue";
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 rounded-lg border border-border/30 bg-background/20 p-3">
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${col}`} />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs leading-relaxed line-clamp-2">{n.title}</p>
                <div className="flex items-center gap-2 mt-1 font-mono text-[10px] text-muted-foreground">
                  <span>{n.source}</span>
                  {analysis?.impact && <><span>·</span><span className={col}>{analysis.impact}</span></>}
                </div>
              </div>
              {n.url && (
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-neon-green transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
