import { Sparkles } from "lucide-react";

import type { Recommendation } from "../types";

type RecommendationPanelProps = {
  recommendations: Recommendation[];
};

export function RecommendationPanel({ recommendations }: RecommendationPanelProps) {
  const top = recommendations[0];

  return (
    <div className="rounded-lg border border-white/10 bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-white/45">AI Recommendation</p>
          <h2 className="text-lg font-semibold text-white">{top?.action ?? "Keep climate recipe"}</h2>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-md bg-lime/10 text-lime">
          <Sparkles size={18} />
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/65">
        {top?.reason ?? "All layers are inside their current crop recipe range."}
      </p>
      <div className="mt-4 flex items-center justify-between rounded-md bg-field px-3 py-2 text-sm">
        <span className="text-white/50">Confidence</span>
        <span className="font-semibold text-white">{top?.confidence ?? 72}%</span>
      </div>
    </div>
  );
}
