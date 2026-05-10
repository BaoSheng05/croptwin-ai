import { useOutletContext } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Save } from "lucide-react";
import { LayerCard } from "../components/LayerCard";
import { ChartsPanel } from "../components/ChartsPanel";
import type { FarmStreamContext } from "../App";
import { usePersistentString } from "../hooks/usePersistentState";
import { api } from "../services/api";
import type { FarmLayoutConfig, YieldSetup, YieldSetupSnapshot } from "../types";

export default function LayerDetailPage() {
  const { farm, getLayerChartData } = useOutletContext<FarmStreamContext>();
  const [setup, setSetup] = useState<YieldSetupSnapshot | null>(null);
  const [layout, setLayout] = useState<FarmLayoutConfig | null>(null);
  const [layoutDraft, setLayoutDraft] = useState<FarmLayoutConfig>({ area_count: 3, layers_per_area: 5, default_crop: "Lettuce" });
  const [drafts, setDrafts] = useState<Record<string, YieldSetup>>({});
  const [setupLoading, setSetupLoading] = useState(true);
  const [savingLayout, setSavingLayout] = useState(false);
  const [savingLayer, setSavingLayer] = useState<string | null>(null);

  const areas = useMemo(() => {
    const map = new Map<string, { name: string; layers: typeof farm.layers }>();
    for (const l of farm.layers) {
      const key = l.area_id ?? "default";
      if (!map.has(key)) map.set(key, { name: l.area_name ?? key, layers: [] });
      map.get(key)!.layers.push(l);
    }
    return Array.from(map.entries());
  }, [farm.layers]);

  const [selectedArea, setSelectedArea] = usePersistentString("croptwin_layer_detail_area", areas[0]?.[0] ?? "area_a");
  const currentAreaLayers = areas.find(([id]) => id === selectedArea)?.[1]?.layers ?? [];
  const [selectedLayer, setSelectedLayer] = usePersistentString("croptwin_layer_detail_layer", currentAreaLayers[0]?.id ?? "");
  const validSelectedLayer = currentAreaLayers.find(l => l.id === selectedLayer) ? selectedLayer : currentAreaLayers[0]?.id ?? "";
  const selectedLayerData = farm.layers.find((layer) => layer.id === validSelectedLayer);

  async function refreshSetupData() {
    const [setupData, layoutData] = await Promise.all([
      api.getYieldSetup(),
      api.getFarmLayout(),
    ]);
    setSetup(setupData);
    setLayout(layoutData);
    setLayoutDraft(layoutData);
    setDrafts(Object.fromEntries(setupData.setups.map((item) => [item.layer_id, item])));
  }

  useEffect(() => {
    let alive = true;
    refreshSetupData()
      .catch((error) => console.error("Layer setup failed", error))
      .finally(() => { if (alive) setSetupLoading(false); });
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
      await refreshSetupData();
    } catch (error) {
      console.error("Yield setup update failed", error);
    } finally {
      setSavingLayer(null);
    }
  }

  async function saveLayout() {
    setSavingLayout(true);
    try {
      await api.updateFarmLayout(layoutDraft);
      await refreshSetupData();
      window.location.reload();
    } catch (error) {
      console.error("Farm layout update failed", error);
    } finally {
      setSavingLayout(false);
    }
  }

  return (
    <div className="grid gap-6 animate-fade-in">
      <h2 className="text-2xl font-semibold text-ink">Layer Detail</h2>

      {/* Area tabs */}
      <div className="flex gap-2">
        {areas.map(([id, area]) => (
          <button
            key={id}
            onClick={() => { setSelectedArea(id); const first = areas.find(([aid]) => aid === id)?.[1]?.layers[0]; if (first) setSelectedLayer(first.id); }}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={selectedArea === id
              ? { backgroundColor: "#228B22", color: "#FFFFFF" }
              : { backgroundColor: "#EAF5EA", color: "#000000", border: "1px solid #B3D4B3" }
            }
          >
            {area.name.split("—")[0].trim()}
          </button>
        ))}
      </div>

      {/* Layer cards */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 stagger">
        {currentAreaLayers.map((layer) => (
          <div
            key={layer.id}
            onClick={() => setSelectedLayer(layer.id)}
            className={`cursor-pointer transition-all duration-300 ${validSelectedLayer === layer.id ? "ring-2 ring-forest-green rounded-xl scale-[1.02]" : "opacity-60 hover:opacity-80"}`}
          >
            <LayerCard layer={layer} />
          </div>
        ))}
      </div>

      {selectedLayerData?.latest_reading && (
        <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Layer Health & Nutrient Context</p>
            <h3 className="mt-1 text-lg font-semibold text-ink">{selectedLayerData.name} · {selectedLayerData.crop}</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {[
              { label: "Crop Health", value: `${selectedLayerData.health_score}/100`, detail: selectedLayerData.status },
              { label: "pH", value: selectedLayerData.latest_reading.ph.toFixed(2), detail: "Nutrient uptake" },
              { label: "Water Level", value: `${selectedLayerData.latest_reading.water_level.toFixed(0)}%`, detail: "Reservoir" },
              { label: "Moisture", value: `${selectedLayerData.latest_reading.soil_moisture.toFixed(0)}%`, detail: "Root zone" },
              { label: "LED", value: `${selectedLayerData.devices.led_intensity}%`, detail: selectedLayerData.devices.auto_mode ? "AI target" : "Manual target" },
            ].map((item) => (
              <div key={item.label} className="rounded-md border border-card-border bg-field-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{item.label}</p>
                <p className="mt-1 text-xl font-semibold text-ink">{item.value}</p>
                <p className="mt-1 text-xs text-muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <ChartsPanel
        data={getLayerChartData(validSelectedLayer)}
        layerLabel={selectedLayerData ? `${selectedLayerData.name} · ${selectedLayerData.crop}` : undefined}
      />

      {setupLoading || !setup || !layout ? (
        <section className="rounded-lg border border-card-border bg-white p-5 text-sm text-muted shadow-card">
          Loading layer setup...
        </section>
      ) : (
        <>
          <details className="group rounded-lg border border-card-border bg-white p-5 shadow-card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-forest-green">
                <Save size={17} />
                <h3 className="text-sm font-semibold text-ink">Owner Farm Layout</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-card-border bg-field-bg px-3 py-1.5 text-xs font-semibold text-muted">
                  {layout.total_layers ?? farm.layers.length} active layers
                </span>
                <ChevronDown size={18} className="text-forest-green transition-transform group-open:rotate-180" />
              </div>
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Areas
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={layoutDraft.area_count}
                  onChange={(event) => setLayoutDraft((current) => ({ ...current, area_count: Number(event.target.value) }))}
                  className="rounded-md border border-card-border px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Layers per Area
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={layoutDraft.layers_per_area}
                  onChange={(event) => setLayoutDraft((current) => ({ ...current, layers_per_area: Number(event.target.value) }))}
                  className="rounded-md border border-card-border px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Default Crop
                <select
                  value={layoutDraft.default_crop}
                  onChange={(event) => setLayoutDraft((current) => ({ ...current, default_crop: event.target.value }))}
                  className="rounded-md border border-card-border bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink"
                >
                  {setup.available_crops.map((crop) => <option key={crop} value={crop}>{crop}</option>)}
                </select>
              </label>
              <button
                type="button"
                onClick={saveLayout}
                disabled={savingLayout}
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-forest-green px-4 text-xs font-semibold text-white transition hover:bg-dark-green disabled:opacity-60"
              >
                <Save size={14} />
                {savingLayout ? "Applying" : "Apply Layout"}
              </button>
            </div>
          </details>

          <details className="group rounded-lg border border-card-border bg-white p-5 shadow-card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-forest-green">
                <Save size={17} />
                <h3 className="text-sm font-semibold text-ink">Manual Farm Setup</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-card-border bg-field-bg px-3 py-1.5 text-xs font-semibold text-muted">
                  Crop count and market price are farmer inputs
                </span>
                <ChevronDown size={18} className="text-forest-green transition-transform group-open:rotate-180" />
              </div>
            </summary>
            <div className="mt-4 overflow-x-auto rounded-lg border border-card-border">
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
                  {setup.setups.map((item) => {
                    const draft = drafts[item.layer_id];
                    const totalPlants = (draft?.rows ?? 0) * (draft?.columns ?? 0) * (draft?.rack_layers ?? 0);
                    return (
                      <tr key={item.layer_id} className="border-t border-card-border">
                        <td className="p-3 font-semibold text-ink">{item.layer_id}</td>
                        <td className="p-3">
                          <select
                            value={draft?.crop ?? item.crop}
                            onChange={(event) => updateDraft(item.layer_id, "crop", event.target.value)}
                            onBlur={() => saveSetup(item.layer_id)}
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
                              onChange={(event) => updateDraft(item.layer_id, field, event.target.value)}
                              onBlur={() => saveSetup(item.layer_id)}
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
                            onChange={(event) => updateDraft(item.layer_id, "farm_area_m2", event.target.value)}
                            onBlur={() => saveSetup(item.layer_id)}
                            className="w-24 rounded-md border border-card-border px-2 py-1.5 text-sm text-ink"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={draft?.price_rm_per_kg ?? 0}
                            onChange={(event) => updateDraft(item.layer_id, "price_rm_per_kg", event.target.value)}
                            onBlur={() => saveSetup(item.layer_id)}
                            className="w-24 rounded-md border border-card-border px-2 py-1.5 text-sm text-ink"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min={0}
                            step="0.001"
                            value={draft?.expected_kg_per_plant ?? 0}
                            onChange={(event) => updateDraft(item.layer_id, "expected_kg_per_plant", event.target.value)}
                            onBlur={() => saveSetup(item.layer_id)}
                            className="w-24 rounded-md border border-card-border px-2 py-1.5 text-sm text-ink"
                          />
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => saveSetup(item.layer_id)}
                            disabled={savingLayer === item.layer_id}
                            className="inline-flex items-center gap-2 rounded-md bg-forest-green px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-dark-green disabled:opacity-60"
                          >
                            <Save size={13} />
                            {savingLayer === item.layer_id ? "Saving" : "Save"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
