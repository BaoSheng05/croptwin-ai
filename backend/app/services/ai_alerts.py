import json
import re
import urllib.request
from uuid import uuid4

from app.core.config import get_settings
from app.schemas import Alert, CropRecipe, SensorReading
from app.services.alerts import (
    HUMIDITY_WARNING_MARGIN,
    MOISTURE_WARNING_MARGIN,
    PH_WARNING_MARGIN,
    TEMP_WARNING_MARGIN,
    generate_alert,
)


ALLOWED_TITLES = {
    "High temperature detected",
    "Low temperature detected",
    "High humidity detected",
    "Low humidity detected",
    "Low soil moisture",
    "pH drift detected",
}
ALLOWED_SEVERITIES = {"info", "warning", "critical"}


def _parse_json_object(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _has_material_risk(reading: SensorReading, recipe: CropRecipe) -> bool:
    return (
        reading.temperature > recipe.temperature_range[1] + TEMP_WARNING_MARGIN
        or reading.temperature < recipe.temperature_range[0] - TEMP_WARNING_MARGIN
        or reading.humidity > recipe.humidity_range[1] + HUMIDITY_WARNING_MARGIN
        or reading.humidity < recipe.humidity_range[0] - HUMIDITY_WARNING_MARGIN
        or reading.soil_moisture < recipe.soil_moisture_range[0] - MOISTURE_WARNING_MARGIN
        or reading.ph < recipe.ph_range[0] - PH_WARNING_MARGIN
        or reading.ph > recipe.ph_range[1] + PH_WARNING_MARGIN
    )


def generate_ai_alert(reading: SensorReading, recipe: CropRecipe) -> Alert | None:
    if not _has_material_risk(reading, recipe):
        return None

    settings = get_settings()
    if not settings.deepseek_api_key:
        return generate_alert(reading, recipe)

    context = {
        "crop": recipe.crop,
        "reading": reading.model_dump(mode="json"),
        "recipe": {
            "temperature_range": recipe.temperature_range,
            "humidity_range": recipe.humidity_range,
            "soil_moisture_range": recipe.soil_moisture_range,
            "ph_range": recipe.ph_range,
            "light_range": recipe.light_range,
        },
    }
    system_prompt = """
You are CropTwin AI Risk Engine.
Decide whether this live vertical farm reading needs exactly one active alert.
Use only the provided JSON context. Do not invent readings.

Return strictly valid JSON:
{
  "alert": true | false,
  "title": "High temperature detected" | "Low temperature detected" | "High humidity detected" | "Low humidity detected" | "Low soil moisture" | "pH drift detected" | null,
  "severity": "warning" | "critical" | null,
  "message": "short user-facing alert message with actual sensor value and ideal range"
}

Rules:
- Return alert false for tiny boundary noise.
- Prefer one highest-impact alert only.
- Critical means severe crop stress, not a mild edge crossing.
- Soil moisture only alerts when it is below the recipe minimum.
- Keep title exactly one of the allowed strings when alert is true.
"""
    body = {
        "model": "deepseek-v4-flash",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(context, ensure_ascii=True)},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 500,
    }
    req = urllib.request.Request(
        "https://api.deepseek.com/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {settings.deepseek_api_key}"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            result = json.loads(response.read().decode("utf-8"))
            parsed = _parse_json_object(result["choices"][0]["message"]["content"])
    except Exception as exc:
        print(f"DeepSeek Risk Engine error: {exc}")
        return generate_alert(reading, recipe)

    if parsed.get("alert") is not True:
        return None

    title = parsed.get("title")
    severity = parsed.get("severity")
    message = parsed.get("message")
    if title not in ALLOWED_TITLES or severity not in ALLOWED_SEVERITIES or not isinstance(message, str):
        return generate_alert(reading, recipe)

    return Alert(
        id=str(uuid4()),
        layer_id=reading.layer_id,
        severity=severity,
        title=title,
        message=message[:320],
    )
