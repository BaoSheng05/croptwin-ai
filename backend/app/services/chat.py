from app.schemas import ChatResponse
from app.store import LAYERS, latest_alerts, latest_recommendations


def answer_farm_question(question: str, layer_id: str | None = None) -> ChatResponse:
    normalized = question.lower()
    target_id = layer_id

    if target_id is None:
        for candidate_id, layer in LAYERS.items():
            if candidate_id.lower() in normalized or layer.name.lower() in normalized:
                target_id = candidate_id
                break

    if target_id is None:
        avg = round(sum(layer.health_score for layer in LAYERS.values()) / len(LAYERS))
        active_alerts = len(latest_alerts())
        return ChatResponse(
            answer=f"The farm average health score is {avg}. There are {active_alerts} recent alerts. Layer 2 is the main watch area because humidity has been trending high.",
            referenced_layers=list(LAYERS.keys()),
        )

    layer = LAYERS[target_id]
    reading = layer.latest_reading
    recommendation = next((item for item in latest_recommendations() if item.layer_id == target_id), None)
    alert = next((item for item in latest_alerts() if item.layer_id == target_id), None)

    if reading is None:
        return ChatResponse(
            answer=f"{layer.name} is currently offline because no sensor readings have arrived yet.",
            referenced_layers=[target_id],
        )

    alert_text = f" The latest alert is: {alert.title}." if alert else " No active issue is currently detected."
    rec_text = f" I recommend: {recommendation.action}." if recommendation else ""
    return ChatResponse(
        answer=(
            f"{layer.name} is growing {layer.crop}. Its health score is {layer.health_score} and status is {layer.status.value}. "
            f"Latest readings are {reading.temperature:.1f} C, {reading.humidity:.0f}% humidity, "
            f"{reading.soil_moisture:.0f}% soil moisture, and pH {reading.ph:.1f}."
            f"{alert_text}{rec_text}"
        ),
        referenced_layers=[target_id],
    )
