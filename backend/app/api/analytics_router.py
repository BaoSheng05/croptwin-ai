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

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import require_valid_layer
from app.core.exceptions import BadRequestError, NotFoundError
from app.database import get_db
from app.schemas import (
    HarvestLogCreate,
    MarketCityDetail,
    MarketCitySnapshot,
    NutrientAutomationRequest,
    NutrientAutoRunRequest,
    WhatIfRequest,
    WhatIfResponse,
    YieldSetupUpdate,
)
from app.services.business import (
    business_impact_snapshot,
    update_yield_setup,
    yield_forecast_snapshot,
    yield_setup_snapshot,
)
from app.services.climate import climate_risk_snapshot
from app.services.energy import energy_optimizer_snapshot
from app.services.expansion import urban_expansion_whatif
from app.services.harvest_logs import create_harvest_log, delete_harvest_log, list_harvest_logs
from app.services.market import get_market_city, list_market_cities, market_news_snapshot, refresh_market_cities
from app.services.nutrients import (
    auto_run_nutrient_automation,
    execute_nutrient_plan,
    nutrient_intelligence_snapshot,
)
from app.services.operations import operations_timeline_snapshot
from app.services.whatif import simulate_whatif

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
def put_yield_setup(layer_id: str, request: YieldSetupUpdate, db: Session = Depends(get_db)) -> dict:
    """Update manual yield and market inputs for one farm layer."""
    return update_yield_setup(layer_id, request, db).model_dump()


@router.get("/harvest/logs")
def get_harvest_logs(db: Session = Depends(get_db)) -> list[dict]:
    """Return persistent manual harvest records."""
    return [item.model_dump(mode="json") for item in list_harvest_logs(db)]


@router.post("/harvest/logs")
def post_harvest_log(request: HarvestLogCreate, db: Session = Depends(get_db)) -> dict:
    """Persist a manual harvest record."""
    return create_harvest_log(db, request).model_dump(mode="json")


@router.delete("/harvest/logs/{log_id}")
def remove_harvest_log(log_id: str, db: Session = Depends(get_db)) -> dict:
    """Delete a manual harvest record."""
    return {"ok": delete_harvest_log(db, log_id)}


# ── Market ───────────────────────────────────────────────────────


@router.get("/market/news")
def get_market_news() -> dict:
    """Return market intelligence: prices, trends, and news for local crops."""
    return market_news_snapshot()


@router.get("/market/cities", response_model=MarketCitySnapshot)
def get_market_cities(
    search: str | None = None,
    sort_by: str = "overall_score",
    sort_dir: str = "desc",
    db: Session = Depends(get_db),
) -> dict:
    """Return the Malaysia city scoring snapshot (podium + sortable list).

    Args:
        search: Optional case-insensitive substring match on city/state.
        sort_by: Column to sort by (e.g. ``overall_score``, ``land_price_value``).
        sort_dir: ``"asc"`` or ``"desc"``.
        db: Database session injected by FastAPI.
    """
    return list_market_cities(db, search=search, sort_by=sort_by, sort_dir=sort_dir)


@router.get("/market/cities/{city_id}", response_model=MarketCityDetail)
def get_market_city_detail(city_id: str, db: Session = Depends(get_db)) -> dict:
    """Return the full detail payload for a single Malaysian city.

    Raises:
        NotFoundError: If the city ID is unknown.
    """
    city = get_market_city(db, city_id)
    if not city:
        raise NotFoundError("Market city not found", details={"city_id": city_id})
    return city


@router.post("/market/cities/refresh", response_model=MarketCitySnapshot)
def post_market_cities_refresh(db: Session = Depends(get_db)) -> dict:
    """Refresh external data sources and rerun DeepSeek analysis for every city.

    This is treated as an expensive admin-style operation: it fetches air
    quality, news, and (when configured) DeepSeek scoring for each city,
    then returns the refreshed snapshot.
    """
    return refresh_market_cities(db)


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
        BadRequestError: If ``confirm`` is not ``True``.
    """
    if not request.confirm:
        raise BadRequestError("Nutrient automation requires confirm=true")
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
        NotFoundError: If the target layer is unknown.
    """
    require_valid_layer(request.layer_id)
    return simulate_whatif(request.layer_id, request.hours, request.action)


@router.get("/whatif/urban-expansion")
def get_urban_expansion_whatif() -> dict:
    """Model the impact of adding more farming capacity to the facility."""
    return urban_expansion_whatif()
