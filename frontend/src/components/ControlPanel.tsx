import { Fan, Lightbulb, Power, ShowerHead, Waves } from "lucide-react";

import type { FarmLayer } from "../types";

type ControlPanelProps = {
  layer: FarmLayer;
  onCommand: (layerId: string, device: string, value: boolean | number) => Promise<unknown>;
};

export function ControlPanel({ layer, onCommand }: ControlPanelProps) {
  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div>
        <p className="text-xs uppercase text-muted">Control Loop</p>
        <h2 className="text-lg font-semibold text-ink">{layer.name} Devices</h2>
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

      <label className="mt-5 block text-sm text-muted">
        <span className="flex items-center gap-2">
          <Lightbulb size={16} className="text-status-warning" />
          LED intensity
        </span>
        <input
          className="mt-3 w-full accent-forest-green"
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
          ? "border-forest-green/40 bg-spring-green/20 text-forest-green font-medium"
          : "border-card-border bg-field-bg text-muted hover:border-forest-green/30 hover:text-ink"
      }`}
      title={label}
    >
      <Icon size={19} />
      <span>{label}</span>
    </button>
  );
}
