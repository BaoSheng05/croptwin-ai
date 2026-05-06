import { useOutletContext } from "react-router-dom";
import { CheckCircle, RefreshCw } from "lucide-react";
import { AlertsPanel } from "../components/AlertsPanel";
import { RecommendationPanel } from "../components/RecommendationPanel";
import { api } from "../services/api";
import type { FarmStreamContext } from "../App";
import type { AlertResolveResult } from "../types";
import { useState } from "react";

export default function AlertsPage() {
  const { farm, alerts, recommendations, refresh } = useOutletContext<FarmStreamContext>();
  const [resolveResult, setResolveResult] = useState<AlertResolveResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const critical = alerts.filter((alert) => alert.severity === "critical").length;
  const warnings = alerts.filter((alert) => alert.severity === "warning").length;
  const solved = resolveResult?.resolved_count ?? 0;

  async function autoResolve() {
    setResolving(true);
    try {
      const result = await api.autoResolveAlerts();
      setResolveResult(result);
      await refresh();
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="grid gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Alerts & Recommendations</h2>
          <p className="mt-1 text-xs text-muted">Duplicate active alerts refresh at most every 30 minutes.</p>
        </div>
        <button
          type="button"
          onClick={autoResolve}
          disabled={resolving}
          className="inline-flex items-center gap-2 rounded-md border border-forest-green/20 bg-spring-green/15 px-3 py-2 text-sm font-semibold text-forest-green transition hover:bg-spring-green/30 disabled:opacity-50"
        >
          {resolving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle size={15} />}
          {resolving ? "Checking..." : "Auto Resolve"}
        </button>
      </div>

      {resolveResult && (
        <div className={`rounded-lg border p-4 ${resolveResult.resolved_count > 0 ? "border-forest-green/20 bg-spring-green/15" : "border-card-border bg-white"}`}>
          <p className="text-sm font-semibold text-ink">
            {resolveResult.resolved_count > 0 ? `Solved ${resolveResult.resolved_count} alert${resolveResult.resolved_count > 1 ? "s" : ""}` : "No solved alerts yet"}
          </p>
          {resolveResult.resolved.length > 0 ? (
            <div className="mt-2 space-y-1">
              {resolveResult.resolved.map((item) => (
                <p key={item.id} className="text-sm text-muted">{item.message}</p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted">Current readings still show active issues. Keep monitoring or execute the recommended action.</p>
          )}
        </div>
      )}

      {/* Summary stats — new from baosheng */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Critical", value: critical, color: "text-status-critical", bg: "bg-red-50 border-status-critical/20" },
          { label: "Warning", value: warnings, color: "text-status-warning", bg: "bg-amber-50 border-status-warning/20" },
          { label: "Solved", value: solved, color: "text-forest-green", bg: "bg-spring-green/15 border-forest-green/20" },
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
        />
      </div>
    </div>
  );
}
