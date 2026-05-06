"""What-If Simulation Engine — CropTwin AI Digital Twin Core.

Projects sensor readings forward in time under two scenarios:
  1. Baseline  — no human intervention (natural drift)
  2. Intervention — a specific device action is taken now

Uses the same health-score formula as the live system so projections
are consistent with the real dashboard.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pydantic import BaseModel

from app.schemas import CropRecipe, SensorReading
from app.services.health import calculate_health_score
from app.store import AI_CONTROL_DECISIONS, LAYERS, get_recipe_for_layer, seed_latest_readings


# ── Request / Response schemas ───────────────────────────────────

class WhatIfRequest(BaseModel):
    layer_id: str
    hours: int = 24
    action: str = "auto"  # "auto" | "fan" | "pump" | "misting" | "none"


class TimePoint(BaseModel):
    hour: int
    temperature: float
    humidity: float
    soil_moisture: float
    health_score: int


class WhatIfResponse(BaseModel):
    layer_id: str
    layer_name: str
    crop: str
    baseline: list[TimePoint]
    intervention: list[TimePoint]
    action_label: str
    summary: str
    current_health: int
    baseline_final_health: int
    intervention_final_health: int
    health_delta: int
    recommendation: str


# ── Physics constants (per-hour rates) ───────────────────────────

DRIFT = {
    "humidity":      0.8,   # %/h natural rise (warm greenhouse)
    "soil_moisture": -0.3,  # %/h natural evaporation
    "temperature":   0.1,   # °C/h solar heating
}

DEVICE_EFFECTS = {
    "fan":     {"humidity": -2.5, "temperature": -0.4, "soil_moisture": 0.0},
    "pump":    {"humidity": 0.0,  "temperature": 0.0,  "soil_moisture": 3.0},
    "misting": {"humidity": 0.8,  "temperature": -0.2, "soil_moisture": 0.0},
}


# ── Simulation core ─────────────────────────────────────────────

def _pick_best_action(reading: SensorReading, recipe: CropRecipe) -> str:
    """Heuristic: choose the single most impactful intervention."""
    if reading.humidity > recipe.humidity_range[1]:
        return "fan"
    if reading.soil_moisture < recipe.soil_moisture_range[0]:
        return "pump"
    if reading.temperature > recipe.temperature_range[1] + 2:
        return "fan"
    return "none"


def _pick_ai_control_action(layer_id: str, reading: SensorReading, recipe: CropRecipe) -> str:
    decision = AI_CONTROL_DECISIONS.get(layer_id)
    if decision:
        for device in ("pump", "misting", "fan"):
            if any(command.device == device and command.value is True for command in decision.commands):
                return device
    return _pick_best_action(reading, recipe)


def _advance(temp: float, hum: float, moist: float,
             effects: dict[str, float] | None = None) -> tuple[float, float, float]:
    """Step one hour forward with natural drift + optional device effects."""
    temp  += DRIFT["temperature"]
    hum   += DRIFT["humidity"]
    moist += DRIFT["soil_moisture"]

    if effects:
        temp  += effects.get("temperature", 0)
        hum   += effects.get("humidity", 0)
        moist += effects.get("soil_moisture", 0)

    return (
        max(5, min(50, temp)),
        max(0, min(100, hum)),
        max(0, min(100, moist)),
    )


def _snapshot(layer_id: str, h: int, temp: float, hum: float,
              moist: float, reading: SensorReading,
              recipe: CropRecipe) -> TimePoint:
    """Build a TimePoint by computing the health score for projected values."""
    projected = SensorReading(
        layer_id=layer_id,
        temperature=temp,
        humidity=hum,
        soil_moisture=moist,
        ph=reading.ph,
        light_intensity=reading.light_intensity,
        water_level=max(0, reading.water_level - h * 0.1),
        timestamp=datetime.now(timezone.utc),
    )
    score = calculate_health_score(projected, recipe)
    return TimePoint(
        hour=h,
        temperature=round(temp, 1),
        humidity=round(hum, 1),
        soil_moisture=round(moist, 1),
        health_score=score,
    )


# ── Public API ───────────────────────────────────────────────────

ACTION_LABELS = {
    "none":    "No action (baseline only)",
    "fan":     "Turn on fan now",
    "pump":    "Turn on water pump now",
    "misting": "Activate misting system now",
}


def simulate_whatif(layer_id: str, hours: int = 24,
                    action: str = "auto") -> WhatIfResponse:
    layer   = LAYERS[layer_id]
    recipe  = get_recipe_for_layer(layer_id)
    seed_latest_readings()
    reading = layer.latest_reading

    if not reading:
        empty = TimePoint(hour=0, temperature=25, humidity=60,
                          soil_moisture=60, health_score=90)
        return WhatIfResponse(
            layer_id=layer_id, layer_name=layer.name, crop=layer.crop,
            baseline=[empty], intervention=[empty],
            action_label="No data", summary="Waiting for sensor readings.",
            current_health=layer.health_score,
            baseline_final_health=empty.health_score,
            intervention_final_health=empty.health_score,
            health_delta=0,
            recommendation="Wait for a live sensor reading before running a prediction.",
        )

    # Resolve "auto" to the best concrete action
    resolved = action if action != "auto" else _pick_ai_control_action(layer_id, reading, recipe)
    effects  = DEVICE_EFFECTS.get(resolved)

    # Starting state
    b_t, b_h, b_m = reading.temperature, reading.humidity, reading.soil_moisture
    i_t, i_h, i_m = b_t, b_h, b_m

    baseline: list[TimePoint] = []
    intervention: list[TimePoint] = []

    for h in range(hours + 1):
        baseline.append(_snapshot(layer_id, h, b_t, b_h, b_m, reading, recipe))
        intervention.append(_snapshot(layer_id, h, i_t, i_h, i_m, reading, recipe))

        # Advance one hour
        b_t, b_h, b_m = _advance(b_t, b_h, b_m)
        i_t, i_h, i_m = _advance(i_t, i_h, i_m, effects)

    # Build human-readable summary
    label = ACTION_LABELS.get(resolved, resolved)
    current = baseline[0].health_score
    b_final = baseline[-1].health_score
    i_final = intervention[-1].health_score
    delta = i_final - b_final
    no_action_change = b_final - current
    action_change = i_final - current

    if resolved == "none":
        if no_action_change < 0:
            trend = f"declines by {abs(no_action_change)} point{'s' if abs(no_action_change) != 1 else ''}"
        elif no_action_change > 0:
            trend = f"improves by {no_action_change} point{'s' if no_action_change != 1 else ''}"
        else:
            trend = "stays stable"
        recommendation = "No intervention is needed right now; keep monitoring the layer."
        summary = (
            f"{layer.name} ({layer.crop}) starts at health {current}/100. "
            f"With no action, health {trend} to {b_final}/100 after {hours}h. "
            f"{recommendation}"
        )
    elif delta > 0:
        recommendation = f"'{label}' is beneficial for this scenario."
        summary = (
            f"{layer.name} ({layer.crop}) starts at health {current}/100. "
            f"Without action: {b_final}/100 after {hours}h. "
            f"With '{label}': {i_final}/100 ({delta} point{'s' if delta != 1 else ''} better). "
            f"{recommendation}"
        )
    elif delta < 0:
        recommendation = f"'{label}' is not recommended for this layer right now; it performs worse than no action."
        summary = (
            f"{layer.name} ({layer.crop}) starts at health {current}/100. "
            f"Without action: {b_final}/100 after {hours}h. "
            f"With '{label}': {i_final}/100 ({abs(delta)} point{'s' if abs(delta) != 1 else ''} worse). "
            f"{recommendation}"
        )
    else:
        if action_change < 0:
            action_trend = f"ends at {i_final}/100, down {abs(action_change)} point{'s' if abs(action_change) != 1 else ''} from now"
        elif action_change > 0:
            action_trend = f"ends at {i_final}/100, up {action_change} point{'s' if action_change != 1 else ''} from now"
        else:
            action_trend = f"stays at {i_final}/100"
        recommendation = f"'{label}' does not change the predicted health outcome; choose it only if you need the specific sensor effect."
        summary = (
            f"{layer.name} ({layer.crop}) starts at health {current}/100. "
            f"Both no action and '{label}' finish at {b_final}/100 after {hours}h; intervention {action_trend}. "
            f"{recommendation}"
        )

    return WhatIfResponse(
        layer_id=layer_id,
        layer_name=layer.name,
        crop=layer.crop,
        baseline=baseline,
        intervention=intervention,
        action_label=label,
        summary=summary,
        current_health=current,
        baseline_final_health=b_final,
        intervention_final_health=i_final,
        health_delta=delta,
        recommendation=recommendation,
    )
