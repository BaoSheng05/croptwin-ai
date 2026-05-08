"""Alert listing, auto-resolve, and recommendation endpoints."""

from fastapi import APIRouter

from app.services.ai_alerts import generate_ai_alert
from app.services.alert_lifecycle import (
    recommendations_for_current_alerts,
    resolve_all_alerts,
    resolve_all_recommendations,
)
from app.services.alerts import alert_is_resolved
from app.store import ALERTS, LAYERS, get_recipe_for_layer, latest_alerts, seed_latest_readings

router = APIRouter()


@router.get("/alerts")
def get_alerts() -> list:
    seed_latest_readings()
    resolve_all_alerts()
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
                "message": (
                    f"Solved: {layer.name} {alert.title.lower()} "
                    "is back within the crop recipe range."
                ),
            })

    for layer in LAYERS.values():
        current_alert = (
            generate_ai_alert(layer.latest_reading, get_recipe_for_layer(layer.id))
            if layer.latest_reading else None
        )
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
    resolve_all_recommendations()
    return recommendations_for_current_alerts()
