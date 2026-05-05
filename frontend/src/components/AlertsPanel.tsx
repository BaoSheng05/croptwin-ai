import { AlertTriangle } from "lucide-react";

import type { Alert } from "../types";

type AlertsPanelProps = {
  alerts: Alert[];
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-white/45">Risk Engine</p>
          <h2 className="text-lg font-semibold text-white">Active Alerts</h2>
        </div>
        <AlertTriangle size={20} className="text-amber" />
      </div>

      <div className="mt-4 space-y-3">
        {alerts.slice(0, 4).map((alert) => (
          <div key={alert.id} className="rounded-md border border-white/10 bg-field p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-white">{alert.title}</p>
              <span className={alert.severity === "critical" ? "text-coral" : "text-amber"}>
                {alert.predictive ? "Predictive" : alert.severity}
              </span>
            </div>
            <p className="mt-1 text-sm leading-5 text-white/55">{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
