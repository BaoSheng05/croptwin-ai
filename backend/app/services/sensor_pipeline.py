"""Sensor reading ingestion pipeline.

The HTTP router (:mod:`app.api.sensor_router`) is intentionally a thin
shell. All side effects of ingesting a sensor reading live here so the
behaviour can be unit-tested without spinning up FastAPI.

Pipeline steps:
  1. Persist the reading (in-memory store + SQLite).
  2. Resolve any alerts/recommendations whose conditions cleared.
  3. Re-compute the layer's health score and status.
  4. Generate a new alert (AI-first, predictive fallback).
  5. Generate a recommendation tied to the alert (or a generic one).
  6. Build the WebSocket event so the router can broadcast it.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas import LayerUpdateEvent, SensorReading
from app.services.ai_alerts import generate_ai_alert
from app.services.alert_lifecycle import (
    record_alert_if_due,
    record_recommendation_if_due,
    resolve_alerts_for_layer,
    resolve_recommendations_for_layer,
)
from app.services.alerts import generate_predictive_alert
from app.services.device_control import update_reported_led_feedback
from app.services.health import calculate_health_score, status_from_score
from app.services.persistence import persist_reading, safe_commit
from app.services.recommendations import (
    generate_recommendation,
    generate_recommendation_for_alert,
)
from app.store import LAYERS, READINGS, get_recipe_for_layer, save_reading


def process_reading(reading: SensorReading, db: Session) -> LayerUpdateEvent:
    """Run the full ingestion pipeline for a single sensor reading.

    Args:
        reading: The incoming sensor snapshot for a single farm layer.
            The caller must have already validated ``reading.layer_id``.
        db: Active SQLAlchemy session used for persistence.

    Returns:
        A :class:`LayerUpdateEvent` describing the updated layer along
        with any alert/recommendation changes triggered by this reading.
        The router is responsible for broadcasting it via WebSocket.
    """
    recipe = get_recipe_for_layer(reading.layer_id)

    # ── Step 1: Persist reading to memory + SQLite ───────────────
    save_reading(reading)
    persist_reading(db, reading)

    # ── Step 2: Resolve stale alerts/recommendations ─────────────
    resolved_alert_ids = resolve_alerts_for_layer(reading.layer_id)
    resolve_recommendations_for_layer(reading.layer_id)

    # ── Step 3: Update layer health & device feedback ────────────
    score = calculate_health_score(reading, recipe)
    layer = LAYERS[reading.layer_id]
    update_reported_led_feedback(reading.layer_id)
    layer.health_score = score
    layer.status = status_from_score(score)

    # ── Step 4: Generate alerts (AI-first, predictive fallback) ──
    alert = (
        generate_ai_alert(reading, recipe)
        or generate_predictive_alert(list(READINGS[reading.layer_id]), recipe)
    )
    layer.main_risk = alert.title if alert else None

    # ── Step 5: Generate recommendation tied to alert if any ─────
    recommendation = generate_recommendation(reading, recipe, devices=layer.devices)

    # Deduplicate alert (skip if same alert was just emitted recently).
    if alert and not record_alert_if_due(alert, db):
        alert = None
    elif alert:
        # Specialise the recommendation now that we know the alert context.
        recommendation = generate_recommendation_for_alert(
            alert, reading, recipe, layer.devices,
        )

    if not record_recommendation_if_due(recommendation, db):
        recommendation = None

    safe_commit(db)

    # ── Step 6: Build the broadcast payload ──────────────────────
    return LayerUpdateEvent(
        data=layer,
        alert=alert,
        recommendation=recommendation,
        resolved_alert_ids=resolved_alert_ids,
    )
