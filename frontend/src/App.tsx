import { Activity, Bell, Droplets, Leaf, PlugZap } from "lucide-react";

import { AlertsPanel } from "./components/AlertsPanel";
import { ChartsPanel } from "./components/ChartsPanel";
import { ChatPanel } from "./components/ChatPanel";
import { ControlPanel } from "./components/ControlPanel";
import { LayerCard } from "./components/LayerCard";
import { MetricCard } from "./components/MetricCard";
import { RecommendationPanel } from "./components/RecommendationPanel";
import { useFarmStream } from "./hooks/useFarmStream";

export default function App() {
  const { farm, alerts, recommendations, chartData, connected, selectedLayer, sendCommand, chat } = useFarmStream();

  return (
    <main className="min-h-screen bg-ink text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-mint text-ink">
                <Leaf size={21} />
              </span>
              <div>
                <p className="text-sm text-white/55">AI digital twin platform</p>
                <h1 className="text-3xl font-semibold tracking-normal text-white">CropTwin AI</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-panel px-3 py-2 text-sm text-white/65">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-mint" : "bg-coral"}`} />
            {connected ? "Live stream connected" : "Using local snapshot"}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              {farm.layers.map((layer) => (
                <LayerCard key={layer.id} layer={layer} />
              ))}
            </div>
            <ChartsPanel data={chartData} />
          </div>

          <aside className="grid content-start gap-4">
            <RecommendationPanel recommendations={recommendations} />
            <ControlPanel layer={selectedLayer} onCommand={sendCommand} />
            <AlertsPanel alerts={alerts} />
            <ChatPanel layer={selectedLayer} chat={chat} />
          </aside>
        </section>
      </div>
    </main>
  );
}
