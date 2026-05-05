import { Activity, Bell, Droplets, PlugZap, TrendingUp, Leaf } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useMemo, useState } from "react";

import { MetricCard } from "../components/MetricCard";
import type { FarmStreamContext } from "../App";

export default function DashboardPage() {
  const { farm, alerts } = useOutletContext<FarmStreamContext>();

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
    <div className="space-y-8 animate-fade-in">
      {/* Hero metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <MetricCard icon={Activity} label="Farm Health" value={`${farm.average_health_score}`} detail={`${farm.layers.length} layers monitored`} />
        <MetricCard icon={Bell} label="Active Alerts" value={`${alerts.length}`} detail="Live risk signals" tone="amber" />
        <MetricCard icon={Droplets} label="Water Saved" value={`${farm.sustainability.water_saved_liters.toFixed(0)}L`} detail="Smart irrigation" tone="cyan" />
        <MetricCard icon={PlugZap} label="Energy Saved" value={`${farm.sustainability.energy_optimized_kwh.toFixed(1)}kWh`} detail="Auto-mode savings" tone="mint" />
      </section>

      {/* Area filter */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/15 mr-3">Areas</span>
        <button
          onClick={() => setSelectedArea(null)}
          className={`rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all ${!selectedArea ? "bg-mint/[0.1] text-mint border border-mint/20" : "bg-white/[0.02] text-white/30 border border-white/[0.04] hover:text-white/50"}`}
        >
          All ({farm.layers.length})
        </button>
        {areas.map(([id, area]) => {
          const avg = Math.round(area.layers.reduce((s, l) => s + l.health_score, 0) / area.layers.length);
          return (
            <button
              key={id}
              onClick={() => setSelectedArea(id)}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all ${selectedArea === id ? "bg-mint/[0.1] text-mint border border-mint/20" : "bg-white/[0.02] text-white/30 border border-white/[0.04] hover:text-white/50"}`}
            >
              {area.name.split("—")[0].trim()} · {avg}
            </button>
          );
        })}
      </div>

      {/* Layer cards by area */}
      {displayedAreas.map(([areaId, area]) => {
        const avgHealth = Math.round(area.layers.reduce((s, l) => s + l.health_score, 0) / area.layers.length);
        const warnings = area.layers.filter(l => l.status !== "Healthy").length;
        return (
          <section key={areaId} className="animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint/[0.06] text-mint/60">
                  <Leaf size={14} />
                </span>
                <div>
                  <h3 className="text-[13px] font-semibold text-white/70">{area.name}</h3>
                  <p className="text-[11px] text-white/25">{area.layers.length} layers · Avg health {avgHealth}</p>
                </div>
              </div>
              {warnings > 0 && (
                <span className="rounded-full bg-amber/[0.08] border border-amber/15 px-2.5 py-1 text-[10px] font-semibold text-amber">
                  {warnings} warning{warnings > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 stagger">
              {area.layers.map((l) => {
                const statusColor = l.status === "Healthy" ? "mint" : l.status === "Warning" ? "amber" : "coral";
                return (
                  <div key={l.id} className="group relative overflow-hidden rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/[0.08] hover:bg-white/[0.03]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[10px] font-medium text-white/20 uppercase">{l.name}</p>
                        <p className="text-[13px] font-semibold text-white/80 mt-0.5">{l.crop}</p>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full bg-${statusColor} shadow-[0_0_8px_rgba(125,223,150,0.3)]`} />
                    </div>

                    <div className="text-2xl font-bold text-white mb-1">{l.health_score}</div>

                    {/* Mini health bar */}
                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${l.health_score >= 80 ? "bg-mint" : l.health_score >= 50 ? "bg-amber" : "bg-coral"}`}
                        style={{ width: `${l.health_score}%` }}
                      />
                    </div>

                    <p className="mt-2 text-[10px] text-white/20">{l.status}</p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
