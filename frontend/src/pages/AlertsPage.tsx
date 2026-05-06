import { useOutletContext } from "react-router-dom";
import { AlertsPanel } from "../components/AlertsPanel";
import { RecommendationPanel } from "../components/RecommendationPanel";
import { SolvedPanel } from "../components/SolvedPanel";
import type { FarmStreamContext } from "../App";
import { useCallback, useState } from "react";

export default function AlertsPage() {
  const { farm, alerts, recommendations, refresh, resolveManager } = useOutletContext<FarmStreamContext>();
  const { solved, hiddenRecs, resolveSingle, resolveAll, clearSolved, deleteSolved, isResolving, isAutomatable } = resolveManager;
  const [resolvingAuto, setResolvingAuto] = useState(false);

  // Build a set of layer+action keys that are currently resolving
  const resolvingKeys = new Set(resolveManager.resolving.map((e) => `${e.layerId}:${e.action}`));

  // 10 minute cooldown — once resolved, suppress duplicate recs for this period
  const COOLDOWN_MS = 10 * 60 * 1000;

  // Filter out: low-priority, duplicates, stale/solved, and currently-resolving suggestions
  const actionableRecs = (() => {
    const seen = new Set<string>();
    return recommendations.filter((r) => {
      if (r.priority === "low") return false;
      const key = `${r.layer_id}:${r.action}`;
      if (seen.has(key)) return false;
      if (resolvingKeys.has(key)) return false;
      
      // If we recently solved this layer+action, suppress it for 10 minutes
      const hiddenTime = hiddenRecs[key];
      if (hiddenTime && Date.now() - new Date(hiddenTime).getTime() < COOLDOWN_MS) {
        return false;
      }

      seen.add(key);
      return true;
    });
  })();

  const critical = alerts.filter((a) => a.severity === "critical").length;
  const warnings = alerts.filter((a) => a.severity === "warning").length;

  const handleResolveSingle = useCallback(
    (rec: (typeof recommendations)[0]) => resolveSingle(rec, farm.layers),
    [resolveSingle, farm.layers],
  );

  const handleAutoResolve = useCallback(async () => {
    setResolvingAuto(true);
    try {
      await resolveAll(actionableRecs, farm.layers, refresh);
    } finally {
      setResolvingAuto(false);
    }
  }, [resolveAll, actionableRecs, farm.layers, refresh]);

  return (
    <div className="grid gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold text-ink">Alerts & Recommendations</h2>
        <p className="mt-1 text-xs text-muted">Duplicate active alerts refresh at most every 30 minutes.</p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Critical", value: critical, color: "text-status-critical", bg: "bg-red-50 border-status-critical/20" },
          { label: "Warning", value: warnings, color: "text-status-warning", bg: "bg-amber-50 border-status-warning/20" },
          { label: "Solved", value: solved.length, color: "text-forest-green", bg: "bg-spring-green/15 border-forest-green/20" },
        ].map((item) => (
          <div key={item.label} className={`rounded-lg border p-4 ${item.bg}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{item.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Panels: Alerts | Suggested Actions | Solved */}
      <div className="grid gap-6 lg:grid-cols-3">
        <AlertsPanel alerts={alerts} layers={farm.layers} />
        <RecommendationPanel
          recommendations={actionableRecs}
          layers={farm.layers}
          isResolving={isResolving}
          onResolveSingle={handleResolveSingle}
          onAutoResolve={handleAutoResolve}
          resolvingAuto={resolvingAuto}
          isAutomatable={isAutomatable}
        />
        <SolvedPanel
          solved={solved}
          onClearAll={clearSolved}
          onDeleteOne={deleteSolved}
        />
      </div>
    </div>
  );
}
