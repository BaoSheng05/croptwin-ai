"""Device command endpoints: manual control, AI-safe execution, bulk auto-mode."""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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

MANUAL_DEVICES = {"fan", "pump", "misting", "climate_heating", "climate_cooling", "led_intensity"}


@router.post("/devices/commands")
async def send_device_command(command: DeviceCommand, db: Session = Depends(get_db)) -> dict:
    if command.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")

    devices = LAYERS[command.layer_id].devices

    if devices.auto_mode and command.device in MANUAL_DEVICES:
        raise HTTPException(
            status_code=400,
            detail="Manual device control is disabled while AI Control is on",
        )
    if command.device == "auto_mode" and type(command.value) is not bool:
        raise HTTPException(status_code=400, detail="auto_mode value must be a boolean")

    if command.device in MANUAL_DEVICES:
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

    return await apply_device_command(command, db)


@router.post("/devices/auto-mode/all")
async def enable_ai_control_for_all_layers(db: Session = Depends(get_db)) -> dict:
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


@router.post("/ai/execute-safe-command")
async def execute_safe_command(request: SafeCommandRequest, db: Session = Depends(get_db)):
    val = validate_device_command(request.layer_id, request.device, request.value, request.duration_minutes)
    if not val["valid"]:
        raise HTTPException(status_code=400, detail=val["reason"])

    cmd = DeviceCommand(layer_id=request.layer_id, device=request.device, value=request.value)
    result = await apply_device_command(cmd, db)

    is_on = request.value is True if type(request.value) is bool else int(request.value) > 0
    if is_on and request.duration_minutes and request.device in CONTROLLABLE_DEVICES:
        token = f"{datetime.now(timezone.utc).timestamp()}:{request.duration_minutes}"
        SCHEDULED_AUTO_OFF[(request.layer_id, request.device)] = token
        asyncio.create_task(
            turn_device_off_later(request.layer_id, request.device, request.duration_minutes, token)
        )
        result["scheduled_auto_off_minutes"] = request.duration_minutes

    return result
