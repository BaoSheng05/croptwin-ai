from uuid import uuid4

from app.schemas import CropRecipe, Recommendation, SensorReading


def generate_recommendation(reading: SensorReading, recipe: CropRecipe) -> Recommendation:
    if reading.humidity > recipe.humidity_range[1]:
        return Recommendation(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            action="Turn on fan for 20 minutes",
            reason="This gives the strongest humidity risk reduction while keeping energy cost acceptable.",
            priority="high",
            confidence=88,
        )

    if reading.soil_moisture < recipe.soil_moisture_range[0]:
        return Recommendation(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            action="Start pump for 2 minutes",
            reason="Soil moisture is below the crop recipe range and irrigation should recover root-zone moisture.",
            priority="high",
            confidence=84,
        )

    if reading.ph < recipe.ph_range[0] or reading.ph > recipe.ph_range[1]:
        return Recommendation(
            id=str(uuid4()),
            layer_id=reading.layer_id,
            action="Check nutrient mix and adjust pH",
            reason="The current pH has drifted outside the crop recipe and can reduce nutrient uptake.",
            priority="medium",
            confidence=78,
        )

    return Recommendation(
        id=str(uuid4()),
        layer_id=reading.layer_id,
        action="Keep current climate recipe",
        reason="Sensor readings are within the ideal crop range.",
        priority="low",
        confidence=72,
    )
