import { CheckCircle2, Clock, Trash2 } from "lucide-react";
import type { SolvedSuggestion } from "../hooks/useResolveManager";

type Props = {
  solved: SolvedSuggestion[];
  onClearAll?: () => void;
  onDeleteOne?: (id: string) => void;
};

function timeAgo(timestamp: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function SolvedPanel({ solved, onClearAll, onDeleteOne }: Props) {
  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase text-muted">Resolution History</p>
          <h2 className="text-lg font-semibold text-ink">Solved</h2>
        </div>
        <div className="flex items-center gap-2">
          {solved.length > 0 && onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1 rounded-md border border-card-border bg-field-bg px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-red-50 hover:text-status-critical hover:border-status-critical/20"
              title="Clear all solved logs"
            >
              <Trash2 size={12} />
              Clear
            </button>
          )}
          <span className="grid h-10 w-10 place-items-center rounded-md bg-spring-green/30 text-forest-green">
            <CheckCircle2 size={18} />
          </span>
        </div>
      </div>
      <div className="space-y-2 stagger">
        {solved.length === 0 && (
          <div className="rounded-md border border-dashed border-card-border py-8 text-center text-sm text-muted">
            No solved suggestions yet
          </div>
        )}
        {solved.map((item) => (
          <div
            key={item.id}
            className="group relative overflow-hidden rounded-md border border-forest-green/15 bg-spring-green/5 p-4 transition-all"
          >
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-forest-green/30 to-transparent" />
            <div className="flex items-start gap-3 pl-2">
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-spring-green/30 text-forest-green">
                <CheckCircle2 size={12} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted/60">
                  {item.areaName.split("—")[0].trim()} · {item.layerName} · {item.crop}
                </p>
                <p className="text-sm font-medium text-ink line-through decoration-forest-green/40">{item.action}</p>
                <p className="mt-1 text-xs leading-relaxed text-forest-green/80">{item.resolvedDescription}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="flex items-center gap-1 text-xs text-muted">
                  <Clock size={11} />
                  <span>{timeAgo(item.solvedAt)}</span>
                </div>
                {onDeleteOne && (
                  <button
                    type="button"
                    onClick={() => onDeleteOne(item.id)}
                    className="grid h-6 w-6 place-items-center rounded-md text-muted/40 transition hover:bg-red-50 hover:text-status-critical opacity-0 group-hover:opacity-100"
                    title="Delete this log"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {solved.length > 0 && (
          <p className="text-center text-xs text-muted pt-1">
            Solved logs are auto-deleted after 24 hours
          </p>
        )}
      </div>
    </div>
  );
}
