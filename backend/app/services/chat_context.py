"""Context construction for the Chat-to-Farm assistant."""

from __future__ import annotations

import json

from app.store import (
    AI_CONTROL_DECISIONS,
    AREAS,
    LAYERS,
    get_recipe_for_layer,
    latest_alerts,
    latest_recommendations,
    sustainability_snapshot,
)

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


def resolve_layer_id(question: str, layer_id: str | None) -> str | None:
    question_lower = question.lower()
    target_id = layer_id if layer_id in LAYERS else None

    for candidate_id, layer in LAYERS.items():
        aliases = {
            candidate_id.lower(),
            layer.name.lower(),
            layer.name.lower().replace("-", " "),
            f"{layer.name.lower()} {layer.crop.lower()}",
            layer.crop.lower(),
        }
        if any(alias in question_lower for alias in aliases):
            return candidate_id

    return target_id


def referenced_layers(question: str, layer_id: str | None) -> list[str]:
    target_id = resolve_layer_id(question, layer_id)
    return [target_id] if target_id else list(LAYERS.keys())[:5]


def formatted_system_prompt() -> str:
    return SYSTEM_PROMPT.format(n_layers=len(LAYERS), n_areas=len(AREAS))


def build_farm_context(selected_layer_id: str | None = None) -> str:
    lines: list[str] = []
    sustainability = sustainability_snapshot()
    lines.append(f"Farm: CropTwin AI Vertical Farm ({len(LAYERS)} layers across {len(AREAS)} areas)")
    lines.append(
        f"Sustainability: water saved {sustainability.water_saved_liters:.0f}L, "
        f"energy {sustainability.energy_optimized_kwh:.1f}kWh, score {sustainability.sustainability_score}/100"
    )
    lines.append("")
    lines.append(layer_context(selected_layer_id))
    lines.append("")

    for area in AREAS.values():
        lines.append(f"=== {area.name} ===")
        for layer_id in area.layer_ids:
            layer = LAYERS[layer_id]
            recipe = get_recipe_for_layer(layer_id)
            reading = layer.latest_reading
            lines.append(
                f"  [{layer_id}] {layer.name} ({layer.crop}) - "
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
            lines.append(f"  [{alert.severity}] {alert.layer_id}: {alert.title} - {alert.message}")

    recommendations = latest_recommendations(8)
    if recommendations:
        lines.append("Latest recommendations:")
        for rec in recommendations:
            lines.append(
                f"  [{rec.priority}] {rec.layer_id}: {rec.action} "
                f"({rec.reason}, confidence {rec.confidence}%)"
            )

    return "\n".join(lines)


def layer_context(layer_id: str | None) -> str:
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
