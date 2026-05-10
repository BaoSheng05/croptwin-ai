"""Chat-to-Farm assistant backed by an LLM.

The chat assistant should feel genuinely intelligent, so this module does not
use keyword templates to fake answers. It builds a real farm context and sends
the conversation to DeepSeek or Gemini. If no model is configured, the API
returns a clear setup message instead of a hard-coded farm answer.
"""

from __future__ import annotations

from app.core.config import get_settings
from app.schemas import ChatResponse
from app.services.chat_clients import call_deepseek, call_gemini
from app.services.chat_context import build_farm_context, formatted_system_prompt, resolve_layer_id
from app.store import (
    AI_CONTROL_DECISIONS,
    LAYERS,
    get_recipe_for_layer,
)


def _local_fallback_answer(question: str, layer_id: str | None, errors: list[str] | None = None) -> str:
    if not layer_id or layer_id not in LAYERS:
        return (
            "I could not reach the external AI model, so I am using local farm logic. "
            "Select a layer first and I can explain its current risks and next action from live sensor data."
        )

    q = question.lower()
    layer = LAYERS[layer_id]
    recipe = get_recipe_for_layer(layer_id)
    reading = layer.latest_reading
    control_decision = AI_CONTROL_DECISIONS.get(layer_id)
    if not reading:
        return (
            f"I could not reach the external AI model, and {layer.name} has no live reading yet. "
            "Wait for the IoT stream, then ask again."
        )

    if control_decision:
        command_texts = []
        for command in control_decision.commands:
            if command.device == "none":
                continue
            if command.device == "led_intensity":
                command_texts.append(f"set LED target to {command.value}%")
            else:
                state = "ON" if command.value is True else "OFF"
                duration = f" for {command.duration_minutes} minutes" if command.duration_minutes else ""
                command_texts.append(f"set {command.device} {state}{duration}")
        plan = "; ".join(command_texts) or "no actuator change"
        if "ignore" in q:
            return (
                f"I could not reach the external AI model, so this is local logic: {layer.name} ({layer.crop}) already has an AI Control plan: "
                f"{control_decision.summary} Current plan: {plan}. Ignoring it may let the active risk continue and health may drop from {layer.health_score}."
            )
        return (
            f"I could not reach the external AI model, so this is local logic for {layer.name} ({layer.crop}): "
            f"follow the current AI Control plan: {control_decision.summary} Current plan: {plan}."
        )

    risks: list[str] = []
    actions: list[str] = []

    if reading.soil_moisture < recipe.soil_moisture_range[0]:
        risks.append(
            f"soil moisture is {reading.soil_moisture:.0f}%, below the ideal {recipe.soil_moisture_range[0]:.0f}-{recipe.soil_moisture_range[1]:.0f}%"
        )
        actions.append("run the pump for 2 minutes and keep monitoring until moisture returns to range")

    if reading.humidity > recipe.humidity_range[1]:
        risks.append(
            f"humidity is {reading.humidity:.0f}%, above the ideal {recipe.humidity_range[0]:.0f}-{recipe.humidity_range[1]:.0f}%"
        )
        actions.append("turn on ventilation/fan to reduce humidity")
    elif reading.humidity < recipe.humidity_range[0]:
        risks.append(
            f"humidity is {reading.humidity:.0f}%, below the ideal {recipe.humidity_range[0]:.0f}-{recipe.humidity_range[1]:.0f}%"
        )
        actions.append("use misting briefly if humidity remains low")

    if reading.temperature < recipe.temperature_range[0] or reading.temperature > recipe.temperature_range[1]:
        risks.append(
            f"temperature is {reading.temperature:.1f}C, outside the ideal {recipe.temperature_range[0]:.0f}-{recipe.temperature_range[1]:.0f}C"
        )

    if reading.ph < recipe.ph_range[0] or reading.ph > recipe.ph_range[1]:
        risks.append(f"pH is {reading.ph:.1f}, outside the ideal {recipe.ph_range[0]:.1f}-{recipe.ph_range[1]:.1f}")
        actions.append("check the nutrient mix and adjust pH")

    if reading.light_intensity < recipe.light_range[0] or reading.light_intensity > recipe.light_range[1]:
        risks.append(
            f"light is {reading.light_intensity:.0f}, outside the ideal {recipe.light_range[0]:.0f}-{recipe.light_range[1]:.0f}"
        )
        actions.append("let AI control adjust the LED target")

    if not risks:
        return (
            f"I could not reach the external AI model, so this is local logic: {layer.name} ({layer.crop}) looks stable. "
            f"Health score is {layer.health_score}. Current readings are temp {reading.temperature:.1f}C, humidity {reading.humidity:.0f}%, "
            f"moisture {reading.soil_moisture:.0f}%, pH {reading.ph:.1f}, light {reading.light_intensity:.0f}. Keep AI control monitoring."
        )

    risk_text = "; ".join(risks)
    action_text = "; ".join(dict.fromkeys(actions)) or "keep monitoring and verify sensor readings"
    if "ignore" in q:
        return (
            f"I could not reach the external AI model, so this is local logic: if you ignore {layer.name} ({layer.crop}), "
            f"the main risk is that {risk_text}. Health may keep dropping from {layer.health_score}. "
            f"Next step: {action_text}."
        )

    return (
        f"I could not reach the external AI model, so this is local logic for {layer.name} ({layer.crop}): "
        f"{risk_text}. Recommended next step: {action_text}."
    )


def answer_farm_question(question: str, layer_id: str | None = None, history: list | None = None) -> ChatResponse:
    settings = get_settings()
    history = history or []
    target_id = resolve_layer_id(question, layer_id)
    referenced = [target_id] if target_id else list(LAYERS.keys())[:5]

    if not settings.deepseek_api_key and not settings.gemini_api_key:
        return ChatResponse(
            answer=(
                "AI chat is enabled, but no LLM API key is configured yet. "
                "Add DEEPSEEK_API_KEY or GEMINI_API_KEY in backend/.env, then restart the backend."
            ),
            referenced_layers=referenced,
            mode="unconfigured",
        )

    context = build_farm_context(target_id)
    system_prompt = formatted_system_prompt()
    errors: list[str] = []
    if settings.deepseek_api_key:
        answer, error = call_deepseek(question, context, history, settings.deepseek_api_key, system_prompt)
        if answer:
            return ChatResponse(answer=answer, referenced_layers=referenced, mode="deepseek")
        if error:
            errors.append(error)

    if settings.gemini_api_key:
        answer, error = call_gemini(question, context, history, settings.gemini_api_key, system_prompt)
        if answer:
            return ChatResponse(answer=answer, referenced_layers=referenced, mode="gemini")
        if error:
            errors.append(error)

    fallback = _local_fallback_answer(question, target_id, errors)
    return ChatResponse(answer=fallback, referenced_layers=referenced, mode="local_fallback")
