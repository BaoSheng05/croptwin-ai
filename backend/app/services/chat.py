import re
from app.schemas import ChatResponse
from app.store import LAYERS, latest_alerts, latest_recommendations, get_recipe_for_layer, sustainability_snapshot

def answer_farm_question(question: str, layer_id: str | None = None) -> ChatResponse:
    q = question.lower()
    
    # Detect layer references
    target_id = layer_id
    for cid, layer in LAYERS.items():
        if cid.lower() in q or layer.name.lower() in q or layer.crop.lower() in q:
            target_id = cid
            break

    # If no layer specific question, handle general intents
    if "auto mode" in q or "auto" in q:
        return ChatResponse(
            answer="Auto mode allows CropTwin AI to take physical action automatically. For example, if humidity climbs above 75%, it will automatically activate the fan to lower it without waiting for manual intervention. This preserves crop health and prevents critical damage.",
            referenced_layers=list(LAYERS.keys()) if not target_id else [target_id]
        )

    if "sustainab" in q or "water" in q or "energy" in q:
        sus = sustainability_snapshot()
        return ChatResponse(
            answer=f"The farm has saved {sus.water_saved_liters:.1f} liters of water and optimized {sus.energy_optimized_kwh:.1f} kWh of energy, saving approximately RM {sus.estimated_cost_reduction_rm:.2f}. The overall sustainability score is {sus.sustainability_score}/100.",
            referenced_layers=[]
        )

    if ("summary" in q or "overall" in q) and target_id is None:
        avg = round(sum(layer.health_score for layer in LAYERS.values()) / len(LAYERS))
        active_alerts = len(latest_alerts())
        return ChatResponse(
            answer=f"The farm average health score is {avg}. There are {active_alerts} recent alerts across all layers. Keep an eye on any layer with a health score dropping below 80.",
            referenced_layers=list(LAYERS.keys())
        )

    # If we couldn't infer a specific layer and it's not a generic question, default to layer_02 or the first one with issues
    if target_id is None:
        target_id = next((l.id for l in LAYERS.values() if l.health_score < 80), "layer_01")

    # Layer specific logic
    layer = LAYERS[target_id]
    reading = layer.latest_reading
    recipe = get_recipe_for_layer(target_id)
    recommendation = next((item for item in latest_recommendations() if item.layer_id == target_id), None)
    alert = next((item for item in latest_alerts() if item.layer_id == target_id), None)

    if reading is None:
        return ChatResponse(
            answer=f"{layer.name} is currently offline. No sensor readings have arrived yet.",
            referenced_layers=[target_id]
        )

    # Intent: what happens if ignored
    if "ignore" in q or "happen" in q:
        issue = ""
        risk = "reduce crop health"
        if reading.humidity > recipe.humidity_range[1]:
            issue = f"humidity is currently {reading.humidity:.0f}%, which is far above {recipe.crop}'s ideal range of {recipe.humidity_range[0]}% to {recipe.humidity_range[1]}%"
            risk = "increase fungal risk and reduce crop health"
        elif reading.soil_moisture < recipe.soil_moisture_range[0]:
            issue = f"soil moisture is currently {reading.soil_moisture:.0f}%, which is below {recipe.crop}'s ideal range"
            risk = "cause wilting and permanent root damage"
        else:
            issue = "the climate"
            
        rec_action = recommendation.action if recommendation else "monitor the situation"
        answer = f"{layer.name} is growing {recipe.crop}. Its {issue}. If ignored, this may {risk}. The recommended action is to {rec_action.lower()}. This should gradually lower risk and improve the health score."
        return ChatResponse(answer=answer, referenced_layers=[target_id])

    # Intent: what should i do / recommend
    if "do next" in q or "recommend" in q or "action" in q:
        if recommendation:
            return ChatResponse(
                answer=f"Based on {layer.name}'s current sensor readings, I recommend: '{recommendation.action}'. {recommendation.reason}",
                referenced_layers=[target_id]
            )
        return ChatResponse(
            answer=f"{layer.name} is doing well. No immediate action is required right now.",
            referenced_layers=[target_id]
        )

    # Intent: why warning / alert
    if "why" in q or "alert" in q or "warning" in q:
        if alert:
            return ChatResponse(
                answer=f"{layer.name} triggered an alert: '{alert.title}'. {alert.message} Current health score has dropped to {layer.health_score}.",
                referenced_layers=[target_id]
            )
        return ChatResponse(
            answer=f"{layer.name} does not have any critical warnings right now. Its status is {layer.status.value}.",
            referenced_layers=[target_id]
        )

    # Default Intent: Status
    alert_text = f" Note: {alert.title}." if alert else ""
    return ChatResponse(
        answer=(
            f"{layer.name} is growing {recipe.crop}. Its health score is {layer.health_score} ({layer.status.value}). "
            f"Currently: {reading.temperature:.1f}°C, {reading.humidity:.0f}% humidity, "
            f"{reading.soil_moisture:.0f}% soil moisture, and pH {reading.ph:.1f}.{alert_text}"
        ),
        referenced_layers=[target_id]
    )
