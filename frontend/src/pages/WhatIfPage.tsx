import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { GitBranch, Play, Clock, Zap } from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { FarmStreamContext } from "../App";
import { DemoScenarioSwitcher } from "../components/DemoScenarioSwitcher";
import { AIDiagnosisPanel } from "../components/AIDiagnosisPanel";
import { api } from "../services/api";
import { useAreaLayers } from "../hooks/useAreaLayers";
import { usePersistentNumber, usePersistentString } from "../hooks/usePersistentState";
import type { WhatIfResult, WhatIfTimePoint } from "../types";
import { localizeTempInText } from "../utils/localize";

const HOUR_OPTIONS = [6, 12, 24, 48];
const ACTION_OPTIONS = [
  { value: "auto", label: "Auto (AI picks)", emoji: "🤖" },
  { value: "fan", label: "Turn on Fan", emoji: "💨" },
  { value: "pump", label: "Water Pump", emoji: "💧" },
  { value: "misting", label: "Misting", emoji: "🌫️" },
  { value: "none", label: "Do nothing", emoji: "❌" },
];
const METRICS = [
  { key: "humidity", label: "Humidity" },
  { key: "health_score", label: "Health" },
  { key: "soil_moisture", label: "Moisture" },
  { key: "temperature", label: "Temp" },
] as const;
type MetricKey = typeof METRICS[number]["key"];

function metricValue(point: WhatIfTimePoint, metric: MetricKey) {
  return point[metric];
}

export default function WhatIfPage() {
  const { farm, refresh } = useOutletContext<FarmStreamContext>();
  const { settings } = useSettings();

  const areas = useAreaLayers(farm.layers);

  const [selectedArea, setSelectedArea] = usePersistentString("croptwin_whatif_area", areas[0]?.id ?? "area_a");
  const currentLayers = areas.find((area) => area.id === selectedArea)?.layers ?? [];
  const [selected, setSelected] = usePersistentString("croptwin_whatif_layer", currentLayers[0]?.id ?? "a_01");
  const [hours, setHours] = usePersistentNumber("croptwin_whatif_hours", 24);
  const [action, setAction] = usePersistentString("croptwin_whatif_action", "auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [metric, setMetric] = usePersistentString("croptwin_whatif_metric", "humidity") as readonly [MetricKey, (value: MetricKey) => void];
  const [activeTab, setActiveTab] = usePersistentString("croptwin_whatif_tab", "demo") as readonly ["demo" | "detector" | "farm", (value: "demo" | "detector" | "farm") => void];

  async function runSimulation() {
    setLoading(true);
    try {
      setResult(await api.runWhatIfSimulation(selected, hours, action));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const chartData = result ? result.baseline.map((b, i) => {
    const transformValue = (val: number) => {
      if (metric === "temperature" && settings.tempUnit === "F") {
        return Number(((val * 9) / 5 + 32).toFixed(1));
      }
      return val;
    };
    return {
      hour: `${b.hour}h`,
      "No Action": transformValue(metricValue(b, metric)),
      [result.action_label]: transformValue(metricValue(result.intervention[i], metric)),
    };
  }) : [];
  const overlappingSeries = result ? result.baseline.every((b, i) => {
    const baselineValue = metricValue(b, metric);
    const interventionValue = metricValue(result.intervention[i], metric);
    return Math.abs(Number(baselineValue) - Number(interventionValue)) < 0.05;
  }) : false;

  return (
    <div className="grid gap-6 animate-fade-in">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-purple-50 text-purple-600">
          <GitBranch size={18} />
        </span>
        <div>
          <h2 className="text-2xl font-semibold text-ink">Simulator & Detector</h2>
          <p className="text-xs text-muted">Trigger demo incidents, detect visual/sensor risks, and predict farm outcomes.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-card-border bg-white p-2 shadow-card">
        {[
          { id: "demo", label: "Trigger Scenario", detail: "Create a controlled incident" },
          { id: "detector", label: "AI Detector", detail: "Camera/upload and sensor diagnosis" },
          { id: "farm", label: "Future Simulation", detail: "Predict one layer's future" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "demo" | "detector" | "farm")}
            className="min-w-48 rounded-md px-4 py-3 text-left transition"
            style={activeTab === tab.id
              ? { backgroundColor: "#006400", color: "#FFFFFF" }
              : { backgroundColor: "#F0F7F0", color: "#2D4A2D" }}
          >
            <span className="block text-sm font-semibold">{tab.label}</span>
            <span className="mt-0.5 block text-xs opacity-80">{tab.detail}</span>
          </button>
        ))}
      </div>

      {activeTab === "demo" && (
        <DemoScenarioSwitcher layers={farm.layers} onApplied={refresh} />
      )}

      {activeTab === "detector" && (
        <section className="grid gap-4">
          <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">AI Visual / Sensor Detector</p>
            <h3 className="mt-1 text-lg font-semibold text-ink">Analyze one layer with telemetry and image evidence</h3>
            <p className="mt-1 text-sm text-muted">Choose the target layer below, then run analysis, upload a plant photo, or capture a camera frame.</p>
          </div>
          <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
            <div className="mb-4 flex flex-wrap gap-2">
              {farm.layers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setSelected(layer.id)}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold transition"
                  style={selected === layer.id
                    ? { backgroundColor: "#006400", color: "#FFFFFF" }
                    : { backgroundColor: "#F0F7F0", color: "#2D4A2D", border: "1px solid #B3D4B3" }}
                >
                  {layer.name} · {layer.crop}
                </button>
              ))}
            </div>
            <AIDiagnosisPanel layerId={selected} />
          </div>
        </section>
      )}

      {/* Controls */}
      {activeTab === "farm" && <div className="rounded-lg border border-card-border bg-white p-6 shadow-card">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Farm Scenario What-If</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">What happens if we take this action?</h3>
          <p className="mt-1 text-sm text-muted">Choose a layer, intervention, and time horizon. CropTwin compares the future with and without the action.</p>
        </div>
        <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
          {/* Area */}
          <div className="w-32 flex-shrink-0">
            <label className="flex items-center h-4 text-xs font-semibold uppercase tracking-wider text-muted mb-2">Area</label>
            <div className="space-y-1">
              {areas.map((area) => (
                <button key={area.id} onClick={() => { setSelectedArea(area.id); const f = areas.find((item) => item.id === area.id)?.layers[0]; if(f) setSelected(f.id); }}
                  className="w-full text-left rounded-md px-3 py-2 text-xs font-medium transition"
                  style={selectedArea === area.id
                    ? { backgroundColor: "#228B22", color: "#FFFFFF" }
                    : { backgroundColor: "#F0F7F0", color: "#2D4A2D", border: "1px solid #B3D4B3" }
                  }>
                  {area.name.split("—")[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {/* Layer */}
          <div className="w-64 flex-shrink-0">
            <label className="flex items-center h-4 text-xs font-semibold uppercase tracking-wider text-muted mb-2">Target</label>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {currentLayers.map((l) => (
                <button key={l.id} onClick={() => setSelected(l.id)}
                  className="w-full text-left rounded-md px-3 py-2 text-xs font-medium transition"
                  style={selected === l.id
                    ? { backgroundColor: "#006400", color: "#FFFFFF" }
                    : { backgroundColor: "#F0F7F0", color: "#2D4A2D", border: "1px solid #B3D4B3" }
                  }>
                  {l.name} · {l.crop}
                </button>
              ))}
            </div>
          </div>

          {/* Action */}
          <div className="w-64 flex-shrink-0">
            <label className="flex items-center h-4 text-xs font-semibold uppercase tracking-wider text-muted mb-2">Intervention</label>
            <div className="space-y-1">
              {ACTION_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setAction(opt.value)}
                  className="w-full text-left rounded-md px-3 py-2 text-xs font-medium transition"
                  style={action === opt.value
                    ? { backgroundColor: "#006400", color: "#FFFFFF" }
                    : { backgroundColor: "#F0F7F0", color: "#2D4A2D", border: "1px solid #B3D4B3" }
                  }>
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className="w-48 flex-shrink-0">
            <label className="flex items-center h-4 text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              <Clock size={14} className="mr-1.5" />Time Horizon
            </label>
            <div className="space-y-1">
              {HOUR_OPTIONS.map((h) => (
                <button key={h} onClick={() => setHours(h)}
                  className="w-full text-left rounded-md px-3 py-2 text-xs font-medium transition"
                  style={hours === h
                    ? { backgroundColor: "#006400", color: "#FFFFFF" }
                    : { backgroundColor: "#F0F7F0", color: "#2D4A2D", border: "1px solid #B3D4B3" }
                  }>
                  {h} hours
                </button>
              ))}
            </div>
          </div>

          {/* Run */}
          <div className="flex-grow flex flex-col justify-end self-stretch pt-6">
            <button onClick={runSimulation} disabled={loading}
              className="flex items-center justify-center gap-2 rounded-lg bg-forest-green px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-forest-green/90 disabled:opacity-50">
              {loading ? <span className="animate-pulse">Simulating...</span> : <><Play size={16} /> Run Prediction</>}
            </button>
          </div>
        </div>
      </div>}

      {/* Results */}
      {activeTab === "farm" && (result ? (
        <div className="space-y-5 animate-fade-up">
          <div className="rounded-lg border border-purple-300/30 bg-purple-50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-purple-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Prediction Summary</span>
            </div>
            <p className="text-sm leading-relaxed text-ink/80">{localizeTempInText(result.summary, settings.tempUnit)}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: "Current", value: `${result.current_health}/100`, color: "text-ink" },
              { label: "No Action", value: `${result.baseline_final_health}/100`, color: "text-status-critical" },
              { label: result.action_label, value: `${result.intervention_final_health}/100`, color: "text-status-healthy" },
              {
                label: "Net Effect",
                value: `${result.health_delta > 0 ? "+" : ""}${result.health_delta}`,
                color: result.health_delta > 0 ? "text-status-healthy" : result.health_delta < 0 ? "text-status-critical" : "text-muted",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-card-border bg-white p-4 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{item.label}</p>
                <p className={`mt-2 text-xl font-semibold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Recommendation</p>
            <p className="mt-1 text-sm leading-relaxed text-ink/80">{localizeTempInText(result.recommendation, settings.tempUnit)}</p>
          </div>

          {/* Metric selector */}
          <div className="flex gap-2">
            {METRICS.map((m) => (
              <button key={m.key} onClick={() => setMetric(m.key)}
                className="rounded-md px-3.5 py-1.5 text-xs font-medium transition"
                style={metric === m.key
                  ? { backgroundColor: "#228B22", color: "#FFFFFF" }
                  : { backgroundColor: "#EAF5EA", color: "#2D4A2D", border: "1px solid #B3D4B3" }
                }>
                {m.label} {m.key === "temperature" ? `(°${settings.tempUnit})` : m.key === "humidity" || m.key === "soil_moisture" || m.key === "health_score" ? "(%)" : ""}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-lg border border-card-border bg-white p-6 shadow-card">
            {overlappingSeries && (
              <p className="mb-3 text-xs text-muted">
                Both scenarios have the same {METRICS.find((m) => m.key === metric)?.label.toLowerCase()} values, so the two lines overlap.
              </p>
            )}
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="wBase" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C0392B" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#C0392B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="wInt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E8449" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1E8449" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="hour" stroke="#2D4A2D" fontSize={11} />
                <YAxis stroke="#2D4A2D" fontSize={11} />
                <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #B3D4B3", borderRadius: 8, color: "#000000", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#2D4A2D" }} />
                <Area
                  type="monotone"
                  dataKey="No Action"
                  stroke="#C0392B"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  fill="url(#wBase)"
                  fillOpacity={0.45}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey={result.action_label}
                  stroke="#1E8449"
                  strokeWidth={2}
                  fill="url(#wInt)"
                  fillOpacity={0.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-card-border bg-field-bg py-16 text-center">
          <GitBranch size={36} className="text-muted/30 mb-3 animate-float" />
          <p className="text-sm text-muted">Select parameters and click <strong className="text-ink">Run Prediction</strong></p>
          <p className="mt-1 text-xs text-muted/60">The Digital Twin engine will simulate two alternate futures</p>
        </div>
      ))}

    </div>
  );
}
