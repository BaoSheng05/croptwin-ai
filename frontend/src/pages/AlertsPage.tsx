import { useOutletContext } from "react-router-dom";
import { AlertsPanel } from "../components/AlertsPanel";
import { RecommendationPanel } from "../components/RecommendationPanel";
import type { FarmStreamContext } from "../App";

export default function AlertsPage() {
  const { farm, alerts, recommendations, executeSafeCommand, refresh } = useOutletContext<FarmStreamContext>();
  const critical = alerts.filter((alert) => alert.severity === "critical").length;
  const warnings = alerts.filter((alert) => alert.severity === "warning").length;
  const predictive = alerts.filter((alert) => alert.predictive).length;

  return (
    <div className="grid gap-6 animate-fade-in">
      <h2 className="text-2xl font-semibold text-ink">Alerts & Recommendations</h2>

      {/* Summary stats — new from baosheng */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Critical", value: critical, color: "text-status-critical", bg: "bg-red-50 border-status-critical/20" },
          { label: "Warning", value: warnings, color: "text-status-warning", bg: "bg-amber-50 border-status-warning/20" },
          { label: "Predictive", value: predictive, color: "text-sky-600", bg: "bg-sky-50 border-sky-300/30" },
        ].map((item) => (
          <div key={item.label} className={`rounded-lg border p-4 ${item.bg}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{item.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AlertsPanel alerts={alerts} layers={farm.layers} />
        <RecommendationPanel
          recommendations={recommendations}
          layers={farm.layers}
          onExecute={async (layerId, device, value, duration) => {
            await executeSafeCommand(layerId, device, value, duration);
            await refresh();
          }}
        />
      </div>
    </div>
  );
}
