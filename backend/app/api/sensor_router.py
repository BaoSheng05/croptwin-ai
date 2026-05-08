"""Sensor reading ingestion endpoint."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
from app.services.recommendations import generate_recommendation, generate_recommendation_for_alert
from app.store import LAYERS, READINGS, get_recipe_for_layer, save_reading

router = APIRouter()


@router.post("/sensors/readings")
async def ingest_reading(reading: SensorReading, db: Session = Depends(get_db)) -> LayerUpdateEvent:
    if reading.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")

    recipe = get_recipe_for_layer(reading.layer_id)
    save_reading(reading)
    resolved_alert_ids = resolve_alerts_for_layer(reading.layer_id)
    resolve_recommendations_for_layer(reading.layer_id)

    # Persist reading
    persist_reading(db, reading)

    # Compute health
    score = calculate_health_score(reading, recipe)
    layer = LAYERS[reading.layer_id]
    update_reported_led_feedback(reading.layer_id)
    layer.health_score = score
    layer.status = status_from_score(score)

    # Generate alert / recommendation
    alert = (
        generate_ai_alert(reading, recipe)
        or generate_predictive_alert(list(READINGS[reading.layer_id]), recipe)
    )
    recommendation = generate_recommendation(reading, recipe, devices=layer.devices)
    layer.main_risk = alert.title if alert else None

    if alert and not record_alert_if_due(alert, db):
        alert = None
    elif alert:
        recommendation = generate_recommendation_for_alert(alert, reading, recipe, layer.devices)

    if not record_recommendation_if_due(recommendation, db):
        recommendation = None

    safe_commit(db)

    event = LayerUpdateEvent(
        data=layer, alert=alert,
        recommendation=recommendation,
        resolved_alert_ids=resolved_alert_ids,
    )
    await manager.broadcast_json(event.model_dump(mode="json"))
    return event
