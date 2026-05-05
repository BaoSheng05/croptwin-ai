import { AlertTriangle, ShieldAlert, Eye } from "lucide-react";
import type { Alert, FarmLayer } from "../types";

type AlertsPanelProps = { alerts: Alert[]; layers: FarmLayer[] };

const severityConfig = {
  critical: { icon: ShieldAlert, bg: "bg-coral/[0.06]", border: "border-coral/15", text: "text-coral", dot: "bg-coral" },
  warning:  { icon: AlertTriangle, bg: "bg-amber/[0.06]", border: "border-amber/15", text: "text-amber", dot: "bg-amber" },
  info:     { icon: Eye, bg: "bg-cyan/[0.06]", border: "border-cyan/15", text: "text-cyan", dot: "bg-cyan" },
};

const cropRecipes: Record<string, { temp: string; humidity: string; moisture: string; ph: string }> = {
  Lettuce: { temp: "16-24C", humidity: "50-70%", moisture: "55-80%", ph: "5.5-6.5" },
  Basil: { temp: "21-28C", humidity: "40-60%", moisture: "45-70%", ph: "5.8-6.8" },
  Strawberry: { temp: "18-26C", humidity: "45-65%", moisture: "50-75%", ph: "5.5-6.5" },
  Spinach: { temp: "15-22C", humidity: "45-65%", moisture: "50-75%", ph: "6.0-7.0" },
  Mint: { temp: "18-25C", humidity: "50-70%", moisture: "55-80%", ph: "6.0-7.0" },
  Tomato: { temp: "20-30C", humidity: "40-60%", moisture: "50-70%", ph: "5.5-6.8" },
};

function timeAgo(timestamp: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function AlertsPanel({ alerts, layers }: AlertsPanelProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">Risk Engine</p>
          <h2 className="text-base font-semibold text-white mt-0.5">Active Alerts</h2>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber/10 text-amber">
          <AlertTriangle size={16} />
        </span>
      </div>

      <div className="space-y-2 stagger">
        {alerts.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/[0.06] py-8 text-center text-[13px] text-white/25">
            No active alerts — all systems nominal
          </div>
        )}
        {alerts.slice(0, 5).map((alert) => {
          const cfg = severityConfig[alert.severity] || severityConfig.info;
          const layer = layers.find((item) => item.id === alert.layer_id);
          const reading = layer?.latest_reading;
          const recipe = layer ? cropRecipes[layer.crop] : undefined;
          return (
            <div key={alert.id} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3.5 transition-all hover:scale-[1.01]`}>
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                <p className="flex-1 text-[13px] font-medium text-white/80">{alert.title}</p>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.text}`}>
                  {alert.predictive ? "Predicted" : alert.severity}
                </span>
              </div>
              {layer && (
                <p className="mt-2 ml-[18px] text-[11px] font-medium text-white/55">
                  {layer.area_name.split("—")[0].trim()} · {layer.name} · {layer.crop}
                  <span className="ml-2 text-white/25">{timeAgo(alert.created_at)}</span>
                </p>
              )}
              <p className="mt-1.5 ml-[18px] text-[12px] leading-relaxed text-white/40">{alert.message}</p>
              {reading && recipe && (
                <div className="mt-3 ml-[18px] grid grid-cols-2 gap-2 text-[10px] text-white/35 sm:grid-cols-4">
                  <span>Humidity <strong className="text-white/60">{reading.humidity.toFixed(0)}%</strong> / {recipe.humidity}</span>
                  <span>Moisture <strong className="text-white/60">{reading.soil_moisture.toFixed(0)}%</strong> / {recipe.moisture}</span>
                  <span>Temp <strong className="text-white/60">{reading.temperature.toFixed(1)}C</strong> / {recipe.temp}</span>
                  <span>pH <strong className="text-white/60">{reading.ph.toFixed(1)}</strong> / {recipe.ph}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
