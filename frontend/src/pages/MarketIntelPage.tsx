import { useEffect, useMemo, useState } from "react";
import { Building2, ExternalLink, MapPin, RefreshCw, Search, Trophy, X } from "lucide-react";
import { api } from "../services/api";
import type { MarketCityDetail, MarketCitySnapshot, MarketCitySummary } from "../types";

type SortKey = "city_name" | "state" | "land_price_value" | "air_pollution_index" | "living_cost_index" | "overall_score";
type PodiumRank = 1 | 2 | 3;
type NumericFilterKey = "land_price_value" | "air_pollution_index" | "living_cost_index" | "overall_score";
type ColumnFilters = {
  state: string;
  ranges: Record<NumericFilterKey, { min: string; max: string }>;
};

const EMPTY_COLUMN_FILTERS: ColumnFilters = {
  state: "",
  ranges: {
    land_price_value: { min: "", max: "" },
    air_pollution_index: { min: "", max: "" },
    living_cost_index: { min: "", max: "" },
    overall_score: { min: "", max: "" },
  },
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "city_name", label: "City" },
  { key: "state", label: "State" },
  { key: "land_price_value", label: "Land Price" },
  { key: "air_pollution_index", label: "Air Pollution" },
  { key: "living_cost_index", label: "Living Cost" },
  { key: "overall_score", label: "Overall Score" },
];

function formatDate(value?: string | null) {
  if (!value) return "Not refreshed yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatLand(city: MarketCitySummary) {
  return `RM ${city.land_price_value.toFixed(0)} / ${city.land_price_unit.replace("RM per ", "")}`;
}

function scoreClass(score: number) {
  if (score >= 80) return "bg-spring-green/20 text-forest-green";
  if (score >= 65) return "bg-amber-50 text-status-warning";
  return "bg-red-50 text-status-critical";
}

function PodiumCard({ city, rank, onClick }: { city: MarketCitySummary; rank: PodiumRank; onClick: () => void }) {
  const styles: Record<PodiumRank, { height: string; color: string; label: string; icon: string }> = {
    1: {
      height: "h-52 md:h-60",
      color: "from-teal-400 to-forest-green",
      label: "text-white",
      icon: "bg-white/20 text-white",
    },
    2: {
      height: "h-44 md:h-52",
      color: "from-yellow-300 to-status-warning",
      label: "text-white",
      icon: "bg-white/20 text-white",
    },
    3: {
      height: "h-40 md:h-48",
      color: "from-red-400 to-red-600",
      label: "text-white",
      icon: "bg-white/20 text-white",
    },
  };
  const style = styles[rank];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full flex-col justify-end overflow-hidden rounded-t-xl bg-gradient-to-br ${style.color} ${style.height} px-5 pb-5 pt-4 text-left shadow-card transition hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-forest-green focus:ring-offset-2`}
    >
      <div className="mb-auto flex items-center justify-between gap-3">
        <span className="text-5xl font-semibold leading-none text-white/95">{rank}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-full ${style.icon}`}>
          <Trophy size={18} />
        </span>
      </div>
      <div className={style.label}>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Rank #{rank}</p>
        <h3 className="mt-1 text-lg font-semibold leading-tight">{city.city_name}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs opacity-90"><MapPin size={13} />{city.state}</p>
        <p className="mt-3 text-sm font-semibold">Score <span className="text-2xl">{city.overall_score}</span></p>
      </div>
    </button>
  );
}

export default function MarketIntelPage() {
  const [snapshot, setSnapshot] = useState<MarketCitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(EMPTY_COLUMN_FILTERS);
  const [sortBy, setSortBy] = useState<SortKey>("overall_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedCity, setSelectedCity] = useState<MarketCityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadCities() {
    setLoading(true);
    try {
      setSnapshot(await api.getMarketCities());
    } catch (error) {
      console.error("Market cities failed", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCities();
  }, []);

  async function refreshCities() {
    setRefreshing(true);
    try {
      setSnapshot(await api.refreshMarketCities());
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

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir(key === "city_name" || key === "state" ? "asc" : "desc");
    }
  }

  function updateRangeFilter(key: NumericFilterKey, edge: "min" | "max", value: string) {
    setColumnFilters((current) => ({
      ...current,
      ranges: {
        ...current.ranges,
        [key]: {
          ...current.ranges[key],
          [edge]: value,
        },
      },
    }));
  }

  const podium = useMemo(() => snapshot?.top_cities ?? [], [snapshot]);
  const stateOptions = useMemo(() => Array.from(new Set((snapshot?.cities ?? []).map((city) => city.state))).sort(), [snapshot]);
  const displayedCities = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = (snapshot?.cities ?? []).filter((city) => {
      const matchesSearch = !query || city.city_name.toLowerCase().includes(query) || city.state.toLowerCase().includes(query);
      const matchesState = !columnFilters.state || city.state === columnFilters.state;
      const matchesRanges = (Object.entries(columnFilters.ranges) as [NumericFilterKey, { min: string; max: string }][]).every(([key, range]) => {
        const value = city[key];
        const min = range.min === "" ? -Infinity : Number(range.min);
        const max = range.max === "" ? Infinity : Number(range.max);
        return value >= min && value <= max;
      });
      return matchesSearch && matchesState && matchesRanges;
    });
    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      if (typeof left === "string" && typeof right === "string") {
        return left.localeCompare(right) * direction;
      }
      return (Number(left) - Number(right)) * direction;
    });
  }, [snapshot, search, columnFilters, sortBy, sortDir]);

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

          <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-forest-green">
                <Building2 size={17} />
                <h3 className="text-sm font-semibold text-ink">Malaysia City List</h3>
              </div>
              <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
                <label className="relative w-full sm:w-72">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search city or state"
                    className="w-full rounded-md border border-card-border bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-forest-green"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setColumnFilters(EMPTY_COLUMN_FILTERS);
                  }}
                  className="rounded-md border border-card-border bg-white px-3 py-2 text-xs font-semibold text-muted transition hover:bg-field-bg hover:text-ink"
                >
                  Clear filters
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-card-border">
              <table className="w-full min-w-[860px] border-collapse bg-white text-sm">
                <thead className="bg-field-bg text-left text-xs uppercase tracking-wider text-muted">
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column.key} className="p-3">
                        <button type="button" onClick={() => toggleSort(column.key)} className="inline-flex items-center gap-1 font-semibold hover:text-forest-green">
                          {column.label}
                          {sortBy === column.key && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                        </button>
                      </th>
                    ))}
                  </tr>
                  <tr className="border-t border-card-border bg-white normal-case tracking-normal">
                    <th className="p-2 text-xs font-medium normal-case text-muted">Use search</th>
                    <th className="p-2">
                      <select
                        value={columnFilters.state}
                        onChange={(event) => setColumnFilters((current) => ({ ...current, state: event.target.value }))}
                        className="w-full rounded border border-card-border bg-white px-2 py-1 text-xs text-ink outline-none focus:border-forest-green"
                      >
                        <option value="">All states</option>
                        {stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}
                      </select>
                    </th>
                    {(["land_price_value", "air_pollution_index", "living_cost_index", "overall_score"] as NumericFilterKey[]).map((key) => (
                      <th key={key} className="p-2">
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            type="number"
                            value={columnFilters.ranges[key].min}
                            onChange={(event) => updateRangeFilter(key, "min", event.target.value)}
                            placeholder="Min"
                            className="min-w-0 rounded border border-card-border bg-white px-2 py-1 text-xs text-ink outline-none focus:border-forest-green"
                          />
                          <input
                            type="number"
                            value={columnFilters.ranges[key].max}
                            onChange={(event) => updateRangeFilter(key, "max", event.target.value)}
                            placeholder="Max"
                            className="min-w-0 rounded border border-card-border bg-white px-2 py-1 text-xs text-ink outline-none focus:border-forest-green"
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedCities.map((city) => (
                    <tr key={city.id} onClick={() => openCity(city.id)} className="cursor-pointer border-t border-card-border transition hover:bg-spring-green/10">
                      <td className="p-3 font-semibold text-ink">{city.city_name}</td>
                      <td className="p-3 text-ink/80">{city.state}</td>
                      <td className="p-3 text-ink/80">{formatLand(city)} <span className="text-xs text-muted">({city.land_price_confidence})</span></td>
                      <td className="p-3 text-ink/80">{city.air_pollution_index.toFixed(0)}</td>
                      <td className="p-3 text-ink/80">{city.living_cost_index.toFixed(0)}</td>
                      <td className="p-3"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${scoreClass(city.overall_score)}`}>{city.overall_score}</span></td>
                    </tr>
                  ))}
                  {displayedCities.length === 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length} className="p-6 text-center text-sm text-muted">
                        No Malaysian cities match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-lg border border-status-warning/20 bg-amber-50 p-4 text-sm text-status-warning">Market city data is unavailable.</div>
      )}

      {(selectedCity || detailLoading) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-forest-green">Malaysia City Detail</p>
                <h3 className="mt-1 text-2xl font-semibold text-ink">{selectedCity ? `${selectedCity.city_name}, ${selectedCity.state}` : "Loading city..."}</h3>
              </div>
              <button type="button" onClick={() => setSelectedCity(null)} className="rounded-md border border-card-border p-2 text-muted transition hover:bg-field-bg hover:text-ink">
                <X size={18} />
              </button>
            </div>

            {!selectedCity ? (
              <div className="rounded-lg border border-card-border bg-field-bg p-8 text-sm text-muted">Loading details...</div>
            ) : (
              <div className="grid gap-5">
                <section className="grid gap-3 md:grid-cols-4">
                  {[
                    ["Overall Score", selectedCity.overall_score],
                    ["Air Pollution", selectedCity.air_pollution_index.toFixed(0)],
                    ["Living Cost", selectedCity.living_cost_index.toFixed(0)],
                    ["Land Price", `RM ${selectedCity.land_price_value.toFixed(0)}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-card-border bg-field-bg p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
                      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
                    </div>
                  ))}
                </section>

                <section className="rounded-lg border border-card-border p-4">
                  <h4 className="text-sm font-semibold text-ink">DeepSeek / Analysis Summary</h4>
                  <p className="mt-2 text-sm leading-relaxed text-ink/80">{selectedCity.analysis_summary}</p>
                  <p className="mt-3 text-sm font-semibold text-forest-green">{selectedCity.recommendation}</p>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-card-border p-4">
                    <h4 className="text-sm font-semibold text-ink">Score Breakdown</h4>
                    <div className="mt-3 grid gap-2">
                      {Object.entries(selectedCity.score_breakdown).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between rounded-md bg-field-bg px-3 py-2 text-sm">
                          <span className="capitalize text-muted">{key.replace(/_/g, " ")}</span>
                          <span className="font-semibold text-ink">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="rounded-lg border border-card-border p-4">
                      <h4 className="text-sm font-semibold text-ink">Strengths</h4>
                      <ul className="mt-2 grid gap-1 text-sm text-ink/80">
                        {selectedCity.strengths.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-card-border p-4">
                      <h4 className="text-sm font-semibold text-ink">Risks</h4>
                      <ul className="mt-2 grid gap-1 text-sm text-ink/80">
                        {selectedCity.risks.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-card-border p-4 text-sm"><p className="font-semibold text-ink">Infrastructure</p><p className="mt-1 text-muted">Score {selectedCity.infrastructure_score}/100</p></div>
                  <div className="rounded-lg border border-card-border p-4 text-sm"><p className="font-semibold text-ink">Convenience</p><p className="mt-1 text-muted">Score {selectedCity.convenience_score}/100</p></div>
                  <div className="rounded-lg border border-card-border p-4 text-sm"><p className="font-semibold text-ink">Transportation & Delivery</p><p className="mt-1 text-muted">Score {selectedCity.transportation_delivery_score}/100</p></div>
                </section>

                <section className="rounded-lg border border-card-border p-4">
                  <h4 className="text-sm font-semibold text-ink">Vertical Farm News</h4>
                  <div className="mt-3 grid gap-2">
                    {selectedCity.news.map((item) => (
                      <a key={`${item.title}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-md bg-field-bg px-3 py-2 text-sm text-forest-green hover:underline">
                        <span>{item.title}</span>
                        <ExternalLink size={14} />
                      </a>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-card-border bg-field-bg p-4 text-xs leading-relaxed text-muted">
                  <p>Land source: {selectedCity.land_price_source}</p>
                  <p>Air pollution source: {selectedCity.air_pollution_source}</p>
                  <p>Living cost source: {selectedCity.living_cost_source}</p>
                  <p>Last updated: {formatDate(selectedCity.last_updated)}</p>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
