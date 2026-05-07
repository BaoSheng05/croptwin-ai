import type { AIControlDecision, Alert, AlertResolveResult, BusinessImpact, ClimateShield, DemoScenario, EnergyOptimizer, FarmLayer, FarmOverview, MarketNews, NutrientIntelligence, OperationsTimeline, Recommendation, UrbanExpansionWhatIf, YieldForecast } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
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

  return response.json() as Promise<T>;
}

export const api = {
  getFarm: () => request<FarmOverview>("/api/farm"),
  getAlerts: () => request<Alert[]>("/api/alerts"),
  autoResolveAlerts: () => request<AlertResolveResult>("/api/alerts/auto-resolve", { method: "POST" }),
  getRecommendations: () => request<Recommendation[]>("/api/recommendations"),
  getEnergyOptimizer: () => request<EnergyOptimizer>("/api/energy/optimizer"),
  getBusinessImpact: () => request<BusinessImpact>("/api/business/impact"),
  getOperationsTimeline: () => request<OperationsTimeline>("/api/operations/timeline"),
  getYieldForecast: () => request<YieldForecast>("/api/yield/forecast"),
  getMarketNews: () => request<MarketNews>("/api/market/news"),
  getNutrientIntelligence: () => request<NutrientIntelligence>("/api/nutrients/intelligence"),
  getClimateShield: () => request<ClimateShield>("/api/climate/shield"),
  getUrbanExpansionWhatIf: () => request<UrbanExpansionWhatIf>("/api/whatif/urban-expansion"),
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
  sendCommand: (layerId: string, device: string, value: boolean | number) =>
    request("/api/devices/commands", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId, device, value }),
    }),
  enableAiControlAll: () =>
    request<{ ok: boolean; updated_count: number }>("/api/devices/auto-mode/all", {
      method: "POST",
    }),
  chat: (question: string, layerId?: string, history?: { role: string; text: string }[]) =>
    request<{ answer: string; referenced_layers: string[]; mode?: string }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ question, layer_id: layerId, history }),
    }),
  aiDiagnose: (layerId: string) =>
    request<any>("/api/ai/diagnose", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId }),
    }),
  aiControlDecision: (layerId: string) =>
    request<AIControlDecision>("/api/ai/control-decision", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId }),
    }),
  executeSafeCommand: (layerId: string, device: string, value: boolean | number, duration_minutes?: number) =>
    request("/api/ai/execute-safe-command", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId, device, value, duration_minutes }),
    }),
};

export function farmSocketUrl(): string {
  const base = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:8000";
  return `${base}/api/ws/farm`;
}
