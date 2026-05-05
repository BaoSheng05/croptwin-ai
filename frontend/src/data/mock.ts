import type { Alert, FarmOverview, Recommendation } from "../types";

const now = new Date().toISOString();

export const fallbackFarm: FarmOverview = {
  name: "CropTwin AI Vertical Farm",
  average_health_score: 85,
  active_alerts: 1,
  sustainability: {
    water_saved_liters: 128.5,
    energy_optimized_kwh: 31.2,
    estimated_cost_reduction_rm: 46.8,
    sustainability_score: 88,
  },
  layers: [
    {
      id: "layer_01",
      name: "Layer 1",
      crop: "Lettuce",
      status: "Healthy",
      health_score: 92,
      main_risk: null,
      latest_reading: {
        layer_id: "layer_01",
        temperature: 22.4,
        humidity: 58,
        soil_moisture: 68,
        ph: 6.1,
        light_intensity: 620,
        water_level: 82,
        timestamp: now,
      },
      devices: { fan: false, pump: false, misting: false, led_intensity: 70, auto_mode: true },
    },
    {
      id: "layer_02",
      name: "Layer 2",
      crop: "Basil",
      status: "Warning",
      health_score: 74,
      main_risk: "Humidity trending high",
      latest_reading: {
        layer_id: "layer_02",
        temperature: 27.8,
        humidity: 74,
        soil_moisture: 49,
        ph: 6.7,
        light_intensity: 720,
        water_level: 71,
        timestamp: now,
      },
      devices: { fan: true, pump: false, misting: false, led_intensity: 70, auto_mode: true },
    },
    {
      id: "layer_03",
      name: "Layer 3",
      crop: "Strawberry",
      status: "Healthy",
      health_score: 88,
      main_risk: null,
      latest_reading: {
        layer_id: "layer_03",
        temperature: 23.6,
        humidity: 61,
        soil_moisture: 63,
        ph: 6.2,
        light_intensity: 840,
        water_level: 78,
        timestamp: now,
      },
      devices: { fan: false, pump: false, misting: false, led_intensity: 82, auto_mode: true },
    },
  ],
};

export const fallbackAlerts: Alert[] = [
  {
    id: "alert_01",
    layer_id: "layer_02",
    severity: "warning",
    title: "High humidity detected",
    message: "Basil humidity is above the ideal range.",
    created_at: now,
    predictive: false,
  },
];

export const fallbackRecommendations: Recommendation[] = [
  {
    id: "rec_01",
    layer_id: "layer_02",
    action: "Turn on fan for 20 minutes",
    reason: "This gives the highest risk reduction while keeping energy cost acceptable.",
    priority: "high",
    confidence: 88,
    created_at: now,
  },
];

export const seedChartData = Array.from({ length: 16 }).map((_, index) => ({
  time: `${index * 2}s`,
  temperature: 22 + Math.sin(index / 2) * 2,
  humidity: 58 + index * 1.2,
  moisture: 68 - index * 0.8,
  ph: 6.1 + Math.sin(index / 3) * 0.2,
}));
