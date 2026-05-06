from collections import defaultdict, deque
from datetime import datetime, timezone

from app.schemas import (
    Alert,
    Area,
    CropRecipe,
    DeviceState,
    FarmLayer,
    LayerStatus,
    Recommendation,
    SensorReading,
    SustainabilitySnapshot,
)

# ── Crop Recipes ─────────────────────────────────────────────────

RECIPES: dict[str, CropRecipe] = {
    "Lettuce": CropRecipe(
        crop="Lettuce",
        temperature_range=(16, 24),
        humidity_range=(50, 70),
        soil_moisture_range=(55, 80),
        ph_range=(5.5, 6.5),
        light_range=(400, 750),
    ),
    "Basil": CropRecipe(
        crop="Basil",
        temperature_range=(21, 28),
        humidity_range=(40, 60),
        soil_moisture_range=(45, 70),
        ph_range=(5.8, 6.8),
        light_range=(500, 900),
    ),
    "Strawberry": CropRecipe(
        crop="Strawberry",
        temperature_range=(18, 26),
        humidity_range=(45, 65),
        soil_moisture_range=(50, 75),
        ph_range=(5.5, 6.5),
        light_range=(650, 1000),
    ),
    "Spinach": CropRecipe(
        crop="Spinach",
        temperature_range=(15, 22),
        humidity_range=(45, 65),
        soil_moisture_range=(50, 75),
        ph_range=(6.0, 7.0),
        light_range=(350, 700),
    ),
    "Mint": CropRecipe(
        crop="Mint",
        temperature_range=(18, 25),
        humidity_range=(50, 70),
        soil_moisture_range=(55, 80),
        ph_range=(6.0, 7.0),
        light_range=(400, 800),
    ),
    "Tomato": CropRecipe(
        crop="Tomato",
        temperature_range=(20, 30),
        humidity_range=(40, 60),
        soil_moisture_range=(50, 70),
        ph_range=(5.5, 6.8),
        light_range=(600, 1000),
    ),
}

# ── Area definitions ─────────────────────────────────────────────

AREA_DEFS = [
    {
        "id": "area_a", "name": "Area A — Leafy Greens Wing",
        "layers": [
            ("a_01", "A-1", "Lettuce"),
            ("a_02", "A-2", "Lettuce"),
            ("a_03", "A-3", "Spinach"),
            ("a_04", "A-4", "Spinach"),
            ("a_05", "A-5", "Lettuce"),
        ],
    },
    {
        "id": "area_b", "name": "Area B — Herbs Wing",
        "layers": [
            ("b_01", "B-1", "Basil"),
            ("b_02", "B-2", "Basil"),
            ("b_03", "B-3", "Mint"),
            ("b_04", "B-4", "Mint"),
            ("b_05", "B-5", "Basil"),
        ],
    },
    {
        "id": "area_c", "name": "Area C — Fruits Wing",
        "layers": [
            ("c_01", "C-1", "Strawberry"),
            ("c_02", "C-2", "Strawberry"),
            ("c_03", "C-3", "Tomato"),
            ("c_04", "C-4", "Tomato"),
            ("c_05", "C-5", "Strawberry"),
        ],
    },
]

# ── Build LAYERS and AREAS from definitions ──────────────────────

LAYERS: dict[str, FarmLayer] = {}
AREAS: dict[str, Area] = {}

_base_profiles: dict[str, dict] = {}

for area_def in AREA_DEFS:
    area_layer_ids = []
    for idx, (lid, lname, crop) in enumerate(area_def["layers"]):
        LAYERS[lid] = FarmLayer(
            id=lid,
            area_id=area_def["id"],
            area_name=area_def["name"],
            name=lname,
            crop=crop,
            status=LayerStatus.healthy,
            health_score=90 + (idx % 3) * 2,
            main_risk=None,
            devices=DeviceState(),
        )
        area_layer_ids.append(lid)

        # Generate diverse sensor profiles per layer
        recipe = RECIPES[crop]
        mid_t = sum(recipe.temperature_range) / 2
        mid_h = sum(recipe.humidity_range) / 2
        mid_m = sum(recipe.soil_moisture_range) / 2
        mid_ph = sum(recipe.ph_range) / 2
        mid_l = sum(recipe.light_range) / 2

        _base_profiles[lid] = {
            "temperature": round(mid_t + (idx - 2) * 0.8, 1),
            "humidity": round(mid_h + (idx - 2) * 2.0, 1),
            "soil_moisture": round(mid_m + (idx - 2) * 1.5, 1),
            "ph": round(mid_ph + (idx - 2) * 0.1, 2),
            "light_intensity": round(mid_l + (idx - 2) * 30, 1),
            "water_level": round(80 - idx * 2, 1),
        }

    AREAS[area_def["id"]] = Area(
        id=area_def["id"],
        name=area_def["name"],
        layer_ids=area_layer_ids,
    )

# Give Area B layer b_02 a default warning state for demo
LAYERS["b_02"].status = LayerStatus.warning
LAYERS["b_02"].health_score = 74
LAYERS["b_02"].main_risk = "Humidity trending high"


# ── Data stores ──────────────────────────────────────────────────

READINGS: dict[str, deque[SensorReading]] = defaultdict(lambda: deque(maxlen=120))
ALERTS: deque[Alert] = deque(maxlen=80)
RECOMMENDATIONS: deque[Recommendation] = deque(maxlen=80)


# ── Helpers ──────────────────────────────────────────────────────

def get_recipe_for_layer(layer_id: str) -> CropRecipe:
    layer = LAYERS[layer_id]
    return RECIPES[layer.crop]


def get_base_profile(layer_id: str) -> dict:
    return _base_profiles.get(layer_id, {})


def save_reading(reading: SensorReading) -> None:
    READINGS[reading.layer_id].append(reading)
    LAYERS[reading.layer_id].latest_reading = reading


def latest_alerts(limit: int = 20) -> list[Alert]:
    seen = set()
    unique = []
    for alert in reversed(ALERTS):
        key = (alert.layer_id, alert.title, alert.predictive)
        if key in seen:
            continue
        seen.add(key)
        unique.append(alert)
        if len(unique) >= limit:
            break
    return unique


def latest_recommendations(limit: int = 20) -> list[Recommendation]:
    seen = set()
    unique = []
    for recommendation in reversed(RECOMMENDATIONS):
        key = (recommendation.layer_id, recommendation.action)
        if key in seen:
            continue
        seen.add(key)
        unique.append(recommendation)
        if len(unique) >= limit:
            break
    return unique


def sustainability_snapshot() -> SustainabilitySnapshot:
    auto_layers = sum(1 for layer in LAYERS.values() if layer.devices.auto_mode)
    health_avg = sum(layer.health_score for layer in LAYERS.values()) / len(LAYERS)
    score = min(100, round(health_avg * 0.7 + auto_layers * 2))
    return SustainabilitySnapshot(
        water_saved_liters=128.5 * len(LAYERS) / 3,
        energy_optimized_kwh=31.2 * len(LAYERS) / 3,
        estimated_cost_reduction_rm=46.8 * len(LAYERS) / 3,
        sustainability_score=score,
    )


def seed_latest_readings() -> None:
    if any(READINGS.values()):
        return

    now = datetime.now(timezone.utc)
    for lid, profile in _base_profiles.items():
        reading = SensorReading(
            layer_id=lid,
            temperature=profile["temperature"],
            humidity=profile["humidity"],
            soil_moisture=profile["soil_moisture"],
            ph=profile["ph"],
            light_intensity=profile["light_intensity"],
            water_level=profile["water_level"],
            timestamp=now,
        )
        save_reading(reading)
