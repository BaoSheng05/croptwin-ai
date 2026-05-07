import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe2, Landmark, Newspaper, RefreshCw, TrendingUp } from "lucide-react";
import { api } from "../services/api";
import type { MarketNews, MarketNewsArticle } from "../types";

function cleanSummary(summary: string) {
  return summary.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const REGION_ICONS: Record<string, typeof Globe2> = {
  Malaysia: Landmark,
  ASEAN: Globe2,
  Global: TrendingUp,
  Policy: Newspaper,
};

export default function MarketIntelPage() {
  const [news, setNews] = useState<MarketNews | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState("All");

  async function loadNews() {
    setLoading(true);
    try {
      setNews(await api.getMarketNews());
    } catch (error) {
      console.error("Market news failed", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNews();
  }, []);

  const regions = useMemo(() => {
    const names = new Set(news?.articles.map((article) => article.region) ?? []);
    return ["All", ...Array.from(names)];
  }, [news]);

  const articles = useMemo(() => {
    const all = news?.articles ?? [];
    return selectedRegion === "All" ? all : all.filter((article) => article.region === selectedRegion);
  }, [news, selectedRegion]);

  return (
    <div className="grid gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Market Intel</h2>
          <p className="mt-1 text-xs text-muted">Vertical farming news, policy signals, and expansion opportunities.</p>
        </div>
        <button
          type="button"
          onClick={loadNews}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-card-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-spring-green/20 disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading || !news ? (
        <div className="rounded-lg border border-card-border bg-white p-8 text-sm text-muted shadow-card">Loading market intelligence...</div>
      ) : (
        <>
          <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2 text-forest-green">
              <Globe2 size={17} />
              <h3 className="text-sm font-semibold text-ink">Owner Expansion Brief</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {news.owner_brief.map((item) => (
                <div key={item} className="rounded-md border border-card-border bg-field-bg p-4 text-sm leading-relaxed text-ink/80">
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Source: {news.source} · Updated {shortDate(news.generated_at)}</p>
          </section>

          <div className="flex flex-wrap gap-2">
            {regions.map((region) => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className="rounded-md px-3.5 py-1.5 text-xs font-semibold transition"
                style={selectedRegion === region
                  ? { backgroundColor: "#228B22", color: "#FFFFFF" }
                  : { backgroundColor: "#EAF5EA", color: "#2D4A2D", border: "1px solid #B3D4B3" }
                }
              >
                {region} {region === "All" ? `(${news.articles.length})` : news.region_counts[region] ? `(${news.region_counts[region]})` : ""}
              </button>
            ))}
          </div>

          <section className="grid gap-4 lg:grid-cols-2">
            {articles.map((article: MarketNewsArticle) => {
              const Icon = REGION_ICONS[article.region] ?? Newspaper;
              return (
                <article key={`${article.title}-${article.source}`} className="rounded-lg border border-card-border bg-white p-5 shadow-card">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-forest-green">
                      <Icon size={16} />
                      <span className="text-xs font-semibold uppercase tracking-wider">{article.region}</span>
                    </div>
                    <span className="shrink-0 rounded-md border border-card-border bg-field-bg px-2 py-1 text-xs font-semibold text-muted">
                      {shortDate(article.published_at)}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold leading-snug text-ink">{article.title}</h3>
                  <p className="mt-2 text-xs font-semibold text-muted">{article.source}</p>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink/75">{cleanSummary(article.summary)}</p>
                  <div className="mt-4 rounded-md border border-forest-green/20 bg-spring-green/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-forest-green">Expansion Signal</p>
                    <p className="mt-1 text-sm text-ink/80">{article.expansion_signal}</p>
                  </div>
                  {article.url && (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-forest-green hover:underline"
                    >
                      Read source <ExternalLink size={14} />
                    </a>
                  )}
                </article>
              );
            })}
          </section>

          {news.errors.length > 0 && (
            <div className="rounded-md border border-status-warning/20 bg-amber-50 p-3 text-xs text-status-warning">
              Some feeds used fallback data: {news.errors.join("; ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
