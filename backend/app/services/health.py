from app.schemas import CropRecipe, LayerStatus, SensorReading


def _range_penalty(value: float, ideal: tuple[float, float], tolerance: float) -> float:
    low, high = ideal
    if low <= value <= high:
        return 0
    distance = low - value if value < low else value - high
    return min(25, distance / tolerance * 25)


def calculate_health_score(reading: SensorReading, recipe: CropRecipe) -> int:
    penalties = [
        _range_penalty(reading.temperature, recipe.temperature_range, 8),
        _range_penalty(reading.humidity, recipe.humidity_range, 30),
        _range_penalty(reading.soil_moisture, recipe.soil_moisture_range, 35),
        _range_penalty(reading.ph, recipe.ph_range, 2),
        _range_penalty(reading.light_intensity, recipe.light_range, 500),
        _range_penalty(reading.water_level, (25, 100), 40),
    ]
    return max(0, min(100, round(100 - sum(penalties))))


def status_from_score(score: int) -> LayerStatus:
    if score < 50:
        return LayerStatus.critical
    if score < 80:
        return LayerStatus.warning
    return LayerStatus.healthy
