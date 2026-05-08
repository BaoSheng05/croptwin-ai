"""Farm overview, layer listing, area listing, and WebSocket."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.realtime.manager import manager
from app.services.alert_lifecycle import resolve_all_alerts, resolve_all_recommendations
from app.store import ALERTS, AREAS, LAYERS, latest_alerts, seed_latest_readings, sustainability_snapshot

router = APIRouter()


@router.get("/farm")
def get_farm_overview() -> dict:
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


@router.get("/layers")
def get_layers() -> list:
    seed_latest_readings()
    return list(LAYERS.values())


@router.get("/areas")
def get_areas() -> list:
    return list(AREAS.values())


@router.get("/recipes")
def get_recipes() -> dict:
    """Return all crop recipes so the frontend doesn't need to hardcode them."""
    from app.store import RECIPES
    return {
        crop: {
            "crop": recipe.crop,
            "temperature_range": recipe.temperature_range,
            "humidity_range": recipe.humidity_range,
            "soil_moisture_range": recipe.soil_moisture_range,
            "ph_range": recipe.ph_range,
            "light_range": recipe.light_range,
        }
        for crop, recipe in RECIPES.items()
    }


@router.websocket("/ws/farm")
async def farm_websocket(websocket: WebSocket) -> None:
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
