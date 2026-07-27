import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  Settings,
  WifiOff,
} from "lucide-react";
import { api, type HealthCheck, type SystemHealth } from "@/lib/api";

const statusStyles = {
  online: "border-bull/30 bg-bull/10 text-bull",
  degraded: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
  offline: "border-bear/30 bg-bear/10 text-bear",
};

function StatusIcon({ check }: { check: HealthCheck }) {
  if (check.status === "online") return <CheckCircle2 className="h-4 w-4" />;
  if (check.status === "degraded") return <AlertTriangle className="h-4 w-4" />;
  return <WifiOff className="h-4 w-4" />;
}

export function SystemStatus() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = useMemo(
    () =>
      health
        ? [
            { key: "backend", label: "Backend", icon: Server, check: health.checks.backend },
            { key: "database", label: "Database", icon: Database, check: health.checks.database },
            {
              key: "mlService",
              label: "ML Service",
              icon: Activity,
              check: health.checks.mlService,
            },
            {
              key: "configuration",
              label: "Config",
              icon: Settings,
              check: health.checks.configuration,
            },
          ]
        : [],
    [health],
  );

  const loadHealth = async () => {
    setLoading(true);
    setError("");
    try {
      setHealth(await api.system.health());
    } catch (err) {
      setError(err instanceof Error ? err.message : "System status is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const timer = window.setInterval(loadHealth, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-neon-green" />
          <h3 className="font-mono text-sm font-bold tracking-wider">SYSTEM STATUS</h3>
        </div>
        <button
          onClick={loadHealth}
          disabled={loading}
          className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-neon-green/40 hover:text-foreground disabled:opacity-50"
          aria-label="Refresh system status"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-bear/30 bg-bear/10 p-3 font-mono text-xs text-bear">
          {error}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {checks.map(({ key, label, icon: Icon, check }) => (
            <div key={key} className={`rounded-lg border p-3 ${statusStyles[check.status]}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="font-mono text-xs font-bold">{label}</span>
                </div>
                <StatusIcon check={check} />
              </div>
              <p className="mt-2 line-clamp-2 font-mono text-[10px] leading-relaxed opacity-90">
                {check.message}
              </p>
              {typeof check.latencyMs === "number" && (
                <p className="mt-1 font-mono text-[10px] opacity-80">{check.latencyMs}ms</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
