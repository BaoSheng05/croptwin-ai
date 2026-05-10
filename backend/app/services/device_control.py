"""Device command application, auto-off scheduling, and LED feedback.

All mutable device-state logic lives here so route handlers stay thin.
"""

import asyncio
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestError, BusinessRuleError
from app.models import DeviceLogDB
from app.realtime.manager import manager
from app.schemas import DeviceCommand
from app.store import LAYERS

# Tracks scheduled auto-off tokens: (layer_id, device) -> token
SCHEDULED_AUTO_OFF: dict[tuple[str, str], str] = {}

CONTROLLABLE_DEVICES = {"fan", "pump", "misting", "climate_heating", "climate_cooling"}

# Devices subject to manual-control restrictions when AI auto-mode is on.
MANUAL_DEVICES = {
    "fan", "pump", "misting", "climate_heating", "climate_cooling", "led_intensity",
}


def validate_manual_command(command: DeviceCommand) -> None:
    """Validate a manual device command before applying it.

    Args:
        command: The incoming device command. ``command.layer_id`` must
            already be a known layer (use ``require_valid_layer`` first).

    Raises:
        BusinessRuleError: If AI auto-mode is on and the operator tries
            to manipulate a device covered by AI control.
        BadRequestError: If the command value type or range is invalid
            for the requested device.
    """
    devices = LAYERS[command.layer_id].devices

    # Block manual control of AI-managed devices while auto-mode is on.
    if devices.auto_mode and command.device in MANUAL_DEVICES:
        raise BusinessRuleError(
            "Manual device control is disabled while AI Control is on",
            details={"layer_id": command.layer_id, "device": command.device},
        )

    # ``auto_mode`` itself must always be a boolean toggle.
    if command.device == "auto_mode":
        if type(command.value) is not bool:
            raise BadRequestError("auto_mode value must be a boolean")
        return

    # No further validation is required for non-controllable devices.
    if command.device not in MANUAL_DEVICES:
        return

    if command.device == "led_intensity":
        if type(command.value) is not int or not (0 <= command.value <= 100):
            raise BadRequestError("LED intensity must be an integer between 0 and 100")
        return

    if command.device in {"climate_heating", "climate_cooling"}:
        if type(command.value) is not int or not (0 <= command.value <= 3):
            raise BadRequestError(
                f"{command.device} value must be an integer between 0 and 3"
            )
        return

    # Remaining manual devices (fan, pump, misting) accept booleans only.
    if type(command.value) is not bool:
        raise BadRequestError(f"{command.device} value must be a boolean")


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


async def execute_safe_command(
    layer_id: str,
    device: str,
    value: bool | int,
    duration_minutes: int | None,
    db: Session,
) -> dict:
    """Execute an AI-recommended safe command and schedule auto-off.

    Args:
        layer_id: Target farm layer.
        device: Device key (must already be safety-validated by the caller).
        value: New device value (bool for fan/pump/misting, int for
            led_intensity / climate channels).
        duration_minutes: Optional auto-off duration in minutes. If the
            command turns the device on and ``device`` is in
            :data:`CONTROLLABLE_DEVICES`, a background task is scheduled
            to turn it off automatically.
        db: Active SQLAlchemy session.

    Returns:
        The same payload returned by :func:`apply_device_command`,
        plus ``scheduled_auto_off_minutes`` when an auto-off was queued.
    """
    cmd = DeviceCommand(layer_id=layer_id, device=device, value=value)
    result = await apply_device_command(cmd, db)

    is_on = value is True if type(value) is bool else int(value) > 0
    if is_on and duration_minutes and device in CONTROLLABLE_DEVICES:
        token = f"{datetime.now(timezone.utc).timestamp()}:{duration_minutes}"
        SCHEDULED_AUTO_OFF[(layer_id, device)] = token
        asyncio.create_task(
            turn_device_off_later(layer_id, device, duration_minutes, token)
        )
        result["scheduled_auto_off_minutes"] = duration_minutes

    return result


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
