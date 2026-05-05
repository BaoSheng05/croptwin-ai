import { Sparkles, ChevronRight } from "lucide-react";
import type { Recommendation } from "../types";

type Props = { recommendations: Recommendation[] };

const priorityStyles = {
  high:   { dot: "bg-coral", bar: "bg-gradient-to-r from-coral/30 to-transparent" },
  medium: { dot: "bg-amber", bar: "bg-gradient-to-r from-amber/20 to-transparent" },
  low:    { dot: "bg-mint",  bar: "bg-gradient-to-r from-mint/15 to-transparent" },
};

export function RecommendationPanel({ recommendations }: Props) {
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

      <div className="space-y-2 stagger">
        {recommendations.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/[0.06] py-8 text-center text-[13px] text-white/25">
            No recommendations — all layers optimal
          </div>
        )}
        {recommendations.slice(0, 5).map((rec) => {
          const ps = priorityStyles[rec.priority] || priorityStyles.low;
          return (
            <div key={rec.id} className="group relative overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 transition-all hover:border-white/[0.08]">
              <div className={`absolute inset-y-0 left-0 w-1 ${ps.bar}`} />
              <div className="flex items-start gap-3 pl-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ps.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white/80">{rec.action}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/35">{rec.reason}</p>
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
