import { useCallback, useMemo, useState } from "react";
import type { YieldForecastLayer } from "../types";

const HARVEST_KEY = "croptwin_harvested_layers_v1";

export type HarvestLog = {
  id: string;
  layer_id: string;
  layer_name: string;
  crop: string;
  kg: number;
  revenue_rm: number;
  harvested_at: string;
};

function loadHarvestLogs(): HarvestLog[] {
  try {
    return JSON.parse(localStorage.getItem(HARVEST_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHarvestLogs(logs: HarvestLog[]) {
  localStorage.setItem(HARVEST_KEY, JSON.stringify(logs));
}

export function useHarvestLogs() {
  const [harvestLogs, setHarvestLogs] = useState<HarvestLog[]>(() => loadHarvestLogs());
  const harvestedIds = useMemo(() => new Set(harvestLogs.map((item) => item.layer_id)), [harvestLogs]);

  const markHarvested = useCallback((layer: YieldForecastLayer) => {
    if (!layer.can_mark_harvested) return;
    setHarvestLogs((current) => {
      const next: HarvestLog[] = [
        {
          id: `${layer.layer_id}:${Date.now()}`,
          layer_id: layer.layer_id,
          layer_name: layer.layer_name,
          crop: layer.crop,
          kg: layer.estimated_kg,
          revenue_rm: layer.estimated_revenue_rm,
          harvested_at: new Date().toISOString(),
        },
        ...current.filter((item) => item.layer_id !== layer.layer_id),
      ];
      saveHarvestLogs(next);
      return next;
    });
  }, []);

  const clearHarvestLog = useCallback((id: string) => {
    setHarvestLogs((current) => {
      const next = current.filter((item) => item.id !== id);
      saveHarvestLogs(next);
      return next;
    });
  }, []);

  return { harvestLogs, harvestedIds, markHarvested, clearHarvestLog };
}
