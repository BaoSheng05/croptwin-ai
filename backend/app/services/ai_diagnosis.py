import json
import urllib.request
from typing import Dict, Any

from app.store import LAYERS, get_recipe_for_layer
from app.core.config import get_settings
from app.schemas import AIDiagnosisResponse, AIDeviceCommand

def get_fallback_diagnosis(layer_id: str) -> AIDiagnosisResponse:
    from app.services.diagnosis import generate_diagnosis
    local = generate_diagnosis(layer_id)
    return AIDiagnosisResponse(
        layer_id=layer_id,
        diagnosis=local.diagnosis,
        severity=local.severity if local.severity in ["Low", "Medium", "High", "Critical", "Normal"] else "Normal",
        confidence=local.confidence,
        evidence=local.causes,
        recommended_actions=local.recommended_actions,
        device_command=AIDeviceCommand(device="none", value=False),
        expected_outcome=local.expected_outcome
    )

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
                return AIDiagnosisResponse(
                    layer_id=layer_id,
                    diagnosis=parsed.get("diagnosis", "Unknown"),
                    severity=parsed.get("severity", "Normal"),
                    confidence=parsed.get("confidence", 50),
                    evidence=parsed.get("evidence", []),
                    recommended_actions=parsed.get("recommended_actions", []),
                    device_command=AIDeviceCommand(**parsed.get("device_command", {"device": "none", "value": False})),
                    expected_outcome=parsed.get("expected_outcome", "")
                )
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
                
                return AIDiagnosisResponse(
                    layer_id=layer_id,
                    diagnosis=parsed.get("diagnosis", "Unknown"),
                    severity=parsed.get("severity", "Normal"),
                    confidence=parsed.get("confidence", 50),
                    evidence=parsed.get("evidence", []),
                    recommended_actions=parsed.get("recommended_actions", []),
                    device_command=AIDeviceCommand(**parsed.get("device_command", {"device": "none", "value": False})),
                    expected_outcome=parsed.get("expected_outcome", "")
                )
        except Exception as e:
            print(f"AI-first Diagnosis API error: {e}")
            return get_fallback_diagnosis(layer_id)
