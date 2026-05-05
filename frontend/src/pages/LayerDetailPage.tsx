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

      <AIDiagnosisPanel layerId={validSelectedLayer} />
      <ChartsPanel
        data={getLayerChartData(validSelectedLayer)}
        layerLabel={selectedLayerData ? `${selectedLayerData.name} · ${selectedLayerData.crop}` : undefined}
      />
    </div>
  );
}
