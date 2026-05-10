"""Read-only farm overview snapshots used by the dashboard.

These helpers consolidate small computations (average health,
sustainability metrics, alert count) and the layout response shaping
that previously lived inline inside :mod:`app.api.farm_router`.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.schemas import FarmLayoutConfig
from app.services.alert_lifecycle import resolve_all_alerts, resolve_all_recommendations
from app.services.farm_persistence import prune_yield_setups, save_farm_layout
from app.store import (
    ALERTS,
    AREAS,
    FARM_LAYOUT,
    LAYERS,
    configure_farm_layout,
    latest_alerts,
    seed_latest_readings,
    sustainability_snapshot,
)


def farm_overview_snapshot() -> dict[str, Any]:
    """Return the full farm dashboard payload.

    Resolves stale alerts/recommendations first so the response always
    matches the current sensor state.
    """
    seed_latest_readings()
    resolve_all_alerts()
    resolve_all_recommendations()

    layer_count = max(1, len(LAYERS))
    avg_health = round(
        sum(layer.health_score for layer in LAYERS.values()) / layer_count
    )

    return {
        "name": "CropTwin AI Vertical Farm",
        "average_health_score": avg_health,
        "active_alerts": len(latest_alerts(limit=len(ALERTS))),
        "layers": list(LAYERS.values()),
        "sustainability": sustainability_snapshot(),
    }


def farm_layout_snapshot() -> dict[str, Any]:
    """Return the owner-defined area/layer counts plus the resolved totals."""
    return {
        **FARM_LAYOUT.model_dump(),
        "total_layers": len(LAYERS),
    }


def update_farm_layout(config: FarmLayoutConfig, db: Session) -> dict[str, Any]:
    """Apply a new farm layout, prune stale yield setups, and return the snapshot.

    Args:
        config: The owner-supplied layout description.
        db: SQLAlchemy session used to persist the change.

    Returns:
        A response payload identical in shape to :func:`farm_layout_snapshot`
        but enriched with the freshly-computed ``areas`` and ``layers`` lists.
    """
    resolved = configure_farm_layout(config)
    save_farm_layout(db, resolved)
    prune_yield_setups(db, set(LAYERS.keys()))
    return {
        **resolved.model_dump(),
        "total_layers": len(LAYERS),
        "areas": list(AREAS.values()),
        "layers": list(LAYERS.values()),
    }
