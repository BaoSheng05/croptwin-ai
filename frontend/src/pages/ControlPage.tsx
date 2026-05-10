import { useOutletContext } from "react-router-dom";
import { AIControlActivity } from "../components/AIControlActivity";
import { ControlPanel } from "../components/ControlPanel";
import { api } from "../services/api";
import type { FarmStreamContext } from "../App";
import type { AIControlDecision } from "../types";
import { useCallback, useMemo, useState } from "react";
import { Power, RefreshCw, Sparkles } from "lucide-react";
import { usePersistentString } from "../hooks/usePersistentState";

export default function ControlPage() {
  const { farm, sendCommand, executeSafeCommand, refresh } = useOutletContext<FarmStreamContext>();
  const [aiDecisions, setAiDecisions] = useState<Record<string, AIControlDecision>>({});
  const [enablingAll, setEnablingAll] = useState(false);

  const areas = useMemo(() => {
    const map = new Map<string, { name: string; layers: typeof farm.layers }>();
    for (const l of farm.layers) {
      const key = l.area_id ?? "default";
      if (!map.has(key)) map.set(key, { name: l.area_name ?? key, layers: [] });
      map.get(key)!.layers.push(l);
    }
    return Array.from(map.entries());
  }, [farm.layers]);

  const [selectedArea, setSelectedArea] = usePersistentString("croptwin_control_area", areas[0]?.[0] ?? "area_a");
  const currentLayers = areas.find(([id]) => id === selectedArea)?.[1]?.layers ?? [];
  const [selected, setSelected] = usePersistentString("croptwin_control_layer", currentLayers[0]?.id ?? "");
  const validSelected = currentLayers.find(l => l.id === selected) ? selected : currentLayers[0]?.id ?? "";
  const selectedLayer = farm.layers.find(l => l.id === validSelected) || farm.layers[0];
  const autoLayerCount = farm.layers.filter((layer) => layer.devices.auto_mode).length;

  const applyAiDecisionCommands = useCallback(async (decision: AIControlDecision, force = false) => {
    const layer = farm.layers.find((item) => item.id === decision.layer_id);
    if (!layer || (!force && !layer.devices.auto_mode)) return;

    for (const command of decision.commands) {
      if (command.device === "none") continue;
      if (command.device === "led_intensity") {
        if (typeof command.value !== "number" || layer.devices.led_intensity === command.value) continue;
        await executeSafeCommand(decision.layer_id, "led_intensity", command.value);
        continue;
      }

      if (command.device === "climate_heating" || command.device === "climate_cooling") {
        const level = typeof command.value === "number" ? command.value : command.value ? 1 : 0;
        if (layer.devices[command.device] === level) continue;
        await executeSafeCommand(decision.layer_id, command.device, level, command.duration_minutes ?? undefined);
        continue;
      }

      if (!["fan", "pump", "misting"].includes(command.device)) continue;
      if (typeof command.value !== "boolean") continue;
      if (layer.devices[command.device] === command.value) continue;
      await executeSafeCommand(decision.layer_id, command.device, command.value, command.duration_minutes ?? undefined);
    }
  }, [executeSafeCommand, farm.layers]);

  const handleAiDecision = useCallback((decision: AIControlDecision) => {
    setAiDecisions((current) => {
      const previous = current[decision.layer_id];
      if (previous?.mode === "deepseek" && decision.mode === "ai_error") return current;
      return { ...current, [decision.layer_id]: decision };
    });
    void applyAiDecisionCommands(decision);
  }, [applyAiDecisionCommands]);

  const handleCommand = useCallback(async (layerId: string, device: string, value: boolean | number) => {
    if (device === "auto_mode" && value === true) {
      const result = await sendCommand(layerId, device, value);
      void (async () => {
        try {
          const decision = await api.aiControlDecision(layerId);
          setAiDecisions((current) => {
            const previous = current[layerId];
            if (previous?.mode === "deepseek" && decision.mode === "ai_error") return current;
            return { ...current, [layerId]: decision };
          });
          await applyAiDecisionCommands(decision, true);
        } catch (error) {
          console.error("AI control decision failed", error);
        }
      })();
      return result;
    }

    return sendCommand(layerId, device, value);
  }, [applyAiDecisionCommands, sendCommand]);

  const handleEnableAllAiControl = useCallback(async () => {
    setEnablingAll(true);
    try {
      await api.enableAiControlAll();
      await refresh();
    } finally {
      setEnablingAll(false);
    }
  }, [refresh]);

  return (
    <div className="grid gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Control Panel</h2>
          <p className="mt-1 text-xs text-muted">
            {autoLayerCount}/{farm.layers.length} layers are in AI Control mode.
          </p>
        </div>
        <button
          type="button"
          onClick={handleEnableAllAiControl}
          disabled={enablingAll || autoLayerCount === farm.layers.length}
          className="inline-flex items-center gap-2 rounded-md border border-purple-400/30 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
          title="Enable AI Control for every area and layer"
        >
          {enablingAll ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {enablingAll ? "Enabling AI Control..." : autoLayerCount === farm.layers.length ? "All Layers in AI Control" : "Enable AI Control for All"}
          {!enablingAll && <Power size={15} />}
        </button>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,576px)_minmax(420px,1fr)]">
        {selectedLayer && <ControlPanel layer={selectedLayer} onCommand={handleCommand} />}
        {selectedLayer && (
          <AIControlActivity
            layer={selectedLayer}
            decision={aiDecisions[selectedLayer.id]}
            onDecision={handleAiDecision}
          />
        )}
      </div>

    </div>
  );
}
