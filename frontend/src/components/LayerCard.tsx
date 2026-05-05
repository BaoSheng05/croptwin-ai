import { Cpu, Droplets, Fan, Lightbulb, ThermometerSun } from "lucide-react";

import type { FarmLayer } from "../types";

type LayerCardProps = {
  layer: FarmLayer;
};

const statusClass = {
  Healthy: "border-mint/40 bg-mint/10 text-mint",
  Warning: "border-amber/40 bg-amber/10 text-amber",
  Critical: "border-coral/40 bg-coral/10 text-coral",
  Offline: "border-white/20 bg-white/10 text-white/60",
};

export function LayerCard({ layer }: LayerCardProps) {
  const reading = layer.latest_reading;

  return (
    <div className="rounded-lg border border-white/10 bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white/50">{layer.name}</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{layer.crop}</h3>
        </div>
        <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${statusClass[layer.status]}`}>
          {layer.status}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-white/45">Health</p>
          <p className="text-4xl font-semibold text-white">{layer.health_score}</p>
        </div>
        <div className="h-16 w-16 rounded-full border-4 border-white/10 p-1">
          <div
            className="h-full rounded-full bg-mint"
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

      <div className="mt-4 flex items-center gap-2 rounded-md bg-field px-3 py-2 text-sm text-white/65">
        <Fan size={16} className={layer.devices.fan ? "text-mint" : "text-white/35"} />
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
    <div className="rounded-md bg-field p-2">
      <div className="flex items-center gap-1.5 text-white/45">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <div className="mt-1 font-medium text-white">{value}</div>
    </div>
  );
}
