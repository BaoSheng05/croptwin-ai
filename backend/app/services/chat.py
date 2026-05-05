"""Chat-to-Farm assistant — Gemini-first with smart deterministic fallback.

Strategy:
  1. Build a rich context string from *real* live farm data.
  2. If GEMINI_API_KEY is configured → send context + question to Gemini.
  3. If not (or if the call fails) → fall back to a varied local engine.
"""

from __future__ import annotations

import json
import random
import urllib.request
from app.schemas import ChatResponse
from app.store import LAYERS, AREAS, latest_alerts, latest_recommendations, get_recipe_for_layer, sustainability_snapshot
from app.core.config import get_settings


# ── Context builder ──────────────────────────────────────────────

def _build_farm_context() -> str:
    """Serialize the entire live farm state into a text block for the LLM."""
    lines: list[str] = []
    sus = sustainability_snapshot()
    lines.append(f"Farm: CropTwin AI Vertical Farm ({len(LAYERS)} layers across {len(AREAS)} areas)")
    lines.append(f"Sustainability: water saved {sus.water_saved_liters:.0f}L, "
                 f"energy {sus.energy_optimized_kwh:.1f}kWh, score {sus.sustainability_score}/100")
    lines.append("")

    for area in AREAS.values():
        lines.append(f"=== {area.name} ===")
        for lid in area.layer_ids:
            layer = LAYERS[lid]
            recipe = get_recipe_for_layer(lid)
            r = layer.latest_reading
            lines.append(f"  [{lid}] {layer.name} ({layer.crop}) — "
                         f"Status: {layer.status.value}, Health: {layer.health_score}")
            lines.append(f"    Ideal: temp {recipe.temperature_range}, hum {recipe.humidity_range}, "
                         f"moist {recipe.soil_moisture_range}, pH {recipe.ph_range}")
            if r:
                lines.append(f"    Live: {r.temperature:.1f}°C, {r.humidity:.0f}% hum, "
                             f"{r.soil_moisture:.0f}% moist, pH {r.ph:.1f}, light {r.light_intensity:.0f}")
            lines.append(f"    Devices: fan={layer.devices.fan} pump={layer.devices.pump} "
                         f"misting={layer.devices.misting} auto={layer.devices.auto_mode}")
        lines.append("")

    alerts = latest_alerts(10)
    if alerts:
        lines.append("Recent alerts:")
        for a in alerts:
            lines.append(f"  [{a.severity}] {a.layer_id}: {a.title}")

    recs = latest_recommendations(5)
    if recs:
        lines.append("Latest recommendations:")
        for rec in recs:
            lines.append(f"  [{rec.priority}] {rec.layer_id}: {rec.action}")

    return "\n".join(lines)


# ── Gemini caller ────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are CropTwin AI, a professional agricultural intelligence assistant for a vertical farm. "
    "You manage {n_layers} growing layers across {n_areas} areas. "
    "Answer the farmer's question using ONLY the provided real-time farm data. "
    "Do NOT invent or hallucinate any sensor values. Be concise, actionable, and friendly. "
    "Refer to specific layers by name (e.g. A-1, B-3) and include actual numbers. "
    "Keep your answer under 150 words."
)


def _call_gemini(question: str, context: str, api_key: str) -> str | None:
    url = ("https://generativelanguage.googleapis.com/v1beta/"
           "models/gemini-2.0-flash:generateContent?key=" + api_key)

    system = SYSTEM_PROMPT.format(n_layers=len(LAYERS), n_areas=len(AREAS))
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"parts": [{"text": f"FARM DATA:\n{context}\n\nFARMER QUESTION:\n{question}"}]}],
        "generationConfig": {"maxOutputTokens": 400, "temperature": 0.5},
    }

    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            return result["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print(f"[Chat] Gemini call failed: {e}")
        return None


# ── Varied deterministic fallback ────────────────────────────────

def _varied_status(layer, reading, recipe, alert, rec) -> str:
    """Generate a varied, natural-sounding status response."""
    templates = [
        (f"Looking at {layer.name} ({layer.crop}), I see a health score of {layer.health_score} "
         f"({layer.status.value}). Current conditions: {reading.temperature:.1f}°C, "
         f"{reading.humidity:.0f}% humidity, {reading.soil_moisture:.0f}% soil moisture, "
         f"pH {reading.ph:.1f}."),
        (f"{layer.name} is currently growing {layer.crop} with a health rating of {layer.health_score}. "
         f"The environment shows {reading.temperature:.1f}°C temperature and "
         f"{reading.humidity:.0f}% relative humidity. Soil moisture sits at {reading.soil_moisture:.0f}%."),
        (f"Here's the rundown for {layer.name} ({layer.crop}): health is at {layer.health_score}/100. "
         f"I'm reading {reading.temperature:.1f}°C, {reading.humidity:.0f}% humidity, "
         f"and {reading.soil_moisture:.0f}% soil moisture right now."),
    ]
    base = random.choice(templates)
    if alert:
        base += f" ⚠️ Alert: {alert.title}."
    if rec:
        base += f" My suggestion: {rec.action}."
    return base


def _varied_ignore(layer, reading, recipe, rec) -> str:
    if reading.humidity > recipe.humidity_range[1]:
        details = [
            f"Right now, {layer.name}'s humidity is at {reading.humidity:.0f}%, which is significantly above "
            f"{layer.crop}'s comfort zone of {recipe.humidity_range[0]}–{recipe.humidity_range[1]}%. "
            f"If you let this continue, fungal diseases could take hold within 24–48 hours, "
            f"potentially damaging the entire crop batch.",
            f"I'm seeing {reading.humidity:.0f}% humidity on {layer.name} — that's well past the "
            f"{recipe.humidity_range[1]}% upper limit for {layer.crop}. Ignoring this creates ideal "
            f"conditions for mold and mildew, which could spread to neighboring layers.",
        ]
    elif reading.soil_moisture < recipe.soil_moisture_range[0]:
        details = [
            f"{layer.name}'s soil moisture has dropped to {reading.soil_moisture:.0f}%, below the "
            f"{recipe.soil_moisture_range[0]}% minimum for {layer.crop}. Without intervention, "
            f"the roots will begin to dehydrate, causing irreversible wilting.",
        ]
    else:
        details = [f"Current conditions on {layer.name} are slightly off-ideal. "
                   f"Continued neglect may gradually reduce crop quality."]

    base = random.choice(details)
    action = rec.action.lower() if rec else "monitor the situation closely"
    return f"{base} I recommend: {action}."


# ── Main entry point ─────────────────────────────────────────────

def answer_farm_question(question: str, layer_id: str | None = None) -> ChatResponse:
    q = question.lower()

    # Detect layer reference from question text
    target_id = layer_id
    for cid, layer in LAYERS.items():
        if cid.lower() in q or layer.name.lower() in q or layer.crop.lower() in q:
            target_id = cid
            break

    # ── Try Gemini first ─────────────────────────────────────────
    settings = get_settings()
    if settings.gemini_api_key:
        context = _build_farm_context()
        answer = _call_gemini(question, context, settings.gemini_api_key)
        if answer:
            referenced = [target_id] if target_id else list(LAYERS.keys())[:5]
            return ChatResponse(answer=answer, referenced_layers=referenced, mode="ai")

    # ── Deterministic fallback (varied templates) ────────────────

    if "auto mode" in q or ("auto" in q and "explain" in q):
        answers = [
            "Auto mode is CropTwin AI's autonomous control system. When enabled, it monitors sensor readings "
            "in real-time and automatically triggers devices when thresholds are crossed. For example, if "
            "humidity rises above 75%, the fan activates without any manual input.",
            "Think of auto mode as an autopilot for your farm. It watches all sensor data 24/7 and "
            "takes corrective action the moment conditions drift outside the ideal range. You can enable "
            "it per-layer from the Control Panel.",
        ]
        return ChatResponse(answer=random.choice(answers),
                            referenced_layers=list(LAYERS.keys()) if not target_id else [target_id], mode="local")

    if "sustainab" in q or ("water" in q and "save" in q) or "energy" in q:
        sus = sustainability_snapshot()
        answers = [
            f"Across all {len(LAYERS)} layers, we've saved {sus.water_saved_liters:.0f}L of water and "
            f"optimized {sus.energy_optimized_kwh:.1f} kWh of energy. That's roughly RM {sus.estimated_cost_reduction_rm:.2f} "
            f"in cost reduction. Sustainability score: {sus.sustainability_score}/100.",
            f"Here's the sustainability snapshot: {sus.water_saved_liters:.0f} liters of water conserved, "
            f"{sus.energy_optimized_kwh:.1f} kWh energy optimized, and RM {sus.estimated_cost_reduction_rm:.2f} saved. "
            f"The farm's overall sustainability index is {sus.sustainability_score}.",
        ]
        return ChatResponse(answer=random.choice(answers), referenced_layers=[], mode="local")

    if ("summary" in q or "overall" in q or "how is" in q) and target_id is None:
        avg = round(sum(l.health_score for l in LAYERS.values()) / len(LAYERS))
        n_alerts = len(latest_alerts())
        worst = min(LAYERS.values(), key=lambda l: l.health_score)
        answers = [
            f"Farm overview: {len(LAYERS)} layers across {len(AREAS)} areas. Average health: {avg}/100. "
            f"{n_alerts} active alerts. The layer needing the most attention is {worst.name} "
            f"({worst.crop}) at health {worst.health_score}.",
            f"Right now the farm is running at an average health of {avg}. I'm tracking {n_alerts} alerts. "
            f"Most layers are stable, but {worst.name} ({worst.crop}) is at {worst.health_score} — "
            f"that's the weakest link right now.",
        ]
        return ChatResponse(answer=random.choice(answers), referenced_layers=list(LAYERS.keys())[:5], mode="local")

    # Resolve target layer
    if target_id is None:
        target_id = next((l.id for l in LAYERS.values() if l.health_score < 80), next(iter(LAYERS)))

    layer = LAYERS[target_id]
    reading = layer.latest_reading
    recipe = get_recipe_for_layer(target_id)
    rec = next((r for r in latest_recommendations() if r.layer_id == target_id), None)
    alert = next((a for a in latest_alerts() if a.layer_id == target_id), None)

    if reading is None:
        return ChatResponse(
            answer=f"{layer.name} ({layer.crop}) is offline — no sensor data yet. Check the IoT connection.",
            referenced_layers=[target_id], mode="local",
        )

    # Intent: ignore / what happens
    if "ignore" in q or "happen" in q or "what if" in q:
        return ChatResponse(
            answer=_varied_ignore(layer, reading, recipe, rec),
            referenced_layers=[target_id], mode="local",
        )

    # Intent: recommend / do next
    if "do next" in q or "recommend" in q or "action" in q or "should" in q:
        if rec:
            answers = [
                f"For {layer.name} ({layer.crop}), I recommend: '{rec.action}'. {rec.reason}",
                f"Based on the latest readings from {layer.name}, my top suggestion is: {rec.action}. "
                f"This is because {rec.reason.lower()}",
            ]
            return ChatResponse(answer=random.choice(answers), referenced_layers=[target_id], mode="local")
        return ChatResponse(
            answer=f"{layer.name} is doing well right now. No immediate action needed — keep monitoring.",
            referenced_layers=[target_id], mode="local",
        )

    # Intent: why warning
    if "why" in q or "alert" in q or "warning" in q:
        if alert:
            answers = [
                f"{layer.name} triggered a {alert.severity} alert: '{alert.title}'. {alert.message} "
                f"Current health score is {layer.health_score}.",
                f"The alert on {layer.name} says: '{alert.title}'. This happened because {alert.message.lower()} "
                f"Health has dropped to {layer.health_score}.",
            ]
            return ChatResponse(answer=random.choice(answers), referenced_layers=[target_id], mode="local")
        return ChatResponse(
            answer=f"{layer.name} doesn't have any active warnings. Status: {layer.status.value}. All clear!",
            referenced_layers=[target_id], mode="local",
        )

    # Default: varied status
    return ChatResponse(
        answer=_varied_status(layer, reading, recipe, alert, rec),
        referenced_layers=[target_id], mode="local",
    )
