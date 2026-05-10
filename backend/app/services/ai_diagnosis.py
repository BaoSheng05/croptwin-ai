import json
import urllib.request
from typing import Dict, Any

from app.store import AI_CONTROL_DECISIONS, LAYERS, get_recipe_for_layer
from app.core.config import get_settings
from app.schemas import AIControlCommand, AIDiagnosisResponse, AIDeviceCommand

def normalize_device_command(command: dict) -> AIDeviceCommand:
    device = command.get("device", "none")
    value = command.get("value", False)
    duration = command.get("duration_minutes")
    if device not in {"fan", "pump", "misting", "climate_heating", "climate_cooling", "led_intensity", "none"}:
        device = "none"
        value = False
        duration = None

    if device == "pump" and value is True:
        duration = min(max(int(duration or 2), 1), 5)
    elif device == "misting" and value is True:
        duration = min(max(int(duration or 3), 1), 5)
    elif device == "fan" and value is True:
        duration = min(max(int(duration or 10), 1), 30)
    elif device in {"climate_heating", "climate_cooling"}:
        if value is True:
            value = 1
        elif value is False:
            value = 0
        else:
            value = min(max(int(value), 0), 3)
        duration = min(max(int(duration or 15), 1), 30) if value > 0 else None
    elif device == "led_intensity":
        if isinstance(value, bool):
            value = 70
        value = min(max(int(value), 0), 100)
        duration = None
    else:
        duration = None

    return AIDeviceCommand(device=device, value=value, duration_minutes=duration)


def _control_command_for_diagnosis(command: AIControlCommand) -> AIDeviceCommand:
    return normalize_device_command({
        "device": command.device,
        "value": command.value,
        "duration_minutes": command.duration_minutes,
    })


def _describe_control_command(command: AIControlCommand) -> str:
    if command.device == "none":
        return "AI Control does not require an actuator change right now."
    if command.device == "led_intensity":
        return f"AI Control target: set LED intensity to {command.value}%."
    if command.device == "climate_heating":
        return f"AI Control target: activate climate heating for {command.duration_minutes or 15} minutes."
    if command.device == "climate_cooling":
        return f"AI Control target: activate climate cooling for {command.duration_minutes or 15} minutes."
    value = "ON" if command.value is True else "OFF"
    duration = f" for {command.duration_minutes} minutes" if command.duration_minutes else ""
    return f"AI Control target: set {command.device} {value}{duration}."


def _primary_control_command(commands: list[AIControlCommand]) -> AIControlCommand | None:
    for device in ("pump", "misting", "climate_heating", "climate_cooling", "fan"):
        for command in commands:
            if command.device == device and command.value is True:
                return command
    for command in commands:
        if command.device == "led_intensity":
            return command
    return commands[0] if commands else None


def align_with_latest_control_decision(layer_id: str, response: AIDiagnosisResponse) -> AIDiagnosisResponse:
    decision = AI_CONTROL_DECISIONS.get(layer_id)
    if not decision:
        return response

    primary = _primary_control_command(decision.commands)
    if not primary:
        return response

    control_action = _describe_control_command(primary)
    evidence = [
        f"Latest AI Control plan is active for this layer: {decision.summary}",
        *response.evidence,
    ]
    actions = [
        control_action,
        *[action for action in response.recommended_actions if action != control_action],
    ]

    return AIDiagnosisResponse(
        layer_id=response.layer_id,
        diagnosis=response.diagnosis,
        severity=response.severity,
        confidence=response.confidence,
        evidence=evidence,
        recommended_actions=actions,
        device_command=_control_command_for_diagnosis(primary),
        expected_outcome=response.expected_outcome,
    )


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
        severity="Low",
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
        return align_with_latest_control_decision(layer_id, get_fallback_diagnosis(layer_id))

    layer = LAYERS.get(layer_id)
    if not layer:
        return align_with_latest_control_decision(layer_id, get_fallback_diagnosis(layer_id))

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
    Latest AI Control Decision: {AI_CONTROL_DECISIONS[layer_id].model_dump(mode="json") if layer_id in AI_CONTROL_DECISIONS else 'None'}
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
        "device": "fan" | "pump" | "misting" | "climate_heating" | "climate_cooling" | "led_intensity" | "none",
        "value": true | false | integer,
        "duration_minutes": integer | null
      },
      "expected_outcome": "Expected result string"
    }
    Safety constraints:
    - Pump duration must be 1-5 minutes.
    - Misting duration must be 1-5 minutes.
    - Fan duration must be 1-30 minutes.
    - Climate heating/cooling duration must be 1-30 minutes.
    - LED intensity must be 0-100 and should only control light intensity, not temperature.
    Important: Do not invent sensor values. Only base your diagnosis on the provided context. If no immediate action is needed, return device "none".
    If Latest AI Control Decision is present, do not contradict it. You may explain the same action, or recommend manual checks that do not conflict with the active AI control plan.
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
                return align_with_latest_control_decision(layer_id, enforce_health_consistency(layer_id, response))
        except Exception as e:
            print(f"DeepSeek Diagnosis API error: {e}")
            return align_with_latest_control_decision(layer_id, get_fallback_diagnosis(layer_id))

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
                return align_with_latest_control_decision(layer_id, enforce_health_consistency(layer_id, response))
        except Exception as e:
            print(f"AI-first Diagnosis API error: {e}")
            return align_with_latest_control_decision(layer_id, get_fallback_diagnosis(layer_id))
