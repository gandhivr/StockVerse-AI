import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Send, Sparkles, User } from "lucide-react";

type Msg = { role: "user" | "ai"; text: string };

const SEED: Msg[] = [
  {
    role: "ai",
    text: "Hello, I'm StockVerse AI. Ask me about Indian stocks, predictions, or market trends.",
  },
];

const FALLBACK_RESPONSE =
  "The AI chat service is temporarily unavailable. Please try again in a moment, or check backend Gemini settings.";

export function AIChat({ initialMessage }: { initialMessage?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sessionId] = useState(
    () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  );
  const seededRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = async (overrideMsg?: string) => {
    const text = (overrideMsg ?? input).trim();
    if (!text || thinking) return;

    setMsgs((m) => [...m, { role: "user", text }]);
    if (!overrideMsg) setInput("");
    setThinking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.userMessage || json.message || "AI chat service is unavailable.");
      }

      const reply = json.data?.message || "I couldn't process that. Please try again.";
      setMsgs((m) => [...m, { role: "ai", text: reply }]);
    } catch (error) {
      setMsgs((m) => [
        ...m,
        { role: "ai", text: error instanceof Error ? error.message : FALLBACK_RESPONSE },
      ]);
    } finally {
      setThinking(false);
    }
  };

  useEffect(() => {
    if (initialMessage && !seededRef.current) {
      seededRef.current = true;
      send(initialMessage);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, thinking]);

  return (
    <div className="glass flex h-[480px] flex-col rounded-2xl">
      <div className="flex items-center gap-2 border-b border-neon-green/20 p-4">
        <div className="relative">
          <Bot className="h-5 w-5 text-neon-green" />
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 animate-blink rounded-full bg-neon-green" />
        </div>
        <div>
          <div className="font-mono text-sm font-bold">STOCKVERSE.AI</div>
          <div className="font-mono text-[10px] text-muted-foreground">
            Powered by Gemini Flash · Finance Expert
          </div>
        </div>
        <Sparkles className="ml-auto h-4 w-4 text-neon-blue" />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 font-mono text-sm">
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}
            >
              {m.role === "ai" && <Bot className="mt-1 h-4 w-4 shrink-0 text-neon-green" />}
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === "ai"
                    ? "border border-neon-green/30 bg-neon-green/5"
                    : "border border-neon-blue/30 bg-neon-blue/10"
                }`}
                dangerouslySetInnerHTML={{
                  __html: m.text
                    .replace(/\*\*(.+?)\*\*/g, "<strong class='text-neon-green'>$1</strong>")
                    .replace(/\n/g, "<br/>"),
                }}
              />
              {m.role === "user" && <User className="mt-1 h-4 w-4 shrink-0 text-neon-blue" />}
            </motion.div>
          ))}
          {thinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Bot className="h-4 w-4 text-neon-green" />
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-blink rounded-full bg-neon-green" />
                <span
                  className="h-1.5 w-1.5 animate-blink rounded-full bg-neon-green"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-blink rounded-full bg-neon-green"
                  style={{ animationDelay: "0.4s" }}
                />
              </span>
              analyzing markets...
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-neon-green/20 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about any stock..."
          className="flex-1 rounded-lg border border-neon-green/30 bg-background/50 px-3 py-2 font-mono text-xs outline-none placeholder:text-muted-foreground focus:border-neon-green"
        />
        <button
          onClick={() => send()}
          disabled={thinking}
          className="rounded-lg bg-gradient-to-r from-neon-green to-neon-blue px-3 text-background transition-transform hover:scale-105 disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
