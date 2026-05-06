import { useMemo, useState } from "react";
import { CheckCircle, ChevronDown, ChevronUp, Hand, Play, RefreshCw, Sparkles } from "lucide-react";
import type { FarmLayer, Recommendation } from "../types";

type Props = {
  recommendations: Recommendation[];
  layers: FarmLayer[];
  isResolving: (rec: Recommendation) => boolean;
  getResolvingProgress?: (rec: Recommendation) => number | null;
  onResolveSingle: (rec: Recommendation) => void;
  onAutoResolve: () => void;
  resolvingAuto: boolean;
  isAutomatable: (rec: Recommendation) => boolean;
};

const priorityStyles = {
  high:   { dot: "bg-status-critical", bar: "bg-gradient-to-r from-status-critical/30 to-transparent" },
  medium: { dot: "bg-status-warning", bar: "bg-gradient-to-r from-status-warning/20 to-transparent" },
  low:    { dot: "bg-forest-green", bar: "bg-gradient-to-r from-forest-green/15 to-transparent" },
};

const DEFAULT_VISIBLE_RECOMMENDATIONS = 6;

export function RecommendationPanel({ recommendations, layers, isResolving, getResolvingProgress, onResolveSingle, onAutoResolve, resolvingAuto, isAutomatable }: Props) {
  const [expanded, setExpanded] = useState(false);
  const sortedRecommendations = useMemo(
    () => [...recommendations].sort((a, b) => {
      const priorityRank = { high: 0, medium: 1, low: 2 };
      const rankDelta = priorityRank[a.priority] - priorityRank[b.priority];
      if (rankDelta !== 0) return rankDelta;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }),
    [recommendations],
  );
  const visibleRecommendations = expanded
    ? sortedRecommendations
    : sortedRecommendations.slice(0, DEFAULT_VISIBLE_RECOMMENDATIONS);
  const hiddenCount = Math.max(0, sortedRecommendations.length - visibleRecommendations.length);

  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase text-muted">Risk Recommendations</p>
          <h2 className="text-lg font-semibold text-ink">Suggested Actions</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAutoResolve}
            disabled={resolvingAuto}
            className="inline-flex items-center gap-1.5 rounded-md border border-forest-green/20 bg-spring-green/15 px-2.5 py-1.5 text-xs font-semibold text-forest-green transition hover:bg-spring-green/30 disabled:opacity-50"
            title="Auto resolve all suggestions"
          >
            {resolvingAuto ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={13} />}
            {resolvingAuto ? "Checking..." : "Auto Resolve"}
          </button>
          <span className="grid h-10 w-10 place-items-center rounded-md bg-spring-green/30 text-forest-green">
            <Sparkles size={18} />
          </span>
        </div>
      </div>
      <div className="space-y-2 stagger">
        {recommendations.length === 0 && (
          <div className="rounded-md border border-dashed border-card-border py-8 text-center text-sm text-muted">
            No new actions right now
          </div>
        )}
        {visibleRecommendations.map((rec) => {
          const ps = priorityStyles[rec.priority] || priorityStyles.low;
          const layer = layers.find((item) => item.id === rec.layer_id);
          const resolving = isResolving(rec);
          const progress = resolving ? getResolvingProgress?.(rec) ?? null : null;
          const canAutomate = isAutomatable(rec);
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
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-sm font-bold text-ink">{rec.confidence}%</span>
                    <p className="text-xs text-muted">confidence</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onResolveSingle(rec)}
                    disabled={resolving || !canAutomate}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      resolving
                        ? "border border-card-border bg-field-bg text-muted cursor-not-allowed opacity-60"
                        : !canAutomate
                          ? "border border-amber-300/30 bg-amber-50 text-amber-700 cursor-not-allowed opacity-70"
                          : "border border-forest-green/30 bg-spring-green/20 text-forest-green hover:bg-spring-green/40"
                    }`}
                    title={!canAutomate ? "Requires manual intervention" : resolving ? `Resolving${progress === null ? "" : ` ${progress}%`}` : "Execute this suggestion"}
                  >
                    {resolving ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        {progress === null ? "Resolving..." : `Resolving ${progress}%`}
                      </>
                    ) : !canAutomate ? (
                      <>
                        <Hand size={12} />
                        Manual
                      </>
                    ) : (
                      <>
                        <Play size={12} />
                        Resolve
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-card-border bg-field-bg px-3 py-2 text-xs font-semibold text-muted transition hover:bg-spring-green/10 hover:text-forest-green"
          >
            <ChevronDown size={14} />
            Show {hiddenCount} more
          </button>
        )}
        {expanded && sortedRecommendations.length > DEFAULT_VISIBLE_RECOMMENDATIONS && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-card-border bg-field-bg px-3 py-2 text-xs font-semibold text-muted transition hover:bg-spring-green/10 hover:text-forest-green"
          >
            <ChevronUp size={14} />
            Show less
          </button>
        )}
      </div>
    </div>
  );
}
