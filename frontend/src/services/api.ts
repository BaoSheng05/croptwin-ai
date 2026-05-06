import type { AIControlDecision, Alert, FarmOverview, Recommendation } from "../types";

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
  getRecommendations: () => request<Recommendation[]>("/api/recommendations"),
  sendCommand: (layerId: string, device: string, value: boolean | number) =>
    request("/api/devices/commands", {
      method: "POST",
      body: JSON.stringify({ layer_id: layerId, device, value }),
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
