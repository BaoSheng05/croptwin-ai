import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Hand, RefreshCw } from "lucide-react";
import { useOutletContext } from "react-router-dom";

import type { FarmStreamContext } from "../App";
import { api } from "../services/api";
import type { YieldForecastLayer } from "../types";
import { useHarvestLogs } from "../hooks/useHarvestLogs";

function statusForRecommendation(isResolving: boolean, canAutomate: boolean) {
  if (isResolving) return "AI resolving";
  if (canAutomate) return "AI managed";
  return "Manual required";
}

export default function AlertsPage() {
  const { farm, alerts, recommendations, resolveManager } = useOutletContext<FarmStreamContext>();
  const [yieldLayers, setYieldLayers] = useState<YieldForecastLayer[]>([]);
  const { harvestedIds, markHarvested } = useHarvestLogs();

  useEffect(() => {
    let alive = true;
    api.getYieldForecast()
      .then((data) => { if (alive) setYieldLayers(data.layers); })
      .catch((error) => console.error("Yield alerts failed", error));
    return () => { alive = false; };
  }, []);

  const harvestAlerts = yieldLayers.filter(
    (layer) =>
      !harvestedIds.has(layer.layer_id) &&
      (layer.can_mark_harvested || layer.harvest_status === "Ready soon" || layer.expected_harvest_days <= 7),
  );

  const rows = useMemo(() => {
    return alerts.map((alert) => {
      const layer = farm.layers.find((item) => item.id === alert.layer_id);
      const rec = recommendations.find((item) => item.layer_id === alert.layer_id);
      const resolving = rec ? resolveManager.isResolving(rec) : false;
      const canAutomate = rec ? resolveManager.isAutomatable(rec) : false;
      return {
        id: alert.id,
        layer: layer ? `${layer.name} · ${layer.crop}` : alert.layer_id,
        risk: alert.severity,
        issue: alert.title,
        detail: alert.message,
        aiStatus: rec ? statusForRecommendation(resolving, canAutomate) : "No action needed",
        action: rec?.action ?? "Monitor only",
        manual: !rec || !canAutomate,
      };
    });
  }, [alerts, farm.layers, recommendations, resolveManager]);

  return (
    <div className="grid gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold text-ink">Alerts</h2>
        <p className="mt-1 text-xs text-muted">Risk queue with AI resolving status and manual harvest alerts.</p>
      </div>

      <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Active Risk Queue</h3>
          <span className="rounded-md border border-card-border bg-field-bg px-3 py-1.5 text-xs font-semibold text-muted">
            {rows.length} active · {harvestAlerts.length} harvest
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-card-border">
          <table className="w-full min-w-[900px] border-collapse bg-white text-sm">
            <thead className="bg-field-bg text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="p-3">Alert</th>
                <th className="p-3">Layer</th>
                <th className="p-3">Risk</th>
                <th className="p-3">AI Status</th>
                <th className="p-3">Action</th>
                <th className="p-3">Resolve</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted">No active risk alerts.</td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-card-border align-top">
                  <td className="p-3">
                    <p className="font-semibold text-ink">{row.issue}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{row.detail}</p>
                  </td>
                  <td className="p-3 font-semibold text-ink">{row.layer}</td>
                  <td className="p-3">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${row.risk === "critical" ? "border-status-critical/20 bg-red-50 text-status-critical" : "border-status-warning/20 bg-amber-50 text-status-warning"}`}>
                      {row.risk}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 rounded-md border border-card-border bg-field-bg px-2 py-1 text-xs font-semibold text-muted">
                      {row.aiStatus.includes("AI") ? <RefreshCw size={12} className="animate-spin" /> : <Hand size={12} />}
                      {row.aiStatus}
                    </span>
                  </td>
                  <td className="p-3 text-ink/80">{row.action}</td>
                  <td className="p-3 text-xs text-muted">{row.manual ? "Operator check" : "Auto monitored"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Harvest Alerts</h3>
            <p className="mt-1 text-xs text-muted">Layers ready now or entering the harvest window soon.</p>
          </div>
          <span className="rounded-md border border-forest-green/20 bg-spring-green/10 px-3 py-1.5 text-xs font-semibold text-forest-green">
            {harvestAlerts.length} harvest reminder{harvestAlerts.length === 1 ? "" : "s"}
          </span>
        </div>

        {harvestAlerts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-card-border bg-field-bg p-8 text-center text-sm text-muted">
            No crops are inside the harvest reminder window yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {harvestAlerts.map((layer) => (
              <article key={`harvest-${layer.layer_id}`} className="rounded-lg border border-card-border bg-spring-green/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {layer.can_mark_harvested ? "Harvest Ready" : "Ready Soon"}
                    </p>
                    <p className="mt-1 text-xs text-muted">{layer.layer_name} · {layer.crop}</p>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                    layer.can_mark_harvested
                      ? "border-forest-green/20 bg-spring-green/10 text-forest-green"
                      : "border-amber-300/30 bg-amber-50 text-amber-700"
                  }`}>
                    {layer.can_mark_harvested ? "now" : `${layer.expected_harvest_days} days`}
                  </span>
                </div>

                <p className="mt-3 text-sm text-ink/80">
                  {layer.estimated_kg.toFixed(2)} kg forecast · RM {layer.estimated_revenue_rm.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Confidence {layer.yield_confidence}% · {layer.area_name}
                </p>

                <div className="mt-4">
                  {layer.can_mark_harvested ? (
                    <button
                      type="button"
                      onClick={() => markHarvested(layer)}
                      className="inline-flex items-center gap-2 rounded-md bg-forest-green px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-forest-green/90"
                    >
                      <CheckCircle2 size={13} />
                      Mark Harvested
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/30 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                      <Hand size={12} />
                      Prepare harvest
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
