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

    if reading.temperature < recipe.temperature_range[0]:
        return Recommendation(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            action="Increase LED intensity to support warming",
            reason="Temperature is below the crop recipe range; a higher LED target can add gentle heat while conditions recover.",
            priority="high",
            confidence=82,
        )

    if reading.temperature > recipe.temperature_range[1]:
        if devices and devices.fan:
            pass
        else:
            return Recommendation(
                id=str(uuid4()),
                layer_id=reading.layer_id,
                action="Turn on fan for 15 minutes",
                reason="Temperature is above the crop recipe range and ventilation can reduce heat stress.",
                priority="high",
                confidence=84,
            )

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

    if reading.humidity < recipe.humidity_range[0]:
        if devices and devices.misting:
            pass
        else:
            return Recommendation(
                id=str(uuid4()),
                layer_id=reading.layer_id,
                action="Start misting for 3 minutes",
                reason="Humidity is below the crop recipe range and misting can recover the canopy microclimate.",
                priority="medium",
                confidence=80,
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

    if reading.light_intensity < recipe.light_range[0]:
        return Recommendation(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            action="Increase LED intensity",
            reason="Light is below the crop recipe range and the crop may not receive enough usable illumination.",
            priority="medium",
            confidence=76,
        )

    if reading.light_intensity > recipe.light_range[1]:
        return Recommendation(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            action="Reduce LED intensity",
            reason="Light is above the crop recipe range and lowering output can reduce energy use and light stress.",
            priority="medium",
            confidence=76,
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
    if "temperature" in action or "warming" in action:
        return recipe.temperature_range[0] <= reading.temperature <= recipe.temperature_range[1]
    if "pump" in action:
        return reading.soil_moisture >= recipe.soil_moisture_range[0]
    if "fan" in action:
        return reading.humidity <= recipe.humidity_range[1] and reading.temperature <= recipe.temperature_range[1]
    if "misting" in action or "mist" in action:
        return reading.humidity >= recipe.humidity_range[0]
    if "led" in action or "light" in action:
        return recipe.light_range[0] <= reading.light_intensity <= recipe.light_range[1]
    if "ph" in action:
        return recipe.ph_range[0] <= reading.ph <= recipe.ph_range[1]
    # "Keep current" / low priority — always resolved
    return True
