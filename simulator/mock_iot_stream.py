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


def generate_reading(layer_id: str, tick: int, scenario: str) -> dict:
    base = LAYER_PROFILES[layer_id].copy()
    wave = math.sin(tick / 6)

    base["temperature"] += wave * 1.4 + random.uniform(-0.3, 0.3)
    base["humidity"] += wave * 2.0 + random.uniform(-1.0, 1.0)
    base["soil_moisture"] += math.cos(tick / 7) * 1.5 + random.uniform(-0.8, 0.8)
    base["ph"] += math.sin(tick / 8) * 0.08 + random.uniform(-0.03, 0.03)
    base["light_intensity"] += random.uniform(-25, 25)
    base["water_level"] -= tick * 0.02

    if scenario == "high_humidity" and layer_id == "layer_02":
        base["humidity"] += min(26, tick * 1.2)
    elif scenario == "low_moisture" and layer_id == "layer_01":
        base["soil_moisture"] -= min(28, tick * 1.1)
    elif scenario == "ph_drift" and layer_id == "layer_03":
        base["ph"] += min(1.4, tick * 0.04)
    elif scenario == "fan_activated" and layer_id == "layer_02":
        base["humidity"] += max(0, 22 - tick * 1.5)

    return {
        "layer_id": layer_id,
        "temperature": round(clamp(base["temperature"], -20, 80), 2),
        "humidity": round(clamp(base["humidity"], 0, 100), 2),
        "soil_moisture": round(clamp(base["soil_moisture"], 0, 100), 2),
        "ph": round(clamp(base["ph"], 0, 14), 2),
        "light_intensity": round(clamp(base["light_intensity"], 0, 2000), 2),
        "water_level": round(clamp(base["water_level"], 0, 100), 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def run_stream(api_base_url: str, scenario: str, interval: float) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        tick = 0
        while True:
            for layer_id in LAYER_PROFILES:
                reading = generate_reading(layer_id, tick, scenario)
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
