"""Farm layout registry — area and layer definitions with sensor profiles.

This module owns the static layout of the farm:
  - AREA_DEFS : raw configuration of areas and their layers
  - LAYERS    : pre-built FarmLayer objects (mutable at runtime)
  - AREAS     : pre-built Area objects

It also computes a *base sensor profile* for each layer. The profile
provides the "typical" reading values derived from the midpoint of
each crop recipe range, with small per-layer offsets for diversity.

Downstream consumers import LAYERS / AREAS from ``app.store`` (which
re-exports them from here) so that all state access goes through a
single module.
"""

from app.core.crop_config import RECIPES
from app.schemas import (
    Area,
    DeviceState,
    FarmLayer,
    LayerStatus,
)


# ── Area definitions (raw config) ────────────────────────────────
# Each area contains a list of (layer_id, display_name, crop_name) tuples.

AREA_DEFS: list[dict] = [
    {
        "id": "area_a",
        "name": "Area A — Leafy Greens Wing",
        "layers": [
            ("a_01", "A-1", "Lettuce"),
            ("a_02", "A-2", "Lettuce"),
            ("a_03", "A-3", "Spinach"),
            ("a_04", "A-4", "Spinach"),
            ("a_05", "A-5", "Lettuce"),
        ],
    },
    {
        "id": "area_b",
        "name": "Area B — Herbs Wing",
        "layers": [
            ("b_01", "B-1", "Basil"),
            ("b_02", "B-2", "Basil"),
            ("b_03", "B-3", "Mint"),
            ("b_04", "B-4", "Mint"),
            ("b_05", "B-5", "Basil"),
        ],
    },
    {
        "id": "area_c",
        "name": "Area C — Fruits Wing",
        "layers": [
            ("c_01", "C-1", "Strawberry"),
            ("c_02", "C-2", "Strawberry"),
            ("c_03", "C-3", "Tomato"),
            ("c_04", "C-4", "Tomato"),
            ("c_05", "C-5", "Strawberry"),
        ],
    },
]


def _build_base_profile(crop: str, layer_index: int) -> dict[str, float]:
    """Compute the default sensor profile for a layer.

    The profile is centered on the midpoint of each recipe range,
    then offset slightly by ``layer_index`` to create realistic
    variation across layers growing the same crop.

    Args:
        crop: The crop name (must exist in RECIPES).
        layer_index: Zero-based position of this layer within its area.

    Returns:
        A dict with keys matching SensorReading fields and float values.
    """
    recipe = RECIPES[crop]
    offset = layer_index - 2  # layers 0–4 → offsets -2 to +2

    return {
        "temperature": round(sum(recipe.temperature_range) / 2 + offset * 0.8, 1),
        "humidity": round(sum(recipe.humidity_range) / 2 + offset * 2.0, 1),
        "soil_moisture": round(sum(recipe.soil_moisture_range) / 2 + offset * 1.5, 1),
        "ph": round(sum(recipe.ph_range) / 2 + offset * 0.1, 2),
        "light_intensity": round(sum(recipe.light_range) / 2 + offset * 30, 1),
        "water_level": round(80 - layer_index * 2, 1),
    }


def build_farm() -> tuple[dict[str, FarmLayer], dict[str, Area], dict[str, dict]]:
    """Construct all LAYERS, AREAS, and base sensor profiles from AREA_DEFS.

    Returns:
        A 3-tuple of:
          - layers: ``{layer_id: FarmLayer}``
          - areas:  ``{area_id: Area}``
          - profiles: ``{layer_id: {sensor_field: value}}``
    """
    layers: dict[str, FarmLayer] = {}
    areas: dict[str, Area] = {}
    profiles: dict[str, dict] = {}

    for area_def in AREA_DEFS:
        area_layer_ids: list[str] = []

        for idx, (lid, lname, crop) in enumerate(area_def["layers"]):
            layers[lid] = FarmLayer(
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
            profiles[lid] = _build_base_profile(crop, idx)

        areas[area_def["id"]] = Area(
            id=area_def["id"],
            name=area_def["name"],
            layer_ids=area_layer_ids,
        )

    # Demo override: give Area B layer b_02 a warning state for demo purposes
    if "b_02" in layers:
        layers["b_02"].status = LayerStatus.warning
        layers["b_02"].health_score = 74
        layers["b_02"].main_risk = "Humidity trending high"

    return layers, areas, profiles
