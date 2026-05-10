import type {
  AIDiagnosisResult, Alert, AlertResolveResult, AIControlDecision, BusinessImpact, ChatMessage, ChatResponse,
  ClimateShield, CropRecipes, DemoScenario, DiagnosisResult, EnergyOptimizer, FarmLayer, FarmLayoutConfig, FarmOverview,
  HarvestLog, HarvestLogCreate, MarketCityDetail, MarketCitySnapshot, MarketNews,
  NutrientIntelligence, OperationsTimeline, Recommendation, UrbanExpansionWhatIf,
  WhatIfResult, YieldForecast, YieldSetupSnapshot, YieldSetupUpdate,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const GET_CACHE_TTL_MS = 60_000;

const getCache = new Map<string, { expiresAt: number; value: unknown }>();

async function request<T>(path: string, init?: RequestInit & { cacheTtlMs?: number }): Promise<T> {
  const method = init?.method ?? "GET";
  const cacheTtlMs = init?.cacheTtlMs ?? GET_CACHE_TTL_MS;
  const cacheKey = method === "GET" ? path : "";
  const cached = cacheKey ? getCache.get(cacheKey) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const { cacheTtlMs: _cacheTtlMs, ...fetchInit } = init ?? {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...fetchInit.headers },
    ...fetchInit,
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.detail) message = typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail);
    } catch {
      // Keep the generic HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }

  const payload = await response.json() as T;
  if (cacheKey && cacheTtlMs > 0) {
    getCache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, value: payload });
  } else if (method !== "GET") {
    getCache.clear();
  }
  return payload;
}

function invalidateGet(path: string) {
  getCache.delete(path);
}

export const api = {
  getFarm: () => request<FarmOverview>("/api/farm"),
  getFarmLayout: () => request<FarmLayoutConfig>("/api/farm/layout"),
  updateFarmLayout: (layout: FarmLayoutConfig) =>
    request<FarmLayoutConfig & { layers: FarmLayer[] }>("/api/farm/layout", {
      method: "PUT",
      body: JSON.stringify(layout),
    }),
  getAlerts: () => request<Alert[]>("/api/alerts"),
  autoResolveAlerts: () => request<AlertResolveResult>("/api/alerts/auto-resolve", { method: "POST" }),
  getRecommendations: () => request<Recommendation[]>("/api/recommendations"),
  getEnergyOptimizer: () => request<EnergyOptimizer>("/api/energy/optimizer"),
  getBusinessImpact: () => request<BusinessImpact>("/api/business/impact"),
  getOperationsTimeline: () => request<OperationsTimeline>("/api/operations/timeline"),
  getYieldForecast: () => request<YieldForecast>("/api/yield/forecast"),
  getYieldSetup: () => request<YieldSetupSnapshot>("/api/yield/setup"),
  updateYieldSetup: (layerId: string, update: YieldSetupUpdate) =>
    request("/api/yield/setup/" + layerId, {
      method: "PUT",
      body: JSON.stringify(update),
    }),
  getHarvestLogs: () => request<HarvestLog[]>("/api/harvest/logs"),
  createHarvestLog: (log: HarvestLogCreate) =>
    request<HarvestLog>("/api/harvest/logs", {
      method: "POST",
      body: JSON.stringify(log),
    }),
  deleteHarvestLog: (id: string) =>
    request<{ ok: boolean }>("/api/harvest/logs/" + encodeURIComponent(id), {
      method: "DELETE",
    }),
  getMarketNews: () => request<MarketNews>("/api/market/news"),
  getMarketCities: (params?: { search?: string; sort_by?: string; sort_dir?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.sort_by) query.set("sort_by", params.sort_by);
    if (params?.sort_dir) query.set("sort_dir", params.sort_dir);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<MarketCitySnapshot>(`/api/market/cities${suffix}`, { cacheTtlMs: 0 });
  },
  getMarketCity: (cityId: string) => request<MarketCityDetail>("/api/market/cities/" + encodeURIComponent(cityId), { cacheTtlMs: 0 }),
  refreshMarketCities: () => request<MarketCitySnapshot>("/api/market/cities/refresh", { method: "POST" }),
  getNutrientIntelligence: () => request<NutrientIntelligence>("/api/nutrients/intelligence"),
  getClimateShield: () => request<ClimateShield>("/api/climate/shield"),
  getUrbanExpansionWhatIf: () => request<UrbanExpansionWhatIf>("/api/whatif/urban-expansion"),
  getRecipes: () => request<CropRecipes>("/api/recipes"),
  getPreference: <T>(key: string) =>
    request<{ key: string; value: T | null }>("/api/preferences/" + encodeURIComponent(key), { cacheTtlMs: 0 }),
  setPreference: <T>(key: string, value: T) =>
    request<{ key: string; value: T }>("/api/preferences/" + encodeURIComponent(key), {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),

  // ── Nutrient automation ───────────────────────────────────────
  executeNutrientPlan: (layerId: string) =>
    request<{ ok: boolean; status: string; risk: string; executed: unknown }>("/api/nutrients/execute-plan", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId, confirm: true }),
    }),
  autoRunNutrientAutomation: (includeMediumRisk = true, maxLayers = 5) =>
    request<{ ok: boolean; summary: string; executed_count: number; skipped_count: number; executed: unknown[] }>("/api/nutrients/auto-run", {
      method: "POST",
      body: JSON.stringify({ include_medium_risk: includeMediumRisk, max_layers: maxLayers, confirm: true }),
    }),

  // ── Demo ──────────────────────────────────────────────────────
  applyDemoScenario: (scenario: DemoScenario, layerId?: string) =>
    request<{
      ok: boolean;
      scenario: DemoScenario;
      layer: FarmLayer;
      alert?: Alert | null;
      recommendation?: Recommendation | null;
      energy: EnergyOptimizer;
      impact: BusinessImpact;
    }>("/api/demo/scenario", {
      method: "POST",
      body: JSON.stringify({ scenario, layer_id: layerId }),
    }),

  // ── Device control ────────────────────────────────────────────
  sendCommand: (layerId: string, device: string, value: boolean | number) =>
    request("/api/devices/commands", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId, device, value }),
    }),
  enableAiControlAll: () =>
    request<{ ok: boolean; updated_count: number }>("/api/devices/auto-mode/all", {
      method: "POST",
    }),
  executeSafeCommand: (layerId: string, device: string, value: boolean | number, durationMinutes?: number) =>
    request("/api/ai/execute-safe-command", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId, device, value, duration_minutes: durationMinutes }),
    }),

  // ── Chat ──────────────────────────────────────────────────────
  chat: (question: string, layerId?: string, history?: ChatMessage[]) =>
    request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ question, layer_id: layerId, history }),
    }),

  // ── AI ────────────────────────────────────────────────────────
  aiDiagnose: (layerId: string) =>
    request<AIDiagnosisResult>("/api/ai/diagnose", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId }),
    }),
  aiControlDecision: (layerId: string) =>
    request<AIControlDecision>("/api/ai/control-decision", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId }),
    }),

  // ── What-If & Diagnosis (previously raw fetch) ────────────────
  runWhatIfSimulation: (layerId: string, hours: number, action: string) =>
    request<WhatIfResult>("/api/whatif/simulate", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId, hours, action }),
    }),
  imageDiagnosis: (layerId: string, imageBase64: string) =>
    request<DiagnosisResult>("/api/diagnosis/image", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId, image_base64: imageBase64 }),
    }),
};

export function invalidateApiCache(paths: string[] = []) {
  if (paths.length === 0) {
    getCache.clear();
    return;
  }
  for (const path of paths) invalidateGet(path);
}

export function farmSocketUrl(): string {
  const explicitBase = import.meta.env.VITE_WS_BASE_URL;
  if (explicitBase) return `${explicitBase}/api/ws/farm`;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws/farm`;
}
