export type ParsedRecommendationAction = {
  device: string;
  metric: string;
  duration: number;
  value?: number;
};

export function parseActionDevice(action: string): ParsedRecommendationAction | null {
  const text = action.toLowerCase();
  const durationMatch = text.match(/(\d+)\s*min/);
  const requestedDuration = durationMatch ? parseInt(durationMatch[1], 10) : null;
  const ledMatch =
    text.match(/led(?:\s+intensity)?\s+to\s+(\d+)%/) ||
    text.match(/set\s+led(?:\s+intensity)?\s+to\s+(\d+)%/);

  if (ledMatch) {
    return {
      device: "led_intensity",
      metric: "light",
      duration: 0,
      value: Math.min(Math.max(parseInt(ledMatch[1], 10), 0), 100),
    };
  }
  if (text.includes("climate heating") || text.includes("heating")) {
    return { device: "climate_heating", metric: "temperature_min", duration: Math.min(requestedDuration ?? 15, 30) };
  }
  if (text.includes("climate cooling") || text.includes("cooling")) {
    return { device: "climate_cooling", metric: "temperature_max", duration: Math.min(requestedDuration ?? 15, 30) };
  }
  if (text.includes("pump")) {
    return { device: "pump", metric: "moisture", duration: Math.min(requestedDuration ?? 2, 5) };
  }
  if (text.includes("fan")) {
    return { device: "fan", metric: "humidity", duration: Math.min(requestedDuration ?? 20, 30) };
  }
  if (text.includes("misting") || text.includes("mist")) {
    return { device: "misting", metric: "humidity", duration: Math.min(requestedDuration ?? 3, 5) };
  }
  return null;
}
