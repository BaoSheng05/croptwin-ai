"""In-memory state container for the CropTwin AI backend.

This module is the single source of truth for all *live* runtime state:
  - LAYERS     : mutable FarmLayer objects (populated by farm_registry)
  - AREAS      : immutable Area definitions (populated by farm_registry)
  - READINGS   : rolling sensor history per layer (deque, max 120 each)
  - ALERTS     : rolling alert buffer (deque, max 80)
  - RECOMMENDATIONS : rolling recommendation buffer (deque, max 80)
  - AI_CONTROL_DECISIONS : latest AI decision per layer

Static configuration (crop recipes, area definitions) lives in
``app.core.crop_config`` and ``app.core.farm_registry``.

All downstream modules should import state objects from this module
rather than from the core modules directly, to keep a clean dependency
graph and make future migration (e.g. to Redis) straightforward.
"""

from collections import defaultdict, deque
from datetime import datetime, timezone

from app.core.crop_config import RECIPES
from app.core.farm_registry import build_farm
from app.schemas import (
    Alert,
    Area,
    CropRecipe,
    FarmLayer,
    Recommendation,
    SensorReading,
    SustainabilitySnapshot,
)

# ── Initialise farm layout ───────────────────────────────────────
# build_farm() reads the static config and produces mutable layer
# objects, area objects, and base sensor profiles.

LAYERS, AREAS, _BASE_PROFILES = build_farm()

# Re-export RECIPES so existing consumers can still do:
#   from app.store import RECIPES
RECIPES = RECIPES  # noqa: F811 — intentional re-export


# ── Live data stores ─────────────────────────────────────────────

READINGS: dict[str, deque[SensorReading]] = defaultdict(
    lambda: deque(maxlen=120)
)
"""Rolling sensor readings per layer (most recent 120 per layer)."""

ALERTS: deque[Alert] = deque(maxlen=80)
"""Global rolling alert buffer (most recent 80 alerts)."""

RECOMMENDATIONS: deque[Recommendation] = deque(maxlen=80)
"""Global rolling recommendation buffer (most recent 80)."""

AI_CONTROL_DECISIONS: dict[str, object] = {}
"""Latest AI control decision payload per layer_id."""


# ── Accessor helpers ─────────────────────────────────────────────


def get_recipe_for_layer(layer_id: str) -> CropRecipe:
    """Look up the crop recipe for the given layer.

    Args:
        layer_id: The layer identifier (e.g. ``"a_01"``).

    Returns:
        The CropRecipe for that layer's assigned crop.

    Raises:
        KeyError: If ``layer_id`` is not in LAYERS or its crop
                  is not in RECIPES.
    """
    layer = LAYERS[layer_id]
    return RECIPES[layer.crop]


def get_base_profile(layer_id: str) -> dict:
    """Return the baseline sensor profile for a layer.

    The profile provides the "typical" sensor values used to
    seed initial readings and as a baseline for demo scenarios.

    Args:
        layer_id: The layer identifier.

    Returns:
        A dict of sensor field names → float values, or empty
        dict if the layer_id is unknown.
    """
    return _BASE_PROFILES.get(layer_id, {})


# ── Mutation helpers ─────────────────────────────────────────────


def save_reading(reading: SensorReading) -> None:
    """Append a sensor reading to the rolling buffer and update the layer.

    This is the canonical way to record a new reading — it keeps both
    the READINGS deque and the layer's ``latest_reading`` in sync.

    Args:
        reading: The SensorReading to record.
    """
    READINGS[reading.layer_id].append(reading)
    LAYERS[reading.layer_id].latest_reading = reading


# ── Query helpers ────────────────────────────────────────────────


def latest_alerts(limit: int = 20) -> list[Alert]:
    """Return up to ``limit`` most recent unique alerts.

    Uniqueness is determined by (layer_id, title, predictive).
    Newer alerts take priority.

    Args:
        limit: Maximum number of alerts to return.

    Returns:
        A list of Alert objects, newest first.
    """
    seen: set[tuple] = set()
    unique: list[Alert] = []

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
    """Return up to ``limit`` most recent unique recommendations.

    Uniqueness is determined by (layer_id, action).
    Newer recommendations take priority.

    Args:
        limit: Maximum number of recommendations to return.

    Returns:
        A list of Recommendation objects, newest first.
    """
    seen: set[tuple] = set()
    unique: list[Recommendation] = []

    for recommendation in reversed(RECOMMENDATIONS):
        key = (recommendation.layer_id, recommendation.action)
        if key in seen:
            continue
        seen.add(key)
        unique.append(recommendation)
        if len(unique) >= limit:
            break

    return unique


# ── Computed snapshots ───────────────────────────────────────────


def sustainability_snapshot() -> SustainabilitySnapshot:
    """Compute a point-in-time sustainability score for the whole farm.

    The score blends average layer health (70% weight) with a bonus
    for layers running in auto mode (2 pts each, capped at 100).

    Returns:
        A SustainabilitySnapshot with water, energy, cost, and score.
    """
    auto_layers = sum(1 for layer in LAYERS.values() if layer.devices.auto_mode)
    health_avg = sum(layer.health_score for layer in LAYERS.values()) / len(LAYERS)
    score = min(100, round(health_avg * 0.7 + auto_layers * 2))

    return SustainabilitySnapshot(
        water_saved_liters=round(128.5 * len(LAYERS) / 3, 1),
        energy_optimized_kwh=round(31.2 * len(LAYERS) / 3, 1),
        estimated_cost_reduction_rm=round(46.8 * len(LAYERS) / 3, 1),
        sustainability_score=score,
    )


# ── Startup seeding ─────────────────────────────────────────────


def seed_latest_readings() -> None:
    """Populate initial sensor readings if the store is empty.

    Called once at application startup to ensure every layer has at
    least one reading derived from its base sensor profile. This is
    idempotent — subsequent calls are no-ops if READINGS already has data.
    """
    if any(READINGS.values()):
        return

    now = datetime.now(timezone.utc)
    for lid, profile in _BASE_PROFILES.items():
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
