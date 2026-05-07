import asyncio
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import SensorReadingDB, AlertDB, RecommendationDB, DeviceLogDB
from app.realtime.manager import manager
from app.core.config import get_settings
from app.schemas import ChatRequest, ChatResponse, DeviceCommand, LayerUpdateEvent, SensorReading, ImageDiagnosisRequest
from app.services.alerts import alert_is_resolved, generate_predictive_alert
from app.services.ai_alerts import generate_ai_alert
from app.services.chat import answer_farm_question
from app.services.health import calculate_health_score, status_from_score
from app.services.diagnosis import DiagnosisRequest, DiagnosisResponse, generate_diagnosis, generate_image_diagnosis
from app.services.ai_diagnosis import run_ai_first_diagnosis
from app.services.ai_control import run_deepseek_control_decision
from app.services.safety_guardrail import validate_device_command
from app.services.whatif import WhatIfRequest, WhatIfResponse, simulate_whatif
from app.services.recommendations import generate_recommendation, generate_recommendation_for_alert, recommendation_is_resolved
from app.schemas import AIDiagnosisResponse, AIDiagnosisRequest, AIControlDecisionRequest, AIControlDecisionResponse, DemoScenarioRequest, NutrientAutomationRequest, SafeCommandRequest
from app.store import (
    ALERTS,
    AREAS,
    LAYERS,
    READINGS,
    RECOMMENDATIONS,
    get_recipe_for_layer,
    latest_alerts,
    latest_recommendations,
    save_reading,
    seed_latest_readings,
    sustainability_snapshot,
)

router = APIRouter()
ALERT_REFRESH_INTERVAL = timedelta(minutes=30)
SCHEDULED_AUTO_OFF: dict[tuple[str, str], str] = {}


def _update_reported_led_feedback(layer_id: str) -> None:
    devices = LAYERS[layer_id].devices
    target = devices.led_intensity
    reported = devices.led_reported_intensity
    if reported == target:
        return
    step = max(1, round(abs(target - reported) * 0.4))
    if reported < target:
        devices.led_reported_intensity = min(target, reported + step)
    else:
        devices.led_reported_intensity = max(target, reported - step)


async def _turn_device_off_later(layer_id: str, device: str, duration_minutes: int, token: str) -> None:
    await asyncio.sleep(duration_minutes * 60)
    if layer_id not in LAYERS or device not in {"fan", "pump", "misting", "climate_heating", "climate_cooling"}:
        return
    if SCHEDULED_AUTO_OFF.get((layer_id, device)) != token:
        return
    devices = LAYERS[layer_id].devices
    if not getattr(devices, device):
        SCHEDULED_AUTO_OFF.pop((layer_id, device), None)
        return
    setattr(devices, device, 0 if device in {"climate_heating", "climate_cooling"} else False)
    SCHEDULED_AUTO_OFF.pop((layer_id, device), None)
    await manager.broadcast_json(
        {
            "event": "device_command",
            "data": {
                "layer_id": layer_id,
                "device": device,
                "value": False,
                "devices": devices.model_dump(mode="json"),
                "source": "scheduled_auto_off",
            },
        }
    )


async def _apply_device_command(command: DeviceCommand, db: Session) -> dict:
    devices = LAYERS[command.layer_id].devices
    setattr(devices, command.device, command.value)
    if command.device == "climate_heating" and int(command.value) > 0:
        devices.climate_cooling = 0
        SCHEDULED_AUTO_OFF.pop((command.layer_id, "climate_cooling"), None)
    elif command.device == "climate_cooling" and int(command.value) > 0:
        devices.climate_heating = 0
        SCHEDULED_AUTO_OFF.pop((command.layer_id, "climate_heating"), None)

    if command.device == "auto_mode" and command.value is True:
        devices.fan = False
        devices.pump = False
        devices.misting = False
        devices.climate_heating = 0
        devices.climate_cooling = 0
        for device in ("fan", "pump", "misting", "climate_heating", "climate_cooling"):
            SCHEDULED_AUTO_OFF.pop((command.layer_id, device), None)
    elif command.device == "auto_mode" and command.value is False:
        for device in ("fan", "pump", "misting", "climate_heating", "climate_cooling"):
            SCHEDULED_AUTO_OFF.pop((command.layer_id, device), None)
    elif command.device in {"fan", "pump", "misting", "climate_heating", "climate_cooling"}:
        SCHEDULED_AUTO_OFF.pop((command.layer_id, command.device), None)

    # ── Log to SQLite ────────────────────────────────────────────
    db.add(DeviceLogDB(
        layer_id=command.layer_id,
        device=command.device,
        value=str(command.value),
    ))
    db.commit()

    await manager.broadcast_json(
        {
            "event": "device_command",
            "data": {
                "layer_id": command.layer_id,
                "device": command.device,
                "value": command.value,
                "devices": devices.model_dump(mode="json"),
            },
        }
    )
    return {"ok": True, "layer_id": command.layer_id, "devices": devices}


def _record_alert_if_due(alert, db: Session) -> bool:
    now = datetime.now(timezone.utc)
    existing = next(
        (
            item for item in ALERTS
            if item.layer_id == alert.layer_id
            and item.title == alert.title
            and item.predictive == alert.predictive
        ),
        None,
    )
    if existing:
        if now - existing.created_at < ALERT_REFRESH_INTERVAL:
            return False
        ALERTS.remove(existing)

    ALERTS.append(alert)
    db.add(AlertDB(
        id=alert.id, layer_id=alert.layer_id, severity=alert.severity,
        title=alert.title, message=alert.message, predictive=alert.predictive,
        created_at=alert.created_at,
    ))
    return True


def _record_recommendation_if_due(recommendation, db: Session) -> bool:
    now = datetime.now(timezone.utc)
    existing = next(
        (
            item for item in RECOMMENDATIONS
            if item.layer_id == recommendation.layer_id
            and item.action == recommendation.action
        ),
        None,
    )
    if existing:
        if now - existing.created_at < ALERT_REFRESH_INTERVAL:
            return False
        RECOMMENDATIONS.remove(existing)

    RECOMMENDATIONS.append(recommendation)
    db.add(RecommendationDB(
        id=recommendation.id, layer_id=recommendation.layer_id,
        action=recommendation.action, reason=recommendation.reason,
        priority=recommendation.priority, confidence=recommendation.confidence,
        created_at=recommendation.created_at,
    ))
    return True


def _resolve_current_alerts_for_layer(layer_id: str) -> list[str]:
    layer = LAYERS.get(layer_id)
    reading = layer.latest_reading if layer else None
    if not layer or not reading:
        return []

    recipe = get_recipe_for_layer(layer_id)
    resolved_ids = []
    for alert in list(ALERTS):
        if alert.layer_id != layer_id:
            continue
        if alert_is_resolved(alert, reading, recipe):
            ALERTS.remove(alert)
            resolved_ids.append(alert.id)

    return resolved_ids


def _resolve_current_recommendations_for_layer(layer_id: str) -> None:
    """Remove recommendations whose underlying condition is now within range."""
    layer = LAYERS.get(layer_id)
    reading = layer.latest_reading if layer else None
    if not layer or not reading:
        return
    recipe = get_recipe_for_layer(layer_id)
    for rec in list(RECOMMENDATIONS):
        if rec.layer_id != layer_id:
            continue
        if recommendation_is_resolved(rec, reading, recipe):
            RECOMMENDATIONS.remove(rec)


def _resolve_all_current_alerts() -> list[str]:
    resolved_ids = []
    for layer_id in list(LAYERS.keys()):
        resolved_ids.extend(_resolve_current_alerts_for_layer(layer_id))
    return resolved_ids


def _resolve_all_current_recommendations() -> None:
    for layer_id in list(LAYERS.keys()):
        _resolve_current_recommendations_for_layer(layer_id)


def _recommendations_for_current_alerts() -> list:
    recommendations = []
    for alert in latest_alerts(limit=len(ALERTS)):
        layer = LAYERS.get(alert.layer_id)
        reading = layer.latest_reading if layer else None
        if not layer or not reading:
            continue
        recipe = get_recipe_for_layer(alert.layer_id)
        recommendations.append(generate_recommendation_for_alert(alert, reading, recipe, layer.devices))
    return recommendations


def _tariff_profile() -> dict:
    settings = get_settings()
    local_hour = (datetime.now(timezone.utc) + timedelta(hours=8)).hour
    if 18 <= local_hour < 22:
        return {"period": "Peak", "rate_rm_per_kwh": settings.tariff_peak_rate_rm, "next_low_cost_window": "22:00-08:00", "source": "configured_time_of_use_tariff"}
    if 6 <= local_hour < 18:
        return {"period": "Shoulder", "rate_rm_per_kwh": settings.tariff_shoulder_rate_rm, "next_low_cost_window": "22:00-08:00", "source": "configured_time_of_use_tariff"}
    return {"period": "Off-peak", "rate_rm_per_kwh": settings.tariff_offpeak_rate_rm, "next_low_cost_window": "Now until 08:00", "source": "configured_time_of_use_tariff"}


def _lighting_strategy_profile() -> dict:
    local_hour = (datetime.now(timezone.utc) + timedelta(hours=8)).hour
    if 6 <= local_hour < 18:
        return {
            "mode": "Sunlight-first",
            "window": "06:00-18:00",
            "led_policy": "Use weather-adjusted sunlight first; LED only fills the crop light deficit.",
            "hvac_policy": "Keep HVAC minimal unless heat or humidity leaves the crop recipe range.",
            "target_dli_shift": "Push non-urgent growth lighting to 22:00-06:00.",
        }
    if 18 <= local_hour < 22:
        return {
            "mode": "Minimal LED",
            "window": "18:00-22:00",
            "led_policy": "Avoid heavy LED during the expensive evening window; maintain only a low safety level.",
            "hvac_policy": "Use the smallest HVAC correction needed for crop safety.",
            "target_dli_shift": "Wait for off-peak night lighting unless the crop is below its minimum light band.",
        }
    return {
        "mode": "Off-peak growth lighting",
        "window": "22:00-06:00",
        "led_policy": "Use cheaper electricity for planned supplemental growth lighting.",
        "hvac_policy": "Run HVAC as needed to keep night temperature and humidity in recipe range.",
        "target_dli_shift": "Recover the daytime light deficit while tariffs are low.",
    }


def _weather_snapshot() -> dict:
    settings = get_settings()
    params = urllib.parse.urlencode({
        "latitude": settings.farm_latitude,
        "longitude": settings.farm_longitude,
        "current": "temperature_2m,relative_humidity_2m,cloud_cover,precipitation",
        "timezone": "Asia/Kuala_Lumpur",
    })
    url = f"https://api.open-meteo.com/v1/forecast?{params}"
    try:
        with urllib.request.urlopen(url, timeout=6) as response:
            payload = json.loads(response.read().decode("utf-8"))
            current = payload.get("current", {})
            cloud_cover = float(current.get("cloud_cover", 45))
            precipitation = float(current.get("precipitation", 0))
            sunlight_factor = max(0.2, min(1.15, 1.0 - cloud_cover / 140 - min(precipitation, 8) / 40))
            return {
                "source": "open-meteo",
                "location": "UTM / Johor Bahru",
                "temperature_c": round(float(current.get("temperature_2m", 30)), 1),
                "humidity_percent": round(float(current.get("relative_humidity_2m", 70)), 1),
                "cloud_cover_percent": round(cloud_cover, 1),
                "precipitation_mm": round(precipitation, 2),
                "sunlight_factor": round(sunlight_factor, 2),
            }
    except Exception as exc:
        return {
            "source": "fallback_simulated_weather",
            "location": "UTM / Johor Bahru",
            "temperature_c": 30.0,
            "humidity_percent": 72.0,
            "cloud_cover_percent": 45.0,
            "precipitation_mm": 0.0,
            "sunlight_factor": 0.68,
            "error": str(exc)[:160],
        }


def _market_news_queries() -> list[dict]:
    return [
        {
            "region": "Malaysia",
            "query": "Malaysia vertical farming OR indoor farming OR agritech grant",
            "signal": "Local grant or pilot opportunity",
        },
        {
            "region": "ASEAN",
            "query": "ASEAN vertical farming startup funding OR government agritech grant",
            "signal": "Regional expansion or partnership opportunity",
        },
        {
            "region": "Global",
            "query": "vertical farming startup funding OR indoor farming investment",
            "signal": "Investor and market trend signal",
        },
        {
            "region": "Policy",
            "query": "government funding controlled environment agriculture vertical farming",
            "signal": "Public-sector support signal",
        },
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
    with urllib.request.urlopen(request, timeout=8) as response:
        root = ET.fromstring(response.read())

    items = []
    for item in root.findall("./channel/item")[:limit]:
        raw_title = item.findtext("title", default="Untitled")
        title, source = _extract_source_from_google_title(raw_title)
        link = item.findtext("link", default="")
        published = item.findtext("pubDate", default="")
        summary = item.findtext("description", default="")
        items.append({
            "region": region,
            "title": title,
            "source": source or "Google News",
            "url": link,
            "published_at": published,
            "summary": summary,
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


def _market_news_snapshot() -> dict:
    articles = []
    errors = []
    for item in _market_news_queries():
        try:
            articles.extend(_fetch_google_news_rss(item["query"], item["region"], item["signal"], limit=4))
        except Exception as exc:
            errors.append(f"{item['region']}: {str(exc)[:120]}")

    if not articles:
        articles = _fallback_market_news()

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

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Google News RSS" if not errors or unique_articles != _fallback_market_news() else "fallback",
        "articles": unique_articles[:16],
        "region_counts": region_counts,
        "owner_brief": [
            "Look for government-backed pilots before committing heavy capex.",
            "Prioritize markets with high food import dependence, high urban density, and premium fresh produce demand.",
            "Treat energy price and subsidy news as expansion signals because HVAC and LED cost drive farm economics.",
        ],
        "errors": errors,
    }


NUTRIENT_RECIPES = {
    "Lettuce": {"ec": (1.2, 1.8), "target_ec": 1.45, "target_ph": 6.1, "reservoir_liters": 90, "stage": "Vegetative"},
    "Spinach": {"ec": (1.4, 2.0), "target_ec": 1.65, "target_ph": 6.3, "reservoir_liters": 85, "stage": "Vegetative"},
    "Basil": {"ec": (1.0, 1.6), "target_ec": 1.35, "target_ph": 6.2, "reservoir_liters": 75, "stage": "Vegetative"},
    "Mint": {"ec": (1.2, 1.8), "target_ec": 1.5, "target_ph": 6.4, "reservoir_liters": 75, "stage": "Vegetative"},
    "Strawberry": {"ec": (1.4, 2.2), "target_ec": 1.8, "target_ph": 6.0, "reservoir_liters": 110, "stage": "Flowering"},
    "Tomato": {"ec": (2.0, 3.2), "target_ec": 2.6, "target_ph": 6.2, "reservoir_liters": 120, "stage": "Fruit set"},
}


def _simulated_ec(layer_id: str, crop: str, reading: SensorReading | None) -> float:
    recipe = NUTRIENT_RECIPES[crop]
    target = recipe["target_ec"]
    if not reading:
        return target
    moisture_pressure = max(-0.25, min(0.25, (reading.soil_moisture - 62) / 100))
    water_dilution = max(-0.35, min(0.15, (reading.water_level - 70) / 140))
    heat_uptake = -0.12 if reading.temperature > 27 else 0.04 if reading.temperature < 19 else 0
    layer_bias = ((sum(ord(ch) for ch in layer_id) % 9) - 4) * 0.035
    return round(max(0.4, min(3.6, target + moisture_pressure - water_dilution + heat_uptake + layer_bias)), 2)


def _nutrient_action_plan(crop: str, reading: SensorReading | None, ec: float) -> dict:
    recipe = NUTRIENT_RECIPES[crop]
    low_ec, high_ec = recipe["ec"]
    target_ec = recipe["target_ec"]
    target_ph = recipe["target_ph"]
    water_level = reading.water_level if reading else 70
    ph = reading.ph if reading else target_ph
    temp = reading.temperature if reading else 24
    reservoir_liters = recipe["reservoir_liters"]
    water_topup_liters = max(0, round((72 - water_level) / 100 * reservoir_liters, 1))
    ec_deficit = max(0, target_ec - ec)
    ec_excess = max(0, ec - target_ec)
    nutrient_a_ml = round(ec_deficit * reservoir_liters * 2.8, 1)
    nutrient_b_ml = round(ec_deficit * reservoir_liters * 2.8, 1)
    dilution_liters = round(ec_excess * reservoir_liters * 0.18, 1)
    ph_up_ml = round(max(0, target_ph - ph) * reservoir_liters * 0.42, 1)
    ph_down_ml = round(max(0, ph - target_ph) * reservoir_liters * 0.38, 1)

    evidence = []
    actions = []
    avoid = []
    status = "Healthy"
    risk = "Low"
    confidence = 82

    if ec < low_ec:
        status = "Nutrient underfeed"
        risk = "High" if ec < low_ec - 0.25 else "Medium"
        confidence += 8
        evidence.append(f"EC {ec:.2f} mS/cm is below {crop}'s range {low_ec:.1f}-{high_ec:.1f}.")
        actions.append(f"Dose Nutrient A {nutrient_a_ml:.1f} ml and Nutrient B {nutrient_b_ml:.1f} ml slowly.")
        avoid.append("Do not dump concentrated A/B nutrients directly onto roots.")
    elif ec > high_ec:
        status = "Nutrient too concentrated"
        risk = "High" if ec > high_ec + 0.35 else "Medium"
        confidence += 8
        evidence.append(f"EC {ec:.2f} mS/cm is above {crop}'s range {low_ec:.1f}-{high_ec:.1f}.")
        actions.append(f"Dilute with {max(dilution_liters, 2):.1f} L clean water, then recheck EC.")
        avoid.append("Do not add more fertilizer until EC returns to range.")
    else:
        evidence.append(f"EC {ec:.2f} mS/cm is within the crop range.")
        actions.append("Keep current nutrient strength and recheck after the next irrigation cycle.")

    if ph < 5.8:
        status = "Acidic nutrient lockout" if status == "Healthy" else status
        risk = "High" if ph < 5.5 else risk
        confidence += 5
        evidence.append(f"pH {ph:.1f} is low, increasing risk of calcium and magnesium lockout.")
        actions.append(f"Add pH Up about {ph_up_ml:.1f} ml, mix for 20 minutes, then retest.")
        avoid.append("Do not raise pH by more than 0.3 per correction cycle.")
    elif ph > 6.8:
        status = "Alkaline nutrient lockout" if status == "Healthy" else status
        risk = "Medium" if risk == "Low" else risk
        confidence += 5
        evidence.append(f"pH {ph:.1f} is high, reducing micronutrient availability.")
        actions.append(f"Add pH Down about {ph_down_ml:.1f} ml, mix for 20 minutes, then retest.")
        avoid.append("Do not add pH Down before nutrients are fully mixed.")

    if water_level < 40:
        risk = "High"
        confidence += 4
        evidence.append(f"Water level {water_level:.0f}% is low, so EC can swing quickly.")
        actions.insert(0, f"Top up reservoir with {max(water_topup_liters, 5):.1f} L clean water before final dosing.")
        avoid.append("Do not dose based on a low reservoir volume without topping up first.")

    if temp > 28:
        evidence.append(f"Temperature {temp:.1f}C is high, which can accelerate nutrient uptake and root stress.")
        actions.append("Cool the root zone or increase airflow before aggressive feeding.")
        avoid.append("Avoid strong feeding while the nutrient solution is warm.")

    score_penalty = 0
    score_penalty += min(35, abs(ec - target_ec) * 38)
    score_penalty += min(25, abs(ph - target_ph) * 18)
    score_penalty += 18 if water_level < 40 else 0
    score_penalty += 10 if temp > 28 else 0
    nutrient_score = max(0, round(100 - score_penalty))

    return {
        "status": status,
        "risk": risk,
        "confidence": min(96, confidence),
        "nutrient_score": nutrient_score,
        "reservoir_liters": reservoir_liters,
        "target_ec": target_ec,
        "target_ph": target_ph,
        "recommended_dose": {
            "nutrient_a_ml": nutrient_a_ml,
            "nutrient_b_ml": nutrient_b_ml,
            "ph_up_ml": ph_up_ml,
            "ph_down_ml": ph_down_ml,
            "water_topup_liters": water_topup_liters,
            "dilution_liters": dilution_liters,
        },
        "evidence": evidence,
        "next_actions": actions[:5],
        "avoid": list(dict.fromkeys(avoid))[:5],
    }


def _nutrient_intelligence_snapshot() -> dict:
    seed_latest_readings()
    layers = []
    for layer in LAYERS.values():
        reading = layer.latest_reading
        crop_recipe = NUTRIENT_RECIPES[layer.crop]
        ec = _simulated_ec(layer.id, layer.crop, reading)
        plan = _nutrient_action_plan(layer.crop, reading, ec)
        layers.append({
            "layer_id": layer.id,
            "layer_name": layer.name,
            "area_name": layer.area_name,
            "crop": layer.crop,
            "growth_stage": crop_recipe["stage"],
            "ph": round(reading.ph if reading else plan["target_ph"], 2),
            "ec": ec,
            "water_level": round(reading.water_level if reading else 70, 1),
            "temperature": round(reading.temperature if reading else 24, 1),
            **plan,
        })

    avg_score = round(sum(item["nutrient_score"] for item in layers) / len(layers))
    high_risk = sum(1 for item in layers if item["risk"] == "High")
    medium_risk = sum(1 for item in layers if item["risk"] == "Medium")
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "average_nutrient_score": avg_score,
        "high_risk_layers": high_risk,
        "medium_risk_layers": medium_risk,
        "system_mode": "Nutrient Intelligence",
        "owner_summary": (
            "Prioritize reservoir top-up and gentle A/B dosing on high-risk layers."
            if high_risk
            else "Nutrient conditions are broadly stable; keep monitoring EC, pH, and reservoir level."
        ),
        "layers": layers,
    }


async def _execute_nutrient_plan(layer_id: str, db: Session) -> dict:
    seed_latest_readings()
    if layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")

    layer = LAYERS[layer_id]
    reading = layer.latest_reading
    if not reading:
        raise HTTPException(status_code=400, detail="No live sensor reading available for nutrient automation")

    ec = _simulated_ec(layer.id, layer.crop, reading)
    plan = _nutrient_action_plan(layer.crop, reading, ec)
    dose = plan["recommended_dose"]

    if plan["risk"] == "Low" and dose["nutrient_a_ml"] == 0 and dose["ph_up_ml"] == 0 and dose["ph_down_ml"] == 0 and dose["water_topup_liters"] == 0:
        layer.devices.fertigation_active = False
        layer.devices.fertigation_last_action = "No nutrient automation needed; layer is inside the recipe band."
    else:
        layer.devices.fertigation_active = True
        layer.devices.nutrient_a_dosed_ml = round(layer.devices.nutrient_a_dosed_ml + dose["nutrient_a_ml"], 1)
        layer.devices.nutrient_b_dosed_ml = round(layer.devices.nutrient_b_dosed_ml + dose["nutrient_b_ml"], 1)
        layer.devices.ph_up_dosed_ml = round(layer.devices.ph_up_dosed_ml + dose["ph_up_ml"], 1)
        layer.devices.ph_down_dosed_ml = round(layer.devices.ph_down_dosed_ml + dose["ph_down_ml"], 1)
        layer.devices.water_topup_liters = round(layer.devices.water_topup_liters + max(dose["water_topup_liters"], 0), 1)
        layer.devices.fertigation_last_action = (
            f"Executed micro-dose: A {dose['nutrient_a_ml']:.1f}ml, B {dose['nutrient_b_ml']:.1f}ml, "
            f"pH Up {dose['ph_up_ml']:.1f}ml, pH Down {dose['ph_down_ml']:.1f}ml, water {dose['water_topup_liters']:.1f}L."
        )

    adjusted = SensorReading(
        layer_id=reading.layer_id,
        temperature=reading.temperature,
        humidity=reading.humidity,
        soil_moisture=min(100, reading.soil_moisture + min(4, dose["water_topup_liters"] * 0.12)),
        ph=round(max(0, min(14, reading.ph + dose["ph_up_ml"] * 0.015 - dose["ph_down_ml"] * 0.015)), 2),
        light_intensity=reading.light_intensity,
        water_level=round(min(100, reading.water_level + dose["water_topup_liters"] / max(plan["reservoir_liters"], 1) * 100), 1),
        timestamp=datetime.now(timezone.utc),
    )
    save_reading(adjusted)
    recipe = get_recipe_for_layer(layer_id)
    layer.health_score = calculate_health_score(adjusted, recipe)
    layer.status = status_from_score(layer.health_score)

    persistence_error = None
    try:
        db.add(DeviceLogDB(layer_id=layer_id, device="fertigation", value=layer.devices.fertigation_last_action or "none"))
        db.add(SensorReadingDB(
            layer_id=adjusted.layer_id,
            temperature=adjusted.temperature,
            humidity=adjusted.humidity,
            soil_moisture=adjusted.soil_moisture,
            ph=adjusted.ph,
            light_intensity=adjusted.light_intensity,
            water_level=adjusted.water_level,
            timestamp=adjusted.timestamp,
        ))
        db.commit()
    except Exception as exc:
        db.rollback()
        persistence_error = str(exc)[:200]
        print(f"Nutrient automation persistence skipped: {persistence_error}")

    await manager.broadcast_json({
        "event": "device_command",
        "data": {
            "layer_id": layer_id,
            "device": "fertigation",
            "value": True,
            "devices": layer.devices.model_dump(mode="json"),
        },
    })
    await manager.broadcast_json(LayerUpdateEvent(data=layer).model_dump(mode="json"))

    return {
        "ok": True,
        "layer_id": layer_id,
        "status": plan["status"],
        "risk": plan["risk"],
        "executed": dose,
        "devices": layer.devices.model_dump(mode="json"),
        "updated_reading": adjusted.model_dump(mode="json"),
        "persistence_error": persistence_error,
    }


def _energy_optimizer_snapshot() -> dict:
    seed_latest_readings()
    tariff = _tariff_profile()
    strategy = _lighting_strategy_profile()
    weather = _weather_snapshot()
    total_led_kw = 0.0
    optimized_led_kw = 0.0
    hvac_kw = 0.0
    layer_plans = []

    for layer in LAYERS.values():
        recipe = get_recipe_for_layer(layer.id)
        reading = layer.latest_reading
        light = reading.light_intensity if reading else sum(recipe.light_range) / 2
        weather_adjusted_light = light * weather["sunlight_factor"]
        natural_light_ratio = max(0, min(100, round((weather_adjusted_light / max(recipe.light_range[1], 1)) * 100)))
        base_led_kw = 0.22
        current_led_kw = base_led_kw * (layer.devices.led_intensity / 100)
        light_deficit_ratio = max(0, min(1, (recipe.light_range[0] - weather_adjusted_light) / max(recipe.light_range[0], 1)))
        fill_light_target = round(25 + light_deficit_ratio * 65)
        if strategy["mode"] == "Sunlight-first":
            target_led = max(10, min(45, fill_light_target if weather_adjusted_light < recipe.light_range[0] else 15))
        elif strategy["mode"] == "Minimal LED":
            target_led = max(15, min(35, fill_light_target if weather_adjusted_light < recipe.light_range[0] * 0.75 else 20))
        else:
            target_led = min(95, max(60, fill_light_target, layer.devices.led_intensity + 10 if weather_adjusted_light < recipe.light_range[0] else 65))

        optimized_kw = base_led_kw * (target_led / 100)
        climate_level = layer.devices.climate_heating + layer.devices.climate_cooling
        reading_temp = reading.temperature if reading else sum(recipe.temperature_range) / 2
        reading_humidity = reading.humidity if reading else sum(recipe.humidity_range) / 2
        hvac_recommended_level = 0
        if reading_temp > recipe.temperature_range[1] + 1.5 or reading_temp < recipe.temperature_range[0] - 1.5:
            hvac_recommended_level = 1 if strategy["mode"] != "Off-peak growth lighting" else 2
        if reading_humidity > recipe.humidity_range[1] + 8:
            hvac_recommended_level = max(hvac_recommended_level, 1)
        hvac_layer_kw = 0.35 * climate_level
        optimized_hvac_kw = 0.35 * hvac_recommended_level
        total_led_kw += current_led_kw
        optimized_led_kw += optimized_kw
        hvac_kw += hvac_layer_kw

        layer_plans.append({
            "layer_id": layer.id,
            "layer_name": layer.name,
            "crop": layer.crop,
            "natural_light_ratio": natural_light_ratio,
            "weather_adjusted_light_lux": round(weather_adjusted_light, 1),
            "current_led_percent": layer.devices.led_intensity,
            "recommended_led_percent": target_led,
            "recommended_hvac_level": hvac_recommended_level,
            "current_kw": round(current_led_kw + hvac_layer_kw, 2),
            "optimized_kw": round(optimized_kw + optimized_hvac_kw, 2),
            "reason": (
                "Sunlight-first: weather-adjusted natural light covers most crop demand, so LED stays low."
                if strategy["mode"] == "Sunlight-first" and weather_adjusted_light >= recipe.light_range[0]
                else "Sunlight-first: clouds reduce natural light, so LED only fills the deficit."
                if strategy["mode"] == "Sunlight-first"
                else "Minimal LED: avoid expensive evening load and defer growth lighting to off-peak night."
                if strategy["mode"] == "Minimal LED"
                else "Off-peak growth lighting: use cheaper night electricity to recover the light target."
            ),
        })

    current_kw = total_led_kw + hvac_kw
    optimized_kw = sum(plan["optimized_kw"] for plan in layer_plans)
    savings_kw = max(0, current_kw - optimized_kw)
    daily_savings_rm = savings_kw * tariff["rate_rm_per_kwh"] * 8
    return {
        "tariff": tariff,
        "strategy": strategy,
        "weather": weather,
        "current_kw": round(current_kw, 2),
        "optimized_kw": round(optimized_kw, 2),
        "savings_kw": round(savings_kw, 2),
        "estimated_daily_savings_rm": round(daily_savings_rm, 2),
        "estimated_monthly_savings_rm": round(daily_savings_rm * 30, 2),
        "recommendation": (
            f"{strategy['mode']} mode is active. {strategy['led_policy']} {strategy['target_dli_shift']}"
        ),
        "layer_plans": layer_plans,
    }


def _business_impact_snapshot() -> dict:
    seed_latest_readings()
    sustainability = sustainability_snapshot()
    energy = _energy_optimizer_snapshot()
    alerts = latest_alerts(limit=len(ALERTS))
    warning_layers = sum(1 for layer in LAYERS.values() if layer.status.value != "Healthy")
    disease_risk = sum(1 for alert in alerts if "fungal" in alert.title.lower() or "humidity" in alert.title.lower())
    crop_loss_prevented = min(28, 8 + warning_layers * 4 + disease_risk * 5)
    monthly_energy = max(energy["estimated_monthly_savings_rm"], sustainability.estimated_cost_reduction_rm * 4)
    monthly_water = sustainability.water_saved_liters * 0.015
    avoided_loss = crop_loss_prevented * 85
    total_monthly = monthly_energy + monthly_water + avoided_loss
    return {
        "monthly_energy_savings_rm": round(monthly_energy, 2),
        "monthly_water_savings_rm": round(monthly_water, 2),
        "crop_loss_prevented_percent": crop_loss_prevented,
        "avoided_crop_loss_rm": round(avoided_loss, 2),
        "estimated_monthly_value_rm": round(total_monthly, 2),
        "payback_months": round(6500 / max(total_monthly, 1), 1),
        "early_detection_days": 3 if warning_layers else 1,
        "summary": f"AI scheduling and early warnings are projected to protect RM {total_monthly:.0f}/month for this demo farm.",
    }


def _scenario_reading(layer_id: str, scenario: str) -> SensorReading:
    layer = LAYERS[layer_id]
    recipe = get_recipe_for_layer(layer_id)
    base = layer.latest_reading or SensorReading(
        layer_id=layer_id,
        temperature=sum(recipe.temperature_range) / 2,
        humidity=sum(recipe.humidity_range) / 2,
        soil_moisture=sum(recipe.soil_moisture_range) / 2,
        ph=sum(recipe.ph_range) / 2,
        light_intensity=sum(recipe.light_range) / 2,
        water_level=78,
    )
    values = base.model_dump()
    if scenario == "normal":
        values.update({
            "temperature": sum(recipe.temperature_range) / 2,
            "humidity": sum(recipe.humidity_range) / 2,
            "soil_moisture": sum(recipe.soil_moisture_range) / 2,
            "ph": sum(recipe.ph_range) / 2,
            "light_intensity": sum(recipe.light_range) / 2,
            "water_level": 82,
        })
    elif scenario == "high_humidity":
        values.update({"humidity": recipe.humidity_range[1] + 16, "temperature": recipe.temperature_range[1] + 1})
    elif scenario == "low_moisture":
        values.update({"soil_moisture": max(10, recipe.soil_moisture_range[0] - 18), "water_level": 32})
    elif scenario == "disease_outbreak":
        values.update({"humidity": recipe.humidity_range[1] + 20, "temperature": recipe.temperature_range[1] + 2, "soil_moisture": recipe.soil_moisture_range[1] + 8})
    elif scenario == "energy_peak":
        values.update({"light_intensity": recipe.light_range[1] + 260, "temperature": recipe.temperature_range[1] + 1})
        layer.devices.led_intensity = 85
    values["timestamp"] = datetime.now(timezone.utc)
    return SensorReading(**values)


# ── Existing real-time endpoints ─────────────────────────────────

@router.get("/farm")
def get_farm_overview() -> dict:
    seed_latest_readings()
    _resolve_all_current_alerts()
    _resolve_all_current_recommendations()
    avg_health = round(sum(layer.health_score for layer in LAYERS.values()) / len(LAYERS))
    return {
        "name": "CropTwin AI Vertical Farm",
        "average_health_score": avg_health,
        "active_alerts": len(latest_alerts(limit=len(ALERTS))),
        "layers": list(LAYERS.values()),
        "sustainability": sustainability_snapshot(),
    }


@router.get("/layers")
def get_layers() -> list:
    seed_latest_readings()
    return list(LAYERS.values())


@router.get("/areas")
def get_areas() -> list:
    return list(AREAS.values())


@router.get("/alerts")
def get_alerts() -> list:
    seed_latest_readings()
    _resolve_all_current_alerts()
    return latest_alerts()


@router.post("/alerts/auto-resolve")
def auto_resolve_alerts() -> dict:
    seed_latest_readings()
    resolved = []

    for alert in list(ALERTS):
        layer = LAYERS.get(alert.layer_id)
        reading = layer.latest_reading if layer else None
        if not layer or not reading:
            continue

        recipe = get_recipe_for_layer(alert.layer_id)
        if alert_is_resolved(alert, reading, recipe):
            ALERTS.remove(alert)
            resolved.append({
                "id": alert.id,
                "layer_id": alert.layer_id,
                "title": alert.title,
                "message": f"Solved: {layer.name} {alert.title.lower()} is back within the crop recipe range.",
            })

    for layer in LAYERS.values():
        current_alert = generate_ai_alert(layer.latest_reading, get_recipe_for_layer(layer.id)) if layer.latest_reading else None
        layer.main_risk = current_alert.title if current_alert else None

    return {
        "resolved_count": len(resolved),
        "active_count": len(ALERTS),
        "resolved": resolved,
        "message": "Solved" if resolved else "No solved alerts yet",
    }


@router.get("/recommendations")
def get_recommendations() -> list:
    seed_latest_readings()
    _resolve_all_current_recommendations()
    return _recommendations_for_current_alerts()


@router.get("/energy/optimizer")
def get_energy_optimizer() -> dict:
    return _energy_optimizer_snapshot()


@router.get("/business/impact")
def get_business_impact() -> dict:
    return _business_impact_snapshot()


@router.get("/market/news")
def get_market_news() -> dict:
    return _market_news_snapshot()


@router.get("/nutrients/intelligence")
def get_nutrient_intelligence() -> dict:
    return _nutrient_intelligence_snapshot()


@router.post("/nutrients/execute-plan")
async def execute_nutrient_plan(request: NutrientAutomationRequest, db: Session = Depends(get_db)) -> dict:
    if not request.confirm:
        raise HTTPException(status_code=400, detail="Nutrient automation requires confirm=true")
    return await _execute_nutrient_plan(request.layer_id, db)


@router.post("/demo/scenario")
async def apply_demo_scenario(request: DemoScenarioRequest, db: Session = Depends(get_db)) -> dict:
    seed_latest_readings()
    layer_id = request.layer_id or "b_02"
    if layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")

    reading = _scenario_reading(layer_id, request.scenario)
    recipe = get_recipe_for_layer(layer_id)
    save_reading(reading)

    layer = LAYERS[layer_id]
    layer.health_score = calculate_health_score(reading, recipe)
    layer.status = status_from_score(layer.health_score)
    alert = generate_ai_alert(reading, recipe) or generate_predictive_alert(list(READINGS[layer_id]), recipe)
    recommendation = generate_recommendation(reading, recipe, devices=layer.devices)
    layer.main_risk = alert.title if alert else None

    if request.scenario == "normal":
        layer.main_risk = None
        for item in list(ALERTS):
            if item.layer_id == layer_id:
                ALERTS.remove(item)
        for item in list(RECOMMENDATIONS):
            if item.layer_id == layer_id:
                RECOMMENDATIONS.remove(item)
        alert = None
        recommendation = None
    else:
        if alert:
            _record_alert_if_due(alert, db)
            recommendation = generate_recommendation_for_alert(alert, reading, recipe, layer.devices)
        if recommendation:
            _record_recommendation_if_due(recommendation, db)

    persistence_error = None
    try:
        db.add(SensorReadingDB(
            layer_id=reading.layer_id,
            temperature=reading.temperature,
            humidity=reading.humidity,
            soil_moisture=reading.soil_moisture,
            ph=reading.ph,
            light_intensity=reading.light_intensity,
            water_level=reading.water_level,
            timestamp=reading.timestamp,
        ))
        db.commit()
    except Exception as exc:
        db.rollback()
        persistence_error = str(exc)[:200]
        print(f"Demo scenario persistence skipped: {persistence_error}")

    event = LayerUpdateEvent(data=layer, alert=alert, recommendation=recommendation, resolved_alert_ids=[])
    await manager.broadcast_json(event.model_dump(mode="json"))
    return {
        "ok": True,
        "scenario": request.scenario,
        "layer": layer.model_dump(mode="json"),
        "alert": alert.model_dump(mode="json") if alert else None,
        "recommendation": recommendation.model_dump(mode="json") if recommendation else None,
        "energy": _energy_optimizer_snapshot(),
        "impact": _business_impact_snapshot(),
        "persistence_error": persistence_error,
    }


@router.post("/sensors/readings")
async def ingest_reading(reading: SensorReading, db: Session = Depends(get_db)) -> LayerUpdateEvent:
    if reading.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")

    recipe = get_recipe_for_layer(reading.layer_id)
    save_reading(reading)
    resolved_alert_ids = _resolve_current_alerts_for_layer(reading.layer_id)
    _resolve_current_recommendations_for_layer(reading.layer_id)

    # ── Persist to SQLite ────────────────────────────────────────
    db.add(SensorReadingDB(
        layer_id=reading.layer_id,
        temperature=reading.temperature,
        humidity=reading.humidity,
        soil_moisture=reading.soil_moisture,
        ph=reading.ph,
        light_intensity=reading.light_intensity,
        water_level=reading.water_level,
        timestamp=reading.timestamp,
    ))

    score = calculate_health_score(reading, recipe)
    layer = LAYERS[reading.layer_id]
    _update_reported_led_feedback(reading.layer_id)
    layer.health_score = score
    layer.status = status_from_score(score)

    alert = generate_ai_alert(reading, recipe) or generate_predictive_alert(list(READINGS[reading.layer_id]), recipe)
    recommendation = generate_recommendation(reading, recipe, devices=layer.devices)
    layer.main_risk = alert.title if alert else None

    if alert and not _record_alert_if_due(alert, db):
        alert = None
    elif alert:
        recommendation = generate_recommendation_for_alert(alert, reading, recipe, layer.devices)

    if not _record_recommendation_if_due(recommendation, db):
        recommendation = None

    db.commit()

    event = LayerUpdateEvent(data=layer, alert=alert, recommendation=recommendation, resolved_alert_ids=resolved_alert_ids)
    await manager.broadcast_json(event.model_dump(mode="json"))
    return event


@router.post("/devices/commands")
async def send_device_command(command: DeviceCommand, db: Session = Depends(get_db)) -> dict:
    if command.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")

    devices = LAYERS[command.layer_id].devices

    manual_devices = {"fan", "pump", "misting", "climate_heating", "climate_cooling", "led_intensity"}
    if devices.auto_mode and command.device in manual_devices:
        raise HTTPException(status_code=400, detail="Manual device control is disabled while AI Control is on")
    if command.device == "auto_mode" and type(command.value) is not bool:
        raise HTTPException(status_code=400, detail="auto_mode value must be a boolean")
    if command.device in manual_devices:
        if command.device == "led_intensity":
            if type(command.value) is not int or not (0 <= command.value <= 100):
                raise HTTPException(status_code=400, detail="LED intensity must be between 0 and 100")
        elif command.device in {"climate_heating", "climate_cooling"}:
            if type(command.value) is not int or not (0 <= command.value <= 3):
                raise HTTPException(status_code=400, detail=f"{command.device} value must be an integer between 0 and 3")
        elif type(command.value) is not bool:
            raise HTTPException(status_code=400, detail=f"{command.device} value must be a boolean")

    return await _apply_device_command(command, db)


@router.post("/devices/auto-mode/all")
async def enable_ai_control_for_all_layers(db: Session = Depends(get_db)) -> dict:
    updated = []
    for layer_id in LAYERS:
        result = await _apply_device_command(
            DeviceCommand(layer_id=layer_id, device="auto_mode", value=True),
            db,
        )
        updated.append({"layer_id": layer_id, "devices": result["devices"].model_dump(mode="json")})

    return {"ok": True, "updated_count": len(updated), "layers": updated}


@router.post("/chat", response_model=ChatResponse)
def chat_to_farm(request: ChatRequest) -> ChatResponse:
    return answer_farm_question(request.question, request.layer_id, request.history)


@router.post("/diagnosis/run", response_model=DiagnosisResponse)
def run_diagnosis(request: DiagnosisRequest) -> DiagnosisResponse:
    if request.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
    return generate_diagnosis(request.layer_id)


@router.post("/diagnosis/image", response_model=DiagnosisResponse)
def run_image_diagnosis(request: ImageDiagnosisRequest) -> DiagnosisResponse:
    if request.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
    return generate_image_diagnosis(request.layer_id, request.image_base64)


@router.post("/whatif/simulate", response_model=WhatIfResponse)
def run_whatif(request: WhatIfRequest) -> WhatIfResponse:
    if request.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
    return simulate_whatif(request.layer_id, request.hours, request.action)


@router.post("/ai/diagnose", response_model=AIDiagnosisResponse)
def ai_diagnose(request: AIDiagnosisRequest) -> AIDiagnosisResponse:
    if request.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
    return run_ai_first_diagnosis(request.layer_id)


@router.post("/ai/control-decision", response_model=AIControlDecisionResponse)
def ai_control_decision(request: AIControlDecisionRequest) -> AIControlDecisionResponse:
    if request.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
    seed_latest_readings()
    return run_deepseek_control_decision(request.layer_id)


@router.post("/ai/execute-safe-command")
async def execute_safe_command(request: SafeCommandRequest, db: Session = Depends(get_db)):
    val = validate_device_command(request.layer_id, request.device, request.value, request.duration_minutes)
    if not val["valid"]:
        raise HTTPException(status_code=400, detail=val["reason"])
        
    cmd = DeviceCommand(layer_id=request.layer_id, device=request.device, value=request.value)
    result = await _apply_device_command(cmd, db)
    is_on = request.value is True if type(request.value) is bool else int(request.value) > 0
    if is_on and request.duration_minutes and request.device in {"fan", "pump", "misting", "climate_heating", "climate_cooling"}:
        token = f"{datetime.now(timezone.utc).timestamp()}:{request.duration_minutes}"
        SCHEDULED_AUTO_OFF[(request.layer_id, request.device)] = token
        asyncio.create_task(_turn_device_off_later(request.layer_id, request.device, request.duration_minutes, token))
        result["scheduled_auto_off_minutes"] = request.duration_minutes
    return result


# ── NEW: Database-backed historical endpoints ────────────────────

@router.get("/db/stats")
def db_stats(db: Session = Depends(get_db)) -> dict:
    """Database statistics — proves real persistence."""
    return {
        "total_readings": db.query(func.count(SensorReadingDB.id)).scalar() or 0,
        "total_alerts": db.query(func.count(AlertDB.id)).scalar() or 0,
        "total_recommendations": db.query(func.count(RecommendationDB.id)).scalar() or 0,
        "total_device_logs": db.query(func.count(DeviceLogDB.id)).scalar() or 0,
        "database": "SQLite (croptwin.db)",
    }


@router.get("/db/readings/{layer_id}")
def db_readings(layer_id: str, limit: int = Query(50, le=500), db: Session = Depends(get_db)) -> list[dict]:
    """Historical sensor readings from SQLite for a specific layer."""
    rows = (
        db.query(SensorReadingDB)
        .filter(SensorReadingDB.layer_id == layer_id)
        .order_by(SensorReadingDB.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id, "layer_id": r.layer_id,
            "temperature": r.temperature, "humidity": r.humidity,
            "soil_moisture": r.soil_moisture, "ph": r.ph,
            "light_intensity": r.light_intensity, "water_level": r.water_level,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]


@router.get("/db/alerts")
def db_alerts(limit: int = Query(20, le=200), db: Session = Depends(get_db)) -> list[dict]:
    """Historical alerts from SQLite."""
    rows = (
        db.query(AlertDB)
        .order_by(AlertDB.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id, "layer_id": r.layer_id, "severity": r.severity,
            "title": r.title, "message": r.message, "predictive": r.predictive,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/db/device-logs")
def db_device_logs(limit: int = Query(20, le=200), db: Session = Depends(get_db)) -> list[dict]:
    """Historical device command logs from SQLite."""
    rows = (
        db.query(DeviceLogDB)
        .order_by(DeviceLogDB.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id, "layer_id": r.layer_id, "device": r.device,
            "value": r.value, "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]


# ── WebSocket ────────────────────────────────────────────────────

@router.websocket("/ws/farm")
async def farm_websocket(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        await websocket.send_json({"event": "snapshot", "data": [layer.model_dump(mode="json") for layer in LAYERS.values()]})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
