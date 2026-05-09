"""Analytics & intelligence endpoints.

Aggregates data from multiple service modules to power the advanced
dashboard features:
  - Energy optimisation and tariff strategy
  - Business impact and yield forecasting
  - Operations timeline
  - Market intelligence
  - Climate risk assessment
  - Nutrient automation
  - What-if simulation and urban expansion modelling
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import require_valid_layer
from app.database import get_db
from app.schemas import NutrientAutomationRequest, NutrientAutoRunRequest, YieldSetupUpdate
from app.services.business import (
    business_impact_snapshot,
    update_yield_setup,
    yield_forecast_snapshot,
    yield_setup_snapshot,
)
from app.services.climate import climate_risk_snapshot
from app.services.energy import energy_optimizer_snapshot
from app.services.expansion import urban_expansion_whatif
from app.services.market import market_news_snapshot
from app.services.nutrients import (
    auto_run_nutrient_automation,
    execute_nutrient_plan,
    nutrient_intelligence_snapshot,
)
from app.services.operations import operations_timeline_snapshot
from app.services.whatif import WhatIfRequest, WhatIfResponse, simulate_whatif

router = APIRouter()


# ── Energy ───────────────────────────────────────────────────────


@router.get("/energy/optimizer")
def get_energy_optimizer() -> dict:
    """Return the current energy optimisation strategy and tariff data."""
    return energy_optimizer_snapshot()


# ── Business ─────────────────────────────────────────────────────


@router.get("/business/impact")
def get_business_impact() -> dict:
    """Return business impact metrics: revenue, cost savings, yield value."""
    return business_impact_snapshot()


# ── Operations ───────────────────────────────────────────────────


@router.get("/operations/timeline")
def get_operations_timeline() -> dict:
    """Return the operations timeline with recent events and upcoming tasks."""
    return operations_timeline_snapshot()


# ── Yield ────────────────────────────────────────────────────────


@router.get("/yield/forecast")
def get_yield_forecast() -> dict:
    """Return yield forecasts per crop based on current conditions."""
    return yield_forecast_snapshot()


@router.get("/yield/setup")
def get_yield_setup() -> dict:
    """Return editable crop amount, farm size, yield, and price inputs."""
    return yield_setup_snapshot()


@router.put("/yield/setup/{layer_id}")
def put_yield_setup(layer_id: str, request: YieldSetupUpdate) -> dict:
    """Update manual yield and market inputs for one farm layer."""
    return update_yield_setup(layer_id, request).model_dump()


# ── Market ───────────────────────────────────────────────────────


@router.get("/market/news")
def get_market_news() -> dict:
    """Return market intelligence: prices, trends, and news for local crops."""
    return market_news_snapshot()


# ── Nutrients ────────────────────────────────────────────────────


@router.get("/nutrients/intelligence")
def get_nutrient_intelligence() -> dict:
    """Return nutrient status and dosing recommendations for all layers."""
    return nutrient_intelligence_snapshot()


@router.post("/nutrients/execute-plan")
async def run_nutrient_plan(
    request: NutrientAutomationRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Execute the nutrient dosing plan for a single layer.

    Requires ``confirm=true`` in the request body as a safety check
    before performing any dosing operations.

    Raises:
        HTTPException: 400 if ``confirm`` is not True.
    """
    if not request.confirm:
        raise HTTPException(
            status_code=400,
            detail="Nutrient automation requires confirm=true",
        )
    return await execute_nutrient_plan(request.layer_id, db)


@router.post("/nutrients/auto-run")
async def run_auto_nutrient_automation(
    request: NutrientAutoRunRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Batch-run nutrient automation across the highest-risk layers.

    Automatically selects layers based on risk level and executes
    dosing plans up to ``max_layers``.
    """
    return await auto_run_nutrient_automation(request, db)


# ── Climate ──────────────────────────────────────────────────────


@router.get("/climate/shield")
def get_climate_shield() -> dict:
    """Return climate risk assessment with weather forecasts and mitigation plans."""
    return climate_risk_snapshot()


# ── What-If Simulation ──────────────────────────────────────────


@router.post("/whatif/simulate", response_model=WhatIfResponse)
def run_whatif(request: WhatIfRequest) -> WhatIfResponse:
    """Run a what-if simulation for a layer over a specified time horizon.

    Simulates the effect of an intervention (e.g. turning on fans,
    adjusting irrigation) on sensor readings and health scores.

    Raises:
        HTTPException: 404 if the target layer is unknown.
    """
    require_valid_layer(request.layer_id)
    return simulate_whatif(request.layer_id, request.hours, request.action)


@router.get("/whatif/urban-expansion")
def get_urban_expansion_whatif() -> dict:
    """Model the impact of adding more farming capacity to the facility."""
    return urban_expansion_whatif()
