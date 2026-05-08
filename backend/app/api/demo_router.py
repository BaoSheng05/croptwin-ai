"""Demo scenario endpoint."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.realtime.manager import manager
from app.schemas import DemoScenarioRequest, LayerUpdateEvent
from app.services.ai_alerts import generate_ai_alert
from app.services.alert_lifecycle import record_alert_if_due, record_recommendation_if_due
from app.services.alerts import generate_predictive_alert
from app.services.business import business_impact_snapshot
from app.services.demo_scenarios import build_scenario_reading
from app.services.energy import energy_optimizer_snapshot
from app.services.health import calculate_health_score, status_from_score
from app.services.persistence import persist_reading, safe_commit
from app.services.recommendations import generate_recommendation, generate_recommendation_for_alert
from app.store import ALERTS, LAYERS, READINGS, RECOMMENDATIONS, get_recipe_for_layer, save_reading, seed_latest_readings

router = APIRouter()


@router.post("/demo/scenario")
async def apply_demo_scenario(request: DemoScenarioRequest, db: Session = Depends(get_db)) -> dict:
    seed_latest_readings()
    layer_id = request.layer_id or "b_02"
    if layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")

    reading = build_scenario_reading(layer_id, request.scenario)
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
            record_alert_if_due(alert, db)
            recommendation = generate_recommendation_for_alert(alert, reading, recipe, layer.devices)
        if recommendation:
            record_recommendation_if_due(recommendation, db)

    persist_reading(db, reading)
    persistence_error = safe_commit(db)

    event = LayerUpdateEvent(
        data=layer, alert=alert,
        recommendation=recommendation,
        resolved_alert_ids=[],
    )
    await manager.broadcast_json(event.model_dump(mode="json"))

    return {
        "ok": True,
        "scenario": request.scenario,
        "layer": layer.model_dump(mode="json"),
        "alert": alert.model_dump(mode="json") if alert else None,
        "recommendation": recommendation.model_dump(mode="json") if recommendation else None,
        "energy": energy_optimizer_snapshot(),
        "impact": business_impact_snapshot(),
        "persistence_error": persistence_error,
    }
