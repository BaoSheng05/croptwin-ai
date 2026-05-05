import { Cpu, Droplets, Fan, Lightbulb, ThermometerSun } from "lucide-react";

import type { FarmLayer } from "../types";

type LayerCardProps = {
  layer: FarmLayer;
};

const statusClass = {
  Healthy:  "border-status-healthy/30 bg-spring-green/20 text-status-healthy",
  Warning:  "border-status-warning/30 bg-amber-50 text-status-warning",
  Critical: "border-status-critical/30 bg-red-50 text-status-critical",
  Offline:  "border-slate-300 bg-slate-100 text-status-offline",
};

export function LayerCard({ layer }: LayerCardProps) {
  const reading = layer.latest_reading;

  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{layer.name}</p>
          <h3 className="mt-1 text-xl font-semibold text-ink">{layer.crop}</h3>
        </div>
        <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${statusClass[layer.status]}`}>
          {layer.status}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-muted">Health</p>
          <p className="text-4xl font-semibold text-ink">{layer.health_score}</p>
        </div>
        <div className="h-16 w-16 rounded-full border-4 border-card-border p-1">
          <div
            className="h-full rounded-full bg-forest-green"
            style={{ clipPath: `inset(${100 - layer.health_score}% 0 0 0)` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Reading icon={ThermometerSun} label="Temp" value={reading ? `${reading.temperature.toFixed(1)} C` : "--"} />
        <Reading icon={Droplets} label="Humidity" value={reading ? `${reading.humidity.toFixed(0)}%` : "--"} />
        <Reading icon={Cpu} label="pH" value={reading ? reading.ph.toFixed(1) : "--"} />
        <Reading icon={Lightbulb} label="LED" value={`${layer.devices.led_intensity}%`} />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-md bg-field-bg px-3 py-2 text-sm text-muted">
        <Fan size={16} className={layer.devices.fan ? "text-forest-green" : "text-slate-400"} />
        {layer.main_risk ?? "Climate recipe stable"}
      </div>
    </div>
  );
}

function Reading({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ThermometerSun;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-field-bg p-2">
      <div className="flex items-center gap-1.5 text-muted">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <div className="mt-1 font-medium text-ink">{value}</div>
    </div>
  );
}
