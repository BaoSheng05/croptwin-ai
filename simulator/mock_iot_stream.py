import argparse
import asyncio
import math
import random
from datetime import datetime, timezone

import httpx

LAYER_PROFILES = {
    "layer_01": {
        "temperature": 22.4,
        "humidity": 58.0,
        "soil_moisture": 68.0,
        "ph": 6.1,
        "light_intensity": 620.0,
        "water_level": 82.0,
    },
    "layer_02": {
        "temperature": 27.2,
        "humidity": 66.0,
        "soil_moisture": 52.0,
        "ph": 6.6,
        "light_intensity": 720.0,
        "water_level": 72.0,
    },
    "layer_03": {
        "temperature": 23.6,
        "humidity": 61.0,
        "soil_moisture": 63.0,
        "ph": 6.2,
        "light_intensity": 840.0,
        "water_level": 78.0,
    },
}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def generate_reading(layer_id: str, tick: int, scenario: str, devices: dict) -> dict:
    base = LAYER_PROFILES[layer_id]
    
    fan_on = devices.get("fan", False)
    pump_on = devices.get("pump", False)
    misting_on = devices.get("misting", False)

    if fan_on:
        base["humidity"] -= 2.0
        base["temperature"] -= 0.5
    else:
        if scenario == "high_humidity" and layer_id == "layer_02":
            base["humidity"] += 1.5

    if pump_on:
        base["soil_moisture"] += 3.0
    else:
        if scenario == "low_moisture" and layer_id == "layer_01":
            base["soil_moisture"] -= 1.0
        else:
            base["soil_moisture"] -= 0.2

    if misting_on:
        base["humidity"] += 1.0
        base["temperature"] -= 0.2

    if scenario == "ph_drift" and layer_id == "layer_03":
        base["ph"] += 0.05

    base["humidity"] = clamp(base["humidity"], 30, 95)
    base["soil_moisture"] = clamp(base["soil_moisture"], 10, 90)
    base["temperature"] = clamp(base["temperature"], 10, 45)
    base["ph"] = clamp(base["ph"], 3.0, 10.0)
    
    base["water_level"] -= 0.1
    if base["water_level"] < 5:
        base["water_level"] = 100

    wave = math.sin(tick / 6)

    temp = base["temperature"] + wave * 1.4 + random.uniform(-0.3, 0.3)
    hum = base["humidity"] + wave * 2.0 + random.uniform(-1.0, 1.0)
    moist = base["soil_moisture"] + math.cos(tick / 7) * 1.5 + random.uniform(-0.8, 0.8)
    ph = base["ph"] + math.sin(tick / 8) * 0.08 + random.uniform(-0.03, 0.03)
    light = base["light_intensity"] + random.uniform(-25, 25)

    return {
        "layer_id": layer_id,
        "temperature": round(clamp(temp, -20, 80), 2),
        "humidity": round(clamp(hum, 0, 100), 2),
        "soil_moisture": round(clamp(moist, 0, 100), 2),
        "ph": round(clamp(ph, 0, 14), 2),
        "light_intensity": round(clamp(light, 0, 2000), 2),
        "water_level": round(clamp(base["water_level"], 0, 100), 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def run_stream(api_base_url: str, scenario: str, interval: float) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        tick = 0
        while True:
            try:
                layers_resp = await client.get(f"{api_base_url}/api/layers")
                layers_resp.raise_for_status()
                backend_layers = {layer["id"]: layer for layer in layers_resp.json()}
            except Exception as e:
                print(f"Warning: Could not fetch layer state: {e}")
                backend_layers = {}

            for layer_id in LAYER_PROFILES:
                devices = backend_layers.get(layer_id, {}).get("devices", {})
                
                # Auto mode feedback loop - triggers real device commands
                if devices.get("auto_mode") and layer_id == "layer_02":
                    current_humidity = LAYER_PROFILES[layer_id]["humidity"]
                    if current_humidity > 75 and not devices.get("fan"):
                        try:
                            await client.post(f"{api_base_url}/api/devices/commands", json={"layer_id": layer_id, "device": "fan", "value": True})
                            devices["fan"] = True
                        except Exception:
                            pass
                    elif current_humidity < 60 and devices.get("fan"):
                        try:
                            await client.post(f"{api_base_url}/api/devices/commands", json={"layer_id": layer_id, "device": "fan", "value": False})
                            devices["fan"] = False
                        except Exception:
                            pass

                reading = generate_reading(layer_id, tick, scenario, devices)
                
                try:
                    response = await client.post(f"{api_base_url}/api/sensors/readings", json=reading)
                    response.raise_for_status()
                    event = response.json()
                    recommendation = event.get("recommendation") or {}
                    print(
                        f"{reading['timestamp']} {layer_id} "
                        f"health={event['data']['health_score']} "
                        f"humidity={reading['humidity']} "
                        f"action={recommendation.get('action', 'none')}"
                    )
                except Exception as e:
                    print(f"Warning: Could not post reading: {e}")
            tick += 1
            await asyncio.sleep(interval)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Mock CropTwin AI IoT stream")
    parser.add_argument("--api-base-url", default="http://localhost:8000")
    parser.add_argument(
        "--scenario",
        choices=["normal", "high_humidity", "low_moisture", "ph_drift", "fan_activated"],
        default="normal",
    )
    parser.add_argument("--interval", type=float, default=2.0)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(run_stream(args.api_base_url, args.scenario, args.interval))
