import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity } from "lucide-react";

const BOOT_LINES = [
  "INITIALIZING STOCKVERSE.AI v4.2.0...",
  "LOADING NEURAL PREDICTION ENGINE...",
  "CONNECTING TO NSE/BSE LIVE FEED...",
  "CALIBRATING QUANT MODELS [12/12]...",
  "SCANNING 5,000+ INDIAN STOCKS...",
  "SENTIMENT ANALYSIS: ONLINE",
  "RISK AI: ONLINE",
  "PORTFOLIO OPTIMIZER: ONLINE",
  "ALL SYSTEMS OPERATIONAL ✓",
];

export function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Run only once on mount — ignore onComplete reference changes
    let i = 0;
    let finished = false;
    const interval = setInterval(() => {
      if (finished) return;
      if (i < BOOT_LINES.length) {
        const line = BOOT_LINES[i];
        if (line !== undefined) {
          setLines((prev) => [...prev, line]);
          setProgress(((i + 1) / BOOT_LINES.length) * 100);
        }
        i++;
      } else {
        finished = true;
        clearInterval(interval);
        setTimeout(() => setDone(true), 400);
        setTimeout(onComplete, 1200);
      }
    }, 180);
    return () => {
      finished = true;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
        >
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="absolute inset-0 scanline pointer-events-none opacity-40" />

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative mb-8"
          >
            <Activity className="h-16 w-16 text-neon-green" />
            <div className="absolute inset-0 blur-xl bg-neon-green/40 animate-pulse" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-2xl font-bold tracking-wider mb-8"
          >
            <span className="gradient-text">STOCKVERSE</span>
            <span className="text-neon-blue">.AI</span>
          </motion.h1>

          <div className="w-80 max-w-[90vw] space-y-1 font-mono text-xs">
            {lines.filter(Boolean).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`${line.includes("✓") ? "text-neon-green" : "text-muted-foreground"}`}
              >
                <span className="text-neon-green/60">{">"}</span> {line}
              </motion.div>
            ))}
            {lines.length < BOOT_LINES.length && (
              <span className="inline-block h-3 w-1.5 bg-neon-green animate-blink" />
            )}
          </div>

          <div className="mt-6 w-80 max-w-[90vw]">
            <div className="h-1 overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full bg-gradient-to-r from-neon-green to-neon-blue"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>BOOT SEQUENCE</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
