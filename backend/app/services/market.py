import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone


MARKET_CACHE: tuple[datetime, dict] | None = None
MARKET_CACHE_TTL = timedelta(minutes=15)
NEWS_TIMEOUT_SECONDS = 0.8


def _market_news_queries() -> list[dict]:
    return [
        {"region": "Malaysia", "query": "Malaysia vertical farming OR indoor farming OR agritech grant", "signal": "Local grant or pilot opportunity"},
        {"region": "ASEAN", "query": "ASEAN vertical farming startup funding OR government agritech grant", "signal": "Regional expansion or partnership opportunity"},
        {"region": "Global", "query": "vertical farming startup funding OR indoor farming investment", "signal": "Investor and market trend signal"},
        {"region": "Policy", "query": "government funding controlled environment agriculture vertical farming", "signal": "Public-sector support signal"},
    ]


def _extract_source_from_google_title(title: str) -> tuple[str, str | None]:
    if " - " not in title:
        return title, None
    headline, source = title.rsplit(" - ", 1)
    return headline.strip(), source.strip()


def _fetch_google_news_rss(query: str, region: str, signal: str, limit: int = 5) -> list[dict]:
    params = urllib.parse.urlencode({
        "q": query,
        "hl": "en-MY",
        "gl": "MY",
        "ceid": "MY:en",
    })
    url = f"https://news.google.com/rss/search?{params}"
    request = urllib.request.Request(url, headers={"User-Agent": "CropTwinAI/1.0"})
    with urllib.request.urlopen(request, timeout=NEWS_TIMEOUT_SECONDS) as response:
        root = ET.fromstring(response.read())

    items = []
    for item in root.findall("./channel/item")[:limit]:
        title, source = _extract_source_from_google_title(item.findtext("title", default="Untitled"))
        items.append({
            "region": region,
            "title": title,
            "source": source or "Google News",
            "url": item.findtext("link", default=""),
            "published_at": item.findtext("pubDate", default=""),
            "summary": item.findtext("description", default=""),
            "expansion_signal": signal,
        })
    return items


def _fallback_market_news() -> list[dict]:
    now = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
    return [
        {
            "region": "Malaysia",
            "title": "Track Malaysia agritech grants and food security programs",
            "source": "CropTwin fallback brief",
            "url": "https://www.miti.gov.my/",
            "published_at": now,
            "summary": "Watch Malaysian government food security, smart farming, and SME digitalisation programs for pilot funding.",
            "expansion_signal": "Local grant or pilot opportunity",
        },
        {
            "region": "ASEAN",
            "title": "Evaluate Singapore and Gulf-facing ASEAN demand for controlled-environment produce",
            "source": "CropTwin fallback brief",
            "url": "https://asean.org/",
            "published_at": now,
            "summary": "Dense urban markets with food-import dependence are useful targets for vertical farming partnerships.",
            "expansion_signal": "Regional expansion or partnership opportunity",
        },
        {
            "region": "Global",
            "title": "Monitor vertical farming investment with caution after industry consolidation",
            "source": "CropTwin fallback brief",
            "url": "https://www.usda.gov/",
            "published_at": now,
            "summary": "Owners should prioritize energy-efficient models, premium crops, and public-sector pilots before large capex expansion.",
            "expansion_signal": "Investor and market trend signal",
        },
    ]


def market_news_snapshot() -> dict:
    global MARKET_CACHE
    if MARKET_CACHE:
        created_at, value = MARKET_CACHE
        if datetime.now(timezone.utc) - created_at < MARKET_CACHE_TTL:
            return {**value, "cache": "hit"}

    articles = []
    errors = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(_fetch_google_news_rss, item["query"], item["region"], item["signal"], 4): item
            for item in _market_news_queries()
        }
        for future in as_completed(futures):
            item = futures[future]
            try:
                articles.extend(future.result())
            except Exception as exc:
                errors.append(f"{item['region']}: {str(exc)[:120]}")

    fallback_articles = _fallback_market_news()
    if not articles:
        articles = fallback_articles

    seen = set()
    unique_articles = []
    for article in articles:
        key = (article["title"].lower(), article["source"])
        if key in seen:
            continue
        seen.add(key)
        unique_articles.append(article)

    region_counts: dict[str, int] = {}
    for article in unique_articles:
        region_counts[article["region"]] = region_counts.get(article["region"], 0) + 1

    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Google News RSS" if not errors or unique_articles != fallback_articles else "fallback",
        "cache": "miss",
        "articles": unique_articles[:16],
        "region_counts": region_counts,
        "owner_brief": [
            "Look for government-backed pilots before committing heavy capex.",
            "Prioritize markets with high food import dependence, high urban density, and premium fresh produce demand.",
            "Treat energy price and subsidy news as expansion signals because HVAC and LED cost drive farm economics.",
        ],
        "errors": errors,
    }
    MARKET_CACHE = (datetime.now(timezone.utc), result)
    return result
