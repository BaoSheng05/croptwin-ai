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
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Critical", value: critical, tone: "text-coral" },
          { label: "Warning", value: warnings, tone: "text-amber" },
          { label: "Predictive", value: predictive, tone: "text-cyan" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">{item.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
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
