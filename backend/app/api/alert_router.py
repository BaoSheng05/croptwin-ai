"""Alert listing, auto-resolve, and recommendation endpoints.

Provides read access to the current alert and recommendation state,
plus a manual trigger to resolve alerts whose underlying conditions
have returned to normal.
"""

from fastapi import APIRouter

from app.services.alert_lifecycle import (
    auto_resolve_and_refresh,
    recommendations_for_current_alerts,
    resolve_all_alerts,
    resolve_all_recommendations,
)
from app.store import latest_alerts, seed_latest_readings

router = APIRouter()


# ── Alert Listing ────────────────────────────────────────────────


@router.get("/alerts")
def get_alerts() -> list:
    """Return the most recent unique alerts across all layers.

    Stale alerts are resolved before the list is built, so the
    response reflects the current farm state.
    """
    seed_latest_readings()
    resolve_all_alerts()
    return latest_alerts()


# ── Auto-Resolve ─────────────────────────────────────────────────


@router.post("/alerts/auto-resolve")
def auto_resolve_alerts() -> dict:
    """Manually trigger alert resolution for the entire farm.

    Checks each active alert against the latest sensor reading for
    its layer. If the reading is now within the crop recipe range,
    the alert is removed and included in the ``resolved`` list.

    After resolution, every layer's ``main_risk`` is refreshed to
    reflect the current state.

    Returns:
        A summary with counts and details of resolved alerts.
    """
    seed_latest_readings()
    return auto_resolve_and_refresh()


# ── Recommendations ──────────────────────────────────────────────


@router.get("/recommendations")
def get_recommendations() -> list:
    """Return one recommendation per active alert.

    Stale recommendations are resolved first, then fresh
    recommendations are generated for every remaining alert.
    """
    seed_latest_readings()
    resolve_all_recommendations()
    return recommendations_for_current_alerts()
