import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { GitBranch, Play, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { FarmStreamContext } from "../App";

type TimePoint = {
  hour: number;
  temperature: number;
  humidity: number;
  soil_moisture: number;
  health_score: number;
};

type WhatIfResult = {
  layer_id: string;
  crop: string;
  baseline: TimePoint[];
  intervention: TimePoint[];
  action_label: string;
  summary: string;
};

const HOUR_OPTIONS = [6, 12, 24, 48];
const ACTION_OPTIONS = [
  { value: "auto", label: "🤖 Auto (AI picks best)", color: "bg-mint" },
  { value: "fan", label: "💨 Turn on Fan", color: "bg-cyan-500" },
  { value: "pump", label: "💧 Turn on Pump", color: "bg-blue-500" },
  { value: "misting", label: "🌫️ Activate Misting", color: "bg-purple-500" },
  { value: "none", label: "❌ Do nothing", color: "bg-white/10" },
];

export default function WhatIfPage() {
  const { farm } = useOutletContext<FarmStreamContext>();
  const [selected, setSelected] = useState(farm.layers[0]?.id ?? "a_01");
  const [hours, setHours] = useState(24);
  const [action, setAction] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [metric, setMetric] = useState<"humidity" | "health_score" | "soil_moisture" | "temperature">("humidity");

  async function runSimulation() {
    setLoading(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${apiBaseUrl}/api/whatif/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layer_id: selected, hours, action }),
      });
      if (res.ok) setResult(await res.json());
    } catch (err) {
      console.error("What-If simulation failed", err);
    } finally {
      setLoading(false);
    }
  }

  // Merge baseline + intervention into recharts-friendly format
  const chartData = result
    ? result.baseline.map((b, i) => ({
        hour: `${b.hour}h`,
        [`No Action`]: (b as any)[metric],
        [result.action_label]: (result.intervention[i] as any)[metric],
      }))
    : [];

  const selectedLayer = farm.layers.find((l) => l.id === selected);

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
          <GitBranch size={20} />
        </span>
        <div>
          <h2 className="text-2xl font-semibold text-white">What-If Simulator</h2>
          <p className="text-sm text-white/50">Predict the future — the heart of your Digital Twin</p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid gap-4 rounded-lg border border-white/10 bg-panel p-6 md:grid-cols-4">
        {/* Layer */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase text-white/50">Target Layer</label>
          <div className="flex flex-col gap-1.5">
            {farm.layers.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelected(l.id)}
                className={`rounded-md px-3 py-2 text-left text-sm transition ${
                  selected === l.id ? "bg-mint/15 text-mint ring-1 ring-mint/30" : "bg-ink text-white/60 hover:bg-white/5"
                }`}
              >
                {l.name} — {l.crop}
              </button>
            ))}
          </div>
        </div>

        {/* Action */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase text-white/50">Intervention</label>
          <div className="flex flex-col gap-1.5">
            {ACTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAction(opt.value)}
                className={`rounded-md px-3 py-2 text-left text-sm transition ${
                  action === opt.value ? "bg-mint/15 text-mint ring-1 ring-mint/30" : "bg-ink text-white/60 hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time Horizon */}
        <div>
          <label className="mb-2 block text-xs font-medium uppercase text-white/50">
            <Clock size={12} className="mr-1 inline" />
            Time Horizon
          </label>
          <div className="flex flex-col gap-1.5">
            {HOUR_OPTIONS.map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`rounded-md px-3 py-2 text-left text-sm transition ${
                  hours === h ? "bg-mint/15 text-mint ring-1 ring-mint/30" : "bg-ink text-white/60 hover:bg-white/5"
                }`}
              >
                {h} hours
              </button>
            ))}
          </div>
        </div>

        {/* Run */}
        <div className="flex flex-col justify-between">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase text-white/50">Current State</label>
            {selectedLayer && (
              <div className="rounded-md bg-ink p-3 text-sm text-white/70">
                <p>Health: <span className="font-semibold text-white">{selectedLayer.health_score}</span></p>
                <p>Status: <span className={selectedLayer.status === "Healthy" ? "text-mint" : "text-coral"}>{selectedLayer.status}</span></p>
              </div>
            )}
          </div>
          <button
            onClick={runSimulation}
            disabled={loading}
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:shadow-violet-500/40 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-pulse">Simulating...</span>
            ) : (
              <>
                <Play size={16} />
                Run Prediction
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-5">
            <h3 className="mb-1 text-sm font-semibold uppercase text-violet-400">AI Prediction Summary</h3>
            <p className="text-sm leading-relaxed text-white/80">{result.summary}</p>
          </div>

          {/* Metric selector */}
          <div className="flex gap-2">
            {(["humidity", "health_score", "soil_moisture", "temperature"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  metric === m ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {m === "health_score" ? "Health Score" : m === "soil_moisture" ? "Soil Moisture" : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-lg border border-white/10 bg-panel p-6">
            <h3 className="mb-4 text-sm font-medium text-white/50 uppercase">
              Projected {metric.replace("_", " ")} — {result.crop} ({hours}h)
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradBaseline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradIntervention" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 13 }}
                  labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Area
                  type="monotone"
                  dataKey="No Action"
                  stroke="#f87171"
                  strokeWidth={2}
                  fill="url(#gradBaseline)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey={result.action_label}
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#gradIntervention)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!result && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-ink/50 py-16 text-center">
          <GitBranch size={40} className="mb-4 text-white/15" />
          <p className="text-sm text-white/40">Select a layer, action, and time horizon, then click <strong className="text-white/60">Run Prediction</strong>.</p>
          <p className="mt-1 text-xs text-white/30">The Digital Twin engine will simulate two alternate futures.</p>
        </div>
      )}
    </div>
  );
}
