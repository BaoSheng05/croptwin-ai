"""Chat-to-Farm assistant backed by an LLM.

The chat assistant should feel genuinely intelligent, so this module does not
use keyword templates to fake answers. It builds a real farm context and sends
the conversation to DeepSeek or Gemini. If no model is configured, the API
returns a clear setup message instead of a hard-coded farm answer.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from app.core.config import get_settings
from app.schemas import ChatResponse
from app.store import (
    AI_CONTROL_DECISIONS,
    AREAS,
    LAYERS,
    get_recipe_for_layer,
    latest_alerts,
    latest_recommendations,
    sustainability_snapshot,
)


def _layer_context(layer_id: str | None) -> str:
    if not layer_id or layer_id not in LAYERS:
        return "No selected layer."

    layer = LAYERS[layer_id]
    recipe = get_recipe_for_layer(layer_id)
    reading = layer.latest_reading
    lines = [
        "SELECTED LAYER - this is the active UI layer. For selected-layer questions, answer ONLY about this layer.",
        f"Id: {layer.id}",
        f"Area: {layer.area_name} ({layer.area_id})",
        f"Layer: {layer.name}",
        f"Crop: {layer.crop}",
        f"Status: {layer.status.value}",
        f"Health: {layer.health_score}",
        f"Main risk: {layer.main_risk or 'None'}",
        (
            f"Ideal: temp {recipe.temperature_range}, hum {recipe.humidity_range}, "
            f"moist {recipe.soil_moisture_range}, pH {recipe.ph_range}, light {recipe.light_range}"
        ),
    ]
    if reading:
        lines.append(
            f"Live: {reading.temperature:.1f}C, {reading.humidity:.0f}% hum, "
            f"{reading.soil_moisture:.0f}% moist, pH {reading.ph:.1f}, "
            f"light {reading.light_intensity:.0f}, water {reading.water_level:.0f}%"
        )
    else:
        lines.append("Live: no current sensor reading")
    lines.append(
        f"Devices: fan={layer.devices.fan}, pump={layer.devices.pump}, "
        f"misting={layer.devices.misting}, led={layer.devices.led_intensity}, auto={layer.devices.auto_mode}"
    )
    control_decision = AI_CONTROL_DECISIONS.get(layer_id)
    if control_decision:
        lines.append(
            "Latest AI control decision: "
            + json.dumps(control_decision.model_dump(mode="json"), ensure_ascii=True)
        )
    return "\n".join(lines)


def _resolve_layer_id(question: str, layer_id: str | None) -> str | None:
    q = question.lower()
    if layer_id in LAYERS:
        target_id = layer_id
    else:
        target_id = None

    for cid, layer in LAYERS.items():
        aliases = {
            cid.lower(),
            layer.name.lower(),
            layer.name.lower().replace("-", " "),
            f"{layer.name.lower()} {layer.crop.lower()}",
            layer.crop.lower(),
        }
        if any(alias in q for alias in aliases):
            return cid

    return target_id


def _build_farm_context(selected_layer_id: str | None = None) -> str:
    """Serialize the live farm state into a text block for the LLM."""
    lines: list[str] = []
    sus = sustainability_snapshot()
    lines.append(f"Farm: CropTwin AI Vertical Farm ({len(LAYERS)} layers across {len(AREAS)} areas)")
    lines.append(
        f"Sustainability: water saved {sus.water_saved_liters:.0f}L, "
        f"energy {sus.energy_optimized_kwh:.1f}kWh, score {sus.sustainability_score}/100"
    )
    lines.append("")
    lines.append(_layer_context(selected_layer_id))
    lines.append("")

    for area in AREAS.values():
        lines.append(f"=== {area.name} ===")
        for lid in area.layer_ids:
            layer = LAYERS[lid]
            recipe = get_recipe_for_layer(lid)
            reading = layer.latest_reading
            lines.append(
                f"  [{lid}] {layer.name} ({layer.crop}) - "
                f"Status: {layer.status.value}, Health: {layer.health_score}, "
                f"Main risk: {layer.main_risk or 'None'}"
            )
            lines.append(
                f"    Ideal: temp {recipe.temperature_range}, hum {recipe.humidity_range}, "
                f"moist {recipe.soil_moisture_range}, pH {recipe.ph_range}, "
                f"light {recipe.light_range}"
            )
            if reading:
                lines.append(
                    f"    Live: {reading.temperature:.1f}C, {reading.humidity:.0f}% hum, "
                    f"{reading.soil_moisture:.0f}% moist, pH {reading.ph:.1f}, "
                    f"light {reading.light_intensity:.0f}, water {reading.water_level:.0f}%"
                )
            else:
                lines.append("    Live: no current sensor reading")
            lines.append(
                f"    Devices: fan={layer.devices.fan}, pump={layer.devices.pump}, "
                f"misting={layer.devices.misting}, led={layer.devices.led_intensity}, "
                f"auto={layer.devices.auto_mode}"
            )
        lines.append("")

    alerts = latest_alerts(10)
    if alerts:
        lines.append("Recent alerts:")
        for alert in alerts:
            lines.append(
                f"  [{alert.severity}] {alert.layer_id}: {alert.title} - {alert.message}"
            )

    recs = latest_recommendations(8)
    if recs:
        lines.append("Latest recommendations:")
        for rec in recs:
            lines.append(
                f"  [{rec.priority}] {rec.layer_id}: {rec.action} "
                f"({rec.reason}, confidence {rec.confidence}%)"
            )

    return "\n".join(lines)


SYSTEM_PROMPT = (
    "You are CropTwin AI, a professional agricultural intelligence assistant for a vertical farm. "
    "You manage {n_layers} growing layers across {n_areas} areas. "
    "Use only the provided real-time farm data for sensor values, statuses, alerts, and recommendations. "
    "Do not invent readings. If the user asks something that the data cannot support, say what is missing "
    "and give the safest next step. If a selected layer is provided, treat it as the current UI context. "
    "When the user says this, it, current, selected, here, which area, which layer, what if I ignore it, or what should I do next, "
    "answer only about the selected layer unless the user explicitly asks for whole-farm or another named layer. "
    "Do not recommend or discuss other layers in a selected-layer answer just because they have stronger alerts. "
    "If a latest AI control decision is present for the selected layer, treat it as the current autonomous action plan. "
    "Do not contradict that plan; explain it or add non-conflicting manual checks only. "
    "Be concise, actionable, and friendly. Refer to specific layers by name or id when useful, and include actual numbers "
    "from the context. Keep answers under 150 words."
)


def _referenced_layers(question: str, layer_id: str | None) -> list[str]:
    target_id = _resolve_layer_id(question, layer_id)
    return [target_id] if target_id else list(LAYERS.keys())[:5]


def _format_api_error(provider: str, exc: Exception) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        body = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(body).get("error", {}).get("message") or body
        except json.JSONDecodeError:
            detail = body
        detail = detail.strip()[:240]
        if exc.code == 401:
            return f"{provider} rejected the API key. Create a new key and update backend/.env."
        if exc.code == 402:
            return f"{provider} API balance is insufficient. Add balance or granted credits, then try again."
        if exc.code == 429:
            return f"{provider} rate limit was reached. Wait a moment and try again."
        return f"{provider} API returned HTTP {exc.code}: {detail}"
    if isinstance(exc, urllib.error.URLError):
        return f"Cannot reach {provider}. Check internet, proxy, firewall, or DNS settings."
    return f"{provider} request failed: {str(exc)[:240]}"


def _call_deepseek(question: str, context: str, history: list, api_key: str) -> tuple[str | None, str | None]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT.format(n_layers=len(LAYERS), n_areas=len(AREAS))}]
    for msg in history[-12:]:
        role = "assistant" if msg.role == "ai" else "user"
        messages.append({"role": role, "content": msg.text})

    messages.append(
        {
            "role": "user",
            "content": (
                "FARM DATA:\n"
                f"{context}\n\n"
                "CURRENT USER QUESTION - prioritize this over older chat history:\n"
                f"{question}"
            ),
        }
    )
    body = {
        "model": "deepseek-v4-flash",
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 400,
    }
    req = urllib.request.Request(
        "https://api.deepseek.com/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            result = json.loads(resp.read())
            return result["choices"][0]["message"]["content"], None
    except Exception as exc:
        error = _format_api_error("DeepSeek", exc)
        print(f"[Chat] {error}")
        return None, error


def _call_gemini(question: str, context: str, history: list, api_key: str) -> tuple[str | None, str | None]:
    contents = []
    for msg in history[-12:]:
        role = "model" if msg.role == "ai" else "user"
        contents.append({"role": role, "parts": [{"text": msg.text}]})

    contents.append(
        {
            "role": "user",
            "parts": [
                {
                    "text": (
                        "FARM DATA:\n"
                        f"{context}\n\n"
                        "CURRENT USER QUESTION - prioritize this over older chat history:\n"
                        f"{question}"
                    )
                }
            ],
        }
    )
    body = {
        "systemInstruction": {
            "parts": [{"text": SYSTEM_PROMPT.format(n_layers=len(LAYERS), n_areas=len(AREAS))}]
        },
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 400, "temperature": 0.2},
    }
    req = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key="
        + api_key,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            result = json.loads(resp.read())
            return result["candidates"][0]["content"]["parts"][0]["text"], None
    except Exception as exc:
        error = _format_api_error("Gemini", exc)
        print(f"[Chat] {error}")
        return None, error


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
    target_id = _resolve_layer_id(question, layer_id)
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

    context = _build_farm_context(target_id)
    errors: list[str] = []
    if settings.deepseek_api_key:
        answer, error = _call_deepseek(question, context, history, settings.deepseek_api_key)
        if answer:
            return ChatResponse(answer=answer, referenced_layers=referenced, mode="deepseek")
        if error:
            errors.append(error)

    if settings.gemini_api_key:
        answer, error = _call_gemini(question, context, history, settings.gemini_api_key)
        if answer:
            return ChatResponse(answer=answer, referenced_layers=referenced, mode="gemini")
        if error:
            errors.append(error)

    fallback = _local_fallback_answer(question, target_id, errors)
    return ChatResponse(answer=fallback, referenced_layers=referenced, mode="local_fallback")
