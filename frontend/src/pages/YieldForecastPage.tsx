import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, History, Save, Sprout, WalletCards } from "lucide-react";

import { api } from "../services/api";
import type { YieldForecast, YieldForecastLayer, YieldSetup, YieldSetupSnapshot } from "../types";
import { useHarvestLogs } from "../hooks/useHarvestLogs";

export default function YieldForecastPage() {
  const [forecast, setForecast] = useState<YieldForecast | null>(null);
  const [setup, setSetup] = useState<YieldSetupSnapshot | null>(null);
  const [drafts, setDrafts] = useState<Record<string, YieldSetup>>({});
  const [loading, setLoading] = useState(true);
  const [savingLayer, setSavingLayer] = useState<string | null>(null);
  const [selectedCrop, setSelectedCrop] = useState("All");
  const { harvestLogs, harvestedIds, markHarvested, clearHarvestLog } = useHarvestLogs();

  async function refreshYieldData() {
    const [forecastData, setupData] = await Promise.all([
      api.getYieldForecast(),
      api.getYieldSetup(),
    ]);
    setForecast(forecastData);
    setSetup(setupData);
    setDrafts(Object.fromEntries(setupData.setups.map((item) => [item.layer_id, item])));
  }

  useEffect(() => {
    let alive = true;
    refreshYieldData()
      .catch((error) => console.error("Yield forecast failed", error))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function updateDraft(layerId: string, field: keyof YieldSetup, value: string) {
    setDrafts((current) => {
      const existing = current[layerId];
      if (!existing) return current;
      const nextValue = field === "crop" ? value : Number(value);
      return { ...current, [layerId]: { ...existing, [field]: nextValue } };
    });
  }

  async function saveSetup(layerId: string) {
    const draft = drafts[layerId];
    if (!draft) return;
    setSavingLayer(layerId);
    try {
      await api.updateYieldSetup(layerId, {
        crop: draft.crop,
        rows: draft.rows,
        columns: draft.columns,
        rack_layers: draft.rack_layers,
        farm_area_m2: draft.farm_area_m2,
        price_rm_per_kg: draft.price_rm_per_kg,
        expected_kg_per_plant: draft.expected_kg_per_plant,
      });
      await refreshYieldData();
    } catch (error) {
      console.error("Yield setup update failed", error);
    } finally {
      setSavingLayer(null);
    }
  }

  const crops = useMemo(() => {
    const values = new Set(forecast?.layers.map((layer) => layer.crop) ?? []);
    return ["All", ...Array.from(values)];
  }, [forecast]);

  const visibleLayers = useMemo(() => {
    const layers = forecast?.layers ?? [];
    return selectedCrop === "All" ? layers : layers.filter((layer) => layer.crop === selectedCrop);
  }, [forecast, selectedCrop]);

  const harvestReady = visibleLayers.filter((layer) => layer.can_mark_harvested && !harvestedIds.has(layer.layer_id));
  const totalVisibleRevenue = visibleLayers.reduce((sum, layer) => sum + layer.estimated_revenue_rm, 0);

  if (loading || !forecast || !setup) {
    return <div className="rounded-lg border border-card-border bg-white p-8 text-sm text-muted shadow-card">Loading yield forecast...</div>;
  }

  return (
    <div className="grid gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Yield Forecast</h2>
          <p className="mt-1 text-xs text-muted">Turn crop health into expected harvest weight and sales value.</p>
        </div>
        <span className="rounded-md border border-forest-green/20 bg-spring-green/10 px-3 py-1.5 text-xs font-semibold text-forest-green">
          Manual harvest workflow
        </span>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Yield</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{forecast.total_estimated_kg.toFixed(1)} kg</p>
        </div>
        <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Estimated Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-forest-green">RM {forecast.total_estimated_revenue_rm.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Harvest Ready</p>
          <p className="mt-2 text-2xl font-semibold text-status-warning">{harvestReady.length}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Confidence</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{forecast.average_confidence}%</p>
        </div>
      </section>

      <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-forest-green">
            <Save size={17} />
            <h3 className="text-sm font-semibold text-ink">Manual Farm Setup</h3>
          </div>
          <span className="rounded-md border border-card-border bg-field-bg px-3 py-1.5 text-xs font-semibold text-muted">
            Crop count and market price are farmer inputs
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-card-border">
          <table className="w-full min-w-[1120px] border-collapse bg-white text-sm">
            <thead className="bg-field-bg text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="p-3">Layer</th>
                <th className="p-3">Crop Type</th>
                <th className="p-3">Rows</th>
                <th className="p-3">Columns</th>
                <th className="p-3">Rack Layers</th>
                <th className="p-3">Plants</th>
                <th className="p-3">Area m2</th>
                <th className="p-3">RM/kg</th>
                <th className="p-3">kg/plant</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {forecast.layers.map((layer) => {
                const draft = drafts[layer.layer_id];
                const totalPlants = (draft?.rows ?? 0) * (draft?.columns ?? 0) * (draft?.rack_layers ?? 0);
                return (
                  <tr key={layer.layer_id} className="border-t border-card-border">
                    <td className="p-3 font-semibold text-ink">{layer.layer_name}</td>
                    <td className="p-3">
                      <select
                        value={draft?.crop ?? layer.crop}
                        onChange={(event) => updateDraft(layer.layer_id, "crop", event.target.value)}
                        className="w-32 rounded-md border border-card-border bg-white px-2 py-1.5 text-sm text-ink"
                      >
                        {setup.available_crops.map((crop) => <option key={crop} value={crop}>{crop}</option>)}
                      </select>
                    </td>
                    {(["rows", "columns", "rack_layers"] as const).map((field) => (
                      <td key={field} className="p-3">
                        <input
                          type="number"
                          min={1}
                          value={draft?.[field] ?? 1}
                          onChange={(event) => updateDraft(layer.layer_id, field, event.target.value)}
                          className="w-20 rounded-md border border-card-border px-2 py-1.5 text-sm text-ink"
                        />
                      </td>
                    ))}
                    <td className="p-3 font-semibold text-ink">{totalPlants}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={draft?.farm_area_m2 ?? 0}
                        onChange={(event) => updateDraft(layer.layer_id, "farm_area_m2", event.target.value)}
                        className="w-24 rounded-md border border-card-border px-2 py-1.5 text-sm text-ink"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={draft?.price_rm_per_kg ?? 0}
                        onChange={(event) => updateDraft(layer.layer_id, "price_rm_per_kg", event.target.value)}
                        className="w-24 rounded-md border border-card-border px-2 py-1.5 text-sm text-ink"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        step="0.001"
                        value={draft?.expected_kg_per_plant ?? 0}
                        onChange={(event) => updateDraft(layer.layer_id, "expected_kg_per_plant", event.target.value)}
                        className="w-24 rounded-md border border-card-border px-2 py-1.5 text-sm text-ink"
                      />
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => saveSetup(layer.layer_id)}
                        disabled={savingLayer === layer.layer_id}
                        className="inline-flex items-center gap-2 rounded-md bg-forest-green px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-dark-green disabled:opacity-60"
                      >
                        <Save size={13} />
                        {savingLayer === layer.layer_id ? "Saving" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {crops.map((crop) => (
          <button
            key={crop}
            onClick={() => setSelectedCrop(crop)}
            className="rounded-md px-3.5 py-1.5 text-xs font-semibold transition"
            style={selectedCrop === crop
              ? { backgroundColor: "#228B22", color: "#FFFFFF" }
              : { backgroundColor: "#EAF5EA", color: "#2D4A2D", border: "1px solid #B3D4B3" }}
          >
            {crop}
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-forest-green">
            <Sprout size={17} />
            <h3 className="text-sm font-semibold text-ink">Layer Harvest Plan</h3>
          </div>
          <span className="rounded-md border border-card-border bg-field-bg px-3 py-1.5 text-xs font-semibold text-muted">
            Filtered sales RM {totalVisibleRevenue.toFixed(0)}
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-card-border">
          <table className="w-full min-w-[900px] border-collapse bg-white text-sm">
            <thead className="bg-field-bg text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="p-3">Layer</th>
                <th className="p-3">Crop</th>
                <th className="p-3">Plants</th>
                <th className="p-3">Harvest In</th>
                <th className="p-3">Yield</th>
                <th className="p-3">Revenue</th>
                <th className="p-3">Status</th>
                <th className="p-3">Manual Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleLayers.map((layer) => {
                const harvested = harvestedIds.has(layer.layer_id);
                const ready = layer.can_mark_harvested;
                return (
                  <tr key={layer.layer_id} className="border-t border-card-border">
                    <td className="p-3 font-semibold text-ink">{layer.layer_name}</td>
                    <td className="p-3 text-ink/80">{layer.crop}</td>
                    <td className="p-3 text-ink/80">{layer.plant_count}</td>
                    <td className="p-3 text-ink/80">{layer.expected_harvest_days} days</td>
                    <td className="p-3 text-ink/80">{layer.estimated_kg.toFixed(2)} kg</td>
                    <td className="p-3 font-semibold text-forest-green">RM {layer.estimated_revenue_rm.toFixed(2)}</td>
                    <td className="p-3">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${harvested ? "border-forest-green/20 bg-spring-green/10 text-forest-green" : ready ? "border-status-warning/20 bg-amber-50 text-status-warning" : "border-card-border bg-field-bg text-muted"}`}>
                        {harvested ? "Harvested" : layer.harvest_status}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => markHarvested(layer)}
                        disabled={harvested || !layer.can_mark_harvested}
                        className="inline-flex items-center gap-2 rounded-md border border-card-border bg-field-bg px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-spring-green/20 disabled:opacity-50"
                        title={layer.can_mark_harvested ? "Record this layer as harvested" : "This layer is still growing and cannot be marked as harvested yet"}
                      >
                        <CheckCircle2 size={13} />
                        {harvested ? "Marked" : layer.can_mark_harvested ? "Mark Harvested" : "Not ready"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-forest-green">
          <History size={17} />
          <h3 className="text-sm font-semibold text-ink">Harvest History</h3>
        </div>
        {harvestLogs.length === 0 ? (
          <div className="rounded-md border border-dashed border-card-border py-8 text-center text-sm text-muted">
            No manual harvest has been recorded yet.
          </div>
        ) : (
          <div className="grid gap-2">
            {harvestLogs.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-card-border bg-field-bg p-3 text-sm">
                <div className="flex items-center gap-2">
                  <WalletCards size={15} className="text-forest-green" />
                  <span className="font-semibold text-ink">{item.layer_name} · {item.crop}</span>
                  <span className="text-muted">{item.kg.toFixed(2)} kg · RM {item.revenue_rm.toFixed(2)}</span>
                </div>
                <button onClick={() => clearHarvestLog(item.id)} className="text-xs font-semibold text-muted hover:text-status-critical">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
