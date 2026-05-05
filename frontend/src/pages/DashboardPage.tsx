import { Activity, Bell, Droplets, PlugZap } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useMemo, useState } from "react";

import { MetricCard } from "../components/MetricCard";
import type { FarmStreamContext } from "../App";

export default function DashboardPage() {
  const { farm, alerts } = useOutletContext<FarmStreamContext>();

  // Group layers by area
  const areas = useMemo(() => {
    const map = new Map<string, { name: string; layers: typeof farm.layers }>();
    for (const l of farm.layers) {
      const key = l.area_id ?? "default";
      if (!map.has(key)) map.set(key, { name: l.area_name ?? key, layers: [] });
      map.get(key)!.layers.push(l);
    }
    return Array.from(map.entries());
  }, [farm.layers]);

  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const displayedAreas = selectedArea ? areas.filter(([id]) => id === selectedArea) : areas;

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold text-white">Farm Overview</h2>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Activity} label="Average Health" value={`${farm.average_health_score}`} detail={`${farm.layers.length} layers monitored`} />
        <MetricCard icon={Bell} label="Active Alerts" value={`${alerts.length}`} detail="Live risk signals" tone="amber" />
        <MetricCard icon={Droplets} label="Water Saved" value={`${farm.sustainability.water_saved_liters.toFixed(0)}L`} detail="Estimated optimization" tone="cyan" />
        <MetricCard icon={PlugZap} label="Energy Optimized" value={`${farm.sustainability.energy_optimized_kwh.toFixed(1)}kWh`} detail="Auto-mode savings" tone="mint" />
      </section>

      {/* Area filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase text-white/40 mr-2">Filter by area:</span>
        <button
          onClick={() => setSelectedArea(null)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${!selectedArea ? "bg-mint/15 text-mint" : "bg-white/5 text-white/50 hover:text-white"}`}
        >
          All Areas
        </button>
        {areas.map(([id, area]) => (
          <button
            key={id}
            onClick={() => setSelectedArea(id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${selectedArea === id ? "bg-mint/15 text-mint" : "bg-white/5 text-white/50 hover:text-white"}`}
          >
            {area.name.split("—")[0].trim()}
          </button>
        ))}
      </div>

      {/* Layer cards grouped by area */}
      {displayedAreas.map(([areaId, area]) => (
        <div key={areaId}>
          <h3 className="mb-3 text-sm font-medium uppercase text-white/40 tracking-wide">{area.name}</h3>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {area.layers.map((l) => (
              <div key={l.id} className="rounded-lg border border-white/5 bg-ink p-4 transition hover:border-white/15">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">{l.name}</p>
                  <span className={`h-2 w-2 rounded-full ${l.status === "Healthy" ? "bg-mint" : l.status === "Warning" ? "bg-amber-400" : "bg-coral"}`} />
                </div>
                <p className="text-xs text-white/40">{l.crop}</p>
                <p className="mt-2 text-2xl font-semibold">{l.health_score}</p>
                <p className="text-xs text-white/30">{l.status}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
