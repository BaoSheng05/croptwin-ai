import { Sparkles } from "lucide-react";

import type { Recommendation } from "../types";

type RecommendationPanelProps = {
  recommendations: Recommendation[];
};

export function RecommendationPanel({ recommendations }: RecommendationPanelProps) {
  const top = recommendations[0];

  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted">AI Recommendation</p>
          <h2 className="text-lg font-semibold text-ink">{top?.action ?? "Keep climate recipe"}</h2>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-md bg-spring-green/30 text-forest-green">
          <Sparkles size={18} />
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">
        {top?.reason ?? "All layers are inside their current crop recipe range."}
      </p>
      <div className="mt-4 flex items-center justify-between rounded-md bg-field-bg px-3 py-2 text-sm">
        <span className="text-muted">Confidence</span>
        <span className="font-semibold text-ink">{top?.confidence ?? 72}%</span>
      </div>
    </div>
  );
}
