import { ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import type { FarmLayer, Recommendation } from "../types";

type Props = {
  recommendations: Recommendation[];
  layers: FarmLayer[];
  onExecute: (layerId: string, device: string, value: boolean | number, duration?: number) => Promise<void>;
};

const priorityStyles = {
  high:   { dot: "bg-status-critical", bar: "bg-gradient-to-r from-status-critical/30 to-transparent" },
  medium: { dot: "bg-status-warning", bar: "bg-gradient-to-r from-status-warning/20 to-transparent" },
  low:    { dot: "bg-forest-green", bar: "bg-gradient-to-r from-forest-green/15 to-transparent" },
};

function commandFromRecommendation(rec: Recommendation) {
  const action = rec.action.toLowerCase();
  if (action.includes("fan")) return { device: "fan", value: true, duration: 20, label: "Execute Fan" };
  if (action.includes("pump")) return { device: "pump", value: true, duration: 2, label: "Execute Pump" };
  if (action.includes("misting")) return { device: "misting", value: true, duration: 3, label: "Execute Misting" };
  return null;
}

export function RecommendationPanel({ recommendations, layers, onExecute }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function execute(rec: Recommendation) {
    const command = commandFromRecommendation(rec);
    if (!command) return;
    setBusyId(rec.id);
    setFeedback(null);
    try {
      await onExecute(rec.layer_id, command.device, command.value, command.duration);
      setFeedback(`Safe command sent to ${command.device}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Command failed safety validation.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase text-muted">AI Recommendations</p>
          <h2 className="text-lg font-semibold text-ink">Suggested Actions</h2>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-md bg-spring-green/30 text-forest-green">
          <Sparkles size={18} />
        </span>
      </div>
      {feedback && (
        <div className="mb-3 rounded-md border border-card-border bg-field-bg px-3 py-2 text-xs text-muted">
          {feedback}
        </div>
      )}

      <div className="space-y-2 stagger">
        {recommendations.length === 0 && (
          <div className="rounded-md border border-dashed border-card-border py-8 text-center text-sm text-muted">
            No recommendations — all layers optimal
          </div>
        )}
        {recommendations.slice(0, 5).map((rec) => {
          const ps = priorityStyles[rec.priority] || priorityStyles.low;
          const layer = layers.find((item) => item.id === rec.layer_id);
          const command = commandFromRecommendation(rec);
          return (
            <div key={rec.id} className="group relative overflow-hidden rounded-md border border-card-border bg-field-bg p-4 transition-all hover:shadow-sm">
              <div className={`absolute inset-y-0 left-0 w-1 ${ps.bar}`} />
              <div className="flex items-start gap-3 pl-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ps.dot}`} />
                <div className="flex-1 min-w-0">
                  {layer && (
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted/60">
                      {layer.area_name.split("—")[0].trim()} · {layer.name} · {layer.crop}
                    </p>
                  )}
                  <p className="text-sm font-medium text-ink">{rec.action}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{rec.reason}</p>
                  {command && (
                    <button
                      type="button"
                      onClick={() => execute(rec)}
                      disabled={busyId === rec.id}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-forest-green/20 bg-spring-green/15 px-2.5 py-1.5 text-xs font-semibold text-forest-green transition hover:bg-spring-green/30 disabled:opacity-50"
                    >
                      <ShieldCheck size={12} />
                      {busyId === rec.id ? "Validating..." : command.label}
                    </button>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-ink">{rec.confidence}%</span>
                  <p className="text-xs text-muted">confidence</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
