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
  climate_heating: number;
  climate_cooling: number;
  led_intensity: number;
  led_reported_intensity: number;
  auto_mode: boolean;
  nutrient_a_dosed_ml: number;
  nutrient_b_dosed_ml: number;
  ph_up_dosed_ml: number;
  ph_down_dosed_ml: number;
  water_topup_liters: number;
  fertigation_active: boolean;
  fertigation_last_action?: string | null;
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

export type AIControlCommand = {
  device: "fan" | "pump" | "misting" | "climate_heating" | "climate_cooling" | "led_intensity" | "none";
  value: boolean | number;
  duration_minutes?: number | null;
  reason: string;
};

export type AIControlDecision = {
  layer_id: string;
  mode: "deepseek" | "fallback" | "unconfigured" | "ai_error";
  summary: string;
  commands: AIControlCommand[];
  reasoning: string[];
  confidence: number;
};

export type AlertResolveResult = {
  resolved_count: number;
  active_count: number;
  message: string;
  resolved: Array<{
    id: string;
    layer_id: string;
    title: string;
    message: string;
  }>;
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
  resolved_alert_ids?: string[];
};

export type EnergyLayerPlan = {
  layer_id: string;
  layer_name: string;
  crop: string;
  natural_light_ratio: number;
  weather_adjusted_light_lux: number;
  current_led_percent: number;
  recommended_led_percent: number;
  recommended_hvac_level: number;
  current_kw: number;
  optimized_kw: number;
  reason: string;
};

export type EnergyOptimizer = {
  tariff: {
    period: "Peak" | "Shoulder" | "Off-peak";
    rate_rm_per_kwh: number;
    next_low_cost_window: string;
    source: string;
  };
  strategy: {
    mode: "Sunlight-first" | "Minimal LED" | "Off-peak growth lighting";
    window: string;
    led_policy: string;
    hvac_policy: string;
    target_dli_shift: string;
  };
  weather: {
    source: string;
    location: string;
    temperature_c: number;
    humidity_percent: number;
    cloud_cover_percent: number;
    precipitation_mm: number;
    sunlight_factor: number;
    error?: string;
  };
  current_kw: number;
  optimized_kw: number;
  savings_kw: number;
  estimated_daily_savings_rm: number;
  estimated_monthly_savings_rm: number;
  recommendation: string;
  layer_plans: EnergyLayerPlan[];
};

export type BusinessImpact = {
  monthly_energy_savings_rm: number;
  monthly_water_savings_rm: number;
  crop_loss_prevented_percent: number;
  avoided_crop_loss_rm: number;
  estimated_monthly_value_rm: number;
  payback_months: number;
  early_detection_days: number;
  summary: string;
};

export type DemoScenario = "normal" | "high_humidity" | "low_moisture" | "disease_outbreak" | "energy_peak";

export type MarketNewsArticle = {
  region: string;
  title: string;
  source: string;
  url: string;
  published_at: string;
  summary: string;
  expansion_signal: string;
};

export type MarketNews = {
  generated_at: string;
  source: string;
  articles: MarketNewsArticle[];
  region_counts: Record<string, number>;
  owner_brief: string[];
  errors: string[];
};

export type NutrientDose = {
  nutrient_a_ml: number;
  nutrient_b_ml: number;
  ph_up_ml: number;
  ph_down_ml: number;
  water_topup_liters: number;
  dilution_liters: number;
};

export type NutrientLayerInsight = {
  layer_id: string;
  layer_name: string;
  area_name: string;
  crop: string;
  growth_stage: string;
  ph: number;
  ec: number;
  water_level: number;
  temperature: number;
  status: string;
  risk: "Low" | "Medium" | "High";
  confidence: number;
  nutrient_score: number;
  reservoir_liters: number;
  target_ec: number;
  target_ph: number;
  recommended_dose: NutrientDose;
  evidence: string[];
  next_actions: string[];
  avoid: string[];
};

export type NutrientIntelligence = {
  generated_at: string;
  average_nutrient_score: number;
  high_risk_layers: number;
  medium_risk_layers: number;
  system_mode: string;
  owner_summary: string;
  layers: NutrientLayerInsight[];
};

export type ClimateRisk = {
  title: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  detail: string;
};

export type ClimateForecastPoint = {
  time: string;
  temperature: number | null;
  humidity: number | null;
  rain_probability: number | null;
  rain_mm: number | null;
  wind_speed: number | null;
  cloud_cover: number | null;
};

export type ClimateShield = {
  generated_at: string;
  source: string;
  location: string;
  overall_risk: "Low" | "Medium" | "High" | "Critical";
  summary: string;
  metrics: {
    max_temperature_c: number;
    max_humidity_percent: number;
    total_rain_mm: number;
    max_rain_probability_percent: number;
    max_wind_kmh: number;
    max_cloud_cover_percent: number;
  };
  risks: ClimateRisk[];
  control_actions: string[];
  preparedness_checklist: string[];
  forecast_points: ClimateForecastPoint[];
  error?: string | null;
};
