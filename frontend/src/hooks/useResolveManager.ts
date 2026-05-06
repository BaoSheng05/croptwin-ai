/**
 * Manages the lifecycle of recommendation resolution.
 * Lives at the Layout level so state persists across page navigation.
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import type { FarmLayer, Recommendation } from "../types";

const SOLVED_KEY = "croptwin_solved_suggestions";
const RESOLVING_KEY = "croptwin_resolving_recs";
const HIDDEN_KEY = "croptwin_hidden_recs";
const DAY_MS = 24 * 60 * 60 * 1000;

// Crop recipe ranges — must match backend store.py
const RECIPES: Record<string, Record<string, [number, number]>> = {
  Lettuce:    { moisture: [55, 80], humidity: [50, 70], temperature: [16, 24], light: [400, 750] },
  Basil:      { moisture: [45, 70], humidity: [40, 60], temperature: [21, 28], light: [500, 900] },
  Strawberry: { moisture: [50, 75], humidity: [45, 65], temperature: [18, 26], light: [650, 1000] },
  Spinach:    { moisture: [50, 75], humidity: [45, 65], temperature: [15, 22], light: [350, 700] },
  Mint:       { moisture: [55, 80], humidity: [50, 70], temperature: [18, 25], light: [400, 800] },
  Tomato:     { moisture: [50, 70], humidity: [40, 60], temperature: [20, 30], light: [600, 1000] },
};

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

type ResolvingEntry = {
  recId: string;
  layerId: string;
  crop: string;
  layerName: string;
  areaName: string;
  action: string;
  device: string;
  metric: string;
  midpoint: number;
};

// ── Helpers ──────────────────────────────────────────────────────

/** Parse device, metric, and duration from AI action text. */
export function parseActionDevice(action: string): { device: string; metric: string; duration: number; value?: number } | null {
  const l = action.toLowerCase();
  // Extract duration in minutes (e.g. "for 2 minutes", "for 20 min")
  const durMatch = l.match(/(\d+)\s*min/);
  const dur = durMatch ? Math.min(parseInt(durMatch[1], 10), 5) : 2; // default 2 min, max 5
  const ledMatch = l.match(/led(?:\s+intensity)?\s+to\s+(\d+)%/) || l.match(/set\s+led(?:\s+intensity)?\s+to\s+(\d+)%/);
  if (ledMatch) return { device: "led_intensity", metric: "light", duration: 0, value: Math.min(Math.max(parseInt(ledMatch[1], 10), 0), 100) };
  if (l.includes("pump")) return { device: "pump", metric: "moisture", duration: dur };
  if (l.includes("fan")) return { device: "fan", metric: "humidity", duration: dur };
  if (l.includes("misting") || l.includes("mist")) return { device: "misting", metric: "humidity", duration: dur };
  return null;
}

function midpoint(crop: string, metric: string): number | null {
  if (metric.endsWith("_min")) {
    const r = RECIPES[crop]?.[metric.replace("_min", "")];
    return r ? r[0] : null;
  }
  if (metric.endsWith("_max")) {
    const r = RECIPES[crop]?.[metric.replace("_max", "")];
    return r ? r[1] : null;
  }
  const r = RECIPES[crop]?.[metric];
  return r ? (r[0] + r[1]) / 2 : null;
}

function readMetric(reading: FarmLayer["latest_reading"], metric: string): number | null {
  if (!reading) return null;
  if (metric === "moisture") return reading.soil_moisture;
  if (metric === "humidity") return reading.humidity;
  if (metric.startsWith("temperature")) return reading.temperature;
  if (metric.startsWith("light")) return reading.light_intensity;
  return null;
}

function buildSolvedDesc(e: ResolvingEntry, val: number): string {
  const m =
    e.metric === "moisture" ? "Soil moisture" :
    e.metric === "humidity" ? "Humidity" :
    e.metric.startsWith("temperature") ? "Temperature" :
    "Light";
  const d = e.device.charAt(0).toUpperCase() + e.device.slice(1);
  const suffix = e.metric.startsWith("temperature") ? "C" : "%";
  return `${m} for ${e.layerName} (${e.crop}) restored to ${val.toFixed(1)}${suffix}. ${d} automatically controlled to bring readings within healthy range.`;
}

function ledResolutionMetric(rec: Recommendation): string {
  const text = `${rec.action} ${rec.reason}`.toLowerCase();
  if (text.includes("temperature") || text.includes("warming")) return "temperature_min";
  if (text.includes("above the crop recipe range") || text.includes("reduce light")) return "light_max";
  return "light_min";
}

function hasRecovered(metric: string, value: number, target: number, device: string): boolean {
  if (device === "fan" || metric.endsWith("_max")) return value <= target;
  return value >= target;
}

function loadJson<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function saveJson(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)); }

// ── Hook ─────────────────────────────────────────────────────────

export function useResolveManager(layers: FarmLayer[]) {
  const [resolving, setResolving] = useState<ResolvingEntry[]>(() => loadJson(RESOLVING_KEY, []));
  const [solved, setSolved] = useState<SolvedSuggestion[]>(() => {
    const items: SolvedSuggestion[] = loadJson(SOLVED_KEY, []);
    return items.filter(i => Date.now() - new Date(i.solvedAt).getTime() < DAY_MS);
  });
  // Hidden timestamp for (layerId:action) to hide stale recommendations
  const [hiddenRecs, setHiddenRecs] = useState<Record<string, string>>(() => loadJson(HIDDEN_KEY, {}));

  // On mount: clean up stale resolving entries whose devices are no longer on
  useEffect(() => {
    if (layers.length === 0) return; // not loaded yet
    setResolving(cur => {
      const valid = cur.filter(e => {
        const layer = layers.find(l => l.id === e.layerId);
        if (!layer) return false;
        // Keep if the device is still on (resolve is still active)
        if (e.device === "led_intensity") return true;
        const deviceOn = layer.devices[e.device as keyof typeof layer.devices];
        return deviceOn === true;
      });
      if (valid.length !== cur.length) saveJson(RESOLVING_KEY, valid);
      return valid;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.length > 0]); // only run once layers are loaded

  // Prune old solved entries every minute
  useEffect(() => {
    const t = setInterval(() => {
      setSolved(cur => {
        const f = cur.filter(i => Date.now() - new Date(i.solvedAt).getTime() < DAY_MS);
        if (f.length !== cur.length) saveJson(SOLVED_KEY, f);
        return f;
      });
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  // Monitor sensor readings — check resolution against midpoint
  useEffect(() => {
    if (resolving.length === 0) return;
    const still: ResolvingEntry[] = [];
    const fresh: SolvedSuggestion[] = [];

    for (const e of resolving) {
        const layer = layers.find(l => l.id === e.layerId);
        const val = readMetric(layer?.latest_reading, e.metric);
        if (val === null) { still.push(e); continue; }

      const hit = hasRecovered(e.metric, val, e.midpoint, e.device);
      if (hit) {
        // Turn off the device — pass duration 0 to satisfy safety guardrail
        if (e.device !== "led_intensity") api.executeSafeCommand(e.layerId, e.device, false, 0).catch(() => {});
        const solvedTime = new Date().toISOString();
        fresh.push({
          id: `${e.recId}_${Date.now()}`,
          recId: e.recId, layerId: e.layerId,
          layerName: e.layerName, areaName: e.areaName, crop: e.crop,
          action: e.action,
          resolvedDescription: buildSolvedDesc(e, val),
          solvedAt: solvedTime,
        });
        setHiddenRecs(cur => {
          const next = { ...cur, [`${e.layerId}:${e.action}`]: solvedTime };
          saveJson(HIDDEN_KEY, next);
          return next;
        });
      } else {
        still.push(e);
      }
    }

    if (fresh.length > 0) {
      setResolving(still); saveJson(RESOLVING_KEY, still);
      setSolved(cur => { const u = [...fresh, ...cur]; saveJson(SOLVED_KEY, u); return u; });
    }
  }, [layers, resolving]);

  // Resolve a single recommendation
  const resolveSingle = useCallback(async (rec: Recommendation, layersList: FarmLayer[]) => {
    const parsed = parseActionDevice(rec.action);
    if (!parsed) return;
    const layer = layersList.find(l => l.id === rec.layer_id);
    if (!layer) return;
    if (parsed.device === "led_intensity") {
      if (typeof parsed.value !== "number") return;
      try {
        await api.executeSafeCommand(rec.layer_id, "led_intensity", parsed.value);
        const metric = ledResolutionMetric(rec);
        const mp = midpoint(layer.crop, metric);
        if (mp === null) return;
        setResolving(cur => {
          const filtered = cur.filter(e => !(e.layerId === rec.layer_id && e.device === "led_intensity"));
          const entry: ResolvingEntry = {
            recId: rec.id, layerId: rec.layer_id, crop: layer.crop,
            layerName: layer.name, areaName: layer.area_name,
            action: rec.action, device: "led_intensity", metric, midpoint: mp,
          };
          const updated = [...filtered, entry];
          saveJson(RESOLVING_KEY, updated);
          return updated;
        });
      } catch {
        // The visible recommendation stays active if the safe command fails.
      }
      return;
    }
    const mp = midpoint(layer.crop, parsed.metric);
    if (mp === null) return;

    // Update or add entry for this layer+device (allow re-resolve if already tracking same layer)
    setResolving(cur => {
      const filtered = cur.filter(e => !(e.layerId === rec.layer_id && e.device === parsed.device));
      const entry: ResolvingEntry = {
        recId: rec.id, layerId: rec.layer_id, crop: layer.crop,
        layerName: layer.name, areaName: layer.area_name,
        action: rec.action, device: parsed.device, metric: parsed.metric, midpoint: mp,
      };
      const updated = [...filtered, entry];
      saveJson(RESOLVING_KEY, updated);
      return updated;
    });

    try {
      await api.executeSafeCommand(rec.layer_id, parsed.device, true, parsed.duration);
    } catch {
      setResolving(cur => { const u = cur.filter(e => e.recId !== rec.id); saveJson(RESOLVING_KEY, u); return u; });
    }
  }, []);

  // Resolve all actionable recommendations
  const resolveAll = useCallback(async (recs: Recommendation[], layersList: FarmLayer[], refresh: () => Promise<void>) => {
    for (const rec of recs) {
      const parsed = parseActionDevice(rec.action);
      if (!parsed) continue;
      await resolveSingle(rec, layersList);
    }
    await api.autoResolveAlerts();
    await refresh();
  }, [resolveSingle]);

  const clearSolved = useCallback(() => { setSolved([]); saveJson(SOLVED_KEY, []); }, []);

  const deleteSolved = useCallback((id: string) => {
    setSolved(cur => { const u = cur.filter(i => i.id !== id); saveJson(SOLVED_KEY, u); return u; });
  }, []);

  const resolvingIds = new Set(resolving.map(e => e.recId));
  // Also include layer+device combos to grey out duplicate recs for same layer
  const resolvingLayerDevices = new Set(resolving.map(e => `${e.layerId}:${e.device}`));

  const isResolving = useCallback((rec: Recommendation) => {
    if (resolvingIds.has(rec.id)) return true;
    const parsed = parseActionDevice(rec.action);
    return parsed ? resolvingLayerDevices.has(`${rec.layer_id}:${parsed.device}`) : false;
  }, [resolvingIds, resolvingLayerDevices]);

  return { resolving, solved, hiddenRecs, resolveSingle, resolveAll, clearSolved, deleteSolved, isResolving,
    isAutomatable: (rec: Recommendation) => parseActionDevice(rec.action) !== null };
}
