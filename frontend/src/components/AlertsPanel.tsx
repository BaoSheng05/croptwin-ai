import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, ShieldAlert, Eye } from "lucide-react";
import type { Alert, FarmLayer } from "../types";

type AlertsPanelProps = { alerts: Alert[]; layers: FarmLayer[] };

const severityConfig = {
  critical: { icon: ShieldAlert, bg: "bg-red-50", border: "border-status-critical/20", text: "text-status-critical", dot: "bg-status-critical" },
  warning:  { icon: AlertTriangle, bg: "bg-amber-50", border: "border-status-warning/20", text: "text-status-warning", dot: "bg-status-warning" },
  info:     { icon: Eye, bg: "bg-sky-50", border: "border-sky-300/30", text: "text-sky-600", dot: "bg-sky-500" },
};

const cropRecipes: Record<string, { temp: string; humidity: string; moisture: string; ph: string }> = {
  Lettuce: { temp: "16-24C", humidity: "50-70%", moisture: "55-80%", ph: "5.5-6.5" },
  Basil: { temp: "21-28C", humidity: "40-60%", moisture: "45-70%", ph: "5.8-6.8" },
  Strawberry: { temp: "18-26C", humidity: "45-65%", moisture: "50-75%", ph: "5.5-6.5" },
  Spinach: { temp: "15-22C", humidity: "45-65%", moisture: "50-75%", ph: "6.0-7.0" },
  Mint: { temp: "18-25C", humidity: "50-70%", moisture: "55-80%", ph: "6.0-7.0" },
  Tomato: { temp: "20-30C", humidity: "40-60%", moisture: "50-70%", ph: "5.5-6.8" },
};

const DEFAULT_VISIBLE_ALERTS = 6;

function timeAgo(timestamp: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function AlertsPanel({ alerts, layers }: AlertsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const sortedAlerts = useMemo(
    () => [...alerts].sort((a, b) => {
      const severityRank = { critical: 0, warning: 1, info: 2 };
      const rankDelta = severityRank[a.severity] - severityRank[b.severity];
      if (rankDelta !== 0) return rankDelta;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }),
    [alerts],
  );
  const visibleAlerts = expanded ? sortedAlerts : sortedAlerts.slice(0, DEFAULT_VISIBLE_ALERTS);
  const hiddenCount = Math.max(0, sortedAlerts.length - visibleAlerts.length);

  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase text-muted">Risk Engine</p>
          <h2 className="text-lg font-semibold text-ink">Active Alerts ({alerts.length})</h2>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-md bg-amber-50 text-status-warning">
          <AlertTriangle size={18} />
        </span>
      </div>

      <div className="space-y-2 stagger">
        {alerts.length === 0 && (
          <div className="rounded-md border border-dashed border-card-border py-8 text-center text-sm text-muted">
            No active alerts — all systems nominal
          </div>
        )}
        {visibleAlerts.map((alert) => {
          const cfg = severityConfig[alert.severity] || severityConfig.info;
          const layer = layers.find((item) => item.id === alert.layer_id);
          const reading = layer?.latest_reading;
          const recipe = layer ? cropRecipes[layer.crop] : undefined;
          return (
            <div key={alert.id} className={`rounded-md border ${cfg.border} ${cfg.bg} p-3 transition-all hover:scale-[1.01]`}>
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                <p className="flex-1 text-sm font-medium text-ink">{alert.title}</p>
                <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.text}`}>
                  {alert.predictive ? "Predicted" : alert.severity}
                </span>
              </div>
              {layer && (
                <p className="mt-2 ml-[18px] text-xs font-medium text-muted">
                  {layer.area_name.split("—")[0].trim()} · {layer.name} · {layer.crop}
                  <span className="ml-2 text-muted/60">{timeAgo(alert.created_at)}</span>
                </p>
              )}
              <p className="mt-1.5 ml-[18px] text-sm leading-relaxed text-muted">{alert.message}</p>
              {reading && recipe && (
                <div className="mt-3 ml-[18px] grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
                  <span>Humidity <strong className="text-ink">{reading.humidity.toFixed(0)}%</strong> / {recipe.humidity}</span>
                  <span>Moisture <strong className="text-ink">{reading.soil_moisture.toFixed(0)}%</strong> / {recipe.moisture}</span>
                  <span>Temp <strong className="text-ink">{reading.temperature.toFixed(1)}C</strong> / {recipe.temp}</span>
                  <span>pH <strong className="text-ink">{reading.ph.toFixed(1)}</strong> / {recipe.ph}</span>
                </div>
              )}
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-card-border bg-field-bg px-3 py-2 text-xs font-semibold text-muted transition hover:bg-spring-green/10 hover:text-forest-green"
          >
            <ChevronDown size={14} />
            Show {hiddenCount} more
          </button>
        )}
        {expanded && sortedAlerts.length > DEFAULT_VISIBLE_ALERTS && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-card-border bg-field-bg px-3 py-2 text-xs font-semibold text-muted transition hover:bg-spring-green/10 hover:text-forest-green"
          >
            <ChevronUp size={14} />
            Show less
          </button>
        )}
      </div>
    </div>
  );
}
