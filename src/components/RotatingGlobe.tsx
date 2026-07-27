import { motion } from "framer-motion";

export function RotatingGlobe({ size = 280 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* outer rings */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 rounded-full border border-neon-green/30"
        style={{ borderTopColor: "oklch(0.88 0.27 150)", borderTopWidth: 2 }}
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute inset-4 rounded-full border border-neon-blue/30"
        style={{ borderRightColor: "oklch(0.78 0.2 230)", borderRightWidth: 2 }}
      />
      {/* globe */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute inset-10 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.3 0.1 230), oklch(0.12 0.05 260))",
          boxShadow: "0 0 60px oklch(0.78 0.2 230 / 0.5), inset -20px -20px 60px oklch(0 0 0 / 0.5)",
        }}
      >
        {/* meridians */}
        {[0, 30, 60, 90, 120, 150].map((d) => (
          <div
            key={d}
            className="absolute inset-0 rounded-full border border-neon-green/20"
            style={{ transform: `rotateY(${d}deg)` }}
          />
        ))}
        {[0, 30, 60, 90, 120, 150].map((d) => (
          <div
            key={`h${d}`}
            className="absolute inset-0 rounded-full border-t border-neon-green/15"
            style={{ transform: `rotateX(${d}deg)` }}
          />
        ))}
      </motion.div>
      {/* dots */}
      {[
        { t: "20%", l: "30%" },
        { t: "40%", l: "60%" },
        { t: "60%", l: "25%" },
        { t: "70%", l: "70%" },
        { t: "30%", l: "75%" },
      ].map((p, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 rounded-full bg-neon-green animate-pulse-glow"
          style={{ top: p.t, left: p.l }}
        />
      ))}
    </div>
  );
}
