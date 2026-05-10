"""Business intelligence snapshots: yield, revenue, savings, ROI.

This module is read-only against the live store. It composes data from
the energy, nutrient, and sustainability services to produce the
dashboard payloads consumed by the analytics router.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.crop_config import RECIPES
from app.core.exceptions import BadRequestError, NotFoundError
from app.schemas import YieldSetup, YieldSetupUpdate
from app.services.energy import energy_optimizer_snapshot
from app.services.nutrients import nutrient_intelligence_snapshot
from app.store import (
    ALERTS,
    LAYERS,
    get_yield_setup,
    latest_alerts,
    save_yield_setup,
    seed_latest_readings,
    sustainability_snapshot,
)
from app.services.farm_persistence import save_yield_setup_record


YIELD_MODEL = {
    "Lettuce": {"days": 24, "kg": 1.8, "rm_per_kg": 13},
    "Spinach": {"days": 23, "kg": 1.4, "rm_per_kg": 12},
    "Basil": {"days": 21, "kg": 1.1, "rm_per_kg": 22},
    "Mint": {"days": 20, "kg": 1.0, "rm_per_kg": 24},
    "Strawberry": {"days": 38, "kg": 1.6, "rm_per_kg": 32},
    "Tomato": {"days": 45, "kg": 2.4, "rm_per_kg": 10},
}

DEMO_HARVEST_DAYS_REMAINING = {
    "a_01": 0,
    "b_03": 2,
    "c_01": 6,
}

DEFAULT_PLANTS_PER_LAYER = 18


def _default_yield_setup(layer_id: str) -> YieldSetup:
    """Return the persisted yield setup for ``layer_id``, applying defaults.

    Side effect: any defaulted price / kg-per-plant values are written
    back via :func:`save_yield_setup` so subsequent reads are idempotent.
    """
    layer = LAYERS[layer_id]
    model = YIELD_MODEL.get(layer.crop, {"kg": 1.4, "rm_per_kg": 12})
    setup = get_yield_setup(layer_id)
    if setup.price_rm_per_kg == 12.0 and layer.crop in YIELD_MODEL:
        setup.price_rm_per_kg = model["rm_per_kg"]
    if setup.expected_kg_per_plant == 0.08:
        setup.expected_kg_per_plant = round(model["kg"] / DEFAULT_PLANTS_PER_LAYER, 3)
    setup.crop = layer.crop
    return save_yield_setup(setup)


def yield_setup_snapshot() -> dict:
    """Return manual farm setup inputs used by the yield forecast."""
    setups = [_default_yield_setup(layer_id).model_dump() for layer_id in LAYERS]
    for setup in setups:
        setup["total_plants"] = setup["rows"] * setup["columns"] * setup["rack_layers"]
    return {
        "available_crops": list(RECIPES.keys()),
        "setups": setups,
    }


def update_yield_setup(layer_id: str, update: YieldSetupUpdate, db: Session | None = None) -> YieldSetup:
    """Update manual grow-plan inputs for one farm layer."""
    if layer_id not in LAYERS:
        raise NotFoundError("Unknown farm layer", details={"layer_id": layer_id})

    current = _default_yield_setup(layer_id)
    data = current.model_dump()
    patch = update.model_dump(exclude_unset=True)

    if "crop" in patch and patch["crop"] not in RECIPES:
        crops = ", ".join(RECIPES.keys())
        raise BadRequestError(
            f"Unsupported crop. Choose one of: {crops}",
            details={"crop": patch["crop"]},
        )

    data.update({key: value for key, value in patch.items() if value is not None})
    setup = YieldSetup(**data)
    save_yield_setup(setup)
    if db:
        save_yield_setup_record(db, setup)
    return setup


def business_impact_snapshot() -> dict:
    """Return projected monthly savings, avoided crop loss, and ROI."""
    seed_latest_readings()
    sustainability = sustainability_snapshot()
    energy = energy_optimizer_snapshot()
    alerts = latest_alerts(limit=len(ALERTS))
    warning_layers = sum(1 for layer in LAYERS.values() if layer.status.value != "Healthy")
    disease_risk = sum(1 for alert in alerts if "fungal" in alert.title.lower() or "humidity" in alert.title.lower())
    crop_loss_prevented = min(28, 8 + warning_layers * 4 + disease_risk * 5)
    monthly_energy = max(energy["estimated_monthly_savings_rm"], sustainability.estimated_cost_reduction_rm * 4)
    monthly_water = sustainability.water_saved_liters * 0.015
    avoided_loss = crop_loss_prevented * 85
    total_monthly = monthly_energy + monthly_water + avoided_loss
    return {
        "monthly_energy_savings_rm": round(monthly_energy, 2),
        "monthly_water_savings_rm": round(monthly_water, 2),
        "crop_loss_prevented_percent": crop_loss_prevented,
        "avoided_crop_loss_rm": round(avoided_loss, 2),
        "estimated_monthly_value_rm": round(total_monthly, 2),
        "payback_months": round(6500 / max(total_monthly, 1), 1),
        "early_detection_days": 3 if warning_layers else 1,
        "summary": f"AI scheduling and early warnings are projected to protect RM {total_monthly:.0f}/month for this demo farm.",
    }


def yield_forecast_snapshot() -> dict:
    """Return per-layer yield, revenue, harvest readiness, and confidence."""
    seed_latest_readings()
    nutrient = nutrient_intelligence_snapshot()
    nutrient_scores = {item["layer_id"]: item["nutrient_score"] for item in nutrient["layers"]}
    energy = energy_optimizer_snapshot()
    light_plans = {item["layer_id"]: item for item in energy["layer_plans"]}
    layers = []

    for layer in LAYERS.values():
        model = YIELD_MODEL.get(layer.crop, {"days": 28, "kg": 1.4, "rm_per_kg": 12})
        setup = _default_yield_setup(layer.id)
        nutrient_score = nutrient_scores.get(layer.id, 85)
        light_plan = light_plans.get(layer.id, {})
        health_factor = max(0.45, layer.health_score / 100)
        nutrient_factor = max(0.55, nutrient_score / 100)
        light_factor = max(0.7, min(1.08, (100 - abs(light_plan.get("recommended_led_percent", 60) - 55)) / 100 + 0.45))
        risk_factor = round(health_factor * 0.45 + nutrient_factor * 0.35 + light_factor * 0.2, 2)
        total_plants = setup.rows * setup.columns * setup.rack_layers
        base_yield_kg = total_plants * setup.expected_kg_per_plant
        expected_kg = round(base_yield_kg * risk_factor, 2)
        revenue_rm = round(expected_kg * setup.price_rm_per_kg, 2)
        delay_days = max(0, round((1 - risk_factor) * 8))
        harvest_days = DEMO_HARVEST_DAYS_REMAINING.get(layer.id, model["days"] + delay_days)
        if harvest_days <= 3:
            harvest_status = "Harvest ready"
        elif harvest_days <= 7:
            harvest_status = "Ready soon"
        else:
            harvest_status = "Growing"
        confidence = round(min(95, max(52, layer.health_score * 0.5 + nutrient_score * 0.35 + 12)))

        layers.append({
            "layer_id": layer.id,
            "layer_name": layer.name,
            "area_name": layer.area_name,
            "crop": layer.crop,
            "expected_harvest_days": harvest_days,
            "harvest_status": harvest_status,
            "can_mark_harvested": harvest_status == "Harvest ready",
            "yield_confidence": confidence,
            "estimated_kg": expected_kg,
            "risk_adjusted_yield_kg": expected_kg,
            "estimated_revenue_rm": revenue_rm,
            "price_rm_per_kg": setup.price_rm_per_kg,
            "risk_factor": risk_factor,
            "plant_count": total_plants,
            "rows": setup.rows,
            "columns": setup.columns,
            "rack_layers": setup.rack_layers,
            "farm_area_m2": setup.farm_area_m2,
            "expected_kg_per_plant": setup.expected_kg_per_plant,
            "drivers": [
                f"Manual setup: {total_plants} plants at {setup.expected_kg_per_plant:.3f} kg/plant",
                f"Health score {layer.health_score}/100",
                f"Nutrient score {nutrient_score}/100",
                f"Lighting mode: {energy['strategy']['mode']}",
            ],
        })

    total_kg = round(sum(item["estimated_kg"] for item in layers), 2)
    total_revenue = round(sum(item["estimated_revenue_rm"] for item in layers), 2)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": f"Current crop plan is forecast to produce {total_kg} kg with estimated sales value RM {total_revenue}.",
        "total_estimated_kg": total_kg,
        "total_estimated_revenue_rm": total_revenue,
        "average_confidence": round(sum(item["yield_confidence"] for item in layers) / len(layers)),
        "layers": layers,
    }
