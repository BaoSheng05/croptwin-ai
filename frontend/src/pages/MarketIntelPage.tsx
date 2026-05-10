import { useMemo, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { api } from "../services/api";
import type { MarketCityDetail, MarketCitySnapshot } from "../types";
import { useSettings } from "../contexts/SettingsContext";
import { useApiResource } from "../hooks/useApiResource";
import { PodiumCard } from "./MarketIntel/PodiumCard";
import { CityTable } from "./MarketIntel/CityTable";
import { CityDetailModal } from "./MarketIntel/CityDetailModal";

function formatDate(value?: string | null) {
  if (!value) return "Not refreshed yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MarketIntelPage() {
  const { formatCurrency } = useSettings();
  const { data: snapshot, loading, refresh: reloadCities } = useApiResource<MarketCitySnapshot>(
    () => api.getMarketCities(),
    [],
  );
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCity, setSelectedCity] = useState<MarketCityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function refreshCities() {
    setRefreshing(true);
    try {
      await api.refreshMarketCities();
      await reloadCities();
    } catch (error) {
      console.error("Market city refresh failed", error);
    } finally {
      setRefreshing(false);
    }
  }

  async function openCity(cityId: string) {
    setDetailLoading(true);
    try {
      setSelectedCity(await api.getMarketCity(cityId));
    } catch (error) {
      console.error("Market city detail failed", error);
    } finally {
      setDetailLoading(false);
    }
  }

  const podium = useMemo(() => snapshot?.top_cities ?? [], [snapshot]);

  return (
    <div className="grid gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Market Intel</h2>
          <p className="mt-1 text-xs text-muted">Malaysia-only city scoring for vertical farm expansion.</p>
        </div>
        <button
          type="button"
          onClick={refreshCities}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-md border border-card-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-spring-green/20 disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing" : "Refresh city data"}
        </button>
      </div>

      {loading && !snapshot ? (
        <div className="rounded-lg border border-card-border bg-white p-8 text-sm text-muted shadow-card">Loading Malaysia market intelligence...</div>
      ) : snapshot ? (
        <>
          <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-forest-green">
                <Trophy size={18} />
                <h3 className="text-sm font-semibold text-ink">Top 3 Malaysia City Podium</h3>
              </div>
              <span className="rounded-md border border-card-border bg-field-bg px-3 py-1.5 text-xs font-semibold text-muted">
                Updated {formatDate(snapshot.generated_at)}
              </span>
            </div>
            <div className="relative mx-auto max-w-3xl px-2 pb-8 pt-8">
              <div className="absolute bottom-5 left-1/2 h-8 w-[92%] -translate-x-1/2 rounded-full bg-forest-green/10 blur-sm" />
              <div className="relative grid grid-cols-3 items-end gap-0">
                {podium[1] && <PodiumCard city={podium[1]} rank={2} onClick={() => openCity(podium[1].id)} />}
                {podium[0] && <PodiumCard city={podium[0]} rank={1} onClick={() => openCity(podium[0].id)} />}
                {podium[2] && <PodiumCard city={podium[2]} rank={3} onClick={() => openCity(podium[2].id)} />}
              </div>
            </div>
          </section>

          <CityTable cities={snapshot.cities} onCityClick={openCity} formatCurrency={formatCurrency} />
        </>
      ) : (
        <div className="rounded-lg border border-status-warning/20 bg-amber-50 p-4 text-sm text-status-warning">Market city data is unavailable.</div>
      )}

      {(selectedCity || detailLoading) && (
        <CityDetailModal
          city={selectedCity}
          detailLoading={detailLoading}
          onClose={() => setSelectedCity(null)}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}
