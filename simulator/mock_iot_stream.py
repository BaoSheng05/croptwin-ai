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

RECIPES: dict[str, dict[str, tuple[float, float]]] = {
    "Lettuce": {"temperature": (16, 24), "humidity": (50, 70), "moisture": (55, 80)},
    "Basil": {"temperature": (21, 28), "humidity": (40, 60), "moisture": (45, 70)},
    "Strawberry": {"temperature": (18, 26), "humidity": (45, 65), "moisture": (50, 75)},
    "Spinach": {"temperature": (15, 22), "humidity": (45, 65), "moisture": (50, 75)},
    "Mint": {"temperature": (18, 25), "humidity": (50, 70), "moisture": (55, 80)},
    "Tomato": {"temperature": (20, 30), "humidity": (40, 60), "moisture": (50, 70)},
}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def generate_reading(layer_id: str, tick: int, scenario: str, devices: dict) -> dict:
    base = LAYER_PROFILES[layer_id]

    fan_on = devices.get("fan", False)
    pump_on = devices.get("pump", False)
    misting_on = devices.get("misting", False)
    climate_heating_on = devices.get("climate_heating", False)
    climate_cooling_on = devices.get("climate_cooling", False)
    led_intensity = clamp(float(devices.get("led_intensity", 70)), 0, 100)

    scenario_fan_active = scenario == "fan_activated" and layer_id in ("b_01", "b_02")

    # Fan: indoor vertical farm fan only ventilates — reduces humidity, not temperature
    if fan_on or scenario_fan_active:
        base["humidity"] -= 2.0
        base["temperature"] -= 0.1  # negligible air-circulation cooling only
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
        base["temperature"] -= 0.1

    if climate_heating_on and not climate_cooling_on:
        base["temperature"] += 1.2
    elif climate_cooling_on and not climate_heating_on:
        base["temperature"] -= 1.8
        base["humidity"] -= 0.4

    # LED heat effect: high-power LEDs generate heat, low LEDs lose ambient warmth
    if led_intensity >= 90:
        base["temperature"] += 0.4
    elif led_intensity >= 70:
        base["temperature"] += 0.1
    elif led_intensity <= 40:
        base["temperature"] -= 0.2

    # LED drives light intensity
    target_light = 250 + led_intensity * 7.5
    base["light_intensity"] += (target_light - base["light_intensity"]) * 0.25

    if scenario == "ph_drift" and layer_id in ("c_01", "c_02"):
        base["ph"] += 0.05

    base["humidity"] = clamp(base["humidity"], 30, 95)
    base["soil_moisture"] = clamp(base["soil_moisture"], 10, 90)
    base["temperature"] = clamp(base["temperature"], 15, 45)
    base["ph"] = clamp(base["ph"], 3.0, 10.0)
    base["light_intensity"] = clamp(base["light_intensity"], 0, 2000)

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
                if devices.get("auto_mode"):
                    layer = backend_layers.get(layer_id, {})
                    crop = layer.get("crop")
                    recipe = RECIPES.get(crop, {})
                    current = LAYER_PROFILES[layer_id]
                    temp_range = recipe.get("temperature")
                    humidity_range = recipe.get("humidity")
                    moisture_range = recipe.get("moisture")

                    if temp_range and current["temperature"] > temp_range[1] and not devices.get("climate_cooling"):
                        try:
                            await client.post(f"{api_base_url}/api/ai/execute-safe-command",
                                              json={"layer_id": layer_id, "device": "climate_cooling", "value": True, "duration_minutes": 5})
                            devices["climate_cooling"] = True
                            devices["climate_heating"] = False
                        except Exception:
                            pass
                    elif temp_range and current["temperature"] < temp_range[0] and not devices.get("climate_heating"):
                        try:
                            await client.post(f"{api_base_url}/api/ai/execute-safe-command",
                                              json={"layer_id": layer_id, "device": "climate_heating", "value": True, "duration_minutes": 5})
                            devices["climate_heating"] = True
                            devices["climate_cooling"] = False
                        except Exception:
                            pass
                    elif temp_range and temp_range[0] <= current["temperature"] <= temp_range[1]:
                        for climate_device in ("climate_heating", "climate_cooling"):
                            if devices.get(climate_device):
                                try:
                                    await client.post(f"{api_base_url}/api/ai/execute-safe-command",
                                                      json={"layer_id": layer_id, "device": climate_device, "value": False, "duration_minutes": 0})
                                    devices[climate_device] = False
                                except Exception:
                                    pass

                    if humidity_range and current["humidity"] > humidity_range[1] and not devices.get("fan"):
                        try:
                            await client.post(f"{api_base_url}/api/ai/execute-safe-command",
                                              json={"layer_id": layer_id, "device": "fan", "value": True, "duration_minutes": 5})
                            devices["fan"] = True
                        except Exception:
                            pass
                    elif humidity_range and current["humidity"] <= humidity_range[1] and devices.get("fan"):
                        try:
                            await client.post(f"{api_base_url}/api/ai/execute-safe-command",
                                              json={"layer_id": layer_id, "device": "fan", "value": False, "duration_minutes": 0})
                            devices["fan"] = False
                        except Exception:
                            pass

                    if moisture_range and current["soil_moisture"] < moisture_range[0] and not devices.get("pump"):
                        try:
                            await client.post(f"{api_base_url}/api/ai/execute-safe-command",
                                              json={"layer_id": layer_id, "device": "pump", "value": True, "duration_minutes": 2})
                            devices["pump"] = True
                        except Exception:
                            pass
                    elif moisture_range and current["soil_moisture"] >= moisture_range[0] and devices.get("pump"):
                        try:
                            await client.post(f"{api_base_url}/api/ai/execute-safe-command",
                                              json={"layer_id": layer_id, "device": "pump", "value": False, "duration_minutes": 0})
                            devices["pump"] = False
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
                        f"temp={reading['temperature']} "
                        f"humidity={reading['humidity']} "
                        f"moisture={reading['soil_moisture']} "
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
