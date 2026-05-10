import { useEffect, useState } from "react";
import { Banknote, ShieldCheck, TimerReset, TrendingUp } from "lucide-react";
import { api } from "../services/api";
import type { BusinessImpact } from "../types";
import { useSettings } from "../contexts/SettingsContext";

export function BusinessImpactPanel() {
  const [impact, setImpact] = useState<BusinessImpact | null>(null);
  const { formatCurrency } = useSettings();

  useEffect(() => {
    let alive = true;
    api.getBusinessImpact()
      .then((data) => { if (alive) setImpact(data); })
      .catch((error) => console.error("Business impact failed", error));
    return () => { alive = false; };
  }, []);

  if (!impact) return null;

  const items = [
    { label: "Monthly Value", value: formatCurrency(impact.estimated_monthly_value_rm), icon: Banknote, tone: "text-forest-green" },
    { label: "Crop Loss Avoided", value: `${impact.crop_loss_prevented_percent}%`, icon: ShieldCheck, tone: "text-status-warning" },
    { label: "Earlier Detection", value: `${impact.early_detection_days} days`, icon: TimerReset, tone: "text-sky-600" },
    { label: "Payback", value: `${impact.payback_months} mo`, icon: TrendingUp, tone: "text-purple-600" },
  ];

  return (
    <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Business Impact</h3>
          <p className="mt-1 text-xs text-muted">{impact.summary}</p>
        </div>
        <span className="rounded-md border border-forest-green/20 bg-spring-green/10 px-2.5 py-1 text-xs font-semibold text-forest-green">
          ROI model
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-md border border-card-border bg-field-bg p-4">
            <div className={`mb-2 flex items-center gap-2 ${item.tone}`}>
              <item.icon size={16} />
              <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
            </div>
            <p className="text-xl font-semibold text-ink">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
