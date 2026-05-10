from uuid import uuid4

from app.schemas import Alert, CropRecipe, SensorReading

TEMP_WARNING_MARGIN = 0.7
HUMIDITY_WARNING_MARGIN = 3.0
MOISTURE_WARNING_MARGIN = 2.0
PH_WARNING_MARGIN = 0.15


def _outside(value: float, range_: tuple[float, float]) -> bool:
    return value < range_[0] or value > range_[1]


def generate_alert(reading: SensorReading, recipe: CropRecipe) -> Alert | None:
    # Temperature Alert logic
    temp_min, temp_max = recipe.temperature_range
    temp_span = max(0.1, temp_max - temp_min)
    temp_buffer = 0.15 * temp_span

    if reading.temperature > temp_max + temp_buffer:
        severity = "critical" if reading.temperature > temp_max + 8 else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="High temperature detected",
            message=f"{recipe.crop} temperature is {reading.temperature:.1f}C, above the ideal {temp_min:.0f}-{temp_max:.0f}C range.",
        )

    if reading.temperature < temp_min - temp_buffer:
        severity = "critical" if reading.temperature < temp_min - 8 else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="Low temperature detected",
            message=f"{recipe.crop} temperature is {reading.temperature:.1f}C, below the ideal {temp_min:.0f}-{temp_max:.0f}C range.",
        )

    # Humidity Alert logic
    hum_min, hum_max = recipe.humidity_range
    hum_span = max(1.0, hum_max - hum_min)
    hum_buffer = 0.15 * hum_span

    if reading.humidity > hum_max + hum_buffer:
        severity = "critical" if reading.humidity > hum_max + 20 else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="High humidity detected",
            message=f"{recipe.crop} humidity is {reading.humidity:.0f}%, above the ideal {hum_min:.0f}-{hum_max:.0f}% range.",
        )

    if reading.humidity < hum_min - hum_buffer:
        severity = "critical" if reading.humidity < hum_min - 20 else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="Low humidity detected",
            message=f"{recipe.crop} humidity is {reading.humidity:.0f}%, below the ideal {hum_min:.0f}-{hum_max:.0f}% range.",
        )

    # Soil Moisture Alert logic
    moist_min, moist_max = recipe.soil_moisture_range
    moist_span = max(1.0, moist_max - moist_min)
    moist_buffer = 0.15 * moist_span

    if reading.soil_moisture < moist_min - moist_buffer:
        critical_threshold = max(0, min(moist_min - 25, moist_min * 0.5))
        severity = "critical" if reading.soil_moisture < critical_threshold else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="Low soil moisture",
            message=f"{recipe.crop} soil moisture is {reading.soil_moisture:.0f}%, below the ideal {moist_min:.0f}-{moist_max:.0f}% range.",
        )

    # pH Alert logic
    ph_min, ph_max = recipe.ph_range
    ph_span = max(0.1, ph_max - ph_min)
    ph_buffer = 0.15 * ph_span

    if reading.ph < ph_min - ph_buffer or reading.ph > ph_max + ph_buffer:
        ph_distance = ph_min - reading.ph if reading.ph < ph_min else reading.ph - ph_max
        severity = "critical" if ph_distance > 1.0 else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="pH drift detected",
            message=f"pH is {reading.ph:.1f}. {recipe.crop} grows best around {ph_min:.1f}-{ph_max:.1f}.",
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
