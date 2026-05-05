import { useOutletContext } from "react-router-dom";
import { ControlPanel } from "../components/ControlPanel";
import type { FarmStreamContext } from "../App";
import { useState, useMemo } from "react";

export default function ControlPage() {
  const { farm, sendCommand } = useOutletContext<FarmStreamContext>();

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
  const [selected, setSelected] = useState(currentLayers[0]?.id ?? "");

  const validSelected = currentLayers.find(l => l.id === selected) ? selected : currentLayers[0]?.id ?? "";
  const selectedLayer = farm.layers.find(l => l.id === validSelected) || farm.layers[0];

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold text-white">Control Panel</h2>

      {/* Area tabs */}
      <div className="flex gap-2">
        {areas.map(([id, area]) => (
          <button
            key={id}
            onClick={() => { setSelectedArea(id); const first = areas.find(([aid]) => aid === id)?.[1]?.layers[0]; if (first) setSelected(first.id); }}
            className={`rounded-md px-4 py-2 text-sm transition-colors ${selectedArea === id ? "bg-mint text-ink font-medium" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
          >
            {area.name.split("—")[0].trim()}
          </button>
        ))}
      </div>

      {/* Layer selector */}
      <div className="flex gap-2 flex-wrap">
        {currentLayers.map(l => (
          <button
            key={l.id}
            onClick={() => setSelected(l.id)}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors ${validSelected === l.id ? "bg-white/10 text-white ring-1 ring-mint/30" : "bg-white/5 text-white/50 hover:text-white"}`}
          >
            {l.name} ({l.crop})
          </button>
        ))}
      </div>

      <div className="max-w-xl">
        {selectedLayer && <ControlPanel layer={selectedLayer} onCommand={sendCommand} />}
      </div>
    </div>
  );
}
