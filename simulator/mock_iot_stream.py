"""Mock IoT stream — pushes synthetic sensor data to the CropTwin AI backend.

Supports a closed-loop feedback: fetches device states from the backend
and adjusts simulated readings accordingly (fan lowers humidity, pump
raises soil moisture, etc.).
"""

import argparse
import asyncio
import math
import random
from datetime import datetime, timezone

import httpx

# ── Layer profiles (will be fetched from backend on startup) ─────

LAYER_PROFILES: dict[str, dict] = {}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def generate_reading(layer_id: str, tick: int, scenario: str, devices: dict) -> dict:
    base = LAYER_PROFILES[layer_id]

    fan_on = devices.get("fan", False)
    pump_on = devices.get("pump", False)
    misting_on = devices.get("misting", False)

    scenario_fan_active = scenario == "fan_activated" and layer_id in ("b_01", "b_02")

    if fan_on or scenario_fan_active:
        base["humidity"] -= 2.0
        base["temperature"] -= 0.5
    else:
        if scenario == "high_humidity" and layer_id in ("b_01", "b_02"):
            base["humidity"] += 1.5

    if pump_on:
        base["soil_moisture"] += 3.0
    else:
        if scenario == "low_moisture" and layer_id in ("a_01", "a_02"):
            base["soil_moisture"] -= 1.0
        else:
            base["soil_moisture"] -= 0.2

    if misting_on:
        base["humidity"] += 1.0
        base["temperature"] -= 0.2

    if scenario == "ph_drift" and layer_id in ("c_01", "c_02"):
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


async def init_profiles(client: httpx.AsyncClient, api_base_url: str) -> None:
    """Fetch layer list from backend and build initial sensor profiles."""
    resp = await client.get(f"{api_base_url}/api/layers")
    resp.raise_for_status()
    layers = resp.json()

    for layer in layers:
        lid = layer["id"]
        reading = layer.get("latest_reading") or {}
        LAYER_PROFILES[lid] = {
            "temperature": reading.get("temperature", 22.0),
            "humidity": reading.get("humidity", 55.0),
            "soil_moisture": reading.get("soil_moisture", 60.0),
            "ph": reading.get("ph", 6.2),
            "light_intensity": reading.get("light_intensity", 650.0),
            "water_level": reading.get("water_level", 80.0),
        }
    print(f"Initialized {len(LAYER_PROFILES)} layer profiles from backend")


async def run_stream(api_base_url: str, scenario: str, interval: float, once: bool) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        # Dynamically load layer profiles from backend
        await init_profiles(client, api_base_url)

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

                # Auto mode feedback loop
                if devices.get("auto_mode") and layer_id in ("b_01", "b_02"):
                    current_humidity = LAYER_PROFILES[layer_id]["humidity"]
                    if current_humidity > 75 and not devices.get("fan"):
                        try:
                            await client.post(f"{api_base_url}/api/ai/execute-safe-command",
                                              json={"layer_id": layer_id, "device": "fan", "value": True, "duration_minutes": 5})
                            devices["fan"] = True
                        except Exception:
                            pass
                    elif current_humidity < 60 and devices.get("fan"):
                        try:
                            await client.post(f"{api_base_url}/api/ai/execute-safe-command",
                                              json={"layer_id": layer_id, "device": "fan", "value": False, "duration_minutes": 0})
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
                    print(f"Warning: Could not post reading for {layer_id}: {e}")
            tick += 1
            if once:
                print("One-shot telemetry validation complete")
                return
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
    parser.add_argument(
        "--once",
        action="store_true",
        help="Send one reading per layer, then exit. Useful for smoke-testing the IoT pipeline.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(run_stream(args.api_base_url, args.scenario, args.interval, args.once))
