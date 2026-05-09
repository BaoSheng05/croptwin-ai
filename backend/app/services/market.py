from __future__ import annotations

import json
import math
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import MarketCityDB, MarketCityNewsDB

NEWS_TIMEOUT_SECONDS = 1.5
API_TIMEOUT_SECONDS = 3.0

MALAYSIA_CITY_BASELINES = [
    {"id": "kuala-lumpur", "city_name": "Kuala Lumpur", "state": "Federal Territory", "lat": 3.139, "lon": 101.6869, "land": 980, "living": 88, "infra": 96, "conv": 97, "transport": 95},
    {"id": "petaling-jaya", "city_name": "Petaling Jaya", "state": "Selangor", "lat": 3.1073, "lon": 101.6067, "land": 820, "living": 82, "infra": 93, "conv": 96, "transport": 92},
    {"id": "shah-alam", "city_name": "Shah Alam", "state": "Selangor", "lat": 3.0738, "lon": 101.5183, "land": 520, "living": 72, "infra": 88, "conv": 87, "transport": 89},
    {"id": "johor-bahru", "city_name": "Johor Bahru", "state": "Johor", "lat": 1.4927, "lon": 103.7414, "land": 460, "living": 70, "infra": 87, "conv": 86, "transport": 91},
    {"id": "george-town", "city_name": "George Town", "state": "Penang", "lat": 5.4141, "lon": 100.3288, "land": 650, "living": 76, "infra": 90, "conv": 91, "transport": 86},
    {"id": "bayan-lepas", "city_name": "Bayan Lepas", "state": "Penang", "lat": 5.2948, "lon": 100.2597, "land": 560, "living": 73, "infra": 89, "conv": 85, "transport": 88},
    {"id": "ipoh", "city_name": "Ipoh", "state": "Perak", "lat": 4.5975, "lon": 101.0901, "land": 260, "living": 58, "infra": 74, "conv": 78, "transport": 72},
    {"id": "melaka-city", "city_name": "Melaka City", "state": "Melaka", "lat": 2.1896, "lon": 102.2501, "land": 310, "living": 62, "infra": 77, "conv": 80, "transport": 76},
    {"id": "seremban", "city_name": "Seremban", "state": "Negeri Sembilan", "lat": 2.7258, "lon": 101.9378, "land": 240, "living": 57, "infra": 73, "conv": 74, "transport": 75},
    {"id": "kuantan", "city_name": "Kuantan", "state": "Pahang", "lat": 3.8077, "lon": 103.326, "land": 230, "living": 56, "infra": 70, "conv": 72, "transport": 74},
    {"id": "kota-kinabalu", "city_name": "Kota Kinabalu", "state": "Sabah", "lat": 5.9804, "lon": 116.0735, "land": 360, "living": 67, "infra": 76, "conv": 78, "transport": 70},
    {"id": "kuching", "city_name": "Kuching", "state": "Sarawak", "lat": 1.5533, "lon": 110.3592, "land": 300, "living": 61, "infra": 75, "conv": 77, "transport": 72},
]

SORT_COLUMNS = {
    "city_name": MarketCityDB.city_name,
    "state": MarketCityDB.state,
    "land_price_value": MarketCityDB.land_price_value,
    "air_pollution_index": MarketCityDB.air_pollution_index,
    "living_cost_index": MarketCityDB.living_cost_index,
    "overall_score": MarketCityDB.overall_score,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_json(value: str, fallback: Any) -> Any:
    try:
        return json.loads(value) if value else fallback
    except json.JSONDecodeError:
        return fallback


def _clamp_score(value: float) -> int:
    return int(max(0, min(100, round(value))))


def _estimate_aqi_from_pm25(pm25: float) -> int:
    if pm25 <= 12:
        return _clamp_score((50 / 12) * pm25)
    if pm25 <= 35.4:
        return _clamp_score(51 + (pm25 - 12.1) * (49 / 23.3))
    if pm25 <= 55.4:
        return _clamp_score(101 + (pm25 - 35.5) * (49 / 19.9))
    if pm25 <= 150.4:
        return _clamp_score(151 + (pm25 - 55.5) * (49 / 94.9))
    return _clamp_score(201 + (pm25 - 150.5) * (99 / 99.4))


def _base_score(city: dict, aqi: float | None = None) -> tuple[int, dict[str, int]]:
    land_score = _clamp_score(100 - (city["land"] / 1100) * 70)
    air_score = _clamp_score(100 - min(aqi if aqi is not None else 55, 180) * 0.45)
    living_score = _clamp_score(100 - city["living"] * 0.55)
    breakdown = {
        "land_price": land_score,
        "air_quality": air_score,
        "living_cost": living_score,
        "infrastructure": city["infra"],
        "convenience": city["conv"],
        "transportation_delivery": city["transport"],
        "market_potential": _clamp_score((city["infra"] + city["conv"] + city["transport"]) / 3),
    }
    overall = _clamp_score(
        breakdown["land_price"] * 0.18
        + breakdown["air_quality"] * 0.12
        + breakdown["living_cost"] * 0.12
        + breakdown["infrastructure"] * 0.18
        + breakdown["convenience"] * 0.14
        + breakdown["transportation_delivery"] * 0.16
        + breakdown["market_potential"] * 0.10
    )
    return overall, breakdown


def _default_analysis(city: dict, aqi: float | None = None) -> dict:
    overall, breakdown = _base_score(city, aqi)
    strengths = []
    risks = []
    if city["infra"] >= 85:
        strengths.append("Strong urban infrastructure and commercial readiness")
    if city["transport"] >= 85:
        strengths.append("Good transportation and delivery access")
    if city["conv"] >= 85:
        strengths.append("High convenience and service access for operations")
    if city["land"] >= 600:
        risks.append("High land cost may increase payback period")
    if city["living"] >= 75:
        risks.append("Higher living cost can raise labour and service expenses")
    if not risks:
        risks.append("Demand validation and site-specific utility checks are still required")
    return {
        "overall_score": overall,
        "score_breakdown": breakdown,
        "summary": f"{city['city_name']} is evaluated for Malaysia-only vertical farm expansion using estimated land cost, air quality, cost of living, infrastructure, convenience, and delivery readiness.",
        "strengths": strengths,
        "risks": risks,
        "recommendation": "Shortlist for site due diligence if rental, electricity tariff, and cold-chain access fit the target crop model.",
        "mode": "local_estimate",
    }


def _fetch_air_quality(city: dict) -> dict:
    params = urllib.parse.urlencode({
        "latitude": city["lat"],
        "longitude": city["lon"],
        "current": "pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone",
        "timezone": "auto",
    })
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CropTwinAI/1.0"})
        with urllib.request.urlopen(req, timeout=API_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
        current = payload.get("current", {})
        pm25 = float(current.get("pm2_5") or 0)
        return {
            "value": _estimate_aqi_from_pm25(pm25) if pm25 > 0 else 55,
            "source": "Open-Meteo Air Quality API",
            "raw": current,
            "error": None,
        }
    except Exception as exc:
        return {
            "value": 55,
            "source": "Estimated fallback; Open-Meteo unavailable",
            "raw": {},
            "error": str(exc)[:160],
        }


def _extract_source_from_google_title(title: str) -> tuple[str, str | None]:
    if " - " not in title:
        return title, None
    headline, source = title.rsplit(" - ", 1)
    return headline.strip(), source.strip()


def _fetch_city_news(city_name: str, limit: int = 3) -> list[dict]:
    query = f'vertical farm OR indoor farming Malaysia "{city_name}"'
    params = urllib.parse.urlencode({"q": query, "hl": "en-MY", "gl": "MY", "ceid": "MY:en"})
    url = f"https://news.google.com/rss/search?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CropTwinAI/1.0"})
        with urllib.request.urlopen(req, timeout=NEWS_TIMEOUT_SECONDS) as response:
            root = ET.fromstring(response.read())
        items = []
        for item in root.findall("./channel/item")[:limit]:
            title, source = _extract_source_from_google_title(item.findtext("title", default="Vertical farming Malaysia"))
            items.append({
                "title": title,
                "url": item.findtext("link", default=""),
                "source": source or "Google News",
                "published_at": item.findtext("pubDate", default=""),
            })
        if items:
            return items
    except Exception:
        pass
    search_url = "https://news.google.com/search?" + urllib.parse.urlencode({"q": f"vertical farm Malaysia {city_name}"})
    return [{"title": f"Google News search: vertical farm Malaysia {city_name}", "url": search_url, "source": "Google News", "published_at": ""}]


def _parse_json_object(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _call_deepseek(city: dict, raw_data: dict, fallback: dict) -> dict:
    settings = get_settings()
    if not settings.deepseek_api_key:
        return {**fallback, "mode": "unconfigured"}
    system_prompt = """
You are CropTwin AI Market Analyst. Evaluate Malaysian cities for vertical farm expansion.
Use only the supplied JSON data. Return strictly valid JSON with:
city_name, overall_score, score_breakdown, summary, strengths, risks, recommendation.
Scores must be integers 0-100. Prefer cities with practical infrastructure, delivery access, reasonable land cost, manageable air quality risk, and local market potential.
"""
    body = {
        "model": "deepseek-v4-flash",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps({"city": city, "data": raw_data}, ensure_ascii=True)},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 700,
    }
    req = urllib.request.Request(
        "https://api.deepseek.com/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {settings.deepseek_api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            result = json.loads(response.read().decode("utf-8"))
        parsed = _parse_json_object(result["choices"][0]["message"]["content"])
        return {**fallback, **parsed, "mode": "deepseek"}
    except Exception as exc:
        return {**fallback, "mode": "ai_error", "ai_error": str(exc)[:180]}


def _city_to_summary(record: MarketCityDB) -> dict:
    return {
        "id": record.id,
        "city_name": record.city_name,
        "state": record.state,
        "land_price_value": record.land_price_value,
        "land_price_unit": record.land_price_unit,
        "land_price_confidence": record.land_price_confidence,
        "air_pollution_index": record.air_pollution_index,
        "living_cost_index": record.living_cost_index,
        "overall_score": record.overall_score,
        "last_updated": record.last_updated.isoformat() if record.last_updated else None,
    }


def _city_to_detail(record: MarketCityDB, news: list[MarketCityNewsDB]) -> dict:
    return {
        **_city_to_summary(record),
        "land_price_source": record.land_price_source,
        "air_pollution_source": record.air_pollution_source,
        "living_cost_source": record.living_cost_source,
        "infrastructure_score": record.infrastructure_score,
        "convenience_score": record.convenience_score,
        "transportation_delivery_score": record.transportation_delivery_score,
        "analysis_summary": record.analysis_summary,
        "score_breakdown": _safe_json(record.score_breakdown_json, {}),
        "strengths": _safe_json(record.strengths_json, []),
        "risks": _safe_json(record.risks_json, []),
        "recommendation": record.recommendation,
        "raw_data": _safe_json(record.raw_data_json, {}),
        "news": [{"title": item.title, "url": item.url, "source": item.source, "published_at": item.published_at} for item in news],
    }


def _upsert_city(db: Session, base: dict, refresh_external: bool = False) -> MarketCityDB:
    aq = _fetch_air_quality(base) if refresh_external else {"value": 55, "source": "Estimated fallback; refresh for Open-Meteo data", "raw": {}, "error": None}
    fallback = _default_analysis(base, aq["value"])
    raw_data = {
        "land_price": {"value": base["land"], "unit": "RM per sq ft", "source": "Estimated city-level commercial/property proxy", "confidence": "estimated"},
        "air_quality": aq,
        "living_cost": {"value": base["living"], "source": "Estimated relative cost index, Kuala Lumpur baseline near 88", "confidence": "estimated"},
        "infrastructure": {"score": base["infra"], "source": "Proxy from city infrastructure and economic role"},
        "convenience": {"score": base["conv"], "source": "Proxy from urban amenities and services"},
        "transportation_delivery": {"score": base["transport"], "source": "Proxy from road, airport, port, and logistics access"},
    }
    analysis = _call_deepseek(base, raw_data, fallback) if refresh_external else fallback
    record = db.get(MarketCityDB, base["id"])
    if not record:
        record = MarketCityDB(id=base["id"])
        db.add(record)
    record.city_name = base["city_name"]
    record.state = base["state"]
    record.land_price_value = float(base["land"])
    record.land_price_unit = "RM per sq ft"
    record.land_price_source = raw_data["land_price"]["source"]
    record.land_price_confidence = raw_data["land_price"]["confidence"]
    record.air_pollution_index = float(aq["value"])
    record.air_pollution_source = aq["source"]
    record.living_cost_index = float(base["living"])
    record.living_cost_source = raw_data["living_cost"]["source"]
    record.infrastructure_score = int(base["infra"])
    record.convenience_score = int(base["conv"])
    record.transportation_delivery_score = int(base["transport"])
    record.overall_score = _clamp_score(float(analysis.get("overall_score", fallback["overall_score"])))
    record.analysis_summary = str(analysis.get("summary") or fallback["summary"])
    record.score_breakdown_json = json.dumps(analysis.get("score_breakdown") or fallback["score_breakdown"])
    record.strengths_json = json.dumps(analysis.get("strengths") or fallback["strengths"])
    record.risks_json = json.dumps(analysis.get("risks") or fallback["risks"])
    record.recommendation = str(analysis.get("recommendation") or fallback["recommendation"])
    record.raw_data_json = json.dumps({**raw_data, "analysis_mode": analysis.get("mode"), "ai_error": analysis.get("ai_error")})
    record.last_updated = _now()
    return record


def ensure_market_cities(db: Session) -> None:
    if db.query(MarketCityDB).count() > 0:
        return
    for city in MALAYSIA_CITY_BASELINES:
        _upsert_city(db, city, refresh_external=False)
    db.commit()


def list_market_cities(db: Session, search: str | None = None, sort_by: str = "overall_score", sort_dir: str = "desc") -> dict:
    ensure_market_cities(db)
    query = db.query(MarketCityDB)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter((MarketCityDB.city_name.ilike(term)) | (MarketCityDB.state.ilike(term)))
    column = SORT_COLUMNS.get(sort_by, MarketCityDB.overall_score)
    query = query.order_by(asc(column) if sort_dir == "asc" else desc(column))
    cities = [_city_to_summary(item) for item in query.all()]
    top = sorted(cities, key=lambda item: item["overall_score"], reverse=True)[:3]
    updated = max((item["last_updated"] for item in cities if item["last_updated"]), default=None)
    return {"scope": "Malaysia", "generated_at": updated or _now().isoformat(), "top_cities": top, "cities": cities}


def get_market_city(db: Session, city_id: str) -> dict | None:
    ensure_market_cities(db)
    record = db.get(MarketCityDB, city_id)
    if not record:
        return None
    news = db.query(MarketCityNewsDB).filter(MarketCityNewsDB.city_id == city_id).order_by(MarketCityNewsDB.id.desc()).limit(8).all()
    if not news:
        for item in _fetch_city_news(record.city_name, 3):
            news.append(MarketCityNewsDB(city_id=city_id, **item))
    return _city_to_detail(record, news)


def refresh_market_cities(db: Session) -> dict:
    for city in MALAYSIA_CITY_BASELINES:
        record = _upsert_city(db, city, refresh_external=True)
        db.query(MarketCityNewsDB).filter(MarketCityNewsDB.city_id == record.id).delete()
        for item in _fetch_city_news(city["city_name"], 4):
            db.add(MarketCityNewsDB(city_id=record.id, **item))
    db.commit()
    return list_market_cities(db)


def market_news_snapshot() -> dict:
    now = _now().isoformat()
    articles = []
    for city in MALAYSIA_CITY_BASELINES[:6]:
        for item in _fetch_city_news(city["city_name"], 1):
            articles.append({
                "region": "Malaysia",
                "title": item["title"],
                "source": item["source"],
                "url": item["url"],
                "published_at": item["published_at"],
                "summary": f"Malaysia-only vertical farm expansion signal for {city['city_name']}.",
                "expansion_signal": "City-level vertical farming relevance",
            })
    return {
        "generated_at": now,
        "source": "Google News RSS / Malaysia city scoring compatibility",
        "articles": articles,
        "region_counts": {"Malaysia": len(articles)},
        "owner_brief": [
            "Malaysia-only market expansion model is active.",
            "Use city scores to shortlist locations, then validate site-level rent, electricity tariff, and logistics.",
            "External values may be estimated when free real-time data is unavailable.",
        ],
        "errors": [],
    }
