import { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { GitBranch, Play, Clock, Zap } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { FarmStreamContext } from "../App";

type TimePoint = { hour: number; temperature: number; humidity: number; soil_moisture: number; health_score: number };
type WhatIfResult = { layer_id: string; crop: string; baseline: TimePoint[]; intervention: TimePoint[]; action_label: string; summary: string };

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

export default function WhatIfPage() {
  const { farm } = useOutletContext<FarmStreamContext>();

  const areas = useMemo(() => {
    const map = new Map<string, { name: string; layers: typeof farm.layers }>();
    for (const l of farm.layers) {
      const key = l.area_id ?? "default";
      if (!map.has(key)) map.set(key, { name: l.area_name ?? key, layers: [] });
      map.get(key)!.layers.push(l);
    }
    return Array.from(map.entries());
  }, [farm.layers]);

  const [selectedArea, setSelectedArea] = useState(areas[0]?.[0] ?? "area_a");
  const currentLayers = areas.find(([id]) => id === selectedArea)?.[1]?.layers ?? [];
  const [selected, setSelected] = useState(currentLayers[0]?.id ?? "a_01");
  const [hours, setHours] = useState(24);
  const [action, setAction] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [metric, setMetric] = useState<typeof METRICS[number]["key"]>("humidity");

  async function runSimulation() {
    setLoading(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${apiBaseUrl}/api/whatif/simulate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layer_id: selected, hours, action }),
      });
      if (res.ok) setResult(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const chartData = result ? result.baseline.map((b, i) => ({
    hour: `${b.hour}h`,
    "No Action": (b as any)[metric],
    [result.action_label]: (result.intervention[i] as any)[metric],
  })) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet/20 to-fuchsia-500/10 text-violet">
          <GitBranch size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-white">What-If Simulator</h2>
          <p className="text-[11px] text-white/25">Predict the future — the heart of your Digital Twin</p>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="grid gap-6 md:grid-cols-4">
          {/* Area + Layer */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-2 block">Target</label>
            <div className="flex gap-1.5 mb-2">
              {areas.map(([id, area]) => (
                <button key={id} onClick={() => { setSelectedArea(id); const f = areas.find(([a]) => a === id)?.[1]?.layers[0]; if(f) setSelected(f.id); }}
                  className={`rounded-lg px-2 py-1 text-[10px] font-medium transition ${selectedArea === id ? "bg-mint/10 text-mint" : "text-white/25 hover:text-white/50"}`}>
                  {area.name.split("—")[0].trim()}
                </button>
              ))}
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {currentLayers.map((l) => (
                <button key={l.id} onClick={() => setSelected(l.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-[11px] transition ${selected === l.id ? "bg-white/[0.06] text-white" : "text-white/30 hover:bg-white/[0.03]"}`}>
                  {l.name} · {l.crop}
                </button>
              ))}
            </div>
          </div>

          {/* Action */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-2 block">Intervention</label>
            <div className="space-y-1">
              {ACTION_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setAction(opt.value)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-[11px] transition ${action === opt.value ? "bg-white/[0.06] text-white" : "text-white/30 hover:bg-white/[0.03]"}`}>
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-2 block">
              <Clock size={10} className="inline mr-1" />Time Horizon
            </label>
            <div className="space-y-1">
              {HOUR_OPTIONS.map((h) => (
                <button key={h} onClick={() => setHours(h)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-[11px] transition ${hours === h ? "bg-white/[0.06] text-white" : "text-white/30 hover:bg-white/[0.03]"}`}>
                  {h} hours
                </button>
              ))}
            </div>
          </div>

          {/* Run */}
          <div className="flex flex-col justify-end">
            <button onClick={runSimulation} disabled={loading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet to-fuchsia-500 px-6 py-3.5 text-[13px] font-semibold text-white shadow-lg shadow-violet/20 transition hover:shadow-violet/30 disabled:opacity-50">
              {loading ? <span className="animate-pulse">Simulating...</span> : <><Play size={16} /> Run Prediction</>}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result ? (
        <div className="space-y-5 animate-fade-up">
          <div className="rounded-2xl border border-violet/20 bg-violet/[0.04] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-violet" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-violet/70">Prediction Summary</span>
            </div>
            <p className="text-[13px] leading-relaxed text-white/60">{result.summary}</p>
          </div>

          {/* Metric selector */}
          <div className="flex gap-2">
            {METRICS.map((m) => (
              <button key={m.key} onClick={() => setMetric(m.key)}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-medium transition ${metric === m.key ? "bg-white/[0.08] text-white" : "text-white/25 hover:text-white/50"}`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="wBase" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="wInt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="hour" stroke="rgba(255,255,255,0.15)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.15)" fontSize={11} />
                <Tooltip contentStyle={{ background: "rgba(13,22,19,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="No Action" stroke="#f87171" strokeWidth={2} fill="url(#wBase)" dot={false} />
                <Area type="monotone" dataKey={result.action_label} stroke="#34d399" strokeWidth={2} fill="url(#wInt)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.06] py-16 text-center">
          <GitBranch size={36} className="text-white/10 mb-3 animate-float" />
          <p className="text-[12px] text-white/25">Select parameters and click <strong className="text-white/40">Run Prediction</strong></p>
          <p className="mt-1 text-[11px] text-white/15">The Digital Twin engine will simulate two alternate futures</p>
        </div>
      )}
    </div>
  );
}
