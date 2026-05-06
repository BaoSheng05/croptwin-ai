import { Fan, Lightbulb, Power, RefreshCw, ShowerHead, ThermometerSun, Waves } from "lucide-react";
import type { FarmLayer } from "../types";

type ControlPanelProps = {
  layer: FarmLayer;
  onCommand: (layerId: string, device: string, value: boolean | number) => Promise<unknown>;
};

export function ControlPanel({ layer, onCommand }: ControlPanelProps) {
  const manualDisabled = layer.devices.auto_mode;

  return (
    <div className={`rounded-lg border p-4 shadow-card transition-all duration-500 ${layer.devices.auto_mode ? "border-purple-400/30 bg-purple-50/10" : "border-card-border bg-white"}`}>
      <div className="mb-4">
        <p className="text-xs uppercase text-muted">Control Loop</p>
        <h2 className="text-lg font-semibold text-ink">{layer.name} — {layer.crop}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 stagger">
        <DeviceToggle icon={Fan} label="Fan" sublabel="Ventilation" active={layer.devices.fan}
          onClick={() => onCommand(layer.id, "fan", !layer.devices.fan)} disabled={manualDisabled} accent={layer.devices.auto_mode ? "violet" : "mint"} />
        <DeviceToggle icon={Waves} label="Pump" sublabel="Irrigation" active={layer.devices.pump}
          onClick={() => onCommand(layer.id, "pump", !layer.devices.pump)} disabled={manualDisabled} accent={layer.devices.auto_mode ? "violet" : "mint"} />
        <DeviceToggle icon={ShowerHead} label="Misting" sublabel="Humidity" active={layer.devices.misting}
          onClick={() => onCommand(layer.id, "misting", !layer.devices.misting)} disabled={manualDisabled} accent={layer.devices.auto_mode ? "violet" : "mint"} />
        <DeviceToggle icon={layer.devices.auto_mode ? RefreshCw : Power} label="Auto" sublabel="AI Control" active={layer.devices.auto_mode}
          onClick={() => onCommand(layer.id, "auto_mode", !layer.devices.auto_mode)} accent="violet" spin={layer.devices.auto_mode} />
      </div>

      {/* ── Thermal Control Slider ────────────────────────── */}
      <div className={`mt-5 transition-opacity ${manualDisabled ? "opacity-50" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-sm text-muted">
            <ThermometerSun size={16} className={layer.devices.climate_heating > 0 ? "text-status-warning" : layer.devices.climate_cooling > 0 ? "text-sky-500" : "text-muted"} />
            Thermal Control
          </span>
          <span className="text-sm font-semibold text-ink">
            {layer.devices.climate_cooling > 0 ? `Cooling Lvl ${layer.devices.climate_cooling}` : 
             layer.devices.climate_heating > 0 ? `Heating Lvl ${layer.devices.climate_heating}` : "OFF"}
          </span>
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-tighter text-muted/60 mb-1 px-1 font-bold">
            <span>Cooling</span>
            <span>OFF</span>
            <span>Heating</span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute inset-x-0 h-2 rounded-full bg-field-bg overflow-hidden border border-card-border">
            {/* Center marker */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-card-border -translate-x-1/2 z-10" />
            <div
              className={`h-full transition-all duration-300 absolute top-0 ${layer.devices.climate_heating > 0 ? "bg-status-warning left-1/2" : "bg-sky-500 right-1/2"}`}
              style={{ 
                width: `${(layer.devices.climate_heating || layer.devices.climate_cooling) * (100/6)}%`,
                background: layer.devices.climate_heating > 0 ? "linear-gradient(to right, #E8A317, #FF5C00)" : "linear-gradient(to left, #0EA5E9, #2563EB)"
              }}
            />
          </div>
          {/* Custom Slider Thumb (Ball) */}
          {(() => {
            const val = layer.devices.climate_heating > 0 ? layer.devices.climate_heating : (layer.devices.climate_cooling > 0 ? -layer.devices.climate_cooling : 0);
            const thumbPos = (val + 3) * (100 / 6);
            return (
              <div 
                className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 bg-white shadow-md transition-all duration-300 -translate-x-1/2 pointer-events-none z-30 ${
                  val > 0 ? "border-status-warning shadow-status-warning/20" : val < 0 ? "border-sky-500 shadow-sky-500/20" : "border-card-border"
                }`}
                style={{ left: `${thumbPos}%` }}
              >
                <div className={`absolute inset-0.5 rounded-full ${val > 0 ? "bg-status-warning/20" : val < 0 ? "bg-sky-500/20" : "bg-transparent"}`} />
              </div>
            );
          })()}
          <input
            className={`absolute inset-0 w-full opacity-0 z-40 ${manualDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            type="range"
            min={-3}
            max={3}
            step={1}
            value={layer.devices.climate_heating > 0 ? layer.devices.climate_heating : (layer.devices.climate_cooling > 0 ? -layer.devices.climate_cooling : 0)}
            disabled={manualDisabled}
            onChange={(e) => {
              if (manualDisabled) return;
              const val = Number(e.target.value);
              if (val === 0) {
                onCommand(layer.id, "climate_heating", 0);
                onCommand(layer.id, "climate_cooling", 0);
              } else if (val > 0) {
                onCommand(layer.id, "climate_heating", val);
              } else {
                onCommand(layer.id, "climate_cooling", Math.abs(val));
              }
            }}
          />
        </div>
          <div className="flex justify-between px-1.5 mt-1.5">
            {[ -3, -2, -1, 0, 1, 2, 3 ].map(tick => (
              <div key={tick} className={`h-1 w-0.5 rounded-full ${tick === 0 ? "h-1.5 bg-muted" : "bg-card-border"}`} />
            ))}
          </div>
        </div>

      {/* ── LED Slider ────────────────────────────────────── */}
      <div className={`mt-5 transition-opacity ${manualDisabled ? "opacity-50" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-sm text-muted">
            <Lightbulb size={16} className="text-status-warning" />
            LED Intensity
          </span>
          <span className="text-sm font-semibold text-ink">{layer.devices.led_intensity}%</span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute inset-x-0 h-2 rounded-full bg-field-bg overflow-hidden border border-card-border">
            <div
              className={`h-full rounded-full transition-all duration-500 ${layer.devices.auto_mode ? "bg-purple-500" : ""}`}
              style={layer.devices.auto_mode ? { width: `${layer.devices.led_intensity}%` } : { width: `${layer.devices.led_intensity}%`, background: "linear-gradient(to right, #C27B00, #E8A317)" }}
            />
          </div>
          {/* Custom LED Thumb */}
          <div 
            className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 bg-white shadow-md transition-all duration-300 -translate-x-1/2 pointer-events-none z-30 ${
              layer.devices.auto_mode ? "border-purple-500 shadow-purple-500/20" : "border-[#E8A317] shadow-orange-500/20"
            }`}
            style={{ left: `${layer.devices.led_intensity}%` }}
          >
            <div className={`absolute inset-0.5 rounded-full ${layer.devices.auto_mode ? "bg-purple-500/20" : "bg-orange-500/20"}`} />
          </div>
          <input
            className={`absolute inset-0 w-full opacity-0 z-40 ${manualDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
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

function DeviceToggle({ icon: Icon, label, sublabel, active, onClick, accent = "mint", disabled = false, spin = false }: {
  icon: typeof Fan; label: string; sublabel: string; active: boolean; onClick: () => void; accent?: string; disabled?: boolean; spin?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex h-24 flex-col items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-all duration-300 overflow-hidden ${
        disabled && accent !== "violet"
          ? "border-card-border bg-field-bg/60 text-muted/60 shadow-none"
          : active
            ? accent === "violet"
              ? "border-purple-400/40 bg-purple-50 text-purple-700 shadow-sm"
              : "border-forest-green/40 bg-spring-green/20 text-forest-green shadow-sm"
            : accent === "violet"
              ? "border-card-border bg-field-bg text-muted"
              : "border-card-border bg-white text-ink hover:border-forest-green/40 hover:bg-spring-green/10"
      } ${disabled ? "cursor-not-allowed" : ""}`}
    >
      {active && accent !== "violet" && <span className="absolute inset-0 animate-shimmer pointer-events-none" />}
      <Icon size={20} className={`${!active && accent === "violet" ? "text-muted/50" : ""} ${spin ? "animate-spin" : ""}`} />
      <span className={`font-semibold ${!active && accent === "violet" ? "text-muted/70" : ""} ${disabled && accent !== "violet" ? "text-muted/50" : ""}`}>{label}</span>
      <span className="text-xs text-muted">{sublabel}</span>
    </button>
  );
}
