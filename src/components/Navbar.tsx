import { Link, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Menu, X, Sparkles, BookOpen } from "lucide-react";
import { useState } from "react";
import { useBeginnerMode } from "@/hooks/useBeginnerMode";

export function Navbar() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isBeginner, toggleBeginner] = useBeginnerMode();

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  const links = isBeginner
    ? [
        { to: "/", label: "./home" },
        { to: "/beginner-portal", label: "🚀 find-stock" },
        { to: "/compare", label: "⚖️ compare" },
        { to: "/dashboard", label: "./dashboard" },
        { to: "/stocks", label: "./stocks" },
        { to: "/portfolio", label: "./portfolio" },
      ]
    : [
        { to: "/", label: "./home" },
        { to: "/compare", label: "⚖️ compare" },
        { to: "/dashboard", label: "./dashboard" },
        { to: "/stocks", label: "./stocks" },
        { to: "/accuracy", label: "./accuracy" },
        { to: "/portfolio", label: "./portfolio" },
      ];

  return (
    <>
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 w-full"
      >
        <div className="glass mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-2xl px-6 py-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="relative">
              <Activity className="h-6 w-6 text-neon-green" />
              <div className="absolute inset-0 blur-md bg-neon-green/50" />
            </div>
            <span className="font-mono text-lg font-bold tracking-tight">
              <span className="gradient-text">Stock</span>
              <span className="text-foreground">Verse</span>
              <span className="text-neon-blue">.AI</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 text-sm font-mono md:flex">
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={
                  isActive(to)
                    ? "text-neon-green"
                    : "text-muted-foreground hover:text-foreground transition-colors"
                }
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Beginner Mode Toggle */}
            <button
              onClick={toggleBeginner}
              className="flex items-center gap-1.5 rounded-xl border border-neon-blue/30 bg-background/40 px-3 py-1.5 font-mono text-[10px] font-bold text-foreground transition-all hover:border-neon-blue/60 hover:bg-neon-blue/5"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isBeginner ? "bg-neon-blue animate-pulse" : "bg-muted-foreground"}`} />
              {isBeginner ? "BEGINNER ON" : "BEGINNER OFF"}
            </button>

            <Link
              to="/dashboard"
              className="hidden md:inline-flex rounded-lg bg-gradient-to-r from-neon-green to-neon-blue px-4 py-2 font-mono text-xs font-bold text-background neon-border transition-transform hover:scale-105"
            >
              LAUNCH AI →
            </Link>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-20 z-40 mx-4 rounded-2xl glass border border-neon-green/20 p-4 md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {links.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-xl px-4 py-3 font-mono text-sm transition-colors ${
                    isActive(to)
                      ? "bg-neon-green/10 text-neon-green"
                      : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              ))}
              <div className="border-t border-border/30 my-2 pt-2 flex flex-col gap-2">
                <button
                  onClick={() => {
                    toggleBeginner();
                    setMobileOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-neon-blue/30 py-2.5 font-mono text-xs text-foreground"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isBeginner ? "bg-neon-blue" : "bg-muted-foreground"}`} />
                  {isBeginner ? "DISABLE BEGINNER MODE" : "ENABLE BEGINNER MODE"}
                </button>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl bg-gradient-to-r from-neon-green to-neon-blue px-4 py-3 text-center font-mono text-sm font-bold text-background"
                >
                  LAUNCH AI →
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
