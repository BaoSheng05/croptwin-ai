import { Droplets, Fan, Thermometer, FlaskConical } from "lucide-react";
import type { FarmLayer } from "../types";

type LayerCardProps = { layer: FarmLayer };

const statusClass = {
  Healthy:  "border-status-healthy/30 bg-spring-green/20 text-status-healthy",
  Warning:  "border-status-warning/30 bg-amber-50 text-status-warning",
  Critical: "border-status-critical/30 bg-red-50 text-status-critical",
  Offline:  "border-slate-300 bg-slate-100 text-status-offline",
};

function HealthRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#1E8449" : score >= 50 ? "#C27B00" : "#C0392B";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} className="ring-track" />
        <circle
          cx={size/2} cy={size/2} r={r}
          className="ring-fill"
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ink">
        {score}
      </span>
    </div>
  );
}

export function LayerCard({ layer }: LayerCardProps) {
  const reading = layer.latest_reading;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-card-border bg-white p-4 shadow-card transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{layer.name}</p>
          <h3 className="text-lg font-semibold text-ink mt-0.5">{layer.crop}</h3>
        </div>
        <HealthRing score={layer.health_score} size={48} />
      </div>

      {/* Readings grid */}
      <div className="grid grid-cols-2 gap-1.5 text-sm">
        <MiniReading icon={Thermometer} value={reading ? `${reading.temperature.toFixed(1)}°` : "—"} />
        <MiniReading icon={Droplets} value={reading ? `${reading.humidity.toFixed(0)}%` : "—"} />
        <MiniReading icon={FlaskConical} value={reading ? `${reading.ph.toFixed(1)}` : "—"} />
        <MiniReading icon={Fan} value={layer.devices.fan ? "ON" : "OFF"} active={layer.devices.fan} />
      </div>

      {/* Status bar */}
      {layer.main_risk && (
        <div className="mt-3 rounded-md bg-amber-50 border border-status-warning/20 px-2.5 py-1.5 text-xs text-status-warning truncate">
          ⚠ {layer.main_risk}
        </div>
      )}
    </div>
  );
}

function MiniReading({ icon: Icon, value, active }: { icon: typeof Thermometer; value: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-field-bg px-2 py-1.5">
      <Icon size={12} className={active ? "text-forest-green" : "text-muted/50"} />
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
