import { ExternalLink, X } from "lucide-react";
import type { MarketCityDetail } from "../../types";

function formatDate(value?: string | null) {
  if (!value) return "Not refreshed yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type Props = {
  city: MarketCityDetail | null;
  detailLoading: boolean;
  onClose: () => void;
  formatCurrency: (amountRM: number) => string;
};

export function CityDetailModal({ city, detailLoading, onClose, formatCurrency }: Props) {
  if (!city && !detailLoading) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-forest-green">Malaysia City Detail</p>
            <h3 className="mt-1 text-2xl font-semibold text-ink">{city ? `${city.city_name}, ${city.state}` : "Loading city..."}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-card-border p-2 text-muted transition hover:bg-field-bg hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {!city ? (
          <div className="rounded-lg border border-card-border bg-field-bg p-8 text-sm text-muted">Loading details...</div>
        ) : (
          <div className="grid gap-5">
            <section className="grid gap-3 md:grid-cols-4">
              {[
                ["Overall Score", city.overall_score],
                ["Air Pollution", city.air_pollution_index.toFixed(0)],
                ["Living Cost", city.living_cost_index.toFixed(0)],
                ["Cost / sqft", `${formatCurrency(city.land_price_value)} / sqft`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-card-border bg-field-bg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
                </div>
              ))}
            </section>

            <section className="rounded-lg border border-card-border p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="rounded-md border border-purple-400 bg-purple-50 px-2 py-1 text-sm font-semibold text-purple-800">DeepSeek AI Analysis Summary</h4>
                <span className="rounded-md border border-purple-400 bg-purple-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-purple-800">
                  AI Decision
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{city.analysis_summary}</p>
              <p className="mt-3 text-sm font-semibold text-forest-green">{city.recommendation}</p>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-card-border p-4">
                <h4 className="text-sm font-semibold text-ink">Score Breakdown</h4>
                <div className="mt-3 grid gap-2">
                  {Object.entries(city.score_breakdown).map(([key, value]) => (
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
                    {city.strengths.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
                <div className="rounded-lg border border-card-border p-4">
                  <h4 className="text-sm font-semibold text-ink">Risks</h4>
                  <ul className="mt-2 grid gap-1 text-sm text-ink/80">
                    {city.risks.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-card-border p-4 text-sm"><p className="font-semibold text-ink">Infrastructure</p><p className="mt-1 text-muted">Score {city.infrastructure_score}/100</p></div>
              <div className="rounded-lg border border-card-border p-4 text-sm"><p className="font-semibold text-ink">Convenience</p><p className="mt-1 text-muted">Score {city.convenience_score}/100</p></div>
              <div className="rounded-lg border border-card-border p-4 text-sm"><p className="font-semibold text-ink">Transportation & Delivery</p><p className="mt-1 text-muted">Score {city.transportation_delivery_score}/100</p></div>
            </section>

            <section className="rounded-lg border border-card-border p-4">
              <h4 className="text-sm font-semibold text-ink">Vertical Farm News</h4>
              <div className="mt-3 grid gap-2">
                {city.news.map((item) => (
                  <a key={`${item.title}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-md bg-field-bg px-3 py-2 text-sm text-forest-green hover:underline">
                    <span>{item.title}</span>
                    <ExternalLink size={14} />
                  </a>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-card-border bg-field-bg p-4 text-xs leading-relaxed text-muted">
              <p>Cost / sqft source: {city.land_price_source}</p>
              <p>Air pollution source: {city.air_pollution_source}</p>
              <p>Living cost source: {city.living_cost_source}</p>
              <p>Last updated: {formatDate(city.last_updated)}</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
