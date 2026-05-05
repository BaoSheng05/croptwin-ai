import { Activity, Bell, Droplets, PlugZap } from "lucide-react";
import { useOutletContext } from "react-router-dom";

import { MetricCard } from "../components/MetricCard";
import type { FarmStreamContext } from "../App";

export default function DashboardPage() {
  const { farm, alerts } = useOutletContext<FarmStreamContext>();

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold text-white">Farm Overview</h2>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Average Health"
          value={`${farm.average_health_score}`}
          detail="Farm-wide crop score"
        />
        <MetricCard icon={Bell} label="Active Alerts" value={`${alerts.length}`} detail="Live risk signals" tone="amber" />
        <MetricCard
          icon={Droplets}
          label="Water Saved"
          value={`${farm.sustainability.water_saved_liters.toFixed(0)}L`}
          detail="Estimated optimization"
          tone="cyan"
        />
        <MetricCard
          icon={PlugZap}
          label="Energy Optimized"
          value={`${farm.sustainability.energy_optimized_kwh.toFixed(1)}kWh`}
          detail="Auto-mode savings"
          tone="mint"
        />
      </section>
      <div className="mt-6 rounded-lg border border-white/10 bg-panel p-6">
        <h3 className="mb-4 text-lg font-medium">Quick Status</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {farm.layers.map((l) => (
            <div key={l.id} className="rounded-md border border-white/5 bg-ink p-4">
              <p className="text-sm text-white/50">{l.name}</p>
              <p className="mt-1 text-xl font-semibold">{l.status}</p>
              <p className="mt-2 text-xs text-white/40">Health: {l.health_score}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
