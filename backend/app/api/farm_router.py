"""Farm overview, layer listing, area listing, crop recipes, and WebSocket.

This is the primary read-only router for the farm dashboard. All
non-trivial computations are delegated to
:mod:`app.services.farm_overview`; the router only parses requests and
shapes responses.
"""

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.crop_config import RECIPES
from app.database import get_db
from app.realtime.manager import manager
from app.schemas import FarmLayoutConfig
from app.services.farm_overview import (
    farm_layout_snapshot,
    farm_overview_snapshot,
    update_farm_layout,
)
from app.services.user_preferences import get_preference, set_preference
from app.store import AREAS, LAYERS, seed_latest_readings

router = APIRouter()


# ── Farm Overview ────────────────────────────────────────────────


@router.get("/farm")
def get_farm_overview() -> dict:
    """Return the full farm snapshot for the dashboard.

    Includes all layers, average health score, active alert count,
    and sustainability metrics.
    """
    return farm_overview_snapshot()


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


@router.get("/farm/layout")
def get_farm_layout() -> dict:
    """Return the owner-defined area and layer count."""
    return farm_layout_snapshot()


@router.put("/farm/layout")
def put_farm_layout(request: FarmLayoutConfig, db: Session = Depends(get_db)) -> dict:
    """Rebuild the farm layout from owner-defined area and layer counts."""
    return update_farm_layout(request, db)


# ── Crop Recipes ─────────────────────────────────────────────────


@router.get("/recipes")
def get_recipes() -> dict:
    """Return all crop recipes so the frontend can display ideal ranges."""
    return {crop: recipe.model_dump() for crop, recipe in RECIPES.items()}


# ── User Preferences ─────────────────────────────────────────────


@router.get("/preferences/{key}")
def read_preference(key: str, db: Session = Depends(get_db)) -> dict:
    """Return a persisted user preference payload."""
    return {"key": key, "value": get_preference(db, key)}


@router.put("/preferences/{key}")
def write_preference(key: str, payload: dict, db: Session = Depends(get_db)) -> dict:
    """Persist a user preference payload."""
    value = payload.get("value")
    return {"key": key, "value": set_preference(db, key, value)}


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
        await websocket.send_json({
            "event": "snapshot",
            "data": [layer.model_dump(mode="json") for layer in LAYERS.values()],
        })
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
