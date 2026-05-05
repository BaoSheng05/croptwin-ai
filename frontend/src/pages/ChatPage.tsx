import { useOutletContext } from "react-router-dom";
import { ChatPanel } from "../components/ChatPanel";
import type { FarmStreamContext } from "../App";
import { useState, useMemo } from "react";
import { Bot, Sparkles } from "lucide-react";

export default function ChatPage() {
  const { farm, chat } = useOutletContext<FarmStreamContext>();

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
    <div className="grid gap-6 animate-fade-in">
      <h2 className="text-2xl font-semibold text-ink">Chat-to-Farm Assistant</h2>

      {/* Header info */}
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-spring-green/30 text-forest-green">
          <Sparkles size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Powered by configured LLM</p>
          <p className="text-xs text-muted">Ask anything about your farm data</p>
        </div>
      </div>

      {/* Area tabs */}
      <div className="flex gap-2">
        {areas.map(([id, area]) => (
          <button
            key={id}
            onClick={() => { setSelectedArea(id); const first = areas.find(([aid]) => aid === id)?.[1]?.layers[0]; if (first) setSelected(first.id); }}
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

      {/* Layer selector */}
      <div className="flex gap-2 flex-wrap">
        {currentLayers.map(l => (
          <button
            key={l.id}
            onClick={() => setSelected(l.id)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={validSelected === l.id
              ? { backgroundColor: "#006400", color: "#FFFFFF" }
              : { backgroundColor: "#F0F7F0", color: "#2D4A2D", border: "1px solid #B3D4B3" }
            }
          >
            {l.name} · {l.crop}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">
        {selectedLayer && <ChatPanel key={selectedLayer.id} layer={selectedLayer} chat={chat} />}
      </div>
    </div>
  );
}
