"""Alert and recommendation lifecycle helpers.

Handles deduplication, recording, and resolution logic that was previously
embedded inside route handlers.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import AlertDB, RecommendationDB
from app.schemas import Alert, Recommendation, SensorReading
from app.services.alerts import alert_is_resolved
from app.services.recommendations import (
    generate_recommendation_for_alert,
    recommendation_is_resolved,
)
from app.store import (
    ALERTS,
    LAYERS,
    RECOMMENDATIONS,
    get_recipe_for_layer,
    latest_alerts,
)

ALERT_REFRESH_INTERVAL = timedelta(minutes=30)


def record_alert_if_due(alert: Alert, db: Session) -> bool:
    """Append *alert* if no duplicate exists within the refresh interval.

    Returns ``True`` when the alert was actually recorded.
    """
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


def record_recommendation_if_due(recommendation: Recommendation, db: Session) -> bool:
    """Append *recommendation* if no duplicate exists within the refresh interval."""
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


# ── Resolution helpers ───────────────────────────────────────────


def resolve_alerts_for_layer(layer_id: str) -> list[str]:
    """Remove alerts whose underlying condition is now within range.

    Returns a list of resolved alert IDs.
    """
    layer = LAYERS.get(layer_id)
    reading = layer.latest_reading if layer else None
    if not layer or not reading:
        return []

    recipe = get_recipe_for_layer(layer_id)
    resolved_ids: list[str] = []
    for alert in list(ALERTS):
        if alert.layer_id != layer_id:
            continue
        if alert_is_resolved(alert, reading, recipe):
            ALERTS.remove(alert)
            resolved_ids.append(alert.id)
    return resolved_ids


def resolve_recommendations_for_layer(layer_id: str) -> None:
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


def resolve_all_alerts() -> list[str]:
    """Resolve alerts across every layer. Returns all resolved IDs."""
    resolved_ids: list[str] = []
    for layer_id in list(LAYERS.keys()):
        resolved_ids.extend(resolve_alerts_for_layer(layer_id))
    return resolved_ids


def resolve_all_recommendations() -> None:
    """Resolve recommendations across every layer."""
    for layer_id in list(LAYERS.keys()):
        resolve_recommendations_for_layer(layer_id)


def recommendations_for_current_alerts() -> list[Recommendation]:
    """Generate a recommendation for every active alert."""
    recommendations: list[Recommendation] = []
    for alert in latest_alerts(limit=len(ALERTS)):
        layer = LAYERS.get(alert.layer_id)
        reading = layer.latest_reading if layer else None
        if not layer or not reading:
            continue
        recipe = get_recipe_for_layer(alert.layer_id)
        recommendations.append(
            generate_recommendation_for_alert(alert, reading, recipe, layer.devices)
        )
    return recommendations


def auto_resolve_and_refresh() -> dict:
    """Auto-resolve alerts whose conditions are back within range.

    Iterates through all active alerts, checks if the latest reading
    for each layer now satisfies the crop recipe, and removes resolved
    alerts. Then refreshes ``main_risk`` on every layer.

    Returns:
        A summary dict with ``resolved_count``, ``active_count``,
        ``resolved`` (list of resolved alert details), and ``message``.
    """
    from app.services.ai_alerts import generate_ai_alert

    resolved: list[dict] = []

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

    # Refresh main_risk on every layer based on current readings
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
