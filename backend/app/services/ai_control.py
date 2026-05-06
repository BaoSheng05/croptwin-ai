import json
import urllib.request

from app.core.config import get_settings
from app.schemas import AIControlCommand, AIControlDecisionResponse
from app.store import LAYERS, get_recipe_for_layer, latest_alerts, latest_recommendations


def _round_to_step(value: float, step: int = 5) -> int:
    return int(round(value / step) * step)


def _led_target_from_light(light: float, light_range: tuple[float, float]) -> tuple[int, str]:
    low, high = light_range
    span = max(1.0, high - low)

    if light < low:
        deficit_ratio = min(1.0, (low - light) / span)
        target = _round_to_step(85 + deficit_ratio * 15)
        return min(100, max(85, target)), f"Light is below the recipe minimum, so AI raises LED output based on a {low - light:.0f} lux deficit."

    if light > high:
        excess_ratio = min(1.0, (light - high) / span)
        target = _round_to_step(40 - excess_ratio * 20)
        return max(20, min(45, target)), f"Light is above the recipe maximum, so AI lowers supplemental LED output to save energy."

    position = (light - low) / span
    target = _round_to_step(85 - position * 35)
    return max(50, min(85, target)), "Light is within range, so AI trims LED output according to where the reading sits inside the recipe band."


def _fallback_decision(layer_id: str, mode: str = "fallback", summary: str | None = None) -> AIControlDecisionResponse:
    layer = LAYERS[layer_id]
    recipe = get_recipe_for_layer(layer_id)
    reading = layer.latest_reading
    commands: list[AIControlCommand] = []
    reasoning: list[str] = []

    if not reading:
        return AIControlDecisionResponse(
            layer_id=layer_id,
            mode=mode,
            summary=summary or "No live sensor reading is available yet.",
            commands=[AIControlCommand(device="none", value=False, reason="Waiting for live telemetry.")],
            reasoning=["AI control needs a current sensor reading before changing actuators."],
            confidence=40,
        )

    if reading.humidity > recipe.humidity_range[1]:
        commands.append(AIControlCommand(device="fan", value=True, duration_minutes=20, reason="Humidity is above the crop recipe range."))
        reasoning.append(f"Humidity {reading.humidity:.1f}% is above ideal {recipe.humidity_range[0]:.0f}-{recipe.humidity_range[1]:.0f}%.")
    elif reading.humidity < recipe.humidity_range[0] - 10:
        commands.append(AIControlCommand(device="misting", value=True, duration_minutes=3, reason="Humidity is far below the crop recipe range."))
        reasoning.append(f"Humidity {reading.humidity:.1f}% is below ideal {recipe.humidity_range[0]:.0f}-{recipe.humidity_range[1]:.0f}%.")

    if reading.soil_moisture < recipe.soil_moisture_range[0]:
        commands.append(AIControlCommand(device="pump", value=True, duration_minutes=2, reason="Soil moisture is below the crop recipe range."))
        reasoning.append(f"Soil moisture {reading.soil_moisture:.1f}% is below ideal {recipe.soil_moisture_range[0]:.0f}-{recipe.soil_moisture_range[1]:.0f}%.")

    led_target, led_reason = _led_target_from_light(reading.light_intensity, recipe.light_range)
    commands.append(AIControlCommand(device="led_intensity", value=led_target, reason=led_reason))
    if reading.light_intensity < recipe.light_range[0]:
        reasoning.append(f"Light {reading.light_intensity:.0f} lux is below ideal minimum {recipe.light_range[0]:.0f}.")
    elif reading.light_intensity > recipe.light_range[1]:
        reasoning.append(f"Light {reading.light_intensity:.0f} lux is above ideal maximum {recipe.light_range[1]:.0f}.")

    if not commands:
        commands.append(AIControlCommand(device="none", value=False, reason="All key readings are within a controllable range."))
        reasoning.append("No actuator change is needed from the current telemetry.")

    return AIControlDecisionResponse(
        layer_id=layer_id,
        mode=mode,
        summary=summary or "Local fallback control decision generated.",
        commands=commands,
        reasoning=reasoning,
        confidence=70 if commands[0].device != "none" else 78,
    )


def run_deepseek_control_decision(layer_id: str) -> AIControlDecisionResponse:
    settings = get_settings()
    if layer_id not in LAYERS:
        return AIControlDecisionResponse(
            layer_id=layer_id,
            mode="fallback",
            summary="Unknown layer.",
            commands=[AIControlCommand(device="none", value=False, reason="Layer id was not found.")],
            reasoning=["The requested layer is not registered in the farm store."],
            confidence=0,
        )

    if not settings.deepseek_api_key:
        return _fallback_decision(
            layer_id,
            mode="unconfigured",
            summary="DeepSeek API key is not configured. Using local fallback logic.",
        )

    layer = LAYERS[layer_id]
    recipe = get_recipe_for_layer(layer_id)
    reading = layer.latest_reading
    alerts = [a for a in latest_alerts(10) if a.layer_id == layer_id]
    recs = [r for r in latest_recommendations(10) if r.layer_id == layer_id]

    context = {
        "layer": {
            "id": layer.id,
            "name": layer.name,
            "area": layer.area_name,
            "crop": layer.crop,
            "status": layer.status.value,
            "health_score": layer.health_score,
            "main_risk": layer.main_risk,
        },
        "recipe": {
            "temperature_range": recipe.temperature_range,
            "humidity_range": recipe.humidity_range,
            "soil_moisture_range": recipe.soil_moisture_range,
            "ph_range": recipe.ph_range,
            "light_range": recipe.light_range,
        },
        "latest_reading": reading.model_dump(mode="json") if reading else None,
        "devices": layer.devices.model_dump(mode="json"),
        "recent_alerts": [alert.model_dump(mode="json") for alert in alerts],
        "recent_recommendations": [rec.model_dump(mode="json") for rec in recs],
        "control_hints": {
            "computed_led_target": _led_target_from_light(reading.light_intensity, recipe.light_range)[0] if reading else layer.devices.led_intensity,
            "led_policy": "Compute LED target from current light position inside the crop light range. Do not default to 70 unless the calculation supports it.",
        },
    }

    system_prompt = """
You are CropTwin AI Control, a cautious autonomous farm controller.
Decide what the AI control loop should do for the selected vertical farm layer.
Use only the provided JSON context. Do not invent sensor values.

Return strictly valid JSON with this schema:
{
  "summary": "short sentence describing the control decision",
  "commands": [
    {
      "device": "fan" | "pump" | "misting" | "led_intensity" | "none",
      "value": true | false | integer,
      "duration_minutes": integer | null,
      "reason": "why this device decision is appropriate"
    }
  ],
  "reasoning": ["brief evidence with actual sensor numbers"],
  "confidence": integer between 0 and 100
}

Safety rules:
- If fan, pump, and misting do not need changes, include one command with device "none" for the climate actuators.
- Always include exactly one "led_intensity" command that represents the AI's LED target for this layer, even when light is currently acceptable.
- Pump duration must be 1-5 minutes.
- Misting duration must be 1-5 minutes and must not be recommended when humidity is above 75%.
- Fan duration should be 5-30 minutes.
- LED intensity must be an integer from 0 to 100.
- LED intensity should be dynamic. Use the computed_led_target as the recommended target unless there is strong evidence to choose another value. Do not blindly hold 70%.
- Prefer the smallest intervention that brings the crop back toward its recipe range.
"""

    body = {
        "model": "deepseek-v4-flash",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(context, ensure_ascii=True)},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 700,
    }
    req = urllib.request.Request(
        "https://api.deepseek.com/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {settings.deepseek_api_key}"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            result = json.loads(response.read().decode("utf-8"))
            parsed = json.loads(result["choices"][0]["message"]["content"])
            return AIControlDecisionResponse(
                layer_id=layer_id,
                mode="deepseek",
                summary=parsed.get("summary", "DeepSeek generated a control decision."),
                commands=[
                    AIControlCommand(
                        device=cmd.get("device", "none"),
                        value=cmd.get("value", False),
                        duration_minutes=cmd.get("duration_minutes"),
                        reason=cmd.get("reason", "No reason provided."),
                    )
                    for cmd in parsed.get("commands", [])
                ] or [AIControlCommand(device="none", value=False, reason="DeepSeek returned no actuator command.")],
                reasoning=parsed.get("reasoning", []),
                confidence=parsed.get("confidence", 50),
            )
    except Exception as exc:
        error_message = str(exc)
        print(f"DeepSeek AI Control API error: {error_message}")
        return _fallback_decision(
            layer_id,
            mode="ai_error",
            summary=f"DeepSeek request failed: {error_message[:180]}. Showing local fallback decision.",
        )
