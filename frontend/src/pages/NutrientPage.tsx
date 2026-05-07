import { useEffect, useMemo, useState } from "react";
import { Beaker, Droplets, FlaskConical, Play, RefreshCw, ShieldAlert, Thermometer, Waves } from "lucide-react";
import { api } from "../services/api";
import type { NutrientIntelligence, NutrientLayerInsight } from "../types";
import { useSettings } from "../contexts/SettingsContext";

const riskStyle = {
  Low: "border-forest-green/20 bg-spring-green/10 text-forest-green",
  Medium: "border-status-warning/20 bg-amber-50 text-status-warning",
  High: "border-status-critical/20 bg-red-50 text-status-critical",
};

export default function NutrientPage() {
  const [data, setData] = useState<NutrientIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const { formatTemp } = useSettings();
  const [selectedArea, setSelectedArea] = useState("All");
  const [executingLayer, setExecutingLayer] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      setData(await api.getNutrientIntelligence());
    } catch (error) {
      console.error("Nutrient intelligence failed", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function executePlan(layerId: string) {
    setExecutingLayer(layerId);
    setMessage(null);
    try {
      const result = await api.executeNutrientPlan(layerId);
      setMessage(`Automated nutrient plan executed for ${layerId}: ${result.status}.`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to execute nutrient plan.");
    } finally {
      setExecutingLayer(null);
    }
  }

  const areas = useMemo(() => {
    const names = new Set(data?.layers.map((layer) => layer.area_name.split("—")[0].trim()) ?? []);
    return ["All", ...Array.from(names)];
  }, [data]);

  const layers = useMemo(() => {
    const all = data?.layers ?? [];
    return selectedArea === "All" ? all : all.filter((layer) => layer.area_name.startsWith(selectedArea));
  }, [data, selectedArea]);

  return (
    <div className="grid gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Nutrient Intelligence</h2>
          <p className="mt-1 text-xs text-muted">EC, pH, reservoir level, and dosing guidance for hydroponic nutrient control.</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-card-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-spring-green/20 disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading || !data ? (
        <div className="rounded-lg border border-card-border bg-white p-8 text-sm text-muted shadow-card">Loading nutrient intelligence...</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Nutrient Score", value: `${data.average_nutrient_score}`, detail: data.owner_summary, icon: Beaker, tone: "text-forest-green" },
              { label: "High Risk", value: `${data.high_risk_layers}`, detail: "Immediate correction layers", icon: ShieldAlert, tone: "text-status-critical" },
              { label: "Medium Risk", value: `${data.medium_risk_layers}`, detail: "Watch and adjust soon", icon: FlaskConical, tone: "text-status-warning" },
              { label: "Mode", value: "EC + pH", detail: "Fertigation decision support", icon: Droplets, tone: "text-sky-600" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-card-border bg-white p-5 shadow-card">
                <div className={`mb-3 flex items-center gap-2 ${item.tone}`}>
                  <item.icon size={18} />
                  <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
                </div>
                <p className="text-2xl font-semibold text-ink">{item.value}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{item.detail}</p>
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2 text-forest-green">
              <Beaker size={17} />
              <h3 className="text-sm font-semibold text-ink">Original Control Logic</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-card-border bg-field-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Nutrient First</p>
                <p className="mt-1 text-sm text-ink/80">Top up water before dosing when reservoir volume is low, so EC does not spike.</p>
              </div>
              <div className="rounded-md border border-card-border bg-field-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Split A/B Dosing</p>
                <p className="mt-1 text-sm text-ink/80">Dose A and B equally and slowly, then wait before correcting pH.</p>
              </div>
              <div className="rounded-md border border-card-border bg-field-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Lockout Guard</p>
                <p className="mt-1 text-sm text-ink/80">pH drift and high root temperature reduce nutrient uptake, even when EC looks acceptable.</p>
              </div>
            </div>
          </section>

          {message && (
            <div className="rounded-md border border-forest-green/20 bg-spring-green/10 p-3 text-sm font-semibold text-forest-green">
              {message}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {areas.map((area) => (
              <button
                key={area}
                onClick={() => setSelectedArea(area)}
                className="rounded-md px-3.5 py-1.5 text-xs font-semibold transition"
                style={selectedArea === area
                  ? { backgroundColor: "#228B22", color: "#FFFFFF" }
                  : { backgroundColor: "#EAF5EA", color: "#2D4A2D", border: "1px solid #B3D4B3" }
                }
              >
                {area}
              </button>
            ))}
          </div>

          <section className="grid gap-4 xl:grid-cols-2">
            {layers.map((layer: NutrientLayerInsight) => (
              <article key={layer.layer_id} className="rounded-lg border border-card-border bg-white p-5 shadow-card">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">{layer.area_name.split("—")[0].trim()}</p>
                    <h3 className="mt-1 text-lg font-semibold text-ink">{layer.layer_name} · {layer.crop}</h3>
                    <p className="text-xs text-muted">{layer.growth_stage} · Reservoir {layer.reservoir_liters}L</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${riskStyle[layer.risk]}`}>{layer.risk}</span>
                    <span className="rounded-full border border-card-border bg-field-bg px-2.5 py-1 text-xs font-bold text-muted">{layer.confidence}% confidence</span>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-4">
                  {[
                    { label: "EC", value: `${layer.ec.toFixed(2)}`, detail: `Target ${layer.target_ec}`, icon: Beaker },
                    { label: "pH", value: layer.ph.toFixed(2), detail: `Target ${layer.target_ph}`, icon: FlaskConical },
                    { label: "Water", value: `${layer.water_level.toFixed(0)}%`, detail: "Reservoir level", icon: Waves },
                    { label: "Temp", value: formatTemp(layer.temperature), detail: "Root stress context", icon: Thermometer },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border border-card-border bg-field-bg p-3">
                      <div className="mb-1 flex items-center gap-1.5 text-forest-green">
                        <item.icon size={14} />
                        <span className="text-xs font-semibold uppercase">{item.label}</span>
                      </div>
                      <p className="text-lg font-semibold text-ink">{item.value}</p>
                      <p className="text-[11px] text-muted">{item.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-md border border-forest-green/20 bg-spring-green/10 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-forest-green">Recommended Dose</p>
                    <button
                      type="button"
                      onClick={() => executePlan(layer.layer_id)}
                      disabled={executingLayer === layer.layer_id}
                      className="inline-flex items-center gap-2 rounded-md border border-forest-green/20 bg-white px-3 py-1.5 text-xs font-semibold text-forest-green transition hover:bg-spring-green/20 disabled:opacity-60"
                    >
                      <Play size={13} />
                      {executingLayer === layer.layer_id ? "Executing..." : "Execute Safely"}
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-ink/80 sm:grid-cols-3">
                    <span>A {layer.recommended_dose.nutrient_a_ml.toFixed(1)} ml</span>
                    <span>B {layer.recommended_dose.nutrient_b_ml.toFixed(1)} ml</span>
                    <span>Water {layer.recommended_dose.water_topup_liters.toFixed(1)} L</span>
                    <span>pH Up {layer.recommended_dose.ph_up_ml.toFixed(1)} ml</span>
                    <span>pH Down {layer.recommended_dose.ph_down_ml.toFixed(1)} ml</span>
                    <span>Dilute {layer.recommended_dose.dilution_liters.toFixed(1)} L</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Evidence</p>
                    <ul className="space-y-1 text-sm text-ink/75">
                      {layer.evidence.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Next Actions</p>
                    <ul className="space-y-1 text-sm text-ink/75">
                      {layer.next_actions.map((item) => <li key={item}>→ {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Avoid</p>
                    <ul className="space-y-1 text-sm text-ink/75">
                      {layer.avoid.length ? layer.avoid.map((item) => <li key={item}>× {item}</li>) : <li>× Avoid changing multiple variables at once.</li>}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
