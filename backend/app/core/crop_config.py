"""Crop recipe definitions — static configuration for each supported crop type.

Each recipe defines the ideal sensor ranges for a crop. These are used
throughout the system to:
  - Evaluate layer health scores (services/health.py)
  - Generate alerts when readings deviate from ideal ranges
  - Build AI diagnosis prompts
  - Guide the nutrient automation engine

Adding a new crop:
  1. Add a CropRecipe entry to RECIPES below.
  2. Reference the crop name in an area definition (core/farm_registry.py).
"""

from app.schemas import CropRecipe

# ── Crop Recipes ─────────────────────────────────────────────────
# Each recipe describes the optimal environmental ranges for a crop.
# Ranges are (min, max) tuples in the units shown:
#   temperature   : °C
#   humidity      : % RH
#   soil_moisture : % volumetric
#   ph            : pH units
#   light         : lux

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


def get_recipe(crop_name: str) -> CropRecipe:
    """Return the CropRecipe for the given crop name.

    Raises:
        KeyError: If the crop name does not exist in RECIPES.
    """
    return RECIPES[crop_name]
