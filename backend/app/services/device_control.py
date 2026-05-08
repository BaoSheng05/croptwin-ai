"""Device command application, auto-off scheduling, and LED feedback.

All mutable device-state logic lives here so route handlers stay thin.
"""

import asyncio
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import DeviceLogDB
from app.realtime.manager import manager
from app.schemas import DeviceCommand
from app.store import LAYERS

# Tracks scheduled auto-off tokens: (layer_id, device) -> token
SCHEDULED_AUTO_OFF: dict[tuple[str, str], str] = {}

CONTROLLABLE_DEVICES = {"fan", "pump", "misting", "climate_heating", "climate_cooling"}


def update_reported_led_feedback(layer_id: str) -> None:
    """Gradually move the reported LED intensity toward the target."""
    devices = LAYERS[layer_id].devices
    target = devices.led_intensity
    reported = devices.led_reported_intensity
    if reported == target:
        return
    step = max(1, round(abs(target - reported) * 0.4))
    if reported < target:
        devices.led_reported_intensity = min(target, reported + step)
    else:
        devices.led_reported_intensity = max(target, reported - step)


async def turn_device_off_later(
    layer_id: str, device: str, duration_minutes: int, token: str
) -> None:
    """Background task that turns a device off after *duration_minutes*."""
    await asyncio.sleep(duration_minutes * 60)

    if layer_id not in LAYERS or device not in CONTROLLABLE_DEVICES:
        return
    if SCHEDULED_AUTO_OFF.get((layer_id, device)) != token:
        return

    devices = LAYERS[layer_id].devices
    if not getattr(devices, device):
        SCHEDULED_AUTO_OFF.pop((layer_id, device), None)
        return

    setattr(devices, device, 0 if device in {"climate_heating", "climate_cooling"} else False)
    SCHEDULED_AUTO_OFF.pop((layer_id, device), None)

    await manager.broadcast_json({
        "event": "device_command",
        "data": {
            "layer_id": layer_id,
            "device": device,
            "value": False,
            "devices": devices.model_dump(mode="json"),
            "source": "scheduled_auto_off",
        },
    })


async def apply_device_command(command: DeviceCommand, db: Session) -> dict:
    """Apply a device command, persist it, and broadcast via WebSocket.

    Returns a result dict with ``ok``, ``layer_id``, ``devices``, and
    an optional ``persistence_error``.
    """
    devices = LAYERS[command.layer_id].devices
    setattr(devices, command.device, command.value)

    # Mutual exclusion: heating and cooling cannot both be active
    if command.device == "climate_heating" and int(command.value) > 0:
        devices.climate_cooling = 0
        SCHEDULED_AUTO_OFF.pop((command.layer_id, "climate_cooling"), None)
    elif command.device == "climate_cooling" and int(command.value) > 0:
        devices.climate_heating = 0
        SCHEDULED_AUTO_OFF.pop((command.layer_id, "climate_heating"), None)

    # Auto-mode toggles reset all manual devices
    if command.device == "auto_mode" and command.value is True:
        devices.fan = False
        devices.pump = False
        devices.misting = False
        devices.climate_heating = 0
        devices.climate_cooling = 0
        for dev in CONTROLLABLE_DEVICES:
            SCHEDULED_AUTO_OFF.pop((command.layer_id, dev), None)
    elif command.device == "auto_mode" and command.value is False:
        for dev in CONTROLLABLE_DEVICES:
            SCHEDULED_AUTO_OFF.pop((command.layer_id, dev), None)
    elif command.device in CONTROLLABLE_DEVICES:
        SCHEDULED_AUTO_OFF.pop((command.layer_id, command.device), None)

    # Persist
    persistence_error = None
    try:
        db.add(DeviceLogDB(
            layer_id=command.layer_id,
            device=command.device,
            value=str(command.value),
        ))
        db.commit()
    except Exception as exc:
        db.rollback()
        persistence_error = str(exc)[:200]
        print(f"Device command persistence skipped: {persistence_error}")

    # Broadcast
    await manager.broadcast_json({
        "event": "device_command",
        "data": {
            "layer_id": command.layer_id,
            "device": command.device,
            "value": command.value,
            "devices": devices.model_dump(mode="json"),
        },
    })

    return {
        "ok": True,
        "layer_id": command.layer_id,
        "devices": devices,
        "persistence_error": persistence_error,
    }
