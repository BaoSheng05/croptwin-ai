import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type { HarvestLog, YieldForecastLayer } from "../types";

export function useHarvestLogs() {
  const [harvestLogs, setHarvestLogs] = useState<HarvestLog[]>([]);
  const harvestedIds = useMemo(() => new Set(harvestLogs.map((item) => item.layer_id)), [harvestLogs]);

  const refreshHarvestLogs = useCallback(() => {
    api.getHarvestLogs()
      .then(setHarvestLogs)
      .catch((error) => console.error("Harvest logs failed", error));
  }, []);

  useEffect(() => {
    refreshHarvestLogs();
  }, [refreshHarvestLogs]);

  const markHarvested = useCallback((layer: YieldForecastLayer) => {
    if (!layer.can_mark_harvested) return;
    api.createHarvestLog({
      layer_id: layer.layer_id,
      layer_name: layer.layer_name,
      crop: layer.crop,
      kg: layer.estimated_kg,
      revenue_rm: layer.estimated_revenue_rm,
    })
      .then((created) => {
        setHarvestLogs((current) => [created, ...current.filter((item) => item.layer_id !== layer.layer_id)]);
      })
      .catch((error) => console.error("Create harvest log failed", error));
  }, []);

  const clearHarvestLog = useCallback((id: string) => {
    api.deleteHarvestLog(id)
      .then(() => setHarvestLogs((current) => current.filter((item) => item.id !== id)))
      .catch((error) => console.error("Delete harvest log failed", error));
  }, []);

  return { harvestLogs, harvestedIds, markHarvested, clearHarvestLog };
}
