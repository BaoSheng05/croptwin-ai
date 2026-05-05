import { Droplets, Fan, Thermometer, FlaskConical } from "lucide-react";
import type { FarmLayer } from "../types";

type LayerCardProps = { layer: FarmLayer };

const statusStyles = {
  Healthy:  { dot: "bg-mint shadow-[0_0_8px_rgba(125,223,150,0.5)]",  border: "border-mint/10",  label: "text-mint" },
  Warning:  { dot: "bg-amber shadow-[0_0_8px_rgba(248,192,90,0.5)]",   border: "border-amber/10", label: "text-amber" },
  Critical: { dot: "bg-coral shadow-[0_0_8px_rgba(255,111,97,0.5)]",   border: "border-coral/10", label: "text-coral" },
  Offline:  { dot: "bg-white/30",                                        border: "border-white/5",  label: "text-white/40" },
};

function HealthRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#7ddf96" : score >= 50 ? "#f8c05a" : "#ff6f61";

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
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
        {score}
      </span>
    </div>
  );
}

export function LayerCard({ layer }: LayerCardProps) {
  const reading = layer.latest_reading;
  const s = statusStyles[layer.status] || statusStyles.Offline;

  return (
    <div className={`group relative overflow-hidden rounded-2xl border ${s.border} bg-white/[0.02] p-4 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.08]`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-medium text-white/25 uppercase tracking-wide">{layer.name}</p>
          <h3 className="text-base font-semibold text-white mt-0.5">{layer.crop}</h3>
        </div>
        <HealthRing score={layer.health_score} size={48} />
      </div>

      {/* Readings grid */}
      <div className="grid grid-cols-2 gap-1.5 text-[12px]">
        <MiniReading icon={Thermometer} value={reading ? `${reading.temperature.toFixed(1)}°` : "—"} />
        <MiniReading icon={Droplets} value={reading ? `${reading.humidity.toFixed(0)}%` : "—"} />
        <MiniReading icon={FlaskConical} value={reading ? `${reading.ph.toFixed(1)}` : "—"} />
        <MiniReading icon={Fan} value={layer.devices.fan ? "ON" : "OFF"} active={layer.devices.fan} />
      </div>

      {/* Status bar */}
      {layer.main_risk && (
        <div className="mt-3 rounded-lg bg-amber/[0.06] border border-amber/10 px-2.5 py-1.5 text-[11px] text-amber/80 truncate">
          ⚠ {layer.main_risk}
        </div>
      )}
    </div>
  );
}

function MiniReading({ icon: Icon, value, active }: { icon: typeof Thermometer; value: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.02] px-2 py-1.5">
      <Icon size={12} className={active ? "text-mint" : "text-white/20"} />
      <span className="font-medium text-white/60">{value}</span>
    </div>
  );
}
