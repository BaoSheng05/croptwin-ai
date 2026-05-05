import { Fan, Lightbulb, Power, ShowerHead, Waves } from "lucide-react";

import type { FarmLayer } from "../types";

type ControlPanelProps = {
  layer: FarmLayer;
  onCommand: (layerId: string, device: string, value: boolean | number) => Promise<unknown>;
};

export function ControlPanel({ layer, onCommand }: ControlPanelProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-panel p-4">
      <div>
        <p className="text-xs uppercase text-white/45">Control Loop</p>
        <h2 className="text-lg font-semibold text-white">{layer.name} Devices</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Toggle
          icon={Fan}
          label="Fan"
          active={layer.devices.fan}
          onClick={() => onCommand(layer.id, "fan", !layer.devices.fan)}
        />
        <Toggle
          icon={Waves}
          label="Pump"
          active={layer.devices.pump}
          onClick={() => onCommand(layer.id, "pump", !layer.devices.pump)}
        />
        <Toggle
          icon={ShowerHead}
          label="Misting"
          active={layer.devices.misting}
          onClick={() => onCommand(layer.id, "misting", !layer.devices.misting)}
        />
        <Toggle
          icon={Power}
          label="Auto"
          active={layer.devices.auto_mode}
          onClick={() => onCommand(layer.id, "auto_mode", !layer.devices.auto_mode)}
        />
      </div>

      <label className="mt-5 block text-sm text-white/65">
        <span className="flex items-center gap-2">
          <Lightbulb size={16} className="text-amber" />
          LED intensity
        </span>
        <input
          className="mt-3 w-full accent-mint"
          type="range"
          min={0}
          max={100}
          value={layer.devices.led_intensity}
          onChange={(event) => onCommand(layer.id, "led_intensity", Number(event.target.value))}
        />
      </label>
    </div>
  );
}

function Toggle({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Fan;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-20 flex-col items-center justify-center gap-2 rounded-md border text-sm transition ${
        active
          ? "border-mint/40 bg-mint/15 text-mint"
          : "border-white/10 bg-field text-white/55 hover:border-white/25 hover:text-white"
      }`}
      title={label}
    >
      <Icon size={19} />
      <span>{label}</span>
    </button>
  );
}
