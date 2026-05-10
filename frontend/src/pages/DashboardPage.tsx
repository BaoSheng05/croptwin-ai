import { Activity, Bell, CloudSun, Droplets, PlugZap, Sprout, WalletCards } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { MetricCard } from "../components/MetricCard";
import { BusinessImpactPanel } from "../components/BusinessImpactPanel";
import type { FarmStreamContext } from "../App";
import { api } from "../services/api";
import type { ClimateShield, YieldForecast } from "../types";
import { useSettings } from "../contexts/SettingsContext";

export default function DashboardPage() {
  const { farm, alerts, recommendations } = useOutletContext<FarmStreamContext>();
  const { formatCurrency } = useSettings();
  const [demoVersion] = useState(0);
  const [yieldForecast, setYieldForecast] = useState<YieldForecast | null>(null);
  const [climate, setClimate] = useState<ClimateShield | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getYieldForecast(), api.getClimateShield()])
      .then(([yieldData, climateData]) => {
        if (!alive) return;
        setYieldForecast(yieldData);
        setClimate(climateData);
      })
      .catch((error) => console.error("Dashboard summary failed", error));
    return () => { alive = false; };
  }, [demoVersion]);

  const harvestReady = useMemo(
    () => yieldForecast?.layers.filter((layer) => layer.can_mark_harvested).length ?? 0,
    [yieldForecast],
  );
  const urgentActions = useMemo(() => {
    const fromAlerts = alerts.slice(0, 2).map((alert) => alert.title);
    const fromRecs = recommendations.slice(0, 2).map((rec) => rec.action);
    return [...fromAlerts, ...fromRecs].slice(0, 3);
  }, [alerts, recommendations]);

  return (
    <div className="grid gap-6 animate-fade-in">
      <section className="rounded-lg border border-card-border bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-forest-green">Beginner Demo Path</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">Owner Summary</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
              One-screen view of farm health, risk, forecast yield, revenue, and climate readiness.
            </p>
          </div>
          <span className="rounded-md border border-forest-green/20 bg-spring-green/10 px-3 py-1.5 text-xs font-semibold text-forest-green">
            Live owner view
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            { icon: Sprout, title: "Expected Yield", text: `${yieldForecast?.total_estimated_kg.toFixed(1) ?? "-"} kg forecast` },
            { icon: WalletCards, title: "Estimated Revenue", text: yieldForecast ? formatCurrency(yieldForecast.total_estimated_revenue_rm) : "-" },
            { icon: CloudSun, title: "Climate Risk", text: climate ? `${climate.overall_risk}: ${climate.summary}` : "Loading climate shield" },
          ].map((item) => (
            <div key={item.title} className="rounded-md border border-card-border bg-field-bg p-4">
              <div className="flex items-center gap-2">
                <item.icon size={16} className="text-forest-green" />
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Hero metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <MetricCard icon={Activity} label="Farm Health" value={`${farm.average_health_score}`} detail={`${farm.layers.length} layers monitored`} />
        <MetricCard icon={Bell} label="Active Alerts" value={`${alerts.length}`} detail="Live risk signals" tone="amber" />
        <MetricCard icon={Droplets} label="Water Saved" value={`${farm.sustainability.water_saved_liters.toFixed(0)}L`} detail="Smart irrigation" tone="blue" />
        <MetricCard icon={PlugZap} label="Energy Saved" value={`${farm.sustainability.energy_optimized_kwh.toFixed(1)}kWh`} detail="Auto-mode savings" tone="green" />
      </section>

      <BusinessImpactPanel key={demoVersion} />

      <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Top Urgent Actions</h3>
          <span className="rounded-md border border-card-border bg-field-bg px-2 py-1 text-xs font-semibold text-muted">
            Harvest ready: {harvestReady}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {(urgentActions.length ? urgentActions : ["No urgent action right now"]).map((item) => (
            <div key={item} className="rounded-md border border-card-border bg-field-bg p-3 text-sm text-ink/80">
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
