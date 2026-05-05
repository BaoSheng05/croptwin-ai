export type LayerStatus = "Healthy" | "Warning" | "Critical" | "Offline";

export type SensorReading = {
  layer_id: string;
  temperature: number;
  humidity: number;
  soil_moisture: number;
  ph: number;
  light_intensity: number;
  water_level: number;
  timestamp: string;
};

export type DeviceState = {
  fan: boolean;
  pump: boolean;
  misting: boolean;
  led_intensity: number;
  auto_mode: boolean;
};

export type FarmLayer = {
  id: string;
  area_id: string;
  area_name: string;
  name: string;
  crop: string;
  status: LayerStatus;
  health_score: number;
  main_risk?: string | null;
  latest_reading?: SensorReading | null;
  devices: DeviceState;
};

export type Alert = {
  id: string;
  layer_id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  created_at: string;
  predictive: boolean;
};

export type Recommendation = {
  id: string;
  layer_id: string;
  action: string;
  reason: string;
  priority: "low" | "medium" | "high";
  confidence: number;
  created_at: string;
};

export type SustainabilitySnapshot = {
  water_saved_liters: number;
  energy_optimized_kwh: number;
  estimated_cost_reduction_rm: number;
  sustainability_score: number;
};

export type FarmOverview = {
  name: string;
  average_health_score: number;
  active_alerts: number;
  layers: FarmLayer[];
  sustainability: SustainabilitySnapshot;
};

export type LayerUpdateEvent = {
  event: "layer_update";
  data: FarmLayer;
  alert?: Alert | null;
  recommendation?: Recommendation | null;
};
