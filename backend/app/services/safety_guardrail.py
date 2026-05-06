from app.store import LAYERS

def validate_device_command(layer_id: str, device: str, value: bool | int, duration_minutes: int | None) -> dict:
    if layer_id not in LAYERS:
        return {"valid": False, "reason": "Unknown layer."}
    
    layer = LAYERS[layer_id]
    reading = layer.latest_reading
    
    if device == "none":
        return {"valid": False, "reason": "No device command."}

    if device not in ["fan", "pump", "misting", "climate_heating", "climate_cooling", "led_intensity"]:
        return {"valid": False, "reason": "Unknown device."}

    # led_intensity must be 0 to 100
    if device == "led_intensity":
        if type(value) is not int or not (0 <= value <= 100):
            return {"valid": False, "reason": "LED intensity must be between 0 and 100."}
    else:
        if type(value) is not bool:
            return {"valid": False, "reason": f"{device} value must be a boolean."}

    # pump duration max 5 minutes
    if device == "pump" and value is True:
        if duration_minutes is None or duration_minutes > 5:
            return {"valid": False, "reason": "Pump duration cannot exceed 5 minutes."}

    if device in {"climate_heating", "climate_cooling"} and value is True:
        if duration_minutes is None or duration_minutes > 30:
            return {"valid": False, "reason": "Climate control duration cannot exceed 30 minutes."}

    # misting cannot turn on if humidity > 75
    if device == "misting" and value is True:
        if reading and reading.humidity > 75:
            return {"valid": False, "reason": "Cannot turn on misting when humidity is above 75%."}

    return {"valid": True, "reason": "Command is safe."}
