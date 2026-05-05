import { AlertTriangle } from "lucide-react";

import type { Alert } from "../types";

type AlertsPanelProps = {
  alerts: Alert[];
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-muted">Risk Engine</p>
          <h2 className="text-lg font-semibold text-ink">Active Alerts</h2>
        </div>
        <AlertTriangle size={20} className="text-status-warning" />
      </div>

      <div className="mt-4 space-y-3">
        {alerts.slice(0, 4).map((alert) => (
          <div key={alert.id} className="rounded-md border border-card-border bg-field-bg p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-ink">{alert.title}</p>
              <span className={alert.severity === "critical" ? "text-status-critical" : "text-status-warning"}>
                {alert.predictive ? "Predictive" : alert.severity}
              </span>
            </div>
            <p className="mt-1 text-sm leading-5 text-muted">{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
