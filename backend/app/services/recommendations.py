from uuid import uuid4

from app.schemas import CropRecipe, DeviceState, Recommendation, SensorReading


def generate_recommendation(
    reading: SensorReading,
    recipe: CropRecipe,
    devices: DeviceState | None = None,
) -> Recommendation:
    """Generate a recommendation based on current sensor reading and crop recipe.

    If ``devices`` is provided, recommendations are suppressed when the
    corrective device is already active (e.g. pump already ON → no need to
    recommend "Start pump").
    """

    if reading.humidity > recipe.humidity_range[1]:
        # Don't recommend turning on the fan if it's already on
        if devices and devices.fan:
            pass  # fall through to next check
        else:
            return Recommendation(
                id=str(uuid4()),
                layer_id=reading.layer_id,
                action="Turn on fan for 20 minutes",
                reason="This gives the strongest humidity risk reduction while keeping energy cost acceptable.",
                priority="high",
                confidence=88,
            )

    if reading.soil_moisture < recipe.soil_moisture_range[0]:
        # Don't recommend starting the pump if it's already on
        if devices and devices.pump:
            pass  # fall through to next check
        else:
            return Recommendation(
                id=str(uuid4()),
                layer_id=reading.layer_id,
                action="Start pump for 2 minutes",
                reason="Soil moisture is below the crop recipe range and irrigation should recover root-zone moisture.",
                priority="high",
                confidence=84,
            )

    if reading.ph < recipe.ph_range[0] or reading.ph > recipe.ph_range[1]:
        return Recommendation(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            action="Check nutrient mix and adjust pH",
            reason="The current pH has drifted outside the crop recipe and can reduce nutrient uptake.",
            priority="medium",
            confidence=78,
        )

    return Recommendation(
        id=str(uuid4()),
        layer_id=reading.layer_id,
        action="Keep current climate recipe",
        reason="Sensor readings are within the ideal crop range.",
        priority="low",
        confidence=72,
    )


def recommendation_is_resolved(
    rec: Recommendation, reading: SensorReading, recipe: CropRecipe,
) -> bool:
    """Return True if the condition that triggered this recommendation is now
    within the normal range, meaning the recommendation is no longer needed."""
    action = rec.action.lower()
    if "pump" in action:
        return reading.soil_moisture >= recipe.soil_moisture_range[0]
    if "fan" in action:
        return reading.humidity <= recipe.humidity_range[1]
    if "misting" in action or "mist" in action:
        return reading.humidity >= recipe.humidity_range[0]
    if "ph" in action:
        return recipe.ph_range[0] <= reading.ph <= recipe.ph_range[1]
    # "Keep current" / low priority — always resolved
    return True
