from uuid import uuid4

from app.schemas import Alert, CropRecipe, DeviceState, Recommendation, SensorReading


def _round_to_step(value: float, step: int = 5) -> int:
    return int(round(value / step) * step)


def _latest_ai_led_target(layer_id: str) -> int | None:
    from app.store import AI_CONTROL_DECISIONS

    decision = AI_CONTROL_DECISIONS.get(layer_id)
    if not decision:
        return None
    for command in decision.commands:
        if command.device == "led_intensity" and isinstance(command.value, int):
            return command.value
    return None


def _smart_led_target(reading: SensorReading, recipe: CropRecipe, devices: DeviceState | None = None) -> int:
    ai_target = _latest_ai_led_target(reading.layer_id)
    if ai_target is not None:
        return ai_target

    current = devices.led_intensity if devices else 70
    light_low, light_high = recipe.light_range
    target = current

    if reading.light_intensity < light_low:
        light_span = max(1, light_high - light_low)
        light_deficit = min(1, (light_low - reading.light_intensity) / light_span)
        target = max(target, 80 + light_deficit * 20)
    elif reading.light_intensity > light_high:
        light_span = max(1, light_high - light_low)
        light_excess = min(1, (reading.light_intensity - light_high) / light_span)
        target = min(target, 45 - light_excess * 20)

    return max(20, min(100, _round_to_step(target)))


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
        if devices and devices.led_intensity >= 95:
            pass
        else:
            return Recommendation(
                id=str(uuid4()),
                layer_id=reading.layer_id,
                action="Set LED intensity to 95%",
                reason="Temperature is below the crop recipe range; increasing LED intensity provides heat.",
            priority="high",
            confidence=86,
        )

    if reading.temperature > recipe.temperature_range[1]:
        if devices and devices.fan:
            pass
        else:
            return Recommendation(
                id=str(uuid4()),
                layer_id=reading.layer_id,
                action="Turn on fan for 15 minutes",
                reason="Temperature is above the crop recipe range; running the fan cools the canopy.",
                priority="high",
                confidence=86,
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
        target = _smart_led_target(reading, recipe, devices)
        return Recommendation(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            action=f"Set LED intensity to {target}%",
            reason="Light is below the crop recipe range; the LED target is computed from the crop light band and current light deficit.",
            priority="medium",
            confidence=76,
        )

    if reading.light_intensity > recipe.light_range[1]:
        target = _smart_led_target(reading, recipe, devices)
        return Recommendation(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            action=f"Set LED intensity to {target}%",
            reason="Light is above the crop recipe range; the LED target is computed to reduce light stress and unnecessary energy use.",
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


def generate_recommendation_for_alert(
    alert: Alert,
    reading: SensorReading,
    recipe: CropRecipe,
    devices: DeviceState | None = None,
) -> Recommendation:
    title = alert.title
    layer_id = alert.layer_id
    priority = "high" if alert.severity == "critical" else "medium"
    confidence = 88 if alert.severity == "critical" else 80

    if title == "Low soil moisture":
        action = "Start pump for 2 minutes" if not devices or not devices.pump else "Keep pump running and monitor moisture recovery"
        reason = f"Linked alert: {alert.message} Irrigation is the matching corrective action for this alert."
    elif title == "High humidity detected":
        action = "Turn on fan for 20 minutes" if not devices or not devices.fan else "Keep fan running and monitor humidity recovery"
        reason = f"Linked alert: {alert.message} Ventilation is the matching corrective action for this alert."
    elif title == "Low humidity detected":
        action = "Start misting for 3 minutes" if not devices or not devices.misting else "Keep misting active and monitor humidity recovery"
        reason = f"Linked alert: {alert.message} Misting is the matching corrective action for this alert."
    elif title == "High temperature detected":
        action = "Turn on fan for 15 minutes" if not devices or not devices.fan else "Keep fan active and monitor temperature recovery"
        reason = f"Linked alert: {alert.message} Running the fan cools the canopy."
    elif title == "Low temperature detected":
        action = "Set LED intensity to 95%" if not devices or devices.led_intensity < 95 else "Keep LED intensity high and monitor temperature recovery"
        reason = f"Linked alert: {alert.message} Increasing LED intensity provides heat."
    elif title == "pH drift detected":
        action = "Check nutrient mix and adjust pH"
        reason = f"Linked alert: {alert.message} Nutrient solution adjustment is required because pH is not directly actuator-controlled."
    elif title == "Humidity risk predicted":
        action = "Prepare ventilation response"
        reason = f"Linked alert: {alert.message} The matching action is to be ready to ventilate if humidity crosses the recipe range."
    elif title == "Irrigation risk predicted":
        action = "Prepare pump response"
        reason = f"Linked alert: {alert.message} The matching action is to be ready to irrigate if soil moisture crosses the recipe range."
    else:
        action = "Review alert and verify sensor reading"
        reason = f"Linked alert: {alert.message}"

    return Recommendation(
        id=f"{alert.id}:recommendation",
        layer_id=layer_id,
        action=action,
        reason=reason,
        priority=priority,
        confidence=confidence,
        created_at=alert.created_at,
    )


def recommendation_is_resolved(
    rec: Recommendation, reading: SensorReading, recipe: CropRecipe,
) -> bool:
    """Return True if the condition that triggered this recommendation is now
    within the normal range, meaning the recommendation is no longer needed."""
    action = rec.action.lower()
    if "temperature" in action or "warming" in action or "climate" in action:
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
