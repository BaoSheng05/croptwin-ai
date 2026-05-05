import { AlertTriangle, ShieldAlert, Eye } from "lucide-react";
import type { Alert } from "../types";

type AlertsPanelProps = { alerts: Alert[] };

const severityConfig = {
  critical: { icon: ShieldAlert, bg: "bg-coral/[0.06]", border: "border-coral/15", text: "text-coral", dot: "bg-coral" },
  warning:  { icon: AlertTriangle, bg: "bg-amber/[0.06]", border: "border-amber/15", text: "text-amber", dot: "bg-amber" },
  info:     { icon: Eye, bg: "bg-cyan/[0.06]", border: "border-cyan/15", text: "text-cyan", dot: "bg-cyan" },
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">Risk Engine</p>
          <h2 className="text-base font-semibold text-white mt-0.5">Active Alerts</h2>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber/10 text-amber">
          <AlertTriangle size={16} />
        </span>
      </div>

      <div className="space-y-2 stagger">
        {alerts.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/[0.06] py-8 text-center text-[13px] text-white/25">
            No active alerts — all systems nominal
          </div>
        )}
        {alerts.slice(0, 5).map((alert) => {
          const cfg = severityConfig[alert.severity] || severityConfig.info;
          return (
            <div key={alert.id} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3.5 transition-all hover:scale-[1.01]`}>
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                <p className="flex-1 text-[13px] font-medium text-white/80">{alert.title}</p>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.text}`}>
                  {alert.predictive ? "Predicted" : alert.severity}
                </span>
              </div>
              <p className="mt-1.5 ml-[18px] text-[12px] leading-relaxed text-white/40">{alert.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
