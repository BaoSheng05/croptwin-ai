import { useOutletContext } from "react-router-dom";
import { useState, useMemo } from "react";
import { LayerCard } from "../components/LayerCard";
import { ChartsPanel } from "../components/ChartsPanel";
import { DiagnosisPanel } from "../components/DiagnosisPanel";
import type { FarmStreamContext } from "../App";

export default function LayerDetailPage() {
  const { farm, chartData } = useOutletContext<FarmStreamContext>();

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
  const areaLayers = areas.find(([id]) => id === selectedArea)?.[1]?.layers ?? [];
  const [selectedLayer, setSelectedLayer] = useState(areaLayers[0]?.id ?? "");

  // Update selected layer when area changes
  const currentAreaLayers = areas.find(([id]) => id === selectedArea)?.[1]?.layers ?? [];
  const validSelectedLayer = currentAreaLayers.find(l => l.id === selectedLayer) ? selectedLayer : currentAreaLayers[0]?.id ?? "";

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Layer Detail</h2>
      </div>

      {/* Area tabs */}
      <div className="flex gap-2">
        {areas.map(([id, area]) => (
          <button
            key={id}
            onClick={() => { setSelectedArea(id); const first = areas.find(([aid]) => aid === id)?.[1]?.layers[0]; if (first) setSelectedLayer(first.id); }}
            className={`rounded-md px-4 py-2 text-sm transition-colors ${selectedArea === id ? "bg-mint text-ink font-medium" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
          >
            {area.name.split("—")[0].trim()}
          </button>
        ))}
      </div>

      {/* Layer selector */}
      <div className="flex gap-2 flex-wrap">
        {currentAreaLayers.map(l => (
          <button
            key={l.id}
            onClick={() => setSelectedLayer(l.id)}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors ${validSelectedLayer === l.id ? "bg-white/10 text-white ring-1 ring-mint/30" : "bg-white/5 text-white/50 hover:text-white"}`}
          >
            {l.name} ({l.crop})
          </button>
        ))}
      </div>

      {/* Layer cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {currentAreaLayers.map((layer) => (
          <div
            key={layer.id}
            onClick={() => setSelectedLayer(layer.id)}
            className={`cursor-pointer transition ${validSelectedLayer === layer.id ? "ring-2 ring-mint rounded-xl" : "opacity-60 grayscale-[0.3]"}`}
          >
            <LayerCard layer={layer} />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <DiagnosisPanel layerId={validSelectedLayer} />
      </div>

      <div className="mt-4">
        <ChartsPanel data={chartData} />
      </div>
    </div>
  );
}
