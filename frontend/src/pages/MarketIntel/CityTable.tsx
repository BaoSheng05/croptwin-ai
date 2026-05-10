import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import type { MarketCitySummary } from "../../types";

type SortKey = "city_name" | "state" | "land_price_value" | "air_pollution_index" | "living_cost_index" | "overall_score";
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
  { key: "land_price_value", label: "Cost / sqft" },
  { key: "air_pollution_index", label: "Air Pollution" },
  { key: "living_cost_index", label: "Living Cost" },
  { key: "overall_score", label: "Overall Score" },
];

function scoreClass(score: number) {
  if (score >= 80) return "bg-spring-green/20 text-forest-green";
  if (score >= 65) return "bg-amber-50 text-status-warning";
  return "bg-red-50 text-status-critical";
}

function formatLand(city: MarketCitySummary, formatCurrency: (amountRM: number) => string) {
  return `${formatCurrency(city.land_price_value)} / sqft`;
}

type Props = {
  cities: MarketCitySummary[];
  onCityClick: (cityId: string) => void;
  formatCurrency: (amountRM: number) => string;
};

export function CityTable({ cities, onCityClick, formatCurrency }: Props) {
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(EMPTY_COLUMN_FILTERS);
  const [sortBy, setSortBy] = useState<SortKey>("overall_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const stateOptions = useMemo(() => Array.from(new Set(cities.map((city) => city.state))).sort(), [cities]);

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

  const displayedCities = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = cities.filter((city) => {
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
  }, [cities, search, columnFilters, sortBy, sortDir]);

  return (
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
              <tr key={city.id} onClick={() => onCityClick(city.id)} className="cursor-pointer border-t border-card-border transition hover:bg-spring-green/10">
                <td className="p-3 font-semibold text-ink">{city.city_name}</td>
                <td className="p-3 text-ink/80">{city.state}</td>
                <td className="p-3 text-ink/80">{formatLand(city, formatCurrency)} <span className="text-xs text-muted">({city.land_price_confidence})</span></td>
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
  );
}
