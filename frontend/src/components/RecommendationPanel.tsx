import { ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import type { FarmLayer, Recommendation } from "../types";

type Props = {
  recommendations: Recommendation[];
  layers: FarmLayer[];
  onExecute: (layerId: string, device: string, value: boolean | number, duration?: number) => Promise<void>;
};

const priorityStyles = {
  high:   { dot: "bg-coral", bar: "bg-gradient-to-r from-coral/30 to-transparent" },
  medium: { dot: "bg-amber", bar: "bg-gradient-to-r from-amber/20 to-transparent" },
  low:    { dot: "bg-mint",  bar: "bg-gradient-to-r from-mint/15 to-transparent" },
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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">AI Recommendations</p>
          <h2 className="text-base font-semibold text-white mt-0.5">Suggested Actions</h2>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet/15 to-mint/10 text-mint">
          <Sparkles size={16} />
        </span>
      </div>
      {feedback && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[11px] text-white/45">
          {feedback}
        </div>
      )}

      <div className="space-y-2 stagger">
        {recommendations.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/[0.06] py-8 text-center text-[13px] text-white/25">
            No recommendations — all layers optimal
          </div>
        )}
        {recommendations.slice(0, 5).map((rec) => {
          const ps = priorityStyles[rec.priority] || priorityStyles.low;
          const layer = layers.find((item) => item.id === rec.layer_id);
          const command = commandFromRecommendation(rec);
          return (
            <div key={rec.id} className="group relative overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 transition-all hover:border-white/[0.08]">
              <div className={`absolute inset-y-0 left-0 w-1 ${ps.bar}`} />
              <div className="flex items-start gap-3 pl-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ps.dot}`} />
                <div className="flex-1 min-w-0">
                  {layer && (
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                      {layer.area_name.split("—")[0].trim()} · {layer.name} · {layer.crop}
                    </p>
                  )}
                  <p className="text-[13px] font-medium text-white/80">{rec.action}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/35">{rec.reason}</p>
                  {command && (
                    <button
                      type="button"
                      onClick={() => execute(rec)}
                      disabled={busyId === rec.id}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-mint/15 bg-mint/[0.07] px-2.5 py-1.5 text-[10px] font-semibold text-mint transition hover:bg-mint/[0.12] disabled:opacity-50"
                    >
                      <ShieldCheck size={12} />
                      {busyId === rec.id ? "Validating..." : command.label}
                    </button>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-white/60">{rec.confidence}%</span>
                  <p className="text-[10px] text-white/20">confidence</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
