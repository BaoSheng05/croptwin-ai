import { Fan, Lightbulb, Power, ShowerHead, Waves } from "lucide-react";
import type { FarmLayer } from "../types";

type ControlPanelProps = {
  layer: FarmLayer;
  onCommand: (layerId: string, device: string, value: boolean | number) => Promise<unknown>;
};

export function ControlPanel({ layer, onCommand }: ControlPanelProps) {
  const manualDisabled = layer.devices.auto_mode;

  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div className="mb-4">
        <p className="text-xs uppercase text-muted">Control Loop</p>
        <h2 className="text-lg font-semibold text-ink">{layer.name} — {layer.crop}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 stagger">
        <DeviceToggle icon={Fan} label="Fan" sublabel="Ventilation" active={layer.devices.fan}
          onClick={() => onCommand(layer.id, "fan", !layer.devices.fan)} disabled={manualDisabled} />
        <DeviceToggle icon={Waves} label="Pump" sublabel="Irrigation" active={layer.devices.pump}
          onClick={() => onCommand(layer.id, "pump", !layer.devices.pump)} disabled={manualDisabled} />
        <DeviceToggle icon={ShowerHead} label="Misting" sublabel="Humidity" active={layer.devices.misting}
          onClick={() => onCommand(layer.id, "misting", !layer.devices.misting)} disabled={manualDisabled} />
        <DeviceToggle icon={Power} label="Auto" sublabel="AI Control" active={layer.devices.auto_mode}
          onClick={() => onCommand(layer.id, "auto_mode", !layer.devices.auto_mode)} accent="violet" />
      </div>

      <div className={`mt-5 transition-opacity ${manualDisabled ? "opacity-50" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-sm text-muted">
            <Lightbulb size={16} className="text-status-warning" />
            LED Intensity
          </span>
          <span className="text-sm font-semibold text-ink">{layer.devices.led_intensity}%</span>
        </div>
        <div className="relative">
          <div className="h-2 rounded-full bg-field-bg overflow-hidden border border-card-border">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${layer.devices.led_intensity}%`, background: "linear-gradient(to right, #C27B00, #E8A317)" }}
            />
          </div>
          <input
            className={`absolute inset-0 w-full opacity-0 ${manualDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            type="range"
            min={0}
            max={100}
            value={layer.devices.led_intensity}
            disabled={manualDisabled}
            onChange={(e) => {
              if (!manualDisabled) onCommand(layer.id, "led_intensity", Number(e.target.value));
            }}
          />
        </div>
      </div>
    </div>
  );
}

function DeviceToggle({ icon: Icon, label, sublabel, active, onClick, accent = "mint", disabled = false }: {
  icon: typeof Fan; label: string; sublabel: string; active: boolean; onClick: () => void; accent?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex h-24 flex-col items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-all duration-300 overflow-hidden ${
        active
          ? accent === "violet"
            ? "border-purple-400/40 bg-purple-50 text-purple-700 shadow-sm"
            : "border-forest-green/40 bg-spring-green/20 text-forest-green shadow-sm"
          : "border-card-border bg-white text-ink hover:border-forest-green/40 hover:bg-spring-green/10"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {active && <span className="absolute inset-0 animate-shimmer pointer-events-none" />}
      <Icon size={20} />
      <span className="font-semibold">{label}</span>
      <span className="text-xs text-muted">{sublabel}</span>
    </button>
  );
}
