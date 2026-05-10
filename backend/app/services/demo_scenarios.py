"""Demo scenario generators and end-to-end pipeline.

This module owns both the synthetic sensor-reading factory used by demos
and the orchestration of the full alert/recommendation pipeline that
runs when an operator triggers a scenario from the UI.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.realtime.manager import manager
from app.schemas import CropRecipe, LayerUpdateEvent, SensorReading
from app.services.ai_alerts import generate_ai_alert
from app.services.alert_lifecycle import record_alert_if_due, record_recommendation_if_due
from app.services.alerts import generate_predictive_alert
from app.services.business import business_impact_snapshot
from app.services.energy import energy_optimizer_snapshot
from app.services.health import calculate_health_score, status_from_score
from app.services.persistence import persist_reading, safe_commit
from app.services.recommendations import (
    generate_recommendation,
    generate_recommendation_for_alert,
)
from app.store import (
    ALERTS,
    LAYERS,
    READINGS,
    RECOMMENDATIONS,
    get_recipe_for_layer,
    save_reading,
    seed_latest_readings,
)


def build_scenario_reading(layer_id: str, scenario: str) -> SensorReading:
    """Return a synthetic reading for *layer_id* adjusted to *scenario*."""
    layer = LAYERS[layer_id]
    recipe = get_recipe_for_layer(layer_id)

    base = layer.latest_reading or _midpoint_reading(layer_id, recipe)
    values = base.model_dump()

    if scenario == "normal":
        values.update(_normal_values(recipe))
    elif scenario == "high_humidity":
        values.update({
            "humidity": recipe.humidity_range[1] + 16,
            "temperature": recipe.temperature_range[1] + 1,
        })
    elif scenario == "low_moisture":
        values.update({
            "soil_moisture": max(10, recipe.soil_moisture_range[0] - 18),
            "water_level": 32,
        })
    elif scenario == "disease_outbreak":
        values.update({
            "humidity": recipe.humidity_range[1] + 20,
            "temperature": recipe.temperature_range[1] + 2,
            "soil_moisture": recipe.soil_moisture_range[1] + 8,
        })
    elif scenario == "energy_peak":
        values.update({
            "light_intensity": recipe.light_range[1] + 260,
            "temperature": recipe.temperature_range[1] + 1,
        })
        layer.devices.led_intensity = 85

    values["timestamp"] = datetime.now(timezone.utc)
    return SensorReading(**values)


# ── Private helpers ──────────────────────────────────────────────


def _midpoint_reading(layer_id: str, recipe: CropRecipe) -> SensorReading:
    """Create a mid-range reading when no live data exists."""
    return SensorReading(
        layer_id=layer_id,
        temperature=sum(recipe.temperature_range) / 2,
        humidity=sum(recipe.humidity_range) / 2,
        soil_moisture=sum(recipe.soil_moisture_range) / 2,
        ph=sum(recipe.ph_range) / 2,
        light_intensity=sum(recipe.light_range) / 2,
        water_level=78,
    )


def _normal_values(recipe: CropRecipe) -> dict:
    """Sensor values that place every metric at its recipe midpoint."""
    return {
        "temperature": sum(recipe.temperature_range) / 2,
        "humidity": sum(recipe.humidity_range) / 2,
        "soil_moisture": sum(recipe.soil_moisture_range) / 2,
        "ph": sum(recipe.ph_range) / 2,
        "light_intensity": sum(recipe.light_range) / 2,
        "water_level": 82,
    }


# ── End-to-end demo pipeline ────────────────────────────────────


def _clear_layer_alerts(layer_id: str) -> None:
    """Remove all active alerts and recommendations for ``layer_id``."""
    for item in list(ALERTS):
        if item.layer_id == layer_id:
            ALERTS.remove(item)
    for item in list(RECOMMENDATIONS):
        if item.layer_id == layer_id:
            RECOMMENDATIONS.remove(item)


async def apply_scenario(layer_id: str, scenario: str, db: Session) -> dict[str, Any]:
    """Run a demo scenario through the full alert/recommendation pipeline.

    Steps:
      1. Build a synthetic reading for the chosen scenario.
      2. Update the layer's health and risk fields.
      3. For ``"normal"``, clear all alerts/recommendations on the layer.
         Otherwise generate alert + recommendation as in real ingestion.
      4. Persist the reading and broadcast a ``layer_update`` event.
      5. Return a comprehensive result dict consumed by the demo router.

    Args:
        layer_id: Layer that should receive the synthetic reading. The
            caller must have validated this ID.
        scenario: Scenario key (e.g. ``"normal"``, ``"disease_outbreak"``).
        db: Active SQLAlchemy session.

    Returns:
        A serialisable result mapping with the updated layer, optional
        alert/recommendation, and live energy/business snapshots.
    """
    seed_latest_readings()

    reading = build_scenario_reading(layer_id, scenario)
    recipe = get_recipe_for_layer(layer_id)
    save_reading(reading)

    layer = LAYERS[layer_id]
    layer.health_score = calculate_health_score(reading, recipe)
    layer.status = status_from_score(layer.health_score)

    alert = (
        generate_ai_alert(reading, recipe)
        or generate_predictive_alert(list(READINGS[layer_id]), recipe)
    )
    recommendation = generate_recommendation(reading, recipe, devices=layer.devices)
    layer.main_risk = alert.title if alert else None

    if scenario == "normal":
        layer.main_risk = None
        _clear_layer_alerts(layer_id)
        alert = None
        recommendation = None
    else:
        if alert:
            record_alert_if_due(alert, db)
            recommendation = generate_recommendation_for_alert(
                alert, reading, recipe, layer.devices,
            )
        if recommendation:
            record_recommendation_if_due(recommendation, db)

    persist_reading(db, reading)
    persistence_error = safe_commit(db)

    event = LayerUpdateEvent(
        data=layer,
        alert=alert,
        recommendation=recommendation,
        resolved_alert_ids=[],
    )
    await manager.broadcast_json(event.model_dump(mode="json"))

    return {
        "ok": True,
        "scenario": scenario,
        "layer": layer.model_dump(mode="json"),
        "alert": alert.model_dump(mode="json") if alert else None,
        "recommendation": recommendation.model_dump(mode="json") if recommendation else None,
        "energy": energy_optimizer_snapshot(),
        "impact": business_impact_snapshot(),
        "persistence_error": persistence_error,
    }
