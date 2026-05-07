import { useMemo, useState } from "react";
import { AlertTriangle, Droplets, Leaf, Play, Sprout, Zap } from "lucide-react";
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

  async function applyScenario() {
    setRunning(true);
    try {
      await api.applyDemoScenario(scenario, layerId || defaultLayer);
      await onApplied();
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
    </section>
  );
}
