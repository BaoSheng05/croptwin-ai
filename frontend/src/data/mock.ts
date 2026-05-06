import type { Alert, FarmOverview, Recommendation } from "../types";

const now = new Date().toISOString();

export const fallbackFarm: FarmOverview = {
  name: "CropTwin AI Vertical Farm",
  average_health_score: 85,
  active_alerts: 1,
  sustainability: {
    water_saved_liters: 642.5,
    energy_optimized_kwh: 156.0,
    estimated_cost_reduction_rm: 234.0,
    sustainability_score: 88,
  },
  layers: [
    {
      id: "a_01", area_id: "area_a", area_name: "Area A — Leafy Greens Wing",
      name: "A-1", crop: "Lettuce", status: "Healthy", health_score: 92, main_risk: null,
      latest_reading: { layer_id: "a_01", temperature: 20, humidity: 60, soil_moisture: 68, ph: 6.0, light_intensity: 575, water_level: 80, timestamp: now },
      devices: { fan: false, pump: false, misting: false, climate_heating: false, climate_cooling: false, led_intensity: 70, led_reported_intensity: 68, auto_mode: true },
    },
    {
      id: "b_02", area_id: "area_b", area_name: "Area B — Herbs Wing",
      name: "B-2", crop: "Basil", status: "Warning", health_score: 74, main_risk: "Humidity trending high",
      latest_reading: { layer_id: "b_02", temperature: 24.5, humidity: 50, soil_moisture: 58, ph: 6.3, light_intensity: 700, water_level: 76, timestamp: now },
      devices: { fan: false, pump: false, misting: false, climate_heating: false, climate_cooling: false, led_intensity: 70, led_reported_intensity: 72, auto_mode: true },
    },
    {
      id: "c_01", area_id: "area_c", area_name: "Area C — Fruits Wing",
      name: "C-1", crop: "Strawberry", status: "Healthy", health_score: 88, main_risk: null,
      latest_reading: { layer_id: "c_01", temperature: 22, humidity: 55, soil_moisture: 63, ph: 6.0, light_intensity: 825, water_level: 80, timestamp: now },
      devices: { fan: false, pump: false, misting: false, climate_heating: false, climate_cooling: false, led_intensity: 82, led_reported_intensity: 80, auto_mode: true },
    },
  ],
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
