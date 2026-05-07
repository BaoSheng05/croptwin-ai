import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Droplets, Leaf, Play, Sprout, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../services/api";
import type { DemoScenario, FarmLayer } from "../types";

const SCENARIOS: Array<{ id: DemoScenario; label: string; icon: LucideIcon }> = [
  { id: "normal", label: "Normal", icon: Leaf },
  { id: "high_humidity", label: "High Humidity", icon: Droplets },
  { id: "low_moisture", label: "Low Moisture", icon: Sprout },
  { id: "disease_outbreak", label: "Disease Risk", icon: AlertTriangle },
  { id: "energy_peak", label: "Energy Peak", icon: Zap },
];

export function DemoScenarioSwitcher({ layers, onApplied }: { layers: FarmLayer[]; onApplied: () => Promise<void> | void }) {
  const defaultLayer = useMemo(() => layers.find((layer) => layer.id === "b_02")?.id ?? layers[0]?.id ?? "", [layers]);
  const [scenario, setScenario] = useState<DemoScenario>("high_humidity");
  const [layerId, setLayerId] = useState(defaultLayer);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function applyScenario() {
    setRunning(true);
    setError("");
    try {
      const response = await api.applyDemoScenario(scenario, layerId || defaultLayer);
      setResult(response);
      await onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scenario failed. Please check backend connection.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Demo Mode</h3>
          <p className="mt-1 text-xs text-muted">Trigger a controlled incident across the digital twin.</p>
        </div>
        <button
          type="button"
          onClick={applyScenario}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-md bg-forest-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-green/90 disabled:opacity-60"
        >
          <Play size={15} />
          {running ? "Applying..." : "Run Scenario"}
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SCENARIOS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScenario(item.id)}
              className="flex min-h-20 flex-col items-start justify-between rounded-md border p-3 text-left text-xs font-semibold transition"
              style={scenario === item.id
                ? { backgroundColor: "#006400", borderColor: "#006400", color: "#FFFFFF" }
                : { backgroundColor: "#F0F7F0", borderColor: "#B3D4B3", color: "#2D4A2D" }
              }
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </div>
        <select
          value={layerId || defaultLayer}
          onChange={(event) => setLayerId(event.target.value)}
          className="h-11 rounded-md border border-card-border bg-field-bg px-3 text-sm font-medium text-ink outline-none focus:border-forest-green"
        >
          {layers.map((layer) => (
            <option key={layer.id} value={layer.id}>{layer.name} · {layer.crop}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-status-critical/30 bg-red-50 p-4 text-sm text-status-critical">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-forest-green/25 bg-spring-green/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white text-forest-green">
                <CheckCircle2 size={17} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">
                  Scenario applied: {result.layer?.name ?? "Selected layer"} · {result.layer?.crop ?? ""}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Health {result.layer?.health_score ?? "-"} · Status {result.layer?.status ?? "-"}
                </p>
              </div>
            </div>
            <span className="rounded-md border border-card-border bg-white px-2.5 py-1 text-xs font-semibold text-forest-green">
              Live demo updated
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-card-border bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">AI Alert</p>
              <p className="mt-1 text-sm font-semibold text-ink">{result.alert?.title ?? "No active alert"}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {result.alert?.message ?? "Layer is back to normal operating range."}
              </p>
            </div>
            <div className="rounded-md border border-card-border bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Recommended Action</p>
              <p className="mt-1 text-sm font-semibold text-ink">{result.recommendation?.action ?? "Maintain current recipe"}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {result.recommendation?.reason ?? "No corrective action needed for this scenario."}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/alerts"
              className="rounded-md bg-forest-green px-3 py-2 text-xs font-semibold text-white transition hover:bg-forest-green/90"
            >
              View Alerts
            </Link>
            <Link
              to="/operations"
              className="rounded-md border border-card-border bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-field-bg"
            >
              View Before / After
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
