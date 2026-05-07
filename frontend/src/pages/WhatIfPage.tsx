import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Building2, GitBranch, Play, Clock, Zap } from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { FarmStreamContext } from "../App";
import { api } from "../services/api";
import type { UrbanExpansionWhatIf } from "../types";

type TimePoint = { hour: number; temperature: number; humidity: number; soil_moisture: number; health_score: number };
type WhatIfResult = {
  layer_id: string;
  layer_name: string;
  crop: string;
  baseline: TimePoint[];
  intervention: TimePoint[];
  action_label: string;
  summary: string;
  current_health: number;
  baseline_final_health: number;
  intervention_final_health: number;
  health_delta: number;
  recommendation: string;
};

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

function localizeText(text: string, tempUnit: "C" | "F") {
  if (tempUnit === "C") return text;
  return text.replace(/(\d+\.?\d*)C/g, (match, p1) => {
    const celsius = parseFloat(p1);
    const fahrenheit = (celsius * 9) / 5 + 32;
    return `${fahrenheit.toFixed(1)}F`;
  });
}

export default function WhatIfPage() {
  const { farm } = useOutletContext<FarmStreamContext>();
  const { settings } = useSettings();

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
  const [urbanLoading, setUrbanLoading] = useState(true);
  const [urbanResult, setUrbanResult] = useState<UrbanExpansionWhatIf | null>(null);

  useEffect(() => {
    let alive = true;
    api.getUrbanExpansionWhatIf()
      .then((data) => { if (alive) setUrbanResult(data); })
      .catch((error) => console.error("Urban expansion what-if failed", error))
      .finally(() => { if (alive) setUrbanLoading(false); });
    return () => { alive = false; };
  }, []);

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

  const chartData = result ? result.baseline.map((b, i) => {
    const transformValue = (val: number) => {
      if (metric === "temperature" && settings.tempUnit === "F") {
        return Number(((val * 9) / 5 + 32).toFixed(1));
      }
      return val;
    };
    return {
      hour: `${b.hour}h`,
      "No Action": transformValue((b as any)[metric]),
      [result.action_label]: transformValue((result.intervention[i] as any)[metric]),
    };
  }) : [];
  const overlappingSeries = result ? result.baseline.every((b, i) => {
    const baselineValue = (b as any)[metric];
    const interventionValue = (result.intervention[i] as any)[metric];
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
          <h2 className="text-2xl font-semibold text-ink">What-If Simulator</h2>
          <p className="text-xs text-muted">Predict the future — the heart of your Digital Twin</p>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-lg border border-card-border bg-white p-6 shadow-card">
        <div className="grid gap-6 md:grid-cols-4">
          {/* Area + Layer */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Target</label>
            <div className="flex gap-1.5 mb-2">
              {areas.map(([id, area]) => (
                <button key={id} onClick={() => { setSelectedArea(id); const f = areas.find(([a]) => a === id)?.[1]?.layers[0]; if(f) setSelected(f.id); }}
                  className="rounded-md px-2 py-1 text-xs font-medium transition"
                  style={selectedArea === id
                    ? { backgroundColor: "#228B22", color: "#FFFFFF" }
                    : { backgroundColor: "#EAF5EA", color: "#2D4A2D" }
                  }>
                  {area.name.split("—")[0].trim()}
                </button>
              ))}
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
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
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Intervention</label>
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
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">
              <Clock size={10} className="inline mr-1" />Time Horizon
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
          <div className="flex flex-col justify-end">
            <button onClick={runSimulation} disabled={loading}
              className="flex items-center justify-center gap-2 rounded-lg bg-forest-green px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-forest-green/90 disabled:opacity-50">
              {loading ? <span className="animate-pulse">Simulating...</span> : <><Play size={16} /> Run Prediction</>}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result ? (
        <div className="space-y-5 animate-fade-up">
          <div className="rounded-lg border border-purple-300/30 bg-purple-50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-purple-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Prediction Summary</span>
            </div>
            <p className="text-sm leading-relaxed text-ink/80">{localizeText(result.summary, settings.tempUnit)}</p>
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
            <p className="mt-1 text-sm leading-relaxed text-ink/80">{localizeText(result.recommendation, settings.tempUnit)}</p>
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
      )}

      <section className="rounded-lg border border-card-border bg-white p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-sky-50 text-sky-600">
              <Building2 size={18} />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-ink">Urban Expansion What-If</h3>
              <p className="text-xs text-muted">Compare land cost, pollution, electricity, climate risk, demand, logistics, and policy support.</p>
            </div>
          </div>
          {urbanResult && (
            <span className="rounded-md border border-forest-green/20 bg-spring-green/10 px-3 py-1.5 text-xs font-semibold text-forest-green">
              Best: {urbanResult.best_city}
            </span>
          )}
        </div>

        {urbanLoading || !urbanResult ? (
          <div className="rounded-md border border-dashed border-card-border bg-field-bg p-8 text-center text-sm text-muted">
            Loading urban expansion simulation...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-md border border-sky-300/30 bg-sky-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">{urbanResult.model}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{urbanResult.summary}</p>
              <p className="mt-2 text-sm font-semibold text-forest-green">
                Recommended deployment: {urbanResult.best_deployment_mode}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {urbanResult.owner_takeaway.map((item) => (
                <div key={item} className="rounded-md border border-card-border bg-field-bg p-4 text-sm leading-relaxed text-ink/80">
                  {item}
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {urbanResult.sites.map((site) => (
                <article key={site.city} className="rounded-lg border border-card-border bg-field-bg p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-base font-semibold text-ink">{site.city}</h4>
                      <p className="mt-1 text-xs text-muted">{site.notes}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-forest-green">{site.expansion_score}</p>
                      <p className="text-xs uppercase tracking-wider text-muted">score</p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-4">
                    {[
                      { label: "Land", value: site.land_cost_index },
                      { label: "Pollution", value: site.air_pollution_index },
                      { label: "Demand", value: site.market_demand_index },
                      { label: "Policy", value: site.policy_support_index },
                    ].map((item) => (
                      <div key={item.label} className="rounded-md border border-card-border bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{item.label}</p>
                        <p className="mt-1 text-lg font-semibold text-ink">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-card-border bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Deployment Mode</p>
                      <p className="mt-1 text-sm text-ink/80">{site.deployment_mode}</p>
                    </div>
                    <div className="rounded-md border border-card-border bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Business Pressure</p>
                      <p className="mt-1 text-sm text-ink/80">
                        {site.capex_pressure} capex · {site.estimated_payback_months} mo payback · RM {site.rent_rm_m2_month}/m² rent
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm font-semibold text-forest-green">{site.recommendation}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
