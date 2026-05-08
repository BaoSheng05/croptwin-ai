from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import DeviceLogDB, SensorReadingDB
from app.realtime.manager import manager
from app.schemas import LayerUpdateEvent, NutrientAutoRunRequest, SensorReading
from app.services.health import calculate_health_score, status_from_score
from app.store import LAYERS, get_recipe_for_layer, save_reading, seed_latest_readings


NUTRIENT_RECIPES = {
    "Lettuce": {"ec": (1.2, 1.8), "target_ec": 1.45, "target_ph": 6.1, "reservoir_liters": 90, "stage": "Vegetative"},
    "Spinach": {"ec": (1.4, 2.0), "target_ec": 1.65, "target_ph": 6.3, "reservoir_liters": 85, "stage": "Vegetative"},
    "Basil": {"ec": (1.0, 1.6), "target_ec": 1.35, "target_ph": 6.2, "reservoir_liters": 75, "stage": "Vegetative"},
    "Mint": {"ec": (1.2, 1.8), "target_ec": 1.5, "target_ph": 6.4, "reservoir_liters": 75, "stage": "Vegetative"},
    "Strawberry": {"ec": (1.4, 2.2), "target_ec": 1.8, "target_ph": 6.0, "reservoir_liters": 110, "stage": "Flowering"},
    "Tomato": {"ec": (2.0, 3.2), "target_ec": 2.6, "target_ph": 6.2, "reservoir_liters": 120, "stage": "Fruit set"},
}


def simulated_ec(layer_id: str, crop: str, reading: SensorReading | None) -> float:
    recipe = NUTRIENT_RECIPES[crop]
    target = recipe["target_ec"]
    if not reading:
        return target
    moisture_pressure = max(-0.25, min(0.25, (reading.soil_moisture - 62) / 100))
    water_dilution = max(-0.35, min(0.15, (reading.water_level - 70) / 140))
    heat_uptake = -0.12 if reading.temperature > 27 else 0.04 if reading.temperature < 19 else 0
    layer_bias = ((sum(ord(ch) for ch in layer_id) % 9) - 4) * 0.035
    return round(max(0.4, min(3.6, target + moisture_pressure - water_dilution + heat_uptake + layer_bias)), 2)


def nutrient_action_plan(crop: str, reading: SensorReading | None, ec: float) -> dict:
    recipe = NUTRIENT_RECIPES[crop]
    low_ec, high_ec = recipe["ec"]
    target_ec = recipe["target_ec"]
    target_ph = recipe["target_ph"]
    water_level = reading.water_level if reading else 70
    ph = reading.ph if reading else target_ph
    temp = reading.temperature if reading else 24
    reservoir_liters = recipe["reservoir_liters"]
    water_topup_liters = max(0, round((72 - water_level) / 100 * reservoir_liters, 1))
    ec_deficit = max(0, target_ec - ec)
    ec_excess = max(0, ec - target_ec)
    nutrient_a_ml = round(ec_deficit * reservoir_liters * 2.8, 1)
    nutrient_b_ml = round(ec_deficit * reservoir_liters * 2.8, 1)
    dilution_liters = round(ec_excess * reservoir_liters * 0.18, 1)
    if ec > high_ec:
        dilution_liters = max(dilution_liters, 2)
    ph_up_ml = round(max(0, target_ph - ph) * reservoir_liters * 0.42, 1)
    ph_down_ml = round(max(0, ph - target_ph) * reservoir_liters * 0.38, 1)

    evidence = []
    actions = []
    avoid = []
    status = "Healthy"
    risk = "Low"
    confidence = 82

    if ec < low_ec:
        status = "Nutrient underfeed"
        risk = "High" if ec < low_ec - 0.25 else "Medium"
        confidence += 8
        evidence.append(f"EC {ec:.2f} mS/cm is below {crop}'s range {low_ec:.1f}-{high_ec:.1f}.")
        actions.append(f"Dose Nutrient A {nutrient_a_ml:.1f} ml and Nutrient B {nutrient_b_ml:.1f} ml slowly.")
        avoid.append("Do not dump concentrated A/B nutrients directly onto roots.")
    elif ec > high_ec:
        status = "Nutrient too concentrated"
        risk = "High" if ec > high_ec + 0.35 else "Medium"
        confidence += 8
        evidence.append(f"EC {ec:.2f} mS/cm is above {crop}'s range {low_ec:.1f}-{high_ec:.1f}.")
        actions.append(f"Dilute with {dilution_liters:.1f} L clean water, then recheck EC.")
        avoid.append("Do not add more fertilizer until EC returns to range.")
    else:
        evidence.append(f"EC {ec:.2f} mS/cm is within the crop range.")
        actions.append("Keep current nutrient strength and recheck after the next irrigation cycle.")

    if ph < 5.8:
        status = "Acidic nutrient lockout" if status == "Healthy" else status
        risk = "High" if ph < 5.5 else risk
        confidence += 5
        evidence.append(f"pH {ph:.1f} is low, increasing risk of calcium and magnesium lockout.")
        actions.append(f"Add pH Up about {ph_up_ml:.1f} ml, mix for 20 minutes, then retest.")
        avoid.append("Do not raise pH by more than 0.3 per correction cycle.")
    elif ph > 6.8:
        status = "Alkaline nutrient lockout" if status == "Healthy" else status
        risk = "Medium" if risk == "Low" else risk
        confidence += 5
        evidence.append(f"pH {ph:.1f} is high, reducing micronutrient availability.")
        actions.append(f"Add pH Down about {ph_down_ml:.1f} ml, mix for 20 minutes, then retest.")
        avoid.append("Do not add pH Down before nutrients are fully mixed.")

    if water_level < 40:
        risk = "High"
        confidence += 4
        evidence.append(f"Water level {water_level:.0f}% is low, so EC can swing quickly.")
        actions.insert(0, f"Top up reservoir with {max(water_topup_liters, 5):.1f} L clean water before final dosing.")
        avoid.append("Do not dose based on a low reservoir volume without topping up first.")

    if temp > 28:
        evidence.append(f"Temperature {temp:.1f}C is high, which can accelerate nutrient uptake and root stress.")
        actions.append("Cool the root zone or increase airflow before aggressive feeding.")
        avoid.append("Avoid strong feeding while the nutrient solution is warm.")

    score_penalty = min(35, abs(ec - target_ec) * 38)
    score_penalty += min(25, abs(ph - target_ph) * 18)
    score_penalty += 18 if water_level < 40 else 0
    score_penalty += 10 if temp > 28 else 0

    return {
        "status": status,
        "risk": risk,
        "confidence": min(96, confidence),
        "nutrient_score": max(0, round(100 - score_penalty)),
        "reservoir_liters": reservoir_liters,
        "target_ec": target_ec,
        "target_ph": target_ph,
        "recommended_dose": {
            "nutrient_a_ml": nutrient_a_ml,
            "nutrient_b_ml": nutrient_b_ml,
            "ph_up_ml": ph_up_ml,
            "ph_down_ml": ph_down_ml,
            "water_topup_liters": water_topup_liters,
            "dilution_liters": dilution_liters,
        },
        "evidence": evidence,
        "next_actions": actions[:5],
        "avoid": list(dict.fromkeys(avoid))[:5],
    }


def nutrient_intelligence_snapshot() -> dict:
    seed_latest_readings()
    layers = []
    for layer in LAYERS.values():
        reading = layer.latest_reading
        crop_recipe = NUTRIENT_RECIPES[layer.crop]
        ec = simulated_ec(layer.id, layer.crop, reading)
        plan = nutrient_action_plan(layer.crop, reading, ec)
        layers.append({
            "layer_id": layer.id,
            "layer_name": layer.name,
            "area_name": layer.area_name,
            "crop": layer.crop,
            "growth_stage": crop_recipe["stage"],
            "ph": round(reading.ph if reading else plan["target_ph"], 2),
            "ec": ec,
            "water_level": round(reading.water_level if reading else 70, 1),
            "temperature": round(reading.temperature if reading else 24, 1),
            **plan,
        })

    high_risk = sum(1 for item in layers if item["risk"] == "High")
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "average_nutrient_score": round(sum(item["nutrient_score"] for item in layers) / len(layers)),
        "high_risk_layers": high_risk,
        "medium_risk_layers": sum(1 for item in layers if item["risk"] == "Medium"),
        "system_mode": "Nutrient Intelligence",
        "owner_summary": (
            "Prioritize reservoir top-up and gentle A/B dosing on high-risk layers."
            if high_risk
            else "Nutrient conditions are broadly stable; keep monitoring EC, pH, and reservoir level."
        ),
        "layers": layers,
    }


async def execute_nutrient_plan(layer_id: str, db: Session) -> dict:
    seed_latest_readings()
    if layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")

    layer = LAYERS[layer_id]
    reading = layer.latest_reading
    if not reading:
        raise HTTPException(status_code=400, detail="No live sensor reading available for nutrient automation")

    ec = simulated_ec(layer.id, layer.crop, reading)
    plan = nutrient_action_plan(layer.crop, reading, ec)
    dose = plan["recommended_dose"]
    applied_water_liters = max(dose["water_topup_liters"], dose["dilution_liters"])

    if plan["risk"] == "Low" and dose["nutrient_a_ml"] == 0 and dose["ph_up_ml"] == 0 and dose["ph_down_ml"] == 0 and applied_water_liters == 0:
        layer.devices.fertigation_active = False
        layer.devices.fertigation_last_action = "No nutrient automation needed; layer is inside the recipe band."
    else:
        layer.devices.fertigation_active = True
        layer.devices.nutrient_a_dosed_ml = round(layer.devices.nutrient_a_dosed_ml + dose["nutrient_a_ml"], 1)
        layer.devices.nutrient_b_dosed_ml = round(layer.devices.nutrient_b_dosed_ml + dose["nutrient_b_ml"], 1)
        layer.devices.ph_up_dosed_ml = round(layer.devices.ph_up_dosed_ml + dose["ph_up_ml"], 1)
        layer.devices.ph_down_dosed_ml = round(layer.devices.ph_down_dosed_ml + dose["ph_down_ml"], 1)
        layer.devices.water_topup_liters = round(layer.devices.water_topup_liters + applied_water_liters, 1)
        layer.devices.fertigation_last_action = (
            f"Executed micro-dose: A {dose['nutrient_a_ml']:.1f}ml, B {dose['nutrient_b_ml']:.1f}ml, "
            f"pH Up {dose['ph_up_ml']:.1f}ml, pH Down {dose['ph_down_ml']:.1f}ml, water {applied_water_liters:.1f}L."
        )

    adjusted = SensorReading(
        layer_id=reading.layer_id,
        temperature=reading.temperature,
        humidity=reading.humidity,
        soil_moisture=min(100, reading.soil_moisture + min(4, applied_water_liters * 0.12)),
        ph=round(max(0, min(14, reading.ph + dose["ph_up_ml"] * 0.015 - dose["ph_down_ml"] * 0.015)), 2),
        light_intensity=reading.light_intensity,
        water_level=round(min(100, reading.water_level + applied_water_liters / max(plan["reservoir_liters"], 1) * 100), 1),
        timestamp=datetime.now(timezone.utc),
    )
    save_reading(adjusted)
    recipe = get_recipe_for_layer(layer_id)
    layer.health_score = calculate_health_score(adjusted, recipe)
    layer.status = status_from_score(layer.health_score)

    persistence_error = None
    try:
        db.add(DeviceLogDB(layer_id=layer_id, device="fertigation", value=layer.devices.fertigation_last_action or "none"))
        db.add(SensorReadingDB(
            layer_id=adjusted.layer_id,
            temperature=adjusted.temperature,
            humidity=adjusted.humidity,
            soil_moisture=adjusted.soil_moisture,
            ph=adjusted.ph,
            light_intensity=adjusted.light_intensity,
            water_level=adjusted.water_level,
            timestamp=adjusted.timestamp,
        ))
        db.commit()
    except Exception as exc:
        db.rollback()
        persistence_error = str(exc)[:200]
        print(f"Nutrient automation persistence skipped: {persistence_error}")

    await manager.broadcast_json({
        "event": "device_command",
        "data": {
            "layer_id": layer_id,
            "device": "fertigation",
            "value": True,
            "devices": layer.devices.model_dump(mode="json"),
        },
    })
    await manager.broadcast_json(LayerUpdateEvent(data=layer).model_dump(mode="json"))

    return {
        "ok": True,
        "layer_id": layer_id,
        "status": plan["status"],
        "risk": plan["risk"],
        "executed": {**dose, "applied_water_liters": applied_water_liters},
        "devices": layer.devices.model_dump(mode="json"),
        "updated_reading": adjusted.model_dump(mode="json"),
        "persistence_error": persistence_error,
    }


async def auto_run_nutrient_automation(request: NutrientAutoRunRequest, db: Session) -> dict:
    if not request.confirm:
        raise HTTPException(status_code=400, detail="Fertigation automation requires confirm=true")

    allowed_risks = {"High", "Medium"} if request.include_medium_risk else {"High"}
    candidates = [
        item for item in nutrient_intelligence_snapshot()["layers"]
        if item["risk"] in allowed_risks
        and any(item["recommended_dose"][key] > 0 for key in (
            "nutrient_a_ml",
            "ph_up_ml",
            "ph_down_ml",
            "water_topup_liters",
            "dilution_liters",
        ))
    ]
    risk_rank = {"High": 0, "Medium": 1, "Low": 2}
    candidates.sort(key=lambda item: (risk_rank.get(item["risk"], 9), item["nutrient_score"]))

    executed = []
    skipped = []
    for item in candidates[:request.max_layers]:
        try:
            executed.append(await execute_nutrient_plan(item["layer_id"], db))
        except Exception as exc:
            skipped.append({"layer_id": item["layer_id"], "reason": str(exc)[:200]})

    return {
        "ok": True,
        "mode": "automatic_fertigation",
        "include_medium_risk": request.include_medium_risk,
        "candidate_count": len(candidates),
        "executed_count": len(executed),
        "skipped_count": len(skipped),
        "executed": executed,
        "skipped": skipped,
        "summary": (
            f"Auto fertigation executed {len(executed)} safe nutrient plan(s)."
            if executed else
            "No nutrient action was required within the selected risk threshold."
        ),
    }
