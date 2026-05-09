"""Farm overview, layer listing, area listing, crop recipes, and WebSocket.

This is the primary read-only router for the farm dashboard. It provides
the top-level farm snapshot that the frontend polls on page load, plus a
WebSocket for real-time layer updates.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.crop_config import RECIPES
from app.realtime.manager import manager
from app.services.alert_lifecycle import resolve_all_alerts, resolve_all_recommendations
from app.store import (
    ALERTS,
    AREAS,
    LAYERS,
    latest_alerts,
    seed_latest_readings,
    sustainability_snapshot,
)

router = APIRouter()


# ── Farm Overview ────────────────────────────────────────────────


@router.get("/farm")
def get_farm_overview() -> dict:
    """Return the full farm snapshot for the dashboard.

    Includes all layers, average health score, active alert count,
    and sustainability metrics. Also triggers resolution of stale
    alerts and recommendations before building the response.
    """
    seed_latest_readings()
    resolve_all_alerts()
    resolve_all_recommendations()

    avg_health = round(
        sum(layer.health_score for layer in LAYERS.values()) / len(LAYERS)
    )

    return {
        "name": "CropTwin AI Vertical Farm",
        "average_health_score": avg_health,
        "active_alerts": len(latest_alerts(limit=len(ALERTS))),
        "layers": list(LAYERS.values()),
        "sustainability": sustainability_snapshot(),
    }


# ── Layer & Area Listings ────────────────────────────────────────


@router.get("/layers")
def get_layers() -> list:
    """Return all farm layers with their current state."""
    seed_latest_readings()
    return list(LAYERS.values())


@router.get("/areas")
def get_areas() -> list:
    """Return all farm areas (wings) and their layer IDs."""
    return list(AREAS.values())


# ── Crop Recipes ─────────────────────────────────────────────────


@router.get("/recipes")
def get_recipes() -> dict:
    """Return all crop recipes so the frontend can display ideal ranges.

    Each recipe is serialised using ``model_dump()`` for consistency
    with other Pydantic-based responses.
    """
    return {
        crop: recipe.model_dump()
        for crop, recipe in RECIPES.items()
    }


# ── WebSocket ────────────────────────────────────────────────────


@router.websocket("/ws/farm")
async def farm_websocket(websocket: WebSocket) -> None:
    """Real-time farm layer updates via WebSocket.

    On connection, sends a full snapshot of all layers. After that,
    the client keeps the connection open to receive incremental
    ``layer_update`` events broadcast by the sensor ingestion pipeline.
    """
    await manager.connect(websocket)
    try:
        # Send initial snapshot so the client has full state immediately
        await websocket.send_json({
            "event": "snapshot",
            "data": [layer.model_dump(mode="json") for layer in LAYERS.values()],
        })
        # Keep connection alive — client may send heartbeats
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
