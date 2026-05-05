import { Fan, Lightbulb, Power, ShowerHead, Waves } from "lucide-react";
import type { FarmLayer } from "../types";

type ControlPanelProps = {
  layer: FarmLayer;
  onCommand: (layerId: string, device: string, value: boolean | number) => Promise<unknown>;
};

export function ControlPanel({ layer, onCommand }: ControlPanelProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">Control Loop</p>
        <h2 className="text-base font-semibold text-white mt-0.5">{layer.name} — {layer.crop}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 stagger">
        <DeviceToggle icon={Fan} label="Fan" sublabel="Ventilation" active={layer.devices.fan}
          onClick={() => onCommand(layer.id, "fan", !layer.devices.fan)} />
        <DeviceToggle icon={Waves} label="Pump" sublabel="Irrigation" active={layer.devices.pump}
          onClick={() => onCommand(layer.id, "pump", !layer.devices.pump)} />
        <DeviceToggle icon={ShowerHead} label="Misting" sublabel="Humidity" active={layer.devices.misting}
          onClick={() => onCommand(layer.id, "misting", !layer.devices.misting)} />
        <DeviceToggle icon={Power} label="Auto" sublabel="AI Control" active={layer.devices.auto_mode}
          onClick={() => onCommand(layer.id, "auto_mode", !layer.devices.auto_mode)} accent="violet" />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-[13px] text-white/50">
            <Lightbulb size={14} className="text-amber" />
            LED Intensity
          </span>
          <span className="text-sm font-semibold text-white">{layer.devices.led_intensity}%</span>
        </div>
        <div className="relative">
          <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber/60 to-amber transition-all duration-300"
              style={{ width: `${layer.devices.led_intensity}%` }}
            />
          </div>
          <input
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            type="range"
            min={0}
            max={100}
            value={layer.devices.led_intensity}
            onChange={(e) => onCommand(layer.id, "led_intensity", Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}

function DeviceToggle({ icon: Icon, label, sublabel, active, onClick, accent = "mint" }: {
  icon: typeof Fan; label: string; sublabel: string; active: boolean; onClick: () => void; accent?: string;
}) {
  const activeClass = accent === "violet"
    ? "border-violet/30 bg-violet/[0.08] text-violet shadow-[0_0_20px_rgba(167,139,250,0.08)]"
    : "border-mint/30 bg-mint/[0.08] text-mint shadow-[0_0_20px_rgba(125,223,150,0.08)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border text-[13px] font-medium transition-all duration-300 overflow-hidden ${
        active ? activeClass : "border-white/[0.06] bg-white/[0.02] text-white/35 hover:border-white/[0.1] hover:text-white/60"
      }`}
    >
      {active && <span className="absolute inset-0 animate-shimmer pointer-events-none" />}
      <Icon size={20} className={active ? "" : ""} />
      <span>{label}</span>
      <span className="text-[10px] opacity-50">{sublabel}</span>
    </button>
  );
}
