import { Activity, Bell, CloudSun, Droplets, PlayCircle, PlugZap, Sprout, WalletCards } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { MetricCard } from "../components/MetricCard";
import { BusinessImpactPanel } from "../components/BusinessImpactPanel";
import type { FarmStreamContext } from "../App";
import { api } from "../services/api";
import type { ClimateShield, DemoScenario, YieldForecast } from "../types";
import { useSettings } from "../contexts/SettingsContext";
import { DEMO_CLIMATE_SHIELD, DEMO_YIELD_FORECAST, friendlyApiError } from "../utils/demoFallbacks";

const DEMO_FLOW: Array<{ scenario: DemoScenario; title: string; description: string }> = [
  {
    scenario: "normal",
    title: "Healthy baseline",
    description: "Start with stable farm conditions and healthy crop growth.",
  },
  {
    scenario: "high_humidity",
    title: "Humidity spike detected",
    description: "The system simulates dangerous humidity conditions and triggers alerts.",
  },
  {
    scenario: "disease_outbreak",
    title: "Disease prevention workflow",
    description: "CropTwin AI recommends prevention actions before damage spreads.",
  },
  {
    scenario: "energy_peak",
    title: "Energy optimization",
    description: "The AI reduces unnecessary power usage during high tariff periods.",
  },
  {
    scenario: "normal",
    title: "Recovered farm state",
    description: "The farm returns to stable conditions after corrective actions.",
  },
];

export default function DashboardPage() {
  const { farm, alerts, recommendations } = useOutletContext<FarmStreamContext>();
  const { formatCurrency } = useSettings();

  const [demoVersion, setDemoVersion] = useState(0);
  const [yieldForecast, setYieldForecast] = useState<YieldForecast | null>(null);
  const [climate, setClimate] = useState<ClimateShield | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [runningDemo, setRunningDemo] = useState(false);
  const [demoLog, setDemoLog] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;

    async function loadDashboardSummary() {
      try {
        setLoadingSummary(true);
        setSummaryError(null);
        setUsingFallback(false);

        const [yieldData, climateData] = await Promise.all([
          api.getYieldForecast(),
          api.getClimateShield(),
        ]);

        if (!alive) return;

        setYieldForecast(yieldData);
        setClimate(climateData);
      } catch (error) {
        console.error("Dashboard summary failed", error);

        if (!alive) return;

        setSummaryError(friendlyApiError(error));
        setUsingFallback(true);
        setYieldForecast(DEMO_YIELD_FORECAST);
        setClimate(DEMO_CLIMATE_SHIELD);
      } finally {
        if (alive) setLoadingSummary(false);
      }
    }

    loadDashboardSummary();

    return () => {
      alive = false;
    };
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

  async function runDemoFlow() {
    try {
      setRunningDemo(true);
      setDemoLog(["Initializing live demo flow..."]);

      for (const step of DEMO_FLOW) {
        setDemoLog((prev) => [...prev, `▶ ${step.title}: ${step.description}`]);

        try {
          await api.applyDemoScenario(step.scenario);
        } catch (error) {
          console.error("Demo scenario failed", error);
          setDemoLog((prev) => [
            ...prev,
            `⚠ Scenario '${step.title}' failed, continuing with fallback simulation.`,
          ]);
        }

        await new Promise((resolve) => setTimeout(resolve, 1400));
      }

      setDemoLog((prev) => [
        ...prev,
        "✅ Demo completed. Farm recovered successfully and recommendations updated.",
      ]);

      setDemoVersion((v) => v + 1);
    } finally {
      setRunningDemo(false);
    }
  }

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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runDemoFlow}
              disabled={runningDemo}
              className="inline-flex items-center gap-2 rounded-lg bg-forest-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlayCircle size={16} />
              {runningDemo ? "Running demo..." : "Start Live Demo"}
            </button>

            <span className="rounded-md border border-forest-green/20 bg-spring-green/10 px-3 py-1.5 text-xs font-semibold text-forest-green">
              Live owner view
            </span>
          </div>
        </div>

        {demoLog.length > 0 && (
          <div className="mt-4 rounded-lg border border-card-border bg-field-bg p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Demo Timeline</h3>
              <span className="text-xs text-muted">Guided hackathon walkthrough</span>
            </div>

            <div className="max-h-52 space-y-2 overflow-y-auto text-sm text-muted">
              {demoLog.map((item) => (
                <div key={item} className="rounded-md border border-card-border bg-white px-3 py-2">
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {summaryError && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-semibold">Live API temporarily unavailable</div>
            <p className="mt-1">
              CropTwin switched to a demo snapshot so your presentation can continue without blank screens.
            </p>
            <p className="mt-2 text-xs opacity-80">Technical detail: {summaryError}</p>
          </div>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            {
              icon: Sprout,
              title: "Expected Yield",
              text: loadingSummary
                ? "Loading live yield forecast..."
                : `${yieldForecast?.total_estimated_kg.toFixed(1) ?? "-"} kg forecast`,
            },
            {
              icon: WalletCards,
              title: "Estimated Revenue",
              text: loadingSummary
                ? "Calculating projected revenue..."
                : yieldForecast
                  ? formatCurrency(yieldForecast.total_estimated_revenue_rm)
                  : "-",
            },
            {
              icon: CloudSun,
              title: "Climate Risk",
              text: loadingSummary
                ? "Checking climate shield..."
                : climate
                  ? `${climate.overall_risk}: ${climate.summary}`
                  : "Climate shield unavailable",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-md border border-card-border bg-field-bg p-4">
              <div className="flex items-center gap-2">
                <item.icon size={16} className="text-forest-green" />
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>

              {usingFallback && !loadingSummary && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Showing demo fallback snapshot.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <MetricCard icon={Activity} label="Farm Health" value={`${farm.average_health_score}`} detail={`${farm.layers.length} layers monitored`} />
        <MetricCard icon={Bell} label="Active Alerts" value={`${alerts.length}`} detail="Live risk signals" tone="amber" />
        <MetricCard icon={Droplets} label="Water Saved" value={`${farm.sustainability.water_saved_liters.toFixed(0)}L`} detail="Smart irrigation" tone="blue" />
        <MetricCard icon={PlugZap} label="Energy Saved" value={`${farm.sustainability.energy_optimized_kwh.toFixed(1)}kWh`} detail="Auto-mode savings" tone="green" />
      </section>

      <BusinessImpactPanel key={demoVersion} />

      <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3">
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
