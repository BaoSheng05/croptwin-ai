import { BatteryCharging, CloudSun, Clock3, Droplets, Lightbulb, PlugZap, TrendingDown, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../services/api";
import type { EnergyOptimizer } from "../types";
import { useSettings } from "../contexts/SettingsContext";
import { useApiResource } from "../hooks/useApiResource";

export default function EnergyPage() {
  const { data: energy, loading } = useApiResource<EnergyOptimizer>(
    () => api.getEnergyOptimizer(),
    [],
  );
  const { formatCurrency, formatTemp, formatRate } = useSettings();

  const chartData = energy?.layer_plans.map((plan) => ({
    name: plan.layer_name,
    Current: plan.current_kw,
    Optimized: plan.optimized_kw,
  })) ?? [];

  return (
    <div className="grid gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Energy Optimizer</h2>
          <p className="mt-1 text-xs text-muted">AI schedule for LED and climate cost reduction.</p>
        </div>
        {energy && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border border-purple-300/30 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700">
              <Lightbulb size={14} />
              {energy.strategy.mode} · {energy.strategy.window}
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-forest-green/20 bg-spring-green/10 px-3 py-1.5 text-xs font-semibold text-forest-green">
              <Clock3 size={14} />
              {energy.tariff.period} · {formatRate(energy.tariff.rate_rm_per_kwh)}/kWh
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-sky-300/30 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
              <CloudSun size={14} />
              {energy.weather.source === "open-meteo" ? "Live weather" : "Weather fallback"}
            </span>
          </div>
        )}
      </div>

      {loading || !energy ? (
        <div className="rounded-lg border border-card-border bg-white p-8 text-sm text-muted shadow-card">Loading energy model...</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Current Load", value: `${energy.current_kw.toFixed(2)} kW`, icon: PlugZap, tone: "text-status-warning" },
              { label: "Optimized Load", value: `${energy.optimized_kw.toFixed(2)} kW`, icon: BatteryCharging, tone: "text-forest-green" },
              { label: "Daily Saving", value: formatRate(energy.estimated_daily_savings_rm), icon: TrendingDown, tone: "text-sky-600" },
              { label: "Monthly Saving", value: formatCurrency(energy.estimated_monthly_savings_rm), icon: Zap, tone: "text-purple-600" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-card-border bg-white p-5 shadow-card">
                <div className={`mb-3 flex items-center gap-2 ${item.tone}`}>
                  <item.icon size={18} />
                  <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
                </div>
                <p className="text-2xl font-semibold text-ink">{item.value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2 text-forest-green">
              <Lightbulb size={17} />
              <h3 className="text-sm font-semibold text-ink">Sunlight-First Energy Strategy</h3>
            </div>
            <p className="text-sm leading-relaxed text-ink/80">{energy.recommendation}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-card-border bg-field-bg p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">LED Policy</p>
                <p className="mt-1 text-sm text-ink/80">{energy.strategy.led_policy}</p>
              </div>
              <div className="rounded-md border border-card-border bg-field-bg p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">HVAC Policy</p>
                <p className="mt-1 text-sm text-ink/80">{energy.strategy.hvac_policy}</p>
              </div>
              <div className="rounded-md border border-card-border bg-field-bg p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Light Shift</p>
                <p className="mt-1 text-sm text-ink/80">{energy.strategy.target_dli_shift}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">
              <span>Next low-cost window: {energy.tariff.next_low_cost_window}</span>
              <span>Tariff source: {energy.tariff.source}</span>
              <span>Weather: {energy.weather.location}</span>
              <span>Sunlight factor: {Math.round(energy.weather.sunlight_factor * 100)}%</span>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Outdoor Temp", value: formatTemp(energy.weather.temperature_c), icon: CloudSun },
              { label: "Outdoor Humidity", value: `${energy.weather.humidity_percent.toFixed(0)}%`, icon: Droplets },
              { label: "Cloud Cover", value: `${energy.weather.cloud_cover_percent.toFixed(0)}%`, icon: CloudSun },
              { label: "Rainfall", value: `${energy.weather.precipitation_mm.toFixed(1)} mm`, icon: Droplets },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-card-border bg-white p-4 shadow-card">
                <div className="mb-2 flex items-center gap-2 text-sky-700">
                  <item.icon size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
                </div>
                <p className="text-xl font-semibold text-ink">{item.value}</p>
              </div>
            ))}
          </section>

          <section className="grid min-h-[520px] gap-5 xl:h-[calc(100vh-420px)] xl:min-h-[520px] xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex min-h-0 flex-col rounded-lg border border-card-border bg-white p-5 shadow-card">
              <h3 className="mb-4 text-sm font-semibold text-ink">Current vs Optimized Load</h3>
              <div className="min-h-[420px] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="name" stroke="#2D4A2D" fontSize={11} />
                    <YAxis stroke="#2D4A2D" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #B3D4B3", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="Current" fill="#C27B00" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Optimized" fill="#228B22" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="min-h-0 space-y-3 overflow-y-auto pr-2 xl:max-h-full">
              {energy.layer_plans.map((plan) => (
                <div key={plan.layer_id} className="rounded-lg border border-card-border bg-white p-4 shadow-card">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{plan.layer_name} · {plan.crop}</p>
                      <p className="text-xs text-muted">{plan.reason}</p>
                    </div>
                    <span className="rounded-md bg-field-bg px-2 py-1 text-xs font-semibold text-forest-green">
                      {plan.natural_light_ratio}% sun
                    </span>
                  </div>
                  <p className="mb-2 text-xs text-muted">Weather-adjusted light: {plan.weather_adjusted_light_lux.toFixed(0)} lux</p>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>LED {plan.current_led_percent}%</span>
                    <span className="font-semibold text-ink">to</span>
                    <span className="font-semibold text-forest-green">LED {plan.recommended_led_percent}%</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>HVAC</span>
                    <span className="font-semibold text-forest-green">Level {plan.recommended_hvac_level}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
