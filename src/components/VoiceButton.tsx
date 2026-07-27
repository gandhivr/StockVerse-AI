import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X } from "lucide-react";

export function VoiceButton() {
  const [active, setActive] = useState(false);
  const [text, setText] = useState("");

  const toggle = () => {
    if (!active) {
      setActive(true);
      setText("");
      // Simulate voice recognition
      setTimeout(() => setText("Show me top AI picks for today..."), 1500);
      setTimeout(() => {
        setActive(false);
      }, 4000);
    } else {
      setActive(false);
    }
  };

  return (
    <>
      <motion.button
        onClick={toggle}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all ${
          active
            ? "bg-bear shadow-[0_0_30px_oklch(0.7_0.25_25/0.5)]"
            : "bg-gradient-to-r from-neon-green to-neon-blue shadow-[0_0_30px_oklch(0.88_0.27_150/0.4)]"
        }`}
      >
        {active ? <MicOff className="h-6 w-6 text-foreground" /> : <Mic className="h-6 w-6 text-background" />}
        {active && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-bear"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-bear"
              animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {active && text && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 right-6 z-50 glass rounded-xl p-4 max-w-xs"
          >
            <div className="flex items-center gap-2 mb-2">
              <Mic className="h-3 w-3 text-neon-green animate-pulse" />
              <span className="font-mono text-[10px] text-neon-green">VOICE AI ACTIVE</span>
            </div>
            <p className="font-mono text-xs text-foreground">{text}</p>
            <div className="mt-2 flex gap-1">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 rounded-full bg-neon-green"
                  animate={{ height: [8, 20, 8] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
