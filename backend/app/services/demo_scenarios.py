"""Demo scenario reading generators.

Produces synthetic sensor readings for each demo scenario so the route
handler stays thin.
"""

from datetime import datetime, timezone

from app.schemas import CropRecipe, SensorReading
from app.store import LAYERS, get_recipe_for_layer


def build_scenario_reading(layer_id: str, scenario: str) -> SensorReading:
    """Return a synthetic reading for *layer_id* adjusted to *scenario*."""
    layer = LAYERS[layer_id]
    recipe = get_recipe_for_layer(layer_id)

    base = layer.latest_reading or _midpoint_reading(layer_id, recipe)
    values = base.model_dump()

    if scenario == "normal":
        values.update(_normal_values(recipe))
    elif scenario == "high_humidity":
        values.update({
            "humidity": recipe.humidity_range[1] + 16,
            "temperature": recipe.temperature_range[1] + 1,
        })
    elif scenario == "low_moisture":
        values.update({
            "soil_moisture": max(10, recipe.soil_moisture_range[0] - 18),
            "water_level": 32,
        })
    elif scenario == "disease_outbreak":
        values.update({
            "humidity": recipe.humidity_range[1] + 20,
            "temperature": recipe.temperature_range[1] + 2,
            "soil_moisture": recipe.soil_moisture_range[1] + 8,
        })
    elif scenario == "energy_peak":
        values.update({
            "light_intensity": recipe.light_range[1] + 260,
            "temperature": recipe.temperature_range[1] + 1,
        })
        layer.devices.led_intensity = 85

    values["timestamp"] = datetime.now(timezone.utc)
    return SensorReading(**values)


# ── Private helpers ──────────────────────────────────────────────


def _midpoint_reading(layer_id: str, recipe: CropRecipe) -> SensorReading:
    """Create a mid-range reading when no live data exists."""
    return SensorReading(
        layer_id=layer_id,
        temperature=sum(recipe.temperature_range) / 2,
        humidity=sum(recipe.humidity_range) / 2,
        soil_moisture=sum(recipe.soil_moisture_range) / 2,
        ph=sum(recipe.ph_range) / 2,
        light_intensity=sum(recipe.light_range) / 2,
        water_level=78,
    )


def _normal_values(recipe: CropRecipe) -> dict:
    """Sensor values that place every metric at its recipe midpoint."""
    return {
        "temperature": sum(recipe.temperature_range) / 2,
        "humidity": sum(recipe.humidity_range) / 2,
        "soil_moisture": sum(recipe.soil_moisture_range) / 2,
        "ph": sum(recipe.ph_range) / 2,
        "light_intensity": sum(recipe.light_range) / 2,
        "water_level": 82,
    }
