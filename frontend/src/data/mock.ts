import type { Alert, FarmLayer, FarmOverview, LayerStatus, Recommendation } from "../types";

const now = new Date().toISOString();

const defaultDevices = (led = 70) => ({
  fan: false,
  pump: false,
  misting: false,
  climate_heating: false,
  climate_cooling: false,
  led_intensity: led,
  led_reported_intensity: led,
  auto_mode: true,
});

const layerDefs = [
  { area_id: "area_a", area_name: "Area A — Leafy Greens Wing", layers: [
    ["a_01", "A-1", "Lettuce", 92],
    ["a_02", "A-2", "Lettuce", 90],
    ["a_03", "A-3", "Spinach", 94],
    ["a_04", "A-4", "Spinach", 91],
    ["a_05", "A-5", "Lettuce", 89],
  ] },
  { area_id: "area_b", area_name: "Area B — Herbs Wing", layers: [
    ["b_01", "B-1", "Basil", 88],
    ["b_02", "B-2", "Basil", 74],
    ["b_03", "B-3", "Mint", 86],
    ["b_04", "B-4", "Mint", 87],
    ["b_05", "B-5", "Basil", 85],
  ] },
  { area_id: "area_c", area_name: "Area C — Fruits Wing", layers: [
    ["c_01", "C-1", "Strawberry", 88],
    ["c_02", "C-2", "Strawberry", 90],
    ["c_03", "C-3", "Tomato", 87],
    ["c_04", "C-4", "Tomato", 89],
    ["c_05", "C-5", "Strawberry", 91],
  ] },
] as const;

const cropBase: Record<string, { temperature: number; humidity: number; soil_moisture: number; ph: number; light_intensity: number }> = {
  Lettuce: { temperature: 20, humidity: 60, soil_moisture: 68, ph: 6.0, light_intensity: 575 },
  Basil: { temperature: 24.5, humidity: 50, soil_moisture: 58, ph: 6.3, light_intensity: 700 },
  Spinach: { temperature: 18.5, humidity: 55, soil_moisture: 62, ph: 6.5, light_intensity: 525 },
  Mint: { temperature: 21.5, humidity: 60, soil_moisture: 67, ph: 6.5, light_intensity: 600 },
  Strawberry: { temperature: 22, humidity: 55, soil_moisture: 63, ph: 6.0, light_intensity: 825 },
  Tomato: { temperature: 25, humidity: 50, soil_moisture: 60, ph: 6.2, light_intensity: 800 },
};

const fallbackLayers: FarmLayer[] = layerDefs.flatMap((area) =>
  area.layers.map(([id, name, crop, health], index) => {
    const base = cropBase[crop];
    const warning = id === "b_02";
    const status: LayerStatus = warning ? "Warning" : "Healthy";
    return {
      id,
      area_id: area.area_id,
      area_name: area.area_name,
      name,
      crop,
      status,
      health_score: health,
      main_risk: warning ? "Humidity trending high" : null,
      latest_reading: {
        layer_id: id,
        temperature: Number((base.temperature + (index - 2) * 0.3).toFixed(1)),
        humidity: Number((base.humidity + (index - 2) * 1.2).toFixed(1)),
        soil_moisture: Number((base.soil_moisture - index * 0.8).toFixed(1)),
        ph: Number((base.ph + (index - 2) * 0.03).toFixed(2)),
        light_intensity: Number((base.light_intensity + (index - 2) * 20).toFixed(1)),
        water_level: 80 - index * 2,
        timestamp: now,
      },
      devices: defaultDevices(crop === "Strawberry" ? 82 : 70),
    };
  }),
);

export const fallbackFarm: FarmOverview = {
  name: "CropTwin AI Vertical Farm",
  average_health_score: Math.round(fallbackLayers.reduce((sum, layer) => sum + layer.health_score, 0) / fallbackLayers.length),
  active_alerts: 1,
  sustainability: {
    water_saved_liters: 642.5,
    energy_optimized_kwh: 156.0,
    estimated_cost_reduction_rm: 234.0,
    sustainability_score: 88,
  },
  layers: fallbackLayers,
};

export const fallbackAlerts: Alert[] = [
  {
    id: "alert_01", layer_id: "b_02", severity: "warning",
    title: "High humidity detected", message: "Basil humidity is above the ideal range.",
    created_at: now, predictive: false,
  },
];

export const fallbackRecommendations: Recommendation[] = [
  {
    id: "rec_01", layer_id: "b_02",
    action: "Turn on fan for 20 minutes",
    reason: "This gives the highest risk reduction while keeping energy cost acceptable.",
    priority: "high", confidence: 88, created_at: now,
  },
];

export const seedChartData = Array.from({ length: 16 }).map((_, index) => ({
  time: `${index * 2}s`,
  temperature: 22 + Math.sin(index / 2) * 2,
  humidity: 58 + index * 1.2,
  moisture: 68 - index * 0.8,
  ph: 6.1 + Math.sin(index / 3) * 0.2,
}));
