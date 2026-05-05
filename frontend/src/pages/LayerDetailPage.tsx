import { useOutletContext } from "react-router-dom";
import { useState, useMemo } from "react";
import { LayerCard } from "../components/LayerCard";
import { ChartsPanel } from "../components/ChartsPanel";
import { DiagnosisPanel } from "../components/DiagnosisPanel";
import { AIDiagnosisPanel } from "../components/AIDiagnosisPanel";
import type { FarmStreamContext } from "../App";

export default function LayerDetailPage() {
  const { farm, getLayerChartData } = useOutletContext<FarmStreamContext>();

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
  const currentAreaLayers = areas.find(([id]) => id === selectedArea)?.[1]?.layers ?? [];
  const [selectedLayer, setSelectedLayer] = useState(currentAreaLayers[0]?.id ?? "");
  const validSelectedLayer = currentAreaLayers.find(l => l.id === selectedLayer) ? selectedLayer : currentAreaLayers[0]?.id ?? "";
  const selectedLayerData = farm.layers.find((layer) => layer.id === validSelectedLayer);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Area tabs */}
      <div className="flex gap-2">
        {areas.map(([id, area]) => (
          <button
            key={id}
            onClick={() => { setSelectedArea(id); const first = areas.find(([aid]) => aid === id)?.[1]?.layers[0]; if (first) setSelectedLayer(first.id); }}
            className={`rounded-full px-4 py-2 text-[12px] font-medium transition-all ${selectedArea === id ? "bg-mint/[0.1] text-mint border border-mint/20" : "bg-white/[0.02] text-white/30 border border-white/[0.04] hover:text-white/50"}`}
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
            className={`cursor-pointer transition-all duration-300 ${validSelectedLayer === layer.id ? "ring-1 ring-mint/30 rounded-2xl scale-[1.02]" : "opacity-50 hover:opacity-80"}`}
          >
            <LayerCard layer={layer} />
          </div>
        ))}
      </div>

      <AIDiagnosisPanel layerId={validSelectedLayer} />
      <ChartsPanel
        data={getLayerChartData(validSelectedLayer)}
        layerLabel={selectedLayerData ? `${selectedLayerData.name} · ${selectedLayerData.crop}` : undefined}
      />
    </div>
  );
}
