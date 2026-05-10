import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CloudRain, RefreshCw, ShieldCheck, Thermometer, Wind } from "lucide-react";
import { api } from "../services/api";
import type { ClimateShield } from "../types";
import { useSettings } from "../contexts/SettingsContext";
import { useApiResource } from "../hooks/useApiResource";

const riskClass = {
  Low: "border-forest-green/20 bg-spring-green/10 text-forest-green",
  Medium: "border-status-warning/20 bg-amber-50 text-status-warning",
  High: "border-status-critical/20 bg-red-50 text-status-critical",
  Critical: "border-status-critical bg-red-100 text-status-critical",
};

function labelTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { weekday: "short", hour: "2-digit" });
}

export default function ClimateShieldPage() {
  const { settings, formatTemp } = useSettings();
  const { data, loading, refresh } = useApiResource<ClimateShield>(
    () => api.getClimateShield(),
    [],
  );

  const chartData = data?.forecast_points.map((point) => ({
    time: labelTime(point.time),
    Temperature: settings.tempUnit === "F" ? Number(((point.temperature ?? 0) * 9/5 + 32).toFixed(1)) : (point.temperature ?? 0),
    Rain: point.rain_probability ?? 0,
    Humidity: point.humidity ?? 0,
  })) ?? [];

  return (
    <div className="grid gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Climate Shield</h2>
          <p className="mt-1 text-xs text-muted">72-hour disaster forecast and preparedness automation for vertical farming.</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-card-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-spring-green/20 disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading || !data ? (
        <div className="rounded-lg border border-card-border bg-white p-8 text-sm text-muted shadow-card">Loading climate risk forecast...</div>
      ) : (
        <>
          <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-forest-green">
                  <ShieldCheck size={18} />
                  <h3 className="text-sm font-semibold text-ink">Preparedness Status</h3>
                </div>
                <p className="text-sm leading-relaxed text-ink/80">{data.summary}</p>
                <p className="mt-2 text-xs text-muted">Source: {data.source} · {data.location}</p>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-sm font-bold ${riskClass[data.overall_risk]}`}>
                {data.overall_risk} Risk
              </span>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Max Temp", value: formatTemp(data.metrics.max_temperature_c), icon: Thermometer },
              { label: "Rain Total", value: `${data.metrics.total_rain_mm.toFixed(1)} mm`, icon: CloudRain },
              { label: "Rain Probability", value: `${data.metrics.max_rain_probability_percent.toFixed(0)}%`, icon: CloudRain },
              { label: "Max Wind", value: `${data.metrics.max_wind_kmh.toFixed(0)} km/h`, icon: Wind },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-card-border bg-white p-5 shadow-card">
                <div className="mb-3 flex items-center gap-2 text-forest-green">
                  <item.icon size={18} />
                  <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
                </div>
                <p className="text-2xl font-semibold text-ink">{item.value}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
              <h3 className="mb-4 text-sm font-semibold text-ink">72h Forecast Signals</h3>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="time" stroke="#2D4A2D" fontSize={11} />
                  <YAxis stroke="#2D4A2D" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #B3D4B3", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="Temperature" name={`Temp (°${settings.tempUnit})`} stroke="#C27B00" fill="#C27B00" fillOpacity={0.12} />
                  <Area type="monotone" dataKey="Rain" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.12} />
                  <Area type="monotone" dataKey="Humidity" stroke="#228B22" fill="#228B22" fillOpacity={0.08} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
                <h3 className="mb-3 text-sm font-semibold text-ink">Detected Climate Risks</h3>
                <div className="space-y-3">
                  {data.risks.map((risk) => (
                    <div key={risk.title} className="rounded-md border border-card-border bg-field-bg p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                          <AlertTriangle size={14} />
                          {risk.title}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${riskClass[risk.severity]}`}>{risk.severity}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-muted">{risk.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-ink">Auto-Control Preparation</h3>
              <ul className="space-y-2 text-sm text-ink/80">
                {data.control_actions.map((item) => <li key={item}>→ {item}</li>)}
              </ul>
            </div>
            <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-ink">Owner Checklist</h3>
              <ul className="space-y-2 text-sm text-ink/80">
                {data.preparedness_checklist.map((item) => <li key={item}>□ {item}</li>)}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
