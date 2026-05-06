import json
import urllib.request
from typing import Dict, Any

from app.store import LAYERS, get_recipe_for_layer
from app.core.config import get_settings
from app.schemas import AIDiagnosisResponse, AIDeviceCommand

def normalize_device_command(command: dict) -> AIDeviceCommand:
    device = command.get("device", "none")
    value = command.get("value", False)
    duration = command.get("duration_minutes")

    if device == "pump" and value is True:
        duration = min(max(int(duration or 2), 1), 5)
    elif device == "misting" and value is True:
        duration = min(max(int(duration or 3), 1), 5)
    elif device == "fan" and value is True:
        duration = min(max(int(duration or 10), 1), 30)
    elif device == "led_intensity":
        if isinstance(value, bool):
            value = 70
        value = min(max(int(value), 0), 100)
        duration = None
    else:
        duration = None

    return AIDeviceCommand(device=device, value=value, duration_minutes=duration)


def get_fallback_diagnosis(layer_id: str) -> AIDiagnosisResponse:
    layer = LAYERS.get(layer_id)
    reading = layer.latest_reading if layer else None
    evidence = ["External AI diagnosis is unavailable, so no deterministic diagnosis was generated."]
    if layer:
        evidence.append(f"Current health score is {layer.health_score}.")
        if layer.main_risk:
            evidence.append(f"Active risk signal: {layer.main_risk}.")
    if reading:
        evidence.append(
            f"Live readings: temp {reading.temperature:.1f}C, humidity {reading.humidity:.0f}%, "
            f"soil moisture {reading.soil_moisture:.0f}%, pH {reading.ph:.1f}, light {reading.light_intensity:.0f}."
        )

    return AIDiagnosisResponse(
        layer_id=layer_id,
        diagnosis="AI diagnosis unavailable",
        severity="Normal",
        confidence=0,
        evidence=evidence,
        recommended_actions=[
            "Check DeepSeek/Gemini API connectivity and backend logs.",
            "Use the Alerts page for rule-based risk signals until AI diagnosis is available.",
        ],
        device_command=AIDeviceCommand(device="none", value=False),
        expected_outcome="AI-first diagnosis will resume once the external model request succeeds."
    )


def enforce_health_consistency(layer_id: str, response: AIDiagnosisResponse) -> AIDiagnosisResponse:
    layer = LAYERS.get(layer_id)
    if not layer or layer.health_score >= 80:
        return response

    if response.severity == "Normal" or "healthy" in response.diagnosis.lower():
        severity = "Medium" if layer.health_score >= 60 else "High"
        evidence = [
            f"Health score is {layer.health_score}, below the healthy threshold of 80.",
            "A low health score should not be classified as Normal even when current readings are near range.",
            *response.evidence,
        ]
        actions = [
            "Review recent alerts and telemetry history for unresolved stress.",
            "Keep AI control active and monitor whether the next readings improve health.",
        ]
        if layer.main_risk:
            actions.insert(0, f"Address active risk: {layer.main_risk}.")

        return AIDiagnosisResponse(
            layer_id=response.layer_id,
            diagnosis="Reduced crop health",
            severity=severity,
            confidence=min(response.confidence, 85),
            evidence=evidence,
            recommended_actions=actions,
            device_command=response.device_command,
            expected_outcome="Health score should recover after the underlying stress is resolved and readings remain stable.",
        )

    return response


def run_ai_first_diagnosis(layer_id: str) -> AIDiagnosisResponse:
    settings = get_settings()
    if not settings.gemini_api_key and not settings.deepseek_api_key:
        return get_fallback_diagnosis(layer_id)

    layer = LAYERS.get(layer_id)
    if not layer:
        return get_fallback_diagnosis(layer_id)

    recipe = get_recipe_for_layer(layer_id)
    reading = layer.latest_reading

    context = f"""
    Layer ID: {layer.id}
    Layer Name: {layer.name}
    Crop: {layer.crop}
    Latest Sensor Readings: 
    - Temperature: {reading.temperature if reading else 'N/A'} (Ideal: {recipe.temperature_range})
    - Humidity: {reading.humidity if reading else 'N/A'} (Ideal: {recipe.humidity_range})
    - Soil Moisture: {reading.soil_moisture if reading else 'N/A'} (Ideal: {recipe.soil_moisture_range})
    - pH: {reading.ph if reading else 'N/A'} (Ideal: {recipe.ph_range})
    Health Score: {layer.health_score}
    Device States: Fan={layer.devices.fan}, Pump={layer.devices.pump}, Misting={layer.devices.misting}, LED={layer.devices.led_intensity}
    Active Alert: {layer.main_risk if layer.main_risk else 'None'}
    """

    prompt = """You are CropTwin AI, an advanced agricultural AI system. Analyze the live farm context and provide a JSON diagnosis.
    Output strictly as a valid JSON object matching this schema:
    {
      "diagnosis": "Short diagnosis title",
      "severity": "Low" | "Medium" | "High" | "Critical" | "Normal",
      "confidence": integer between 0-100,
      "evidence": ["list of string reasons"],
      "recommended_actions": ["list of string manual actions"],
      "device_command": {
        "device": "fan" | "pump" | "misting" | "led_intensity" | "none",
        "value": true | false | integer,
        "duration_minutes": integer | null
      },
      "expected_outcome": "Expected result string"
    }
    Safety constraints:
    - Pump duration must be 1-5 minutes.
    - Misting duration must be 1-5 minutes.
    - Fan duration must be 1-30 minutes.
    - LED intensity must be 0-100.
    Important: Do not invent sensor values. Only base your diagnosis on the provided context. If no immediate action is needed, return device "none".
    """

    if settings.deepseek_api_key:
        url = "https://api.deepseek.com/chat/completions"
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {settings.deepseek_api_key}"}
        data = {
            "model": "deepseek-v4-flash",
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": "Context:\n" + context}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.5
        }
        req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
                text = result["choices"][0]["message"]["content"]
                parsed = json.loads(text)
                response = AIDiagnosisResponse(
                    layer_id=layer_id,
                    diagnosis=parsed.get("diagnosis", "Unknown"),
                    severity=parsed.get("severity", "Normal"),
                    confidence=parsed.get("confidence", 50),
                    evidence=parsed.get("evidence", []),
                    recommended_actions=parsed.get("recommended_actions", []),
                    device_command=normalize_device_command(parsed.get("device_command", {"device": "none", "value": False})),
                    expected_outcome=parsed.get("expected_outcome", "")
                )
                return enforce_health_consistency(layer_id, response)
        except Exception as e:
            print(f"DeepSeek Diagnosis API error: {e}")
            return get_fallback_diagnosis(layer_id)

    elif settings.gemini_api_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.gemini_api_key}"
        headers = {"Content-Type": "application/json"}
        data = {
            "contents": [{"parts": [{"text": prompt + "\n\nContext:\n" + context}]}],
            "generationConfig": {"responseMimeType": "application/json"}
        }
        
        req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
                text = result["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                
                response = AIDiagnosisResponse(
                    layer_id=layer_id,
                    diagnosis=parsed.get("diagnosis", "Unknown"),
                    severity=parsed.get("severity", "Normal"),
                    confidence=parsed.get("confidence", 50),
                    evidence=parsed.get("evidence", []),
                    recommended_actions=parsed.get("recommended_actions", []),
                    device_command=normalize_device_command(parsed.get("device_command", {"device": "none", "value": False})),
                    expected_outcome=parsed.get("expected_outcome", "")
                )
                return enforce_health_consistency(layer_id, response)
        except Exception as e:
            print(f"AI-first Diagnosis API error: {e}")
            return get_fallback_diagnosis(layer_id)
