from uuid import uuid4

from app.schemas import Alert, CropRecipe, SensorReading


def _outside(value: float, range_: tuple[float, float]) -> bool:
    return value < range_[0] or value > range_[1]


def generate_alert(reading: SensorReading, recipe: CropRecipe) -> Alert | None:
    if reading.temperature > recipe.temperature_range[1]:
        severity = "critical" if reading.temperature > recipe.temperature_range[1] + 8 else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="High temperature detected",
            message=f"{recipe.crop} temperature is {reading.temperature:.1f}C, above the ideal {recipe.temperature_range[0]:.0f}-{recipe.temperature_range[1]:.0f}C range.",
        )

    if reading.temperature < recipe.temperature_range[0]:
        severity = "critical" if reading.temperature < recipe.temperature_range[0] - 8 else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="Low temperature detected",
            message=f"{recipe.crop} temperature is {reading.temperature:.1f}C, below the ideal {recipe.temperature_range[0]:.0f}-{recipe.temperature_range[1]:.0f}C range.",
        )

    if reading.humidity > recipe.humidity_range[1]:
        severity = "critical" if reading.humidity > recipe.humidity_range[1] + 20 else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="High humidity detected",
            message=f"{recipe.crop} humidity is {reading.humidity:.0f}%, above the ideal {recipe.humidity_range[0]:.0f}-{recipe.humidity_range[1]:.0f}% range.",
        )

    if reading.humidity < recipe.humidity_range[0]:
        severity = "critical" if reading.humidity < recipe.humidity_range[0] - 20 else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="Low humidity detected",
            message=f"{recipe.crop} humidity is {reading.humidity:.0f}%, below the ideal {recipe.humidity_range[0]:.0f}-{recipe.humidity_range[1]:.0f}% range.",
        )

    if reading.soil_moisture < recipe.soil_moisture_range[0]:
        critical_threshold = max(0, min(recipe.soil_moisture_range[0] - 25, recipe.soil_moisture_range[0] * 0.5))
        severity = "critical" if reading.soil_moisture < critical_threshold else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="Low soil moisture",
            message=f"{recipe.crop} soil moisture is {reading.soil_moisture:.0f}%, below the ideal {recipe.soil_moisture_range[0]:.0f}-{recipe.soil_moisture_range[1]:.0f}% range.",
        )

    if _outside(reading.ph, recipe.ph_range):
        ph_distance = recipe.ph_range[0] - reading.ph if reading.ph < recipe.ph_range[0] else reading.ph - recipe.ph_range[1]
        severity = "critical" if ph_distance > 1.0 else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="pH drift detected",
            message=f"pH is {reading.ph:.1f}. {recipe.crop} grows best around {recipe.ph_range[0]:.1f}-{recipe.ph_range[1]:.1f}.",
        )

    return None


def alert_is_resolved(alert: Alert, reading: SensorReading, recipe: CropRecipe) -> bool:
    title = alert.title
    if title == "High temperature detected":
        return reading.temperature <= recipe.temperature_range[1]
    if title == "Low temperature detected":
        return reading.temperature >= recipe.temperature_range[0]
    if title == "High humidity detected":
        return reading.humidity <= recipe.humidity_range[1]
    if title == "Low humidity detected":
        return reading.humidity >= recipe.humidity_range[0]
    if title == "Low soil moisture":
        return reading.soil_moisture >= recipe.soil_moisture_range[0]
    if title == "pH drift detected":
        return recipe.ph_range[0] <= reading.ph <= recipe.ph_range[1]
    if title == "Humidity risk predicted":
        return reading.humidity <= recipe.humidity_range[1]
    if title == "Irrigation risk predicted":
        return reading.soil_moisture >= recipe.soil_moisture_range[0]
    return False


def generate_predictive_alert(readings: list[SensorReading], recipe: CropRecipe) -> Alert | None:
    if len(readings) < 3:
        return None

    recent = readings[-3:]
    humidity_delta = recent[-1].humidity - recent[0].humidity
    moisture_delta = recent[-1].soil_moisture - recent[0].soil_moisture

    if recent[-1].humidity < recipe.humidity_range[1] and humidity_delta > 8:
        return Alert(
            id=str(uuid4()),
            layer_id=recent[-1].layer_id,
            severity="warning",
            title="Humidity risk predicted",
            message="Humidity is rising quickly and may enter the unsafe range soon.",
            predictive=True,
        )

    if recent[-1].soil_moisture > recipe.soil_moisture_range[0] and moisture_delta < -10:
        return Alert(
            id=str(uuid4()),
            layer_id=recent[-1].layer_id,
            severity="warning",
            title="Irrigation risk predicted",
            message="Soil moisture is dropping quickly and may need pump activation soon.",
            predictive=True,
        )

    return None
