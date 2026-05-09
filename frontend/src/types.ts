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

export type AIDeviceCommand = {
  device: "fan" | "pump" | "misting" | "climate_heating" | "climate_cooling" | "led_intensity" | "none";
  value: boolean | number;
  duration_minutes?: number | null;
};

export type AIControlDecision = {
  layer_id: string;
  mode: "deepseek" | "fallback" | "unconfigured" | "ai_error";
  summary: string;
  commands: AIControlCommand[];
  reasoning: string[];
  confidence: number;
};

export type AIDiagnosisResult = {
  layer_id: string;
  diagnosis: string;
  severity: "Low" | "Medium" | "High" | "Critical" | "Normal";
  confidence: number;
  evidence: string[];
  recommended_actions: string[];
  device_command: AIDeviceCommand;
  expected_outcome: string;
};

export type DiagnosisResult = {
  layer_id: string;
  crop: string;
  diagnosis: string;
  severity: "Low" | "Medium" | "High" | "Critical" | "Normal";
  confidence: number;
  causes: string[];
  recommended_actions: string[];
  expected_outcome: string;
};

export type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

export type ChatResponse = {
  answer: string;
  referenced_layers: string[];
  mode?: "deepseek" | "gemini" | "unconfigured" | "ai_error" | "local_fallback" | "fallback" | "local";
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

export type FarmLayoutConfig = {
  area_count: number;
  layers_per_area: number;
  default_crop: string;
  total_layers?: number;
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

export type OperationTimelineEvent = {
  id: string;
  timestamp: string;
  layer_id: string;
  layer_name: string;
  crop: string;
  type: string;
  title: string;
  trigger: string;
  ai_recommendation: string;
  actor: string;
  executed_action: string;
  before: {
    health_score: number;
    humidity: number;
    risk: string;
  };
  after: {
    health_score: number;
    humidity: number;
    risk: string;
  };
  impact: string;
};

export type OperationsTimeline = {
  generated_at: string;
  summary: string;
  closed_loop_events: number;
  resolved_or_improving: number;
  events: OperationTimelineEvent[];
};

export type YieldForecastLayer = {
  layer_id: string;
  layer_name: string;
  area_name: string;
  crop: string;
  expected_harvest_days: number;
  harvest_status: "Growing" | "Ready soon" | "Harvest ready";
  can_mark_harvested: boolean;
  yield_confidence: number;
  estimated_kg: number;
  risk_adjusted_yield_kg: number;
  estimated_revenue_rm: number;
  price_rm_per_kg: number;
  risk_factor: number;
  plant_count: number;
  rows: number;
  columns: number;
  rack_layers: number;
  farm_area_m2: number;
  expected_kg_per_plant: number;
  drivers: string[];
};

export type YieldForecast = {
  generated_at: string;
  summary: string;
  total_estimated_kg: number;
  total_estimated_revenue_rm: number;
  average_confidence: number;
  layers: YieldForecastLayer[];
};

export type YieldSetup = {
  layer_id: string;
  crop: string;
  rows: number;
  columns: number;
  rack_layers: number;
  farm_area_m2: number;
  price_rm_per_kg: number;
  expected_kg_per_plant: number;
  total_plants?: number;
};

export type YieldSetupSnapshot = {
  available_crops: string[];
  setups: YieldSetup[];
};

export type YieldSetupUpdate = Partial<Omit<YieldSetup, "layer_id" | "total_plants">>;

export type DemoScenario = "normal" | "high_humidity" | "low_moisture" | "disease_outbreak" | "energy_peak";

export type WhatIfTimePoint = {
  hour: number;
  temperature: number;
  humidity: number;
  soil_moisture: number;
  health_score: number;
};

export type WhatIfResult = {
  layer_id: string;
  layer_name: string;
  crop: string;
  baseline: WhatIfTimePoint[];
  intervention: WhatIfTimePoint[];
  action_label: string;
  summary: string;
  current_health: number;
  baseline_final_health: number;
  intervention_final_health: number;
  health_delta: number;
  recommendation: string;
};

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

export type UrbanExpansionSite = {
  city: string;
  land_cost_index: number;
  rent_rm_m2_month: number;
  electricity_index: number;
  air_pollution_index: number;
  market_demand_index: number;
  policy_support_index: number;
  logistics_index: number;
  climate_risk_index: number;
  notes: string;
  expansion_score: number;
  deployment_mode: string;
  capex_pressure: "Low" | "Medium" | "High";
  estimated_payback_months: number;
  recommendation: string;
};

export type UrbanExpansionWhatIf = {
  generated_at: string;
  model: string;
  summary: string;
  best_city: string;
  best_deployment_mode: string;
  sites: UrbanExpansionSite[];
  owner_takeaway: string[];
};

export type UserSettings = {
  tempUnit: "C" | "F";
  currency: "RM" | "USD";
  refreshRate: number; // seconds
  autoPilot: boolean;
  aiSensitivity: number; // 0-100
  soundAlerts: boolean;
};

export type CropRecipeRange = {
  crop: string;
  temperature_range: [number, number];
  humidity_range: [number, number];
  soil_moisture_range: [number, number];
  ph_range: [number, number];
  light_range: [number, number];
};

/** Keyed by crop name, e.g. { Lettuce: {...}, Basil: {...} } */
export type CropRecipes = Record<string, CropRecipeRange>;
