"""Demo scenario endpoint.

Applies pre-built environmental scenarios (e.g. high humidity, disease
outbreak, energy peak) to a target layer for testing and presentation.
The full sensor → alert → recommendation pipeline runs on the simulated
reading, producing realistic system responses.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import require_valid_layer
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

router = APIRouter()

# Default layer for demos when none is specified
_DEFAULT_DEMO_LAYER = "b_02"


@router.post("/demo/scenario")
async def apply_demo_scenario(
    request: DemoScenarioRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Apply a demo scenario and run the full processing pipeline.

    Workflow:
      1. Build a synthetic sensor reading matching the scenario
      2. Save the reading and update layer health
      3. Generate alerts and recommendations (unless "normal" scenario)
      4. For "normal" scenario: clear all alerts/recommendations for the layer
      5. Persist to database and broadcast via WebSocket
      6. Return the result with energy and business impact snapshots

    Args:
        request: The scenario type and optional target layer.
        db: Database session (injected by FastAPI).

    Returns:
        A comprehensive result dict including the updated layer,
        any alert/recommendation, and analytics snapshots.
    """
    seed_latest_readings()

    layer_id = request.layer_id or _DEFAULT_DEMO_LAYER
    require_valid_layer(layer_id)

    # ── Step 1: Build scenario reading ───────────────────────────
    reading = build_scenario_reading(layer_id, request.scenario)
    recipe = get_recipe_for_layer(layer_id)
    save_reading(reading)

    # ── Step 2: Update layer health ──────────────────────────────
    layer = LAYERS[layer_id]
    layer.health_score = calculate_health_score(reading, recipe)
    layer.status = status_from_score(layer.health_score)

    # ── Step 3: Generate alerts & recommendations ────────────────
    alert = (
        generate_ai_alert(reading, recipe)
        or generate_predictive_alert(list(READINGS[layer_id]), recipe)
    )
    recommendation = generate_recommendation(reading, recipe, devices=layer.devices)
    layer.main_risk = alert.title if alert else None

    # ── Step 4: Handle "normal" scenario (reset) ─────────────────
    if request.scenario == "normal":
        # Clear all alerts and recommendations for this layer
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
        # Record alert and generate alert-specific recommendation
        if alert:
            record_alert_if_due(alert, db)
            recommendation = generate_recommendation_for_alert(
                alert, reading, recipe, layer.devices,
            )
        if recommendation:
            record_recommendation_if_due(recommendation, db)

    # ── Step 5: Persist and broadcast ────────────────────────────
    persist_reading(db, reading)
    persistence_error = safe_commit(db)

    event = LayerUpdateEvent(
        data=layer,
        alert=alert,
        recommendation=recommendation,
        resolved_alert_ids=[],
    )
    await manager.broadcast_json(event.model_dump(mode="json"))

    # ── Step 6: Return comprehensive result ──────────────────────
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
