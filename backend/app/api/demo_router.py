"""Demo scenario endpoint.

The router defers to :func:`app.services.demo_scenarios.apply_scenario`
which owns the alert/recommendation pipeline.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import require_valid_layer
from app.database import get_db
from app.schemas import DemoScenarioRequest
from app.services.demo_scenarios import apply_scenario

router = APIRouter()

# Default layer used when the request does not specify one.
_DEFAULT_DEMO_LAYER = "b_02"


@router.post("/demo/scenario")
async def apply_demo_scenario(
    request: DemoScenarioRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Apply a demo scenario to a target layer and return the result.

    Args:
        request: The scenario type and optional target layer.
        db: Database session injected by FastAPI.

    Returns:
        Result payload from :func:`apply_scenario` including the updated
        layer, alert/recommendation, and analytics snapshots.

    Raises:
        NotFoundError: If the target layer is unknown.
    """
    layer_id = request.layer_id or _DEFAULT_DEMO_LAYER
    require_valid_layer(layer_id)
    return await apply_scenario(layer_id, request.scenario, db)
