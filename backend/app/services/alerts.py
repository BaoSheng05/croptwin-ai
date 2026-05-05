from uuid import uuid4

from app.schemas import Alert, CropRecipe, SensorReading


def _outside(value: float, range_: tuple[float, float]) -> bool:
    return value < range_[0] or value > range_[1]


def generate_alert(reading: SensorReading, recipe: CropRecipe) -> Alert | None:
    if reading.humidity > recipe.humidity_range[1]:
        severity = "critical" if reading.humidity > recipe.humidity_range[1] + 20 else "warning"
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity=severity,
            title="High humidity detected",
            message=f"{recipe.crop} humidity is {reading.humidity:.0f}%, above the ideal {recipe.humidity_range[0]:.0f}-{recipe.humidity_range[1]:.0f}% range.",
        )

    if reading.soil_moisture < recipe.soil_moisture_range[0]:
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity="warning",
            title="Low soil moisture",
            message=f"{recipe.crop} soil moisture is {reading.soil_moisture:.0f}%, below the ideal range.",
        )

    if _outside(reading.ph, recipe.ph_range):
        return Alert(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            severity="warning",
            title="pH drift detected",
            message=f"pH is {reading.ph:.1f}. {recipe.crop} grows best around {recipe.ph_range[0]:.1f}-{recipe.ph_range[1]:.1f}.",
        )

    return None


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
