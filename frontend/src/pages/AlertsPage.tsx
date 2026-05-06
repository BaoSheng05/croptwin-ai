import { useOutletContext } from "react-router-dom";
import { AlertsPanel } from "../components/AlertsPanel";
import { RecommendationPanel } from "../components/RecommendationPanel";
import { SolvedPanel } from "../components/SolvedPanel";
import type { FarmStreamContext } from "../App";

export default function AlertsPage() {
  const { farm, alerts, recommendations, resolveManager } = useOutletContext<FarmStreamContext>();
  const { solved, clearSolved, deleteSolved, isResolving, getResolvingProgress, isAutomatable } = resolveManager;

  // One recommendation is shown for every active alert.
  const actionableRecs = recommendations.filter((r) => r.priority !== "low");

  const critical = alerts.filter((a) => a.severity === "critical").length;
  const warnings = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="grid gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold text-ink">Alerts & Recommendations</h2>
        <p className="mt-1 text-xs text-muted">Each active alert has one linked recommendation.</p>
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
          getResolvingProgress={getResolvingProgress}
          isAutomatable={isAutomatable}
        />
        <SolvedPanel
          solved={solved}
          resolving={resolveManager.resolving}
          layers={farm.layers}
          onClearAll={clearSolved}
          onDeleteOne={deleteSolved}
        />
      </div>
    </div>
  );
}
