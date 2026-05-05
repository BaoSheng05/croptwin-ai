from typing import List, Optional
from pydantic import BaseModel
from app.store import LAYERS, get_recipe_for_layer

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
        
    return DiagnosisResponse(
        layer_id=layer_id,
        crop=layer.crop,
        diagnosis=diagnosis,
        severity=severity,
        confidence=confidence,
        causes=causes,
        recommended_actions=recommended_actions,
        expected_outcome=expected_outcome
    )
