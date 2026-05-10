"""Device command endpoints: manual control, AI-safe execution, bulk auto-mode.

The router only parses requests and shapes responses. All validation
and side effects live in :mod:`app.services.device_control` and
:mod:`app.services.safety_guardrail`.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import require_valid_layer
from app.core.exceptions import BadRequestError
from app.database import get_db
from app.schemas import DeviceCommand, SafeCommandRequest
from app.services.device_control import (
    apply_device_command,
    execute_safe_command,
    validate_manual_command,
)
from app.services.safety_guardrail import validate_device_command
from app.store import LAYERS

router = APIRouter()


# ── Manual Device Control ────────────────────────────────────────


@router.post("/devices/commands")
async def send_device_command(
    command: DeviceCommand,
    db: Session = Depends(get_db),
) -> dict:
    """Execute a manual device command from the operator.

    Args:
        command: The incoming device command.
        db: Database session injected by FastAPI.

    Raises:
        NotFoundError: If the layer is unknown.
        BadRequestError: If the command value is malformed.
        BusinessRuleError: If AI auto-mode blocks manual control.
    """
    require_valid_layer(command.layer_id)
    validate_manual_command(command)
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
async def execute_safe_command_endpoint(
    request: SafeCommandRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Execute an AI-recommended device command with safety guardrails.

    Unlike manual commands, this goes through ``validate_device_command``
    which checks environmental constraints (e.g. pump max duration,
    misting humidity threshold, climate mutual exclusion).

    Raises:
        BadRequestError: If the safety guardrail rejects the command.
    """
    validation = validate_device_command(
        request.layer_id, request.device,
        request.value, request.duration_minutes,
    )
    if not validation["valid"]:
        raise BadRequestError(validation["reason"], details={"layer_id": request.layer_id})

    return await execute_safe_command(
        request.layer_id, request.device,
        request.value, request.duration_minutes,
        db,
    )
