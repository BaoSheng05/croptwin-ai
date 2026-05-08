"""Analytics & intelligence endpoints.

Energy, business impact, operations, yield, market, climate, nutrients,
and what-if simulation.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import NutrientAutomationRequest, NutrientAutoRunRequest
from app.services.business import business_impact_snapshot, yield_forecast_snapshot
from app.services.climate import climate_risk_snapshot
from app.services.energy import energy_optimizer_snapshot
from app.services.expansion import urban_expansion_whatif
from app.services.market import market_news_snapshot
from app.services.nutrients import (
    auto_run_nutrient_automation as run_auto_nutrient_automation,
    execute_nutrient_plan as run_nutrient_plan,
    nutrient_intelligence_snapshot,
)
from app.services.operations import operations_timeline_snapshot
from app.services.whatif import WhatIfRequest, WhatIfResponse, simulate_whatif
from app.store import LAYERS

router = APIRouter()


# ── Energy ───────────────────────────────────────────────────────

@router.get("/energy/optimizer")
def get_energy_optimizer() -> dict:
    return energy_optimizer_snapshot()


# ── Business ─────────────────────────────────────────────────────

@router.get("/business/impact")
def get_business_impact() -> dict:
    return business_impact_snapshot()


# ── Operations ───────────────────────────────────────────────────

@router.get("/operations/timeline")
def get_operations_timeline() -> dict:
    return operations_timeline_snapshot()


# ── Yield ────────────────────────────────────────────────────────

@router.get("/yield/forecast")
def get_yield_forecast() -> dict:
    return yield_forecast_snapshot()


# ── Market ───────────────────────────────────────────────────────

@router.get("/market/news")
def get_market_news() -> dict:
    return market_news_snapshot()


# ── Nutrients ────────────────────────────────────────────────────

@router.get("/nutrients/intelligence")
def get_nutrient_intelligence() -> dict:
    return nutrient_intelligence_snapshot()


@router.post("/nutrients/execute-plan")
async def execute_nutrient_plan(request: NutrientAutomationRequest, db: Session = Depends(get_db)) -> dict:
    if not request.confirm:
        raise HTTPException(status_code=400, detail="Nutrient automation requires confirm=true")
    return await run_nutrient_plan(request.layer_id, db)


@router.post("/nutrients/auto-run")
async def auto_run_nutrient_automation(request: NutrientAutoRunRequest, db: Session = Depends(get_db)) -> dict:
    return await run_auto_nutrient_automation(request, db)


# ── Climate ──────────────────────────────────────────────────────

@router.get("/climate/shield")
def get_climate_shield() -> dict:
    return climate_risk_snapshot()


# ── What-If ──────────────────────────────────────────────────────

@router.post("/whatif/simulate", response_model=WhatIfResponse)
def run_whatif(request: WhatIfRequest) -> WhatIfResponse:
    if request.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
    return simulate_whatif(request.layer_id, request.hours, request.action)


@router.get("/whatif/urban-expansion")
def get_urban_expansion_whatif() -> dict:
    return urban_expansion_whatif()
