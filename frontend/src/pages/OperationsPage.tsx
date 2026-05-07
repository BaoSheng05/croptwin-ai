import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, ClipboardList, Clock, Sprout } from "lucide-react";

import { api } from "../services/api";
import type { OperationsTimeline, YieldForecast } from "../types";

function formatTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function riskStyle(risk: string) {
  if (risk === "High" || risk === "Critical") return "border-red-200 bg-red-50 text-red-700";
  if (risk === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-forest-green/20 bg-spring-green/10 text-forest-green";
}

export default function OperationsPage() {
  const [timeline, setTimeline] = useState<OperationsTimeline | null>(null);
  const [forecast, setForecast] = useState<YieldForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCrop, setSelectedCrop] = useState("All");

  useEffect(() => {
    let alive = true;
    Promise.all([api.getOperationsTimeline(), api.getYieldForecast()])
      .then(([timelineData, forecastData]) => {
        if (!alive) return;
        setTimeline(timelineData);
        setForecast(forecastData);
      })
      .catch((error) => console.error("Operations cockpit failed", error))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const crops = useMemo(() => {
    const values = new Set(forecast?.layers.map((layer) => layer.crop) ?? []);
    return ["All", ...Array.from(values)];
  }, [forecast]);

  const visibleYieldLayers = useMemo(() => {
    if (!forecast) return [];
    if (selectedCrop === "All") return forecast.layers;
    return forecast.layers.filter((layer) => layer.crop === selectedCrop);
  }, [forecast, selectedCrop]);

  const selectedRevenue = visibleYieldLayers.reduce((sum, layer) => sum + layer.estimated_revenue_rm, 0);
  const selectedKg = visibleYieldLayers.reduce((sum, layer) => sum + layer.estimated_kg, 0);

  if (loading || !timeline || !forecast) {
    return (
      <div className="rounded-lg border border-card-border bg-white p-10 text-center text-sm text-muted shadow-card">
        Loading operations cockpit...
      </div>
    );
  }

  return (
    <div className="grid gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-spring-green/10 text-forest-green">
            <ClipboardList size={19} />
          </span>
          <div>
            <h2 className="text-2xl font-semibold text-ink">Operations Cockpit</h2>
            <p className="text-xs text-muted">Audit trail, before/after impact, yield, and revenue forecast.</p>
          </div>
        </div>
        <span className="rounded-md border border-card-border bg-white px-3 py-1.5 text-xs font-semibold text-muted">
          Updated {formatTime(timeline.generated_at)}
        </span>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Closed-loop Events</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{timeline.closed_loop_events}</p>
          <p className="mt-1 text-xs text-muted">Alert to action trail</p>
        </div>
        <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Improving</p>
          <p className="mt-2 text-2xl font-semibold text-forest-green">{timeline.resolved_or_improving}</p>
          <p className="mt-1 text-xs text-muted">After-action risk reduced</p>
        </div>
        <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Forecast Yield</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{forecast.total_estimated_kg.toFixed(1)} kg</p>
          <p className="mt-1 text-xs text-muted">{forecast.average_confidence}% confidence</p>
        </div>
        <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Expected Sales</p>
          <p className="mt-2 text-2xl font-semibold text-forest-green">RM {forecast.total_estimated_revenue_rm.toFixed(0)}</p>
          <p className="mt-1 text-xs text-muted">Risk-adjusted crop value</p>
        </div>
      </section>

      <section className="rounded-lg border border-card-border bg-white p-6 shadow-card">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">Farm Operations Timeline</h3>
            <p className="text-sm text-muted">{timeline.summary}</p>
          </div>
          <Clock size={18} className="text-muted" />
        </div>

        <div className="grid gap-4">
          {timeline.events.map((event) => (
            <article key={event.id} className="rounded-lg border border-card-border bg-field-bg p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {formatTime(event.timestamp)} · {event.layer_name} · {event.crop}
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-ink">{event.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-ink/70">{event.trigger}</p>
                </div>
                <span className="rounded-md border border-card-border bg-white px-3 py-1.5 text-xs font-semibold text-muted">
                  {event.type}
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-md border border-card-border bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">AI Recommendation</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink/80">{event.ai_recommendation}</p>
                </div>
                <div className="rounded-md border border-card-border bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Executed By</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{event.actor}</p>
                  <p className="mt-1 text-sm text-ink/70">{event.executed_action}</p>
                </div>
                <div className="rounded-md border border-card-border bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Impact</p>
                  <p className="mt-2 text-sm leading-relaxed text-forest-green">{event.impact}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Before</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <span>Health {event.before.health_score}</span>
                    <span>Humidity {event.before.humidity}%</span>
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${riskStyle(event.before.risk)}`}>
                      {event.before.risk}
                    </span>
                  </div>
                </div>
                <div className="rounded-md border border-forest-green/20 bg-spring-green/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-forest-green">After</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <span>Health {event.after.health_score}</span>
                    <span>Humidity {event.after.humidity}%</span>
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${riskStyle(event.after.risk)}`}>
                      {event.after.risk}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-card-border bg-white p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-spring-green/10 text-forest-green">
              <Sprout size={17} />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-ink">Crop Yield & Revenue Forecast</h3>
              <p className="text-sm text-muted">{forecast.summary}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {crops.map((crop) => (
              <button
                key={crop}
                onClick={() => setSelectedCrop(crop)}
                className="rounded-md px-3 py-1.5 text-xs font-semibold transition"
                style={selectedCrop === crop
                  ? { backgroundColor: "#228B22", color: "#FFFFFF" }
                  : { backgroundColor: "#EAF5EA", color: "#2D4A2D", border: "1px solid #B3D4B3" }}
              >
                {crop}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-card-border bg-field-bg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Filtered Yield</p>
            <p className="mt-1 text-xl font-semibold text-ink">{selectedKg.toFixed(1)} kg</p>
          </div>
          <div className="rounded-md border border-card-border bg-field-bg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Filtered Sales</p>
            <p className="mt-1 text-xl font-semibold text-forest-green">RM {selectedRevenue.toFixed(0)}</p>
          </div>
          <div className="rounded-md border border-card-border bg-field-bg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Forecast Model</p>
            <p className="mt-1 text-sm text-ink/80">Health + nutrient + lighting strategy</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-card-border">
          <table className="w-full min-w-[860px] border-collapse bg-white text-sm">
            <thead className="bg-field-bg text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="p-3">Layer</th>
                <th className="p-3">Crop</th>
                <th className="p-3">Harvest</th>
                <th className="p-3">Yield</th>
                <th className="p-3">Price</th>
                <th className="p-3">Sales</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Drivers</th>
              </tr>
            </thead>
            <tbody>
              {visibleYieldLayers.map((layer) => (
                <tr key={layer.layer_id} className="border-t border-card-border">
                  <td className="p-3 font-semibold text-ink">{layer.layer_name}</td>
                  <td className="p-3 text-ink/80">{layer.crop}</td>
                  <td className="p-3 text-ink/80">{layer.expected_harvest_days} days</td>
                  <td className="p-3 text-ink/80">{layer.estimated_kg.toFixed(2)} kg</td>
                  <td className="p-3 text-ink/80">RM {layer.price_rm_per_kg}/kg</td>
                  <td className="p-3 font-semibold text-forest-green">RM {layer.estimated_revenue_rm.toFixed(2)}</td>
                  <td className="p-3">
                    <span className="rounded-md border border-card-border bg-field-bg px-2 py-1 text-xs font-semibold">
                      {layer.yield_confidence}%
                    </span>
                  </td>
                  <td className="p-3 text-xs leading-relaxed text-muted">
                    {layer.drivers.join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-card-border bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-sky-50 text-sky-600">
            <BarChart3 size={17} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-ink">Pitch Value</h3>
            <p className="text-sm text-muted">This page proves CropTwin is not only a dashboard.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            "Records what happened, who acted, and what changed after the action.",
            "Translates farm health into expected yield and sales value.",
            "Gives owners a simple audit trail for operational trust.",
          ].map((item) => (
            <div key={item} className="flex gap-2 rounded-md border border-card-border bg-field-bg p-4 text-sm text-ink/80">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-forest-green" />
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
