import type { CropRecipes, FarmLayer, Recommendation } from "../types";

export type ResolvingEntry = {
  recId: string;
  layerId: string;
  crop: string;
  layerName: string;
  areaName: string;
  action: string;
  device: string;
  metric: string;
  midpoint: number;
  startValue?: number;
  bestProgress?: number;
  startedAt?: string;
};

function recipeRangeForMetric(recipes: CropRecipes, crop: string, metric: string): [number, number] | null {
  const recipe = recipes[crop];
  if (!recipe) return null;
  const baseMetric = metric.replace("_min", "").replace("_max", "");
  if (baseMetric === "moisture") return recipe.soil_moisture_range;
  if (baseMetric === "humidity") return recipe.humidity_range;
  if (baseMetric === "temperature") return recipe.temperature_range;
  if (baseMetric === "light") return recipe.light_range;
  return null;
}

export function targetValue(recipes: CropRecipes, crop: string, metric: string): number | null {
  const range = recipeRangeForMetric(recipes, crop, metric);
  if (!range) return null;
  if (metric.endsWith("_min")) return range[0];
  if (metric.endsWith("_max")) return range[1];
  if (metric === "moisture") return range[0];
  return (range[0] + range[1]) / 2;
}

export function readMetric(reading: FarmLayer["latest_reading"], metric: string): number | null {
  if (!reading) return null;
  if (metric === "moisture") return reading.soil_moisture;
  if (metric === "humidity" || metric === "humidity_min" || metric === "humidity_max") return reading.humidity;
  if (metric.startsWith("temperature")) return reading.temperature;
  if (metric.startsWith("light")) return reading.light_intensity;
  return null;
}

export function ledResolutionMetric(rec: Recommendation): string {
  const text = `${rec.action} ${rec.reason}`.toLowerCase();
  if (text.includes("temperature") || text.includes("warming")) return "temperature_min";
  if (text.includes("above the crop recipe range") || text.includes("reduce light")) return "light_max";
  return "light_min";
}

export function resolutionMetric(rec: Recommendation, fallbackMetric: string): string {
  const text = `${rec.action} ${rec.reason}`.toLowerCase();
  if (text.includes("temperature is") && text.includes("above")) return "temperature_max";
  if (text.includes("temperature is") && text.includes("below")) return "temperature_min";
  if (text.includes("humidity is") && text.includes("above")) return "humidity_max";
  if (text.includes("humidity is") && text.includes("below")) return "humidity_min";
  if (text.includes("soil moisture")) return "moisture";
  return fallbackMetric;
}

export function hasRecovered(metric: string, value: number, target: number, device: string): boolean {
  if (device === "fan" || metric.endsWith("_max")) return value <= target;
  return value >= target;
}

function clampProgress(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function resolveProgress(entry: ResolvingEntry, layer?: FarmLayer): number | null {
  const current = readMetric(layer?.latest_reading, entry.metric);
  if (current === null) return null;

  if (hasRecovered(entry.metric, current, entry.midpoint, entry.device)) return 100;

  if (typeof entry.startValue !== "number" || entry.startValue === entry.midpoint) {
    return 0;
  }

  const improvesDownward = entry.device === "fan" || entry.metric.endsWith("_max");
  const raw = improvesDownward
    ? ((entry.startValue - current) / (entry.startValue - entry.midpoint)) * 100
    : ((current - entry.startValue) / (entry.midpoint - entry.startValue)) * 100;

  return Math.max(entry.bestProgress ?? 0, clampProgress(raw));
}

export function buildSolvedDesc(entry: ResolvingEntry, value: number): string {
  const metricLabel =
    entry.metric === "moisture" ? "Soil moisture" :
    entry.metric.startsWith("humidity") ? "Humidity" :
    entry.metric.startsWith("temperature") ? "Temperature" :
    "Light";
  const deviceLabel = entry.device.charAt(0).toUpperCase() + entry.device.slice(1);
  const suffix = entry.metric.startsWith("temperature") ? "C" : "%";
  return `${metricLabel} for ${entry.layerName} (${entry.crop}) restored to ${value.toFixed(1)}${suffix}. ${deviceLabel} automatically controlled to bring readings within healthy range.`;
}
