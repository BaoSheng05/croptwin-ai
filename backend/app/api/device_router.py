"""Device command endpoints: manual control, AI-safe execution, bulk auto-mode.

Handles three distinct command flows:
  1. Manual commands from the operator (with auto-mode guard)
  2. Bulk auto-mode toggle for all layers
  3. AI-recommended safe commands (with safety guardrail validation)
"""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import require_valid_layer
from app.database import get_db
from app.schemas import DeviceCommand, SafeCommandRequest
from app.services.device_control import (
    CONTROLLABLE_DEVICES,
    SCHEDULED_AUTO_OFF,
    apply_device_command,
    turn_device_off_later,
)
from app.services.safety_guardrail import validate_device_command
from app.store import LAYERS

router = APIRouter()

# Devices that require auto_mode to be OFF for manual control
_MANUAL_DEVICES = {"fan", "pump", "misting", "climate_heating", "climate_cooling", "led_intensity"}


def _validate_manual_command(command: DeviceCommand) -> None:
    """Validate a manual device command and raise HTTP 400 on failure.

    Checks:
      - auto_mode must be off for manual device control
      - auto_mode value must be boolean
      - led_intensity must be int 0–100
      - climate_heating/cooling must be int 0–3
      - boolean devices (fan, pump, misting) must receive bool values

    Args:
        command: The incoming device command to validate.

    Raises:
        HTTPException: 400 with a descriptive error message.
    """
    devices = LAYERS[command.layer_id].devices

    # Guard: manual control blocked while AI auto-mode is on
    if devices.auto_mode and command.device in _MANUAL_DEVICES:
        raise HTTPException(
            status_code=400,
            detail="Manual device control is disabled while AI Control is on",
        )

    # auto_mode toggle must be boolean
    if command.device == "auto_mode":
        if type(command.value) is not bool:
            raise HTTPException(status_code=400, detail="auto_mode value must be a boolean")
        return  # no further validation needed

    # Per-device value validation
    if command.device not in _MANUAL_DEVICES:
        return

    if command.device == "led_intensity":
        if type(command.value) is not int or not (0 <= command.value <= 100):
            raise HTTPException(status_code=400, detail="LED intensity must be between 0 and 100")
    elif command.device in {"climate_heating", "climate_cooling"}:
        if type(command.value) is not int or not (0 <= command.value <= 3):
            raise HTTPException(
                status_code=400,
                detail=f"{command.device} value must be an integer between 0 and 3",
            )
    elif type(command.value) is not bool:
        raise HTTPException(
            status_code=400,
            detail=f"{command.device} value must be a boolean",
        )


# ── Manual Device Control ────────────────────────────────────────


@router.post("/devices/commands")
async def send_device_command(
    command: DeviceCommand,
    db: Session = Depends(get_db),
) -> dict:
    """Execute a manual device command from the operator.

    The command is validated for type correctness and auto-mode
    restrictions before being applied to the layer's device state.

    Raises:
        HTTPException: 404 if layer unknown, 400 if validation fails.
    """
    require_valid_layer(command.layer_id)
    _validate_manual_command(command)
    return await apply_device_command(command, db)


# ── Bulk Auto-Mode ───────────────────────────────────────────────


@router.post("/devices/auto-mode/all")
async def enable_ai_control_for_all_layers(
    db: Session = Depends(get_db),
) -> dict:
    """Enable AI auto-mode for every layer in the farm.

    Iterates through all layers and sets ``auto_mode=True``,
    which resets manual device overrides and enables AI control.

    Returns:
        A summary with the count of updated layers and their new states.
    """
    updated = []
    for layer_id in LAYERS:
        result = await apply_device_command(
            DeviceCommand(layer_id=layer_id, device="auto_mode", value=True),
            db,
        )
        updated.append({
            "layer_id": layer_id,
            "devices": result["devices"].model_dump(mode="json"),
        })

    return {"ok": True, "updated_count": len(updated), "layers": updated}


# ── AI Safe Command Execution ────────────────────────────────────


@router.post("/ai/execute-safe-command")
async def execute_safe_command(
    request: SafeCommandRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Execute an AI-recommended device command with safety guardrails.

    Unlike manual commands, this goes through ``validate_device_command``
    which checks environmental constraints (e.g. pump max duration,
    misting humidity threshold, climate mutual exclusion).

    If the command has a ``duration_minutes``, a background task is
    scheduled to automatically turn the device off after that time.

    Raises:
        HTTPException: 400 if the safety guardrail rejects the command.
    """
    # Safety validation
    validation = validate_device_command(
        request.layer_id, request.device,
        request.value, request.duration_minutes,
    )
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["reason"])

    # Execute the command
    cmd = DeviceCommand(
        layer_id=request.layer_id,
        device=request.device,
        value=request.value,
    )
    result = await apply_device_command(cmd, db)

    # Schedule auto-off if the device is being turned on with a duration
    is_on = request.value is True if type(request.value) is bool else int(request.value) > 0
    if is_on and request.duration_minutes and request.device in CONTROLLABLE_DEVICES:
        token = f"{datetime.now(timezone.utc).timestamp()}:{request.duration_minutes}"
        SCHEDULED_AUTO_OFF[(request.layer_id, request.device)] = token
        asyncio.create_task(
            turn_device_off_later(
                request.layer_id, request.device,
                request.duration_minutes, token,
            )
        )
        result["scheduled_auto_off_minutes"] = request.duration_minutes

    return result
