"""Climate-risk snapshots driven by Open-Meteo forecasts.

Provides:
  * :func:`weather_snapshot` — short-cached, low-timeout fetch of the
    next 24 hours of temperature/humidity/precipitation.
  * :func:`climate_risk_snapshot` — the dashboard payload combining the
    forecast with rule-based risk classification and mitigation tips.

Network failures fall back to a deterministic local estimate so the
Climate Shield page always renders.
"""

import json
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from app.core.config import get_settings


WEATHER_CACHE: dict[str, tuple[datetime, dict]] = {}
WEATHER_CACHE_TTL = timedelta(minutes=10)
WEATHER_TIMEOUT_SECONDS = 0.8


def _get_cached_value(key: str) -> dict | None:
    """Return a cached weather entry if it exists and is still fresh."""
    cached = WEATHER_CACHE.get(key)
    if not cached:
        return None
    created_at, value = cached
    if datetime.now(timezone.utc) - created_at > WEATHER_CACHE_TTL:
        WEATHER_CACHE.pop(key, None)
        return None
    return value


def _set_cached_value(key: str, value: dict) -> dict:
    """Store ``value`` under ``key`` with the current timestamp."""
    WEATHER_CACHE[key] = (datetime.now(timezone.utc), value)
    return value


def weather_snapshot() -> dict:
    """Return the current temperature/humidity for the configured farm location.

    Cached for ``WEATHER_CACHE_TTL``. On any network error a deterministic
    fallback is returned so callers can always proceed.
    """
    cached = _get_cached_value("current_weather")
    if cached:
        return {**cached, "cache": "hit"}

    settings = get_settings()
    params = urllib.parse.urlencode({
        "latitude": settings.farm_latitude,
        "longitude": settings.farm_longitude,
        "current": "temperature_2m,relative_humidity_2m,cloud_cover,precipitation",
        "timezone": "Asia/Kuala_Lumpur",
    })
    url = f"https://api.open-meteo.com/v1/forecast?{params}"
    try:
        with urllib.request.urlopen(url, timeout=WEATHER_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
            current = payload.get("current", {})
            cloud_cover = float(current.get("cloud_cover", 45))
            precipitation = float(current.get("precipitation", 0))
            sunlight_factor = max(0.2, min(1.15, 1.0 - cloud_cover / 140 - min(precipitation, 8) / 40))
            return _set_cached_value("current_weather", {
                "source": "open-meteo",
                "location": "UTM / Johor Bahru",
                "temperature_c": round(float(current.get("temperature_2m", 30)), 1),
                "humidity_percent": round(float(current.get("relative_humidity_2m", 70)), 1),
                "cloud_cover_percent": round(cloud_cover, 1),
                "precipitation_mm": round(precipitation, 2),
                "sunlight_factor": round(sunlight_factor, 2),
                "cache": "miss",
            })
    except Exception as exc:
        stale = WEATHER_CACHE.get("current_weather")
        if stale:
            return {**stale[1], "cache": "stale", "error": str(exc)[:160]}
        return _set_cached_value("current_weather", {
            "source": "fallback_simulated_weather",
            "location": "UTM / Johor Bahru",
            "temperature_c": 30.0,
            "humidity_percent": 72.0,
            "cloud_cover_percent": 45.0,
            "precipitation_mm": 0.0,
            "sunlight_factor": 0.68,
            "cache": "fallback",
            "error": str(exc)[:160],
        })


def _fetch_climate_forecast() -> dict:
    """Fetch the next ~24h hourly forecast from Open-Meteo (cached)."""
    cached = _get_cached_value("climate_forecast")
    if cached:
        return {**cached, "cache": "hit"}

    settings = get_settings()
    params = urllib.parse.urlencode({
        "latitude": settings.farm_latitude,
        "longitude": settings.farm_longitude,
        "hourly": "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,cloud_cover",
        "forecast_days": 3,
        "timezone": "Asia/Kuala_Lumpur",
    })
    url = f"https://api.open-meteo.com/v1/forecast?{params}"
    try:
        with urllib.request.urlopen(url, timeout=WEATHER_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return _set_cached_value("climate_forecast", {"source": "open-meteo", "hourly": payload.get("hourly", {}), "cache": "miss"})
    except Exception as exc:
        stale = WEATHER_CACHE.get("climate_forecast")
        if stale:
            return {**stale[1], "cache": "stale", "error": str(exc)[:160]}
        now = datetime.now(timezone.utc)
        hours = [(now + timedelta(hours=i)).isoformat() for i in range(72)]
        return _set_cached_value("climate_forecast", {
            "source": "fallback_simulated_forecast",
            "error": str(exc)[:160],
            "cache": "fallback",
            "hourly": {
                "time": hours,
                "temperature_2m": [31 + (i % 8) * 0.4 for i in range(72)],
                "relative_humidity_2m": [70 + (i % 6) * 3 for i in range(72)],
                "precipitation_probability": [25 if i < 18 else 78 if i < 34 else 45 for i in range(72)],
                "precipitation": [0 if i < 18 else 4.5 if i < 34 else 0.8 for i in range(72)],
                "wind_speed_10m": [8 if i < 36 else 22 for i in range(72)],
                "cloud_cover": [40 if i < 18 else 88 if i < 34 else 60 for i in range(72)],
            },
        })


def climate_risk_snapshot() -> dict:
    """Return the climate-risk dashboard payload.

    Combines the hourly forecast with rule-based risk classification
    (heat stress, condensation, lightning) and a list of mitigation
    actions for each risk window.
    """
    forecast = _fetch_climate_forecast()
    hourly = forecast["hourly"]
    times = hourly.get("time", [])
    temps = hourly.get("temperature_2m", [])
    humidity = hourly.get("relative_humidity_2m", [])
    precip_prob = hourly.get("precipitation_probability", [])
    precip = hourly.get("precipitation", [])
    wind = hourly.get("wind_speed_10m", [])
    cloud = hourly.get("cloud_cover", [])
    horizon = min(len(times), 72)

    def mx(values, default=0):
        return max(values[:horizon]) if values else default

    max_temp = mx(temps, 30)
    max_humidity = mx(humidity, 70)
    max_precip_prob = mx(precip_prob, 0)
    total_rain = round(sum(precip[:horizon]), 1) if precip else 0
    max_wind = mx(wind, 0)
    max_cloud = mx(cloud, 0)

    risks = []
    if max_temp >= 34:
        risks.append(("Heat stress", "High" if max_temp >= 36 else "Medium", f"Outdoor temperature may reach {max_temp:.1f}C."))
    if max_humidity >= 88:
        risks.append(("Fungal pressure", "High" if max_humidity >= 94 else "Medium", f"Humidity may reach {max_humidity:.0f}%, increasing mildew risk."))
    if max_precip_prob >= 70 or total_rain >= 18:
        risks.append(("Heavy rain / flood disruption", "High" if total_rain >= 25 else "Medium", f"Forecast rain total is {total_rain:.1f} mm with {max_precip_prob:.0f}% peak probability."))
    if max_wind >= 25:
        risks.append(("Strong wind / power stability", "Medium", f"Wind speed may reach {max_wind:.0f} km/h."))
    if max_cloud >= 85:
        risks.append(("Low natural light", "Medium", f"Cloud cover may reach {max_cloud:.0f}%, reducing daylight contribution."))

    if not risks:
        risks.append(("Stable weather", "Low", "No major climate threat detected in the next 72 hours."))

    severity_order = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}
    overall = max((risk[1] for risk in risks), key=lambda item: severity_order[item])
    control_actions = []
    checklist = []
    for title, _, _ in risks:
        if title == "Heat stress":
            control_actions.append("Pre-cool grow rooms before afternoon heat peak; keep HVAC in efficient cooling level 1-2.")
            checklist.append("Inspect HVAC filters and confirm backup fans are working.")
        elif title == "Fungal pressure":
            control_actions.append("Lower humidity setpoint, increase airflow, and pause misting during high-risk hours.")
            checklist.append("Prepare disease scouting route for leaf surface checks.")
        elif title == "Heavy rain / flood disruption":
            control_actions.append("Charge UPS, raise critical controllers above floor level, and avoid reservoir overflow.")
            checklist.append("Check drainage, roof leaks, water pumps, and spare power supply.")
        elif title == "Strong wind / power stability":
            control_actions.append("Enable conservative automation mode and avoid non-critical dosing during unstable power window.")
            checklist.append("Secure external sensors, cables, and greenhouse intake vents.")
        elif title == "Low natural light":
            control_actions.append("Shift supplemental LED load to off-peak night window to recover light deficit.")
            checklist.append("Review LED schedule and crop DLI target.")

    hourly_points = []
    for i in range(0, horizon, 6):
        hourly_points.append({
            "time": times[i],
            "temperature": round(float(temps[i]), 1) if i < len(temps) else None,
            "humidity": round(float(humidity[i]), 1) if i < len(humidity) else None,
            "rain_probability": round(float(precip_prob[i]), 1) if i < len(precip_prob) else None,
            "rain_mm": round(float(precip[i]), 1) if i < len(precip) else None,
            "wind_speed": round(float(wind[i]), 1) if i < len(wind) else None,
            "cloud_cover": round(float(cloud[i]), 1) if i < len(cloud) else None,
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": forecast["source"],
        "location": "UTM / Johor Bahru",
        "overall_risk": overall,
        "summary": f"{overall} climate preparedness level for the next 72 hours.",
        "metrics": {
            "max_temperature_c": round(max_temp, 1),
            "max_humidity_percent": round(max_humidity, 1),
            "total_rain_mm": total_rain,
            "max_rain_probability_percent": round(max_precip_prob, 1),
            "max_wind_kmh": round(max_wind, 1),
            "max_cloud_cover_percent": round(max_cloud, 1),
        },
        "risks": [{"title": r[0], "severity": r[1], "detail": r[2]} for r in risks],
        "control_actions": list(dict.fromkeys(control_actions)),
        "preparedness_checklist": list(dict.fromkeys(checklist)),
        "forecast_points": hourly_points,
        "error": forecast.get("error"),
    }
