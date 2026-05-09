"""Sensor reading ingestion pipeline.

This is the most critical endpoint in the system. Every sensor reading
from the IoT simulator (or real hardware) flows through here, triggering
a cascade of side effects:

  1. Save the reading to the in-memory store and SQLite
  2. Resolve any stale alerts/recommendations for the layer
  3. Re-compute the layer's health score and status
  4. Generate new alerts (threshold + predictive) if warranted
  5. Generate a recommendation for any new alert
  6. Broadcast the updated layer state via WebSocket
"""

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from app.api import require_valid_layer
from app.database import get_db
from app.realtime.manager import manager
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

router = APIRouter()


@router.post("/sensors/readings")
async def ingest_reading(
    reading: SensorReading,
    db: Session = Depends(get_db),
) -> LayerUpdateEvent:
    """Ingest a sensor reading and process the full update pipeline.

    This endpoint orchestrates the entire reading lifecycle:
    storing data, evaluating health, generating alerts, and
    broadcasting real-time updates to connected clients.

    Args:
        reading: The incoming sensor snapshot for a single layer.
        db: Database session (injected by FastAPI).

    Returns:
        A LayerUpdateEvent containing the updated layer, any new
        alert/recommendation, and IDs of resolved alerts.

    Raises:
        HTTPException: 404 if the layer_id is unknown.
    """
    require_valid_layer(reading.layer_id)

    recipe = get_recipe_for_layer(reading.layer_id)

    # ── Step 1: Store reading ────────────────────────────────────
    save_reading(reading)
    persist_reading(db, reading)

    # ── Step 2: Resolve stale alerts/recommendations ─────────────
    resolved_alert_ids = resolve_alerts_for_layer(reading.layer_id)
    resolve_recommendations_for_layer(reading.layer_id)

    # ── Step 3: Update layer health ──────────────────────────────
    score = calculate_health_score(reading, recipe)
    layer = LAYERS[reading.layer_id]
    update_reported_led_feedback(reading.layer_id)
    layer.health_score = score
    layer.status = status_from_score(score)

    # ── Step 4: Generate alerts ──────────────────────────────────
    # Try AI-powered alert first, fall back to predictive (trend-based)
    alert = (
        generate_ai_alert(reading, recipe)
        or generate_predictive_alert(list(READINGS[reading.layer_id]), recipe)
    )
    layer.main_risk = alert.title if alert else None

    # ── Step 5: Generate recommendation ──────────────────────────
    recommendation = generate_recommendation(
        reading, recipe, devices=layer.devices,
    )

    # Deduplicate: only record alert if it's fresh enough
    if alert and not record_alert_if_due(alert, db):
        alert = None
    elif alert:
        # Upgrade recommendation to be alert-specific
        recommendation = generate_recommendation_for_alert(
            alert, reading, recipe, layer.devices,
        )

    if not record_recommendation_if_due(recommendation, db):
        recommendation = None

    safe_commit(db)

    # ── Step 6: Broadcast via WebSocket ──────────────────────────
    event = LayerUpdateEvent(
        data=layer,
        alert=alert,
        recommendation=recommendation,
        resolved_alert_ids=resolved_alert_ids,
    )
    await manager.broadcast_json(event.model_dump(mode="json"))

    return event
