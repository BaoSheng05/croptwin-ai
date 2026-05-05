from collections import defaultdict, deque
from datetime import datetime, timezone

from app.schemas import (
    Alert,
    CropRecipe,
    DeviceState,
    FarmLayer,
    LayerStatus,
    Recommendation,
    SensorReading,
    SustainabilitySnapshot,
)

RECIPES: dict[str, CropRecipe] = {
    "Basil": CropRecipe(
        crop="Basil",
        temperature_range=(21, 28),
        humidity_range=(40, 60),
        soil_moisture_range=(45, 70),
        ph_range=(5.8, 6.8),
        light_range=(500, 900),
    ),
    "Lettuce": CropRecipe(
        crop="Lettuce",
        temperature_range=(16, 24),
        humidity_range=(50, 70),
        soil_moisture_range=(55, 80),
        ph_range=(5.5, 6.5),
        light_range=(400, 750),
    ),
    "Strawberry": CropRecipe(
        crop="Strawberry",
        temperature_range=(18, 26),
        humidity_range=(45, 65),
        soil_moisture_range=(50, 75),
        ph_range=(5.5, 6.5),
        light_range=(650, 1000),
    ),
}

LAYERS: dict[str, FarmLayer] = {
    "layer_01": FarmLayer(
        id="layer_01",
        name="Layer 1",
        crop="Lettuce",
        status=LayerStatus.healthy,
        health_score=92,
        main_risk=None,
        devices=DeviceState(),
    ),
    "layer_02": FarmLayer(
        id="layer_02",
        name="Layer 2",
        crop="Basil",
        status=LayerStatus.warning,
        health_score=74,
        main_risk="Humidity trending high",
        devices=DeviceState(),
    ),
    "layer_03": FarmLayer(
        id="layer_03",
        name="Layer 3",
        crop="Strawberry",
        status=LayerStatus.healthy,
        health_score=88,
        main_risk=None,
        devices=DeviceState(led_intensity=82),
    ),
}

READINGS: dict[str, deque[SensorReading]] = defaultdict(lambda: deque(maxlen=120))
ALERTS: deque[Alert] = deque(maxlen=80)
RECOMMENDATIONS: deque[Recommendation] = deque(maxlen=80)


def get_recipe_for_layer(layer_id: str) -> CropRecipe:
    layer = LAYERS[layer_id]
    return RECIPES[layer.crop]


def save_reading(reading: SensorReading) -> None:
    READINGS[reading.layer_id].append(reading)
    LAYERS[reading.layer_id].latest_reading = reading


def latest_alerts(limit: int = 20) -> list[Alert]:
    return list(ALERTS)[-limit:][::-1]


def latest_recommendations(limit: int = 20) -> list[Recommendation]:
    return list(RECOMMENDATIONS)[-limit:][::-1]


def sustainability_snapshot() -> SustainabilitySnapshot:
    auto_layers = sum(1 for layer in LAYERS.values() if layer.devices.auto_mode)
    health_avg = sum(layer.health_score for layer in LAYERS.values()) / len(LAYERS)
    score = min(100, round(health_avg * 0.7 + auto_layers * 8))
    return SustainabilitySnapshot(
        water_saved_liters=128.5,
        energy_optimized_kwh=31.2,
        estimated_cost_reduction_rm=46.8,
        sustainability_score=score,
    )


def seed_latest_readings() -> None:
    if any(READINGS.values()):
        return

    now = datetime.now(timezone.utc)
    seed = {
        "layer_01": SensorReading(
            layer_id="layer_01",
            temperature=22.4,
            humidity=58,
            soil_moisture=68,
            ph=6.1,
            light_intensity=620,
            water_level=82,
            timestamp=now,
        ),
        "layer_02": SensorReading(
            layer_id="layer_02",
            temperature=27.8,
            humidity=74,
            soil_moisture=49,
            ph=6.7,
            light_intensity=720,
            water_level=71,
            timestamp=now,
        ),
        "layer_03": SensorReading(
            layer_id="layer_03",
            temperature=23.6,
            humidity=61,
            soil_moisture=63,
            ph=6.2,
            light_intensity=840,
            water_level=78,
            timestamp=now,
        ),
    }
    for reading in seed.values():
        save_reading(reading)
