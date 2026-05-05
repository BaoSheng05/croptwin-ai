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
    <div className="grid gap-6 animate-fade-in">
      <h2 className="text-2xl font-semibold text-ink">Farm Overview</h2>

      {/* Hero metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <MetricCard icon={Activity} label="Farm Health" value={`${farm.average_health_score}`} detail={`${farm.layers.length} layers monitored`} />
        <MetricCard icon={Bell} label="Active Alerts" value={`${alerts.length}`} detail="Live risk signals" tone="amber" />
        <MetricCard icon={Droplets} label="Water Saved" value={`${farm.sustainability.water_saved_liters.toFixed(0)}L`} detail="Smart irrigation" tone="blue" />
        <MetricCard icon={PlugZap} label="Energy Saved" value={`${farm.sustainability.energy_optimized_kwh.toFixed(1)}kWh`} detail="Auto-mode savings" tone="green" />
      </section>

      {/* Area filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted mr-3">Areas</span>
        <button
          onClick={() => setSelectedArea(null)}
          className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors"
          style={!selectedArea
            ? { backgroundColor: "#228B22", color: "#FFFFFF" }
            : { backgroundColor: "#EAF5EA", color: "#000000", border: "1px solid #B3D4B3" }
          }
        >
          All ({farm.layers.length})
        </button>
        {areas.map(([id, area]) => {
          const avg = Math.round(area.layers.reduce((s, l) => s + l.health_score, 0) / area.layers.length);
          return (
            <button
              key={id}
              onClick={() => setSelectedArea(id)}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={selectedArea === id
                ? { backgroundColor: "#228B22", color: "#FFFFFF" }
                : { backgroundColor: "#EAF5EA", color: "#000000", border: "1px solid #B3D4B3" }
              }
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
                <span className="grid h-8 w-8 place-items-center rounded-md bg-spring-green/20 text-forest-green">
                  <Leaf size={14} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{area.name}</h3>
                  <p className="text-xs text-muted">{area.layers.length} layers · Avg health {avgHealth}</p>
                </div>
              </div>
              {warnings > 0 && (
                <span className="rounded-md bg-amber-50 border border-status-warning/20 px-2.5 py-1 text-xs font-semibold text-status-warning">
                  {warnings} warning{warnings > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 stagger">
              {area.layers.map((l) => {
                const statusColor = l.status === "Healthy" ? "status-healthy" : l.status === "Warning" ? "status-warning" : "status-critical";
                return (
                  <div key={l.id} className="rounded-lg border border-card-border bg-white p-4 shadow-card transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs font-medium text-muted uppercase">{l.name}</p>
                        <p className="text-sm font-semibold text-ink mt-0.5">{l.crop}</p>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full bg-${statusColor}`} />
                    </div>

                    <div className="text-2xl font-bold text-ink mb-1">{l.health_score}</div>

                    {/* Mini health bar */}
                    <div className="h-1 rounded-full bg-field-bg overflow-hidden border border-card-border/50">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${l.health_score}%`,
                          backgroundColor: l.health_score >= 80 ? "#1E8449" : l.health_score >= 50 ? "#C27B00" : "#C0392B",
                        }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-muted">{l.status}</p>
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
