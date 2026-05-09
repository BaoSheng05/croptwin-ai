CREATE TABLE IF NOT EXISTS farms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS layers (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  name TEXT NOT NULL,
  crop TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Healthy',
  health_score INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  layer_id TEXT NOT NULL REFERENCES layers(id),
  temperature REAL NOT NULL,
  humidity REAL NOT NULL,
  soil_moisture REAL NOT NULL,
  ph REAL NOT NULL,
  light_intensity REAL NOT NULL,
  water_level REAL NOT NULL,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL REFERENCES layers(id),
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  predictive INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL REFERENCES layers(id),
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  priority TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_states (
  layer_id TEXT PRIMARY KEY REFERENCES layers(id),
  fan INTEGER NOT NULL DEFAULT 0,
  pump INTEGER NOT NULL DEFAULT 0,
  misting INTEGER NOT NULL DEFAULT 0,
  led_intensity INTEGER NOT NULL DEFAULT 70,
  auto_mode INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_cities (
  id TEXT PRIMARY KEY,
  city_name TEXT NOT NULL,
  state TEXT NOT NULL,
  land_price_value REAL NOT NULL DEFAULT 0,
  land_price_unit TEXT NOT NULL DEFAULT 'RM per sq ft',
  land_price_source TEXT NOT NULL DEFAULT '',
  land_price_confidence TEXT NOT NULL DEFAULT 'estimated',
  air_pollution_index REAL NOT NULL DEFAULT 0,
  air_pollution_source TEXT NOT NULL DEFAULT '',
  living_cost_index REAL NOT NULL DEFAULT 0,
  living_cost_source TEXT NOT NULL DEFAULT '',
  infrastructure_score INTEGER NOT NULL DEFAULT 0,
  convenience_score INTEGER NOT NULL DEFAULT 0,
  transportation_delivery_score INTEGER NOT NULL DEFAULT 0,
  overall_score INTEGER NOT NULL DEFAULT 0,
  analysis_summary TEXT NOT NULL DEFAULT '',
  score_breakdown_json TEXT NOT NULL DEFAULT '{}',
  strengths_json TEXT NOT NULL DEFAULT '[]',
  risks_json TEXT NOT NULL DEFAULT '[]',
  recommendation TEXT NOT NULL DEFAULT '',
  raw_data_json TEXT NOT NULL DEFAULT '{}',
  last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_city_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id TEXT NOT NULL REFERENCES market_cities(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'Google News',
  published_at TEXT NOT NULL DEFAULT ''
);
