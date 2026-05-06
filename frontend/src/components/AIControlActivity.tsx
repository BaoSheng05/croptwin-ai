import { Fan, Lightbulb, Power, ShowerHead, ThermometerSun, Waves, Activity, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import type { AIControlDecision, FarmLayer } from "../types";

type Props = {
  layer: FarmLayer;
  decision?: AIControlDecision | null;
  onDecision?: (decision: AIControlDecision) => void;
};

const deviceRows = [
  { key: "fan", label: "Fan", action: "Ventilation", icon: Fan },
  { key: "pump", label: "Pump", action: "Irrigation", icon: Waves },
  { key: "misting", label: "Misting", action: "Humidity boost", icon: ShowerHead },
  { key: "climate_heating", label: "Climate", action: "Heating", icon: ThermometerSun },
  { key: "climate_cooling", label: "Climate", action: "Cooling", icon: ThermometerSun },
] as const;

function formatReading(value?: number, suffix = "") {
  return typeof value === "number" ? `${value.toFixed(value % 1 === 0 ? 0 : 1)}${suffix}` : "-";
}

function describeCommand(command: AIControlDecision["commands"][number]) {
  if (command.device === "none") return "No actuator change";
  const value = typeof command.value === "boolean" ? (command.value ? "ON" : "OFF") : `${command.value}%`;
  const duration = command.duration_minutes ? ` for ${command.duration_minutes}m` : "";
  return `${command.device} -> ${value}${duration}`;
}

function modeLabel(mode?: AIControlDecision["mode"]) {
  if (mode === "deepseek") return "DeepSeek decision";
  if (mode === "unconfigured") return "Local fallback";
  if (mode === "ai_error") return "DeepSeek failed";
  return "Local decision";
}

export function AIControlActivity({ layer, decision: externalDecision, onDecision }: Props) {
  const [localDecision, setLocalDecision] = useState<AIControlDecision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onDecisionRef = useRef(onDecision);
  const decision = externalDecision ?? localDecision;
  const reading = layer.latest_reading;
  const activeDeviceCount = deviceRows.filter((device) => layer.devices[device.key]).length;
  const ledTarget = decision?.commands.find((command) => command.device === "led_intensity" && typeof command.value === "number")?.value;
  const ledReported = layer.devices.led_reported_intensity ?? layer.devices.led_intensity;

  useEffect(() => {
    onDecisionRef.current = onDecision;
  }, [onDecision]);

  const loadDecision = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextDecision = await api.aiControlDecision(layer.id);
      setLocalDecision(nextDecision);
      onDecisionRef.current?.(nextDecision);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ask DeepSeek for a control decision.");
    } finally {
      setLoading(false);
    }
  }, [layer.id]);

  useEffect(() => {
    if (!layer.devices.auto_mode) {
      setLoading(false);
      setError(null);
      return;
    }
    if (!externalDecision) loadDecision();
  }, [externalDecision, layer.devices.auto_mode, loadDecision]);

  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted">AI Control Activity</p>
          <h2 className="text-lg font-semibold text-ink">{layer.name} — {layer.crop}</h2>
        </div>
        <button
          type="button"
          onClick={loadDecision}
          disabled={loading}
          className={`grid h-10 w-10 place-items-center rounded-md transition ${layer.devices.auto_mode ? "bg-purple-50 text-purple-700 hover:bg-purple-100" : "bg-field-bg text-muted hover:bg-spring-green/10"} disabled:opacity-50`}
          title="Ask DeepSeek again"
        >
          {loading ? <RefreshCw size={18} className="animate-spin" /> : <Power size={18} />}
        </button>
      </div>

      <div className={`rounded-md border p-3 ${layer.devices.auto_mode ? "border-purple-400/30 bg-purple-50/70" : "border-card-border bg-field-bg"}`}>
        <p className="text-sm font-semibold text-ink">
          {layer.devices.auto_mode ? "AI Control is active" : "AI Control is paused"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {layer.devices.auto_mode
            ? activeDeviceCount > 0
              ? `AI currently has ${activeDeviceCount} actuator${activeDeviceCount > 1 ? "s" : ""} running.`
              : "AI is monitoring this layer and keeping manual actuators off."
            : "Manual control is enabled. AI will not override user device choices."}
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        {deviceRows.map(({ key, label, action, icon: Icon }) => {
          const active = layer.devices[key];
          const aiRunning = layer.devices.auto_mode && active;
          return (
            <div key={key} className={`flex items-center justify-between rounded-md border px-3 py-2 ${aiRunning ? "border-purple-400/30 bg-purple-50/70" : "border-card-border bg-field-bg"}`}>
              <div className="flex items-center gap-3">
                <span className={`grid h-8 w-8 place-items-center rounded-md ${aiRunning ? "bg-purple-100 text-purple-700" : active ? "bg-spring-green/30 text-forest-green" : "bg-white text-muted"}`}>
                  <Icon size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{label}</p>
                  <p className="text-xs text-muted">{action}</p>
                </div>
              </div>
              <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${aiRunning ? "bg-purple-100 text-purple-700" : active ? "bg-spring-green/30 text-forest-green" : "bg-white text-muted"}`}>
                {aiRunning ? (key === "climate_heating" ? "AI HEATING" : key === "climate_cooling" ? "AI COOLING" : "AI RUNNING") : active ? "RUNNING" : "OFF"}
              </span>
            </div>
          );
        })}

        <div className="flex items-center justify-between rounded-md border border-card-border bg-field-bg px-3 py-2">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-white text-status-warning">
              <Lightbulb size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">LED Light</p>
              <p className="text-xs text-muted">Target and device feedback</p>
            </div>
          </div>
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-ink">
            {layer.devices.auto_mode && typeof ledTarget === "number"
              ? `Target ${ledTarget}% · Device reported ${ledReported}%`
              : `Manual target ${layer.devices.led_intensity}% · Device reported ${ledReported}%`}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-card-border bg-field-bg p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
          <Activity size={15} />
          Current basis
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
          <span>Temp {formatReading(reading?.temperature, "C")}</span>
          <span>Humidity {formatReading(reading?.humidity, "%")}</span>
          <span>Moisture {formatReading(reading?.soil_moisture, "%")}</span>
          <span>Light {formatReading(reading?.light_intensity)}</span>
        </div>
      </div>

      {layer.devices.auto_mode ? (
      <div className="mt-4 rounded-md border border-card-border bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs uppercase text-muted">Latest AI decision</p>
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${decision?.mode === "deepseek" ? "bg-purple-50 text-purple-700" : "bg-field-bg text-muted"}`}>
            <Sparkles size={12} />
            {modeLabel(decision?.mode)}
          </span>
        </div>
        {error ? (
          <p className="text-sm text-status-critical">{error}</p>
        ) : loading && !decision ? (
          <p className="text-sm text-muted">Asking DeepSeek to decide...</p>
        ) : decision ? (
          <>
            <p className="text-sm font-semibold text-ink">{decision.summary}</p>
            <div className="mt-3 space-y-2">
              {decision.commands.map((command, index) => (
                <div key={`${command.device}-${index}`} className="rounded-md border border-card-border bg-field-bg px-3 py-2">
                  <p className="text-sm font-semibold text-ink">{describeCommand(command)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{command.reason}</p>
                </div>
              ))}
            </div>
            {decision.reasoning.length > 0 && (
              <div className="mt-3 space-y-1">
                {decision.reasoning.slice(0, 3).map((reason, index) => (
                  <p key={index} className="text-xs leading-relaxed text-muted">{reason}</p>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs font-semibold text-forest-green">
              Confidence {decision.confidence}%
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">No AI control decision has been generated for this layer yet.</p>
        )}
      </div>
      ) : (
        <div className="mt-4 rounded-md border border-card-border bg-white p-3">
          <p className="text-xs uppercase text-muted">AI decision paused</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Manual control is active. DeepSeek decisions are not being applied or refreshed for this layer.
          </p>
        </div>
      )}
    </div>
  );
}
