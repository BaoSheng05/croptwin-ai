/**
 * Manages the lifecycle of recommendation resolution.
 * Lives at the Layout level so state persists across page navigation.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "../services/api";
import type { CropRecipes, FarmLayer, Recommendation } from "../types";
import { usePersistentState } from "./usePersistentState";
import { parseActionDevice } from "../utils/recommendationParser";
import {
  buildSolvedDesc,
  hasRecovered,
  ledResolutionMetric,
  readMetric,
  resolutionMetric,
  resolveProgress,
  targetValue,
  type ResolvingEntry,
} from "../utils/recommendationProgress";

const SOLVED_KEY = "croptwin_solved_suggestions_v2";
const RESOLVING_KEY = "croptwin_resolving_recs_v2";
const HIDDEN_KEY = "croptwin_hidden_recs_v2";
const DAY_MS = 24 * 60 * 60 * 1000;

export { parseActionDevice, resolveProgress };
export type { ResolvingEntry };

export type SolvedSuggestion = {
  id: string;
  recId: string;
  layerId: string;
  layerName: string;
  areaName: string;
  crop: string;
  action: string;
  resolvedDescription: string;
  solvedAt: string;
};

function recentSolved(items: SolvedSuggestion[]) {
  return items.filter((item) => Date.now() - new Date(item.solvedAt).getTime() < DAY_MS);
}

function deviceIsActive(layer: FarmLayer | undefined, device: string): boolean {
  if (!layer) return false;
  if (device === "led_intensity") return true;
  return layer.devices[device as keyof FarmLayer["devices"]] === true;
}

function recommendationKey(rec: Recommendation) {
  return `${rec.layer_id}:${rec.action}`;
}

export function useResolveManager(layers: FarmLayer[], activeRecommendations: Recommendation[] = []) {
  const [recipes, setRecipes] = useState<CropRecipes>({});
  const [resolving, setResolving] = usePersistentState<ResolvingEntry[]>(RESOLVING_KEY, []);
  const [solved, setSolved] = usePersistentState<SolvedSuggestion[]>(SOLVED_KEY, () => recentSolved([]));
  const [hiddenRecs, setHiddenRecs] = usePersistentState<Record<string, string>>(HIDDEN_KEY, {});
  const previousRecommendationsRef = useRef<Recommendation[] | null>(null);

  useEffect(() => {
    api.getRecipes().then(setRecipes).catch(() => setRecipes({}));
  }, []);

  useEffect(() => {
    setSolved((current) => recentSolved(current));
  }, [setSolved]);

  useEffect(() => {
    if (layers.length === 0) return;
    setResolving((current) => current.filter((entry) => deviceIsActive(layers.find((layer) => layer.id === entry.layerId), entry.device)));
  }, [layers, setResolving]);

  useEffect(() => {
    if (layers.length === 0) return;
    const activeLayerDevices = new Set(
      activeRecommendations
        .map((rec) => {
          const parsed = parseActionDevice(rec.action);
          return parsed ? `${rec.layer_id}:${parsed.device}` : null;
        })
        .filter(Boolean),
    );

    setResolving((current) => current.filter((entry) => {
      if (activeLayerDevices.has(`${entry.layerId}:${entry.device}`)) return true;
      return deviceIsActive(layers.find((layer) => layer.id === entry.layerId), entry.device);
    }));
  }, [activeRecommendations, layers, setResolving]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSolved((current) => recentSolved(current));
      setHiddenRecs((current) => Object.fromEntries(
        Object.entries(current).filter(([, timestamp]) => Date.now() - new Date(timestamp).getTime() < DAY_MS),
      ));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [setHiddenRecs, setSolved]);

  useEffect(() => {
    if (resolving.length === 0) return;

    const still: ResolvingEntry[] = [];
    const fresh: SolvedSuggestion[] = [];

    for (const entry of resolving) {
      const layer = layers.find((item) => item.id === entry.layerId);
      const value = readMetric(layer?.latest_reading, entry.metric);
      if (value === null) {
        still.push(entry);
        continue;
      }

      if (hasRecovered(entry.metric, value, entry.midpoint, entry.device)) {
        if (entry.device !== "led_intensity") {
          api.executeSafeCommand(entry.layerId, entry.device, false, 0).catch((error) => console.error(error));
        }
        const solvedAt = new Date().toISOString();
        fresh.push({
          id: `${entry.recId}_${Date.now()}`,
          recId: entry.recId,
          layerId: entry.layerId,
          layerName: entry.layerName,
          areaName: entry.areaName,
          crop: entry.crop,
          action: entry.action,
          resolvedDescription: buildSolvedDesc(entry, value),
          solvedAt,
        });
        setHiddenRecs((current) => ({ ...current, [`${entry.layerId}:${entry.action}`]: solvedAt }));
        continue;
      }

      if (!deviceIsActive(layer, entry.device)) continue;
      const progress = resolveProgress(entry, layer);
      still.push(progress === null ? entry : { ...entry, bestProgress: Math.max(entry.bestProgress ?? 0, progress) });
    }

    if (fresh.length > 0) {
      setResolving(still);
      setSolved((current) => {
        const freshKeys = new Set(fresh.map((item) => `${item.layerId}:${item.action}`));
        return [...fresh, ...current.filter((item) => !freshKeys.has(`${item.layerId}:${item.action}`))];
      });
    } else if (still.some((item, index) => item.bestProgress !== resolving[index]?.bestProgress)) {
      setResolving(still);
    }
  }, [layers, resolving, setHiddenRecs, setResolving, setSolved]);

  useEffect(() => {
    const previous = previousRecommendationsRef.current;
    previousRecommendationsRef.current = activeRecommendations;
    if (!previous || layers.length === 0) return;

    const activeKeys = new Set(activeRecommendations.map(recommendationKey));
    const solvedAt = new Date().toISOString();
    const fresh: SolvedSuggestion[] = [];

    for (const rec of previous) {
      if (activeKeys.has(recommendationKey(rec)) || rec.priority === "low") continue;

      const parsed = parseActionDevice(rec.action);
      const layer = layers.find((item) => item.id === rec.layer_id);
      if (!parsed || !layer) continue;

      const metric = resolutionMetric(rec, parsed.metric);
      const midpoint = targetValue(recipes, layer.crop, metric);
      const value = readMetric(layer.latest_reading, metric);
      if (midpoint === null || value === null || !hasRecovered(metric, value, midpoint, parsed.device)) continue;

      const entry: ResolvingEntry = {
        recId: rec.id,
        layerId: rec.layer_id,
        crop: layer.crop,
        layerName: layer.name,
        areaName: layer.area_name,
        action: rec.action,
        device: parsed.device,
        metric,
        midpoint,
      };
      fresh.push({
        id: `${rec.id}_auto_${Date.now()}`,
        recId: rec.id,
        layerId: rec.layer_id,
        layerName: layer.name,
        areaName: layer.area_name,
        crop: layer.crop,
        action: rec.action,
        resolvedDescription: buildSolvedDesc(entry, value),
        solvedAt,
      });
    }

    if (fresh.length === 0) return;

    setSolved((current) => {
      const freshKeys = new Set(fresh.map((item) => `${item.layerId}:${item.action}`));
      return [...fresh, ...current.filter((item) => !freshKeys.has(`${item.layerId}:${item.action}`))];
    });
    setHiddenRecs((current) => {
      const next = { ...current };
      for (const item of fresh) next[`${item.layerId}:${item.action}`] = item.solvedAt;
      return next;
    });
  }, [activeRecommendations, layers, recipes, setHiddenRecs, setSolved]);

  const resolveSingle = useCallback(async (rec: Recommendation, layersList: FarmLayer[]) => {
    const parsed = parseActionDevice(rec.action);
    const layer = layersList.find((item) => item.id === rec.layer_id);
    if (!parsed || !layer) return;

    const metric = parsed.device === "led_intensity"
      ? ledResolutionMetric(rec)
      : resolutionMetric(rec, parsed.metric);
    const midpoint = targetValue(recipes, layer.crop, metric);
    if (midpoint === null) return;

    if (parsed.device === "led_intensity") {
      if (typeof parsed.value !== "number") return;
      await api.executeSafeCommand(rec.layer_id, "led_intensity", parsed.value);
    } else {
      await api.executeSafeCommand(rec.layer_id, parsed.device, true, parsed.duration);
    }

    setResolving((current) => {
      const filtered = current.filter((entry) => !(entry.layerId === rec.layer_id && entry.device === parsed.device));
      return [
        ...filtered,
        {
          recId: rec.id,
          layerId: rec.layer_id,
          crop: layer.crop,
          layerName: layer.name,
          areaName: layer.area_name,
          action: rec.action,
          device: parsed.device,
          metric,
          midpoint,
          startValue: readMetric(layer.latest_reading, metric) ?? undefined,
          bestProgress: 0,
          startedAt: new Date().toISOString(),
        },
      ];
    });
  }, [recipes, setResolving]);

  const resolveAll = useCallback(async (recs: Recommendation[], layersList: FarmLayer[], refresh: () => Promise<void>) => {
    for (const rec of recs) {
      if (!parseActionDevice(rec.action)) continue;
      try {
        await resolveSingle(rec, layersList);
      } catch (error) {
        console.error("resolveSingle failed:", error);
      }
    }
    await api.autoResolveAlerts();
    await refresh();
  }, [resolveSingle]);

  const clearSolved = useCallback(() => setSolved([]), [setSolved]);
  const deleteSolved = useCallback((id: string) => {
    setSolved((current) => current.filter((item) => item.id !== id));
  }, [setSolved]);

  const resolvingIds = useMemo(() => new Set(resolving.map((entry) => entry.recId)), [resolving]);
  const resolvingLayerDevices = useMemo(() => new Set(resolving.map((entry) => `${entry.layerId}:${entry.device}`)), [resolving]);

  const isResolving = useCallback((rec: Recommendation) => {
    if (resolvingIds.has(rec.id)) return true;
    const parsed = parseActionDevice(rec.action);
    return parsed ? resolvingLayerDevices.has(`${rec.layer_id}:${parsed.device}`) : false;
  }, [resolvingIds, resolvingLayerDevices]);

  const getResolvingProgress = useCallback((rec: Recommendation) => {
    const parsed = parseActionDevice(rec.action);
    const entry = resolving.find((item) =>
      item.recId === rec.id || (parsed && item.layerId === rec.layer_id && item.device === parsed.device)
    );
    if (!entry) return null;
    return resolveProgress(entry, layers.find((layer) => layer.id === entry.layerId));
  }, [layers, resolving]);

  const isHiddenRecommendation = useCallback((rec: Recommendation) => {
    const timestamp = hiddenRecs[recommendationKey(rec)];
    return timestamp ? Date.now() - new Date(timestamp).getTime() < DAY_MS : false;
  }, [hiddenRecs]);

  const isAutomatable = useCallback((rec: Recommendation) => {
    return parseActionDevice(rec.action) !== null;
  }, []);

  return {
    resolving,
    solved,
    hiddenRecs,
    resolveSingle,
    resolveAll,
    clearSolved,
    deleteSolved,
    isResolving,
    getResolvingProgress,
    isHiddenRecommendation,
    isAutomatable,
  };
}
