import json
import urllib.request
from typing import List, Optional
from pydantic import BaseModel
from app.store import LAYERS, get_recipe_for_layer
from app.core.config import get_settings

class DiagnosisRequest(BaseModel):
    layer_id: str

class DiagnosisResponse(BaseModel):
    layer_id: str
    crop: str
    diagnosis: str
    severity: str
    confidence: int
    causes: List[str]
    recommended_actions: List[str]
    expected_outcome: str

def call_gemini_diagnosis(diagnosis: DiagnosisResponse, api_key: str) -> DiagnosisResponse:
    prompt = """You are CropTwin AI, an agricultural diagnosis assistant. Diagnose the crop condition using only the provided farm data. Do not invent data. Rewrite the diagnosis into a professional farm report suitable for a dashboard.
    Output strictly as a valid JSON object matching this schema:
    {
      "diagnosis": "Short diagnosis title",
      "severity": "High" | "Medium" | "Low" | "Normal",
      "causes": ["List of evidence strings"],
      "recommended_actions": ["List of action strings"],
      "expected_outcome": "Expected result string"
    }"""
    
    context = f"""
    Crop: {diagnosis.crop}
    Deterministic Diagnosis: {diagnosis.diagnosis}
    Severity: {diagnosis.severity}
    Causes/Evidence: {diagnosis.causes}
    Recommended Actions: {diagnosis.recommended_actions}
    Expected Outcome: {diagnosis.expected_outcome}
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    data = {
        "contents": [{"parts": [{"text": prompt + "\n\nContext:\n" + context}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode("utf-8"))
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
            
            return DiagnosisResponse(
                layer_id=diagnosis.layer_id,
                crop=diagnosis.crop,
                confidence=diagnosis.confidence,
                diagnosis=parsed.get("diagnosis", diagnosis.diagnosis),
                severity=parsed.get("severity", diagnosis.severity),
                causes=parsed.get("causes", diagnosis.causes),
                recommended_actions=parsed.get("recommended_actions", diagnosis.recommended_actions),
                expected_outcome=parsed.get("expected_outcome", diagnosis.expected_outcome)
            )
    except Exception as e:
        print(f"Gemini API error: {e}")
        return diagnosis

def generate_diagnosis(layer_id: str) -> DiagnosisResponse:
    layer = LAYERS[layer_id]
    recipe = get_recipe_for_layer(layer_id)
    reading = layer.latest_reading
    devices = layer.devices

    if not reading:
        return DiagnosisResponse(
            layer_id=layer_id,
            crop=layer.crop,
            diagnosis="Unknown condition",
            severity="Low",
            confidence=0,
            causes=["No sensor readings available yet."],
            recommended_actions=["Ensure IoT sensors are online."],
            expected_outcome="System will receive data and update status."
        )

    causes = []
    recommended_actions = []
    diagnosis = "Healthy crop condition"
    severity = "Normal"
    confidence = 95
    expected_outcome = "Crop will continue optimal growth."

    # Rule 1: High fungal risk (Humidity)
    if reading.humidity > recipe.humidity_range[1] + 5:
        diagnosis = "High fungal risk"
        severity = "High"
        diff = reading.humidity - recipe.humidity_range[1]
        confidence = min(98, max(60, 60 + int(diff * 1.5)))
        causes.append(f"Humidity is {reading.humidity:.0f}%, above {recipe.crop}'s ideal range of {recipe.humidity_range[0]}–{recipe.humidity_range[1]}%")
        causes.append(f"Health score has dropped to {layer.health_score}")
        if not devices.fan:
            causes.append("Fan is currently off")
            recommended_actions.append("Turn on fan for 20 minutes")
        if devices.misting:
            causes.append("Misting system is currently active")
            recommended_actions.append("Reduce misting temporarily")
        recommended_actions.append("Monitor humidity until it falls below 65%")
        expected_outcome = "Humidity should gradually decrease and the health score should improve."

    # Rule 2: Dehydration risk (Soil Moisture)
    elif reading.soil_moisture < recipe.soil_moisture_range[0] - 5:
        diagnosis = "Dehydration risk"
        severity = "High"
        diff = recipe.soil_moisture_range[0] - reading.soil_moisture
        confidence = min(98, max(60, 60 + int(diff * 1.5)))
        causes.append(f"Soil moisture is {reading.soil_moisture:.0f}%, below {recipe.crop}'s ideal range of {recipe.soil_moisture_range[0]}–{recipe.soil_moisture_range[1]}%")
        causes.append(f"Health score has dropped to {layer.health_score}")
        if not devices.pump:
            causes.append("Water pump is currently off")
            recommended_actions.append("Turn on water pump")
        recommended_actions.append("Check irrigation lines for blockage")
        expected_outcome = "Soil moisture will recover to ideal levels, preventing wilting."

    # Rule 3: Nutrient absorption risk (pH)
    elif reading.ph < recipe.ph_range[0] - 0.5 or reading.ph > recipe.ph_range[1] + 0.5:
        diagnosis = "Nutrient absorption risk"
        severity = "Medium"
        diff = abs(reading.ph - (recipe.ph_range[0] + recipe.ph_range[1])/2)
        confidence = min(98, max(60, 60 + int(diff * 20)))
        causes.append(f"pH is {reading.ph:.1f}, outside {recipe.crop}'s ideal range of {recipe.ph_range[0]}–{recipe.ph_range[1]}")
        causes.append(f"Health score has dropped to {layer.health_score}")
        recommended_actions.append("Adjust nutrient solution dosing")
        recommended_actions.append("Run buffer cycle in irrigation")
        expected_outcome = "pH will normalize, allowing roots to absorb nutrients efficiently."

    # Rule 4: Heat stress risk (Temperature)
    elif reading.temperature > recipe.temperature_range[1] + 2:
        diagnosis = "Heat stress risk"
        severity = "High"
        diff = reading.temperature - recipe.temperature_range[1]
        confidence = min(98, max(60, 60 + int(diff * 3)))
        causes.append(f"Temperature is {reading.temperature:.1f}°C, above {recipe.crop}'s ideal range of {recipe.temperature_range[0]}–{recipe.temperature_range[1]}°C")
        causes.append(f"Health score has dropped to {layer.health_score}")
        if not devices.fan:
            recommended_actions.append("Turn on fan to increase airflow")
        if not devices.misting:
            recommended_actions.append("Activate misting for evaporative cooling")
        expected_outcome = "Temperature will drop, reducing plant stress."

    # Rule 5: Insufficient light exposure
    elif reading.light_intensity < recipe.light_range[0] - 100:
        diagnosis = "Insufficient light exposure"
        severity = "Medium"
        diff = recipe.light_range[0] - reading.light_intensity
        confidence = min(98, max(60, 60 + int(diff * 0.1)))
        causes.append(f"Light intensity is {reading.light_intensity:.0f} lux, below ideal minimum of {recipe.light_range[0]} lux")
        causes.append(f"Health score has dropped to {layer.health_score}")
        if devices.led_intensity < 80:
            causes.append(f"LED intensity is currently at {devices.led_intensity}%")
            recommended_actions.append("Increase LED intensity to 100%")
        expected_outcome = "Photosynthesis rate will normalize and growth will resume."
        
    if not causes:
        causes.append("All environmental parameters are within ideal ranges.")
        causes.append(f"Current health score is {layer.health_score}.")
        recommended_actions.append("Maintain current operational schedule.")
        
    base_response = DiagnosisResponse(
        layer_id=layer_id,
        crop=layer.crop,
        diagnosis=diagnosis,
        severity=severity,
        confidence=confidence,
        causes=causes,
        recommended_actions=recommended_actions,
        expected_outcome=expected_outcome
    )
    
    settings = get_settings()
    if settings.gemini_api_key:
        return call_gemini_diagnosis(base_response, settings.gemini_api_key)
        
    return base_response


def generate_image_diagnosis(layer_id: str, image_base64: str) -> DiagnosisResponse:
    """Uses Gemini Vision to diagnose a crop image combined with sensor data."""
    layer = LAYERS[layer_id]
    recipe = get_recipe_for_layer(layer_id)
    reading = layer.latest_reading
    
    settings = get_settings()
    
    if not settings.gemini_api_key:
        return DiagnosisResponse(
            layer_id=layer_id, crop=layer.crop, diagnosis="API Key Required", severity="Normal", confidence=0,
            causes=["Plant image diagnosis requires a valid Gemini API key in the backend."],
            recommended_actions=["Add GEMINI_API_KEY to backend/.env"], expected_outcome="Image diagnosis will be unlocked."
        )

    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]

    prompt = """You are CropTwin AI, an expert agricultural vision system. Analyze the provided plant image combined with the live sensor data to diagnose the plant's health.
    Output strictly as a valid JSON object matching this schema:
    {
      "diagnosis": "Short diagnosis title",
      "severity": "High" | "Medium" | "Low" | "Normal",
      "causes": ["List of evidence strings derived from both image and sensor data"],
      "recommended_actions": ["List of action strings"],
      "expected_outcome": "Expected result string"
    }"""

    sensor_context = f"""
    Crop: {layer.crop}
    Current Temperature: {reading.temperature if reading else 'N/A'} (Ideal: {recipe.temperature_range})
    Current Humidity: {reading.humidity if reading else 'N/A'} (Ideal: {recipe.humidity_range})
    Current Soil Moisture: {reading.soil_moisture if reading else 'N/A'} (Ideal: {recipe.soil_moisture_range})
    Current pH: {reading.ph if reading else 'N/A'} (Ideal: {recipe.ph_range})
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.gemini_api_key}"
    headers = {"Content-Type": "application/json"}
    
    data = {
        "contents": [
            {
                "parts": [
                    {"text": prompt + "\n\nSensor Context:\n" + sensor_context},
                    {
                        "inlineData": {
                            "mimeType": "image/jpeg",
                            "data": image_base64
                        }
                    }
                ]
            }
        ],
        "generationConfig": {"responseMimeType": "application/json"}
    }

    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read().decode("utf-8"))
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
            
            return DiagnosisResponse(
                layer_id=layer_id,
                crop=layer.crop,
                confidence=85,
                diagnosis=parsed.get("diagnosis", "Unknown Vision Issue"),
                severity=parsed.get("severity", "Normal"),
                causes=parsed.get("causes", []),
                recommended_actions=parsed.get("recommended_actions", []),
                expected_outcome=parsed.get("expected_outcome", "")
            )
    except Exception as e:
        print(f"Gemini Vision API error: {e}")
        return DiagnosisResponse(
            layer_id=layer_id, crop=layer.crop, diagnosis="Vision API Error", severity="Normal", confidence=0,
            causes=[f"Failed to process image: {e}"], recommended_actions=["Try another image"], expected_outcome="-"
        )

