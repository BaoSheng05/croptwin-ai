from app.store import LAYERS

def validate_device_command(layer_id: str, device: str, value: bool | int, duration_minutes: int | None) -> dict:
    if layer_id not in LAYERS:
        return {"valid": False, "reason": "Unknown layer."}
    
    layer = LAYERS[layer_id]
    reading = layer.latest_reading
    
    if device == "none":
        return {"valid": False, "reason": "No device command."}

    boolean_devices = {"fan", "pump", "misting"}
    climate_devices = {"climate_heating", "climate_cooling"}
    if device not in {*boolean_devices, *climate_devices, "led_intensity"}:
        return {"valid": False, "reason": "Unknown device."}

    # led_intensity must be 0 to 100
    if device == "led_intensity":
        if type(value) is not int or not (0 <= value <= 100):
            return {"valid": False, "reason": "LED intensity must be between 0 and 100."}
    elif device in boolean_devices:
        if type(value) is not bool:
            return {"valid": False, "reason": f"{device} value must be a boolean."}
    elif device in climate_devices:
        if type(value) is not int or not (0 <= value <= 3):
            return {"valid": False, "reason": f"{device} value must be an integer level from 0 to 3."}

    if device == "climate_heating" and isinstance(value, int) and value > 0 and layer.devices.climate_cooling:
        return {"valid": False, "reason": "Cannot turn on climate heating while climate cooling is on."}

    if device == "climate_cooling" and isinstance(value, int) and value > 0 and layer.devices.climate_heating:
        return {"valid": False, "reason": "Cannot turn on climate cooling while climate heating is on."}

    # pump duration max 5 minutes
    if device == "pump" and value is True:
        if duration_minutes is None or duration_minutes > 5:
            return {"valid": False, "reason": "Pump duration cannot exceed 5 minutes."}



    # misting cannot turn on if humidity > 75
    if device == "misting" and value is True:
        if reading and reading.humidity > 75:
            return {"valid": False, "reason": "Cannot turn on misting when humidity is above 75%."}

    return {"valid": True, "reason": "Command is safe."}
