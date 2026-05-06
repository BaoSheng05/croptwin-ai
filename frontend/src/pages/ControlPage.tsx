import { useOutletContext } from "react-router-dom";
import { AIControlActivity } from "../components/AIControlActivity";
import { ControlPanel } from "../components/ControlPanel";
import { api } from "../services/api";
import type { FarmStreamContext } from "../App";
import type { AIControlDecision } from "../types";
import { useCallback, useMemo, useState } from "react";

export default function ControlPage() {
  const { farm, sendCommand } = useOutletContext<FarmStreamContext>();
  const [aiDecisions, setAiDecisions] = useState<Record<string, AIControlDecision>>({});

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
  const rememberDecision = useCallback((decision: AIControlDecision) => {
    setAiDecisions((current) => ({ ...current, [decision.layer_id]: decision }));
  }, []);

  const handleCommand = useCallback(async (layerId: string, device: string, value: boolean | number) => {
    if (device === "auto_mode" && value === true) {
      const decision = await api.aiControlDecision(layerId);
      rememberDecision(decision);
      const ledTarget = decision.commands.find((command) => command.device === "led_intensity");
      if (typeof ledTarget?.value === "number") {
        await sendCommand(layerId, "led_intensity", ledTarget.value);
      }
    }

    return sendCommand(layerId, device, value);
  }, [rememberDecision, sendCommand]);

  return (
    <div className="grid gap-6 animate-fade-in">
      <h2 className="text-2xl font-semibold text-ink">Control Panel</h2>

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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,576px)_minmax(420px,1fr)]">
        {selectedLayer && <ControlPanel layer={selectedLayer} onCommand={handleCommand} />}
        {selectedLayer && (
          <AIControlActivity
            layer={selectedLayer}
            decision={aiDecisions[selectedLayer.id]}
            onDecision={rememberDecision}
          />
        )}
      </div>
    </div>
  );
}
