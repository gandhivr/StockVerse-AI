import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Brain,
  RefreshCw,
  Info,
  CheckCircle,
  HelpCircle,
  Play,
  ArrowLeft,
  Briefcase
} from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Navbar } from "@/components/Navbar";

export const Route = createFileRoute("/beginner-portal")({
  head: () => ({
    meta: [
      { title: "Stock Matcher — StockVerse AI" },
      { name: "description", content: "AI matches the best stocks for beginner traders." },
    ],
  }),
  component: BeginnerPortalPage,
});

interface RecommendedStock {
  symbol: string;
  companyName: string;
  currentPrice: number;
  changePercent: number;
  riskRating: string;
  badge: string;
  reason: string;
}

function BeginnerPortalPage() {
  const navigate = useNavigate();

  // Wizard state: 0 = Intro, 1 = Goal, 2 = Risk, 3 = Horizon, 4 = Loading, 5 = Results
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<"safety" | "growth" | "dividends" | "">("");
  const [risk, setRisk] = useState<"low" | "medium" | "high" | "">("");
  const [horizon, setHorizon] = useState<"short" | "long" | "">("");
  
  const [loadingText, setLoadingText] = useState("");
  const [results, setResults] = useState<RecommendedStock[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startQuiz = () => {
    setGoal("");
    setRisk("");
    setHorizon("");
    setStep(1);
  };

  const selectGoal = (val: "safety" | "growth" | "dividends") => {
    setGoal(val);
    setStep(2);
  };

  const selectRisk = (val: "low" | "medium" | "high") => {
    setRisk(val);
    setStep(3);
  };

  const selectHorizon = (val: "short" | "long") => {
    setHorizon(val);
    runMatchingEngine(goal, risk, val);
  };

  const runMatchingEngine = async (g: string, r: string, h: string) => {
    setStep(4);
    setLoadingText("Aggregating stock list...");
    
    // Simulate loading steps for visual feedback
    const loadSteps = [
      "Calculating financial strength ratios...",
      "Scraping yfinance fundamental metrics...",
      "Checking price trend predictions...",
      "Matching with Gemini AI logic...",
      "Generating simplified jargon-free reports..."
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < loadSteps.length) {
        setLoadingText(loadSteps[currentStep]);
        currentStep++;
      } else {
        clearInterval(interval);
      }
    }, 900);

    try {
      const res = await fetch("/api/recommendations/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: g, risk: r, horizon: h }),
      });
      const json = await res.json();
      
      clearInterval(interval);
      
      if (json.success && json.data) {
        setResults(json.data);
        setStep(5);
      } else {
        setError(json.message || "Failed to retrieve stock matches.");
        setStep(0);
      }
    } catch (err: unknown) {
      clearInterval(interval);
      setError("Unable to connect to the recommendation matching engine.");
      setStep(0);
    }
  };

  const simulateBuy = (symbol: string) => {
    // Add to paper trading / watchlist
    const currentWL = JSON.parse(localStorage.getItem("watchlist") || "[]");
    if (!currentWL.includes(symbol)) {
      currentWL.unshift(symbol);
      localStorage.setItem("watchlist", JSON.stringify(currentWL));
    }
    // Set beginner mode on and navigate to symbol details
    localStorage.setItem("stockverse_beginner_mode", "true");
    window.dispatchEvent(new Event("beginner-mode-changed"));
    navigate({ to: "/stocks/$symbol", params: { symbol } });
  };

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Navbar />

      <div className="mx-auto max-w-4xl px-4 pt-28 pb-16">
        
        {/* Intro Step */}
        {step === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-neon-blue/10 text-neon-blue mb-6">
              <Brain className="h-8 w-8 text-neon-blue animate-pulse" />
            </div>
            
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              Find Stocks <span className="gradient-text">Without Jargon</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground leading-relaxed">
              Don't know what RSI, P/E ratios, or EBITDA means? No problem.
              Our system screens the market and matches you with the best stocks based on your real goals.
            </p>

            {error && (
              <div className="mx-auto mt-6 max-w-md rounded-xl border border-bear/30 bg-bear/5 p-3 text-xs text-bear">
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={startQuiz}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-green to-neon-blue px-8 py-4 font-mono text-sm font-bold text-background neon-border transition-all hover:scale-105"
            >
              FIND MY MATCHES <Play className="h-4 w-4 fill-current" />
            </button>

            <div className="mt-12 grid gap-6 sm:grid-cols-3 text-left">
              {[
                { title: "Zero Terminology", desc: "No complex math. We explain everything in simple everyday language." },
                { title: "Tailored to You", desc: "Choose whether you want steady income, safe savings, or high-risk growth." },
                { title: "Easy Execution", desc: "Get simulated buying guides and targets in one click." }
              ].map((item, i) => (
                <div key={i} className="glass rounded-2xl p-5 border border-border/20">
                  <div className="font-mono text-[10px] text-neon-green mb-2">// 0{i + 1} BENEFIT</div>
                  <h3 className="font-mono text-sm font-bold text-foreground mb-1">{item.title}</h3>
                  <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Wizard Card Container */}
        {step > 0 && step < 4 && (
          <div className="glass rounded-3xl border border-border/40 p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-background">
              <motion.div
                className="h-full bg-gradient-to-r from-neon-green to-neon-blue"
                initial={{ width: "0%" }}
                animate={{ width: `${(step / 3) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <button
              onClick={() => setStep(step - 1)}
              className="mb-6 flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> BACK
            </button>

            <AnimatePresence mode="wait">
              {/* Step 1: Goal */}
              {step === 1 && (
                <motion.div
                  key="step-goal"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <span className="font-mono text-[10px] text-neon-green tracking-widest">// STEP 1 OF 3</span>
                    <h2 className="text-3xl font-black mt-1">What is your primary investment goal?</h2>
                    <p className="text-sm text-muted-foreground mt-1">Select what you want your money to do for you.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      {
                        id: "safety",
                        title: "Keep It Safe",
                        desc: "Focus on protecting savings. Buy large, stable companies with low debt.",
                        icon: Shield,
                        color: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5 hover:bg-emerald-400/10 hover:border-emerald-400/40"
                      },
                      {
                        id: "growth",
                        title: "Grow My Money",
                        desc: "Aim for high returns over time. Buy fast-growing companies with sales momentum.",
                        icon: TrendingUp,
                        color: "text-neon-blue border-neon-blue/20 bg-neon-blue/5 hover:bg-neon-blue/10 hover:border-neon-blue/40"
                      },
                      {
                        id: "dividends",
                        title: "Regular Extra Income",
                        desc: "Receive constant payouts. Buy companies that share their profits back to you.",
                        icon: DollarSign,
                        color: "text-purple-400 border-purple-400/20 bg-purple-400/5 hover:bg-purple-400/10 hover:border-purple-400/40"
                      }
                    ].map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => selectGoal(opt.id as any)}
                          className={`rounded-2xl border text-left p-6 transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[180px] ${opt.color}`}
                        >
                          <Icon className="h-7 w-7" />
                          <div>
                            <h3 className="font-mono text-sm font-bold mt-4">{opt.title}</h3>
                            <p className="font-mono text-[10px] leading-relaxed mt-1 text-muted-foreground/80">{opt.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Risk */}
              {step === 2 && (
                <motion.div
                  key="step-risk"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <span className="font-mono text-[10px] text-neon-green tracking-widest">// STEP 2 OF 3</span>
                    <h2 className="text-3xl font-black mt-1">How much risk are you comfortable with?</h2>
                    <p className="text-sm text-muted-foreground mt-1">More risk can yield higher returns, but prices will fluctuate sharply.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      {
                        id: "low",
                        title: "Low Risk",
                        desc: "Comfortable with slow, steady movements. I dislike seeing losses.",
                        color: "border-bull/20 hover:border-bull/60 hover:bg-bull/5 text-bull"
                      },
                      {
                        id: "medium",
                        title: "Medium Risk",
                        desc: "Okay with moderate shifts. I want a balance of safety and growth.",
                        color: "border-yellow-400/20 hover:border-yellow-400/60 hover:bg-yellow-400/5 text-yellow-400"
                      },
                      {
                        id: "high",
                        title: "High Risk",
                        desc: "Happy to take big swings. I want maximal return potential.",
                        color: "border-bear/20 hover:border-bear/60 hover:bg-bear/5 text-bear"
                      }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => selectRisk(opt.id as any)}
                        className={`rounded-2xl border text-left p-6 transition-all duration-200 cursor-pointer min-h-[140px] flex flex-col justify-between ${opt.color}`}
                      >
                        <HelpCircle className="h-5 w-5" />
                        <div>
                          <h3 className="font-mono text-sm font-bold">{opt.title}</h3>
                          <p className="font-mono text-[10px] leading-relaxed mt-1 text-muted-foreground/80">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Horizon */}
              {step === 3 && (
                <motion.div
                  key="step-horizon"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <span className="font-mono text-[10px] text-neon-green tracking-widest">// STEP 3 OF 3</span>
                    <h2 className="text-3xl font-black mt-1">How long do you plan to hold the stock?</h2>
                    <p className="text-sm text-muted-foreground mt-1">This helps us align with short-term price moves or long-term strength.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      {
                        id: "short",
                        title: "Short Term (Weeks/Months)",
                        desc: "I want to capture quick swings and exit when profits hit my target.",
                        color: "border-neon-blue/20 hover:border-neon-blue/60 hover:bg-neon-blue/5 text-neon-blue"
                      },
                      {
                        id: "long",
                        title: "Long Term (Years)",
                        desc: "I want to buy great businesses and hold them as they compound wealth.",
                        color: "border-neon-green/20 hover:border-neon-green/60 hover:bg-neon-green/5 text-neon-green"
                      }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => selectHorizon(opt.id as any)}
                        className={`rounded-2xl border text-left p-6 transition-all duration-200 cursor-pointer min-h-[140px] flex flex-col justify-between ${opt.color}`}
                      >
                        <Briefcase className="h-5 w-5" />
                        <div>
                          <h3 className="font-mono text-sm font-bold">{opt.title}</h3>
                          <p className="font-mono text-[10px] leading-relaxed mt-1 text-muted-foreground/80">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Step 4: Loading Screen */}
        {step === 4 && (
          <div className="glass rounded-3xl border border-border/40 p-12 text-center shadow-2xl flex flex-col items-center">
            <div className="relative mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="h-14 w-14 rounded-full border-2 border-neon-blue/20 border-t-neon-blue"
              />
              <Brain className="absolute inset-0 m-auto h-6 w-6 text-neon-blue animate-pulse" />
            </div>
            
            <h2 className="font-mono text-base font-bold text-foreground">AI Matcher at work...</h2>
            <p className="font-mono text-xs text-muted-foreground mt-2 max-w-sm">
              {loadingText}
            </p>
          </div>
        )}

        {/* Step 5: Results Screen */}
        {step === 5 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-4">
              <div>
                <span className="font-mono text-xs text-neon-green">// RESULTS GENERATED</span>
                <h2 className="text-3xl font-black mt-0.5">Your Top Stock Matches</h2>
                <p className="font-mono text-[11px] text-muted-foreground">
                  Goal: <span className="text-foreground capitalize">{goal}</span> · Risk: <span className="text-foreground capitalize">{risk}</span> · Horizon: <span className="text-foreground capitalize">{horizon === "short" ? "Short Term" : "Long Term"}</span>
                </p>
              </div>

              <button
                onClick={startQuiz}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:border-neon-blue/40 hover:text-foreground transition-all"
              >
                <RefreshCw className="h-3 w-3" /> RE-TAKE WIZARD
              </button>
            </div>

            {/* Results Grid */}
            <div className="grid gap-6">
              {results.map((item, index) => {
                const isUp = item.changePercent >= 0;
                return (
                  <motion.div
                    key={item.symbol}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.12 }}
                    className="glass rounded-2xl border border-border/40 p-6 flex flex-col md:flex-row items-start justify-between gap-6 hover:border-neon-blue/30 transition-all duration-200"
                  >
                    <div className="space-y-3 flex-1">
                      {/* Badge / Ticker row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-neon-blue/10 border border-neon-blue/30 px-3 py-0.5 font-mono text-[9px] font-bold text-neon-blue tracking-wider">
                          {item.badge}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] ${
                          item.riskRating === "Low Risk" ? "border-bull/30 bg-bull/5 text-bull" : item.riskRating === "High Risk" ? "border-bear/30 bg-bear/5 text-bear" : "border-yellow-400/30 bg-yellow-400/5 text-yellow-400"
                        }`}>
                          {item.riskRating}
                        </span>
                      </div>

                      {/* Name & price */}
                      <div>
                        <h3 className="text-xl font-bold flex items-baseline gap-2">
                          <span className="text-foreground">{item.companyName}</span>
                          <span className="text-xs text-muted-foreground font-mono">({item.symbol})</span>
                        </h3>
                        <div className="mt-1 flex items-baseline gap-2 font-mono">
                          <span className="text-base font-bold text-foreground">₹{item.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          <span className={`text-xs ${isUp ? "text-bull" : "text-bear"}`}>
                            {isUp ? "▲" : "▼"} {Math.abs(item.changePercent).toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {/* Explanation box */}
                      <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 p-4">
                        <div className="font-mono text-[9px] font-bold text-neon-green tracking-wider mb-1">
                          WHY TO BUY (IN PLAIN TERMS):
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                          {item.reason}
                        </p>
                      </div>

                      {/* Simplified Buy Guide */}
                      <div className="flex items-start gap-2 text-muted-foreground font-mono text-[10px] leading-relaxed">
                        <Info className="h-3.5 w-3.5 mt-0.5 text-neon-blue shrink-0" />
                        <div>
                          <span className="text-foreground font-bold">Action Plan: </span> 
                          Buy at current levels. We suggest checking exit options once the stock returns a simple 5-10% profit.
                        </div>
                      </div>
                    </div>

                    {/* Actions button column */}
                    <div className="flex flex-col gap-2 w-full md:w-auto md:shrink-0 justify-center">
                      <button
                        onClick={() => simulateBuy(item.symbol)}
                        className="w-full md:w-40 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-green to-neon-blue py-3 font-mono text-xs font-bold text-background hover:scale-105 transition-transform"
                      >
                        <CheckCircle className="h-4 w-4" /> SIMULATE BUY
                      </button>
                      <Link
                        to="/stocks/$symbol"
                        params={{ symbol: item.symbol }}
                        className="w-full md:w-40 flex items-center justify-center gap-2 rounded-xl border border-border/80 py-3 font-mono text-xs font-bold text-muted-foreground hover:border-neon-blue hover:text-foreground transition-colors"
                      >
                        VIEW STOCK DETAILS
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Disclaimer */}
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-[10px] font-mono leading-relaxed text-yellow-400/80">
              ⚠️ <strong>Educational simulator only:</strong> StockVerse matches stocks based on historical numbers. It is not financial advice. Always verify with personal research and start with paper trading (simulations) to learn the ropes.
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
