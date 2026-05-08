from datetime import datetime, timedelta, timezone

from app.core.config import get_settings
from app.services.climate import weather_snapshot
from app.store import LAYERS, get_recipe_for_layer, seed_latest_readings


def tariff_profile() -> dict:
    settings = get_settings()
    local_hour = (datetime.now(timezone.utc) + timedelta(hours=8)).hour
    if 18 <= local_hour < 22:
        return {
            "period": "Peak",
            "rate_rm_per_kwh": settings.tariff_peak_rate_rm,
            "next_low_cost_window": "22:00-08:00",
            "source": "configured_time_of_use_tariff",
        }
    if 6 <= local_hour < 18:
        return {
            "period": "Shoulder",
            "rate_rm_per_kwh": settings.tariff_shoulder_rate_rm,
            "next_low_cost_window": "22:00-08:00",
            "source": "configured_time_of_use_tariff",
        }
    return {
        "period": "Off-peak",
        "rate_rm_per_kwh": settings.tariff_offpeak_rate_rm,
        "next_low_cost_window": "Now until 08:00",
        "source": "configured_time_of_use_tariff",
    }


def lighting_strategy_profile() -> dict:
    local_hour = (datetime.now(timezone.utc) + timedelta(hours=8)).hour
    if 6 <= local_hour < 18:
        return {
            "mode": "Sunlight-first",
            "window": "06:00-18:00",
            "led_policy": "Use weather-adjusted sunlight first; LED only fills the crop light deficit.",
            "hvac_policy": "Keep HVAC minimal unless heat or humidity leaves the crop recipe range.",
            "target_dli_shift": "Push non-urgent growth lighting to 22:00-06:00.",
        }
    if 18 <= local_hour < 22:
        return {
            "mode": "Minimal LED",
            "window": "18:00-22:00",
            "led_policy": "Avoid heavy LED during the expensive evening window; maintain only a low safety level.",
            "hvac_policy": "Use the smallest HVAC correction needed for crop safety.",
            "target_dli_shift": "Wait for off-peak night lighting unless the crop is below its minimum light band.",
        }
    return {
        "mode": "Off-peak growth lighting",
        "window": "22:00-06:00",
        "led_policy": "Use cheaper electricity for planned supplemental growth lighting.",
        "hvac_policy": "Run HVAC as needed to keep night temperature and humidity in recipe range.",
        "target_dli_shift": "Recover the daytime light deficit while tariffs are low.",
    }


def energy_optimizer_snapshot() -> dict:
    seed_latest_readings()
    tariff = tariff_profile()
    strategy = lighting_strategy_profile()
    weather = weather_snapshot()
    total_led_kw = 0.0
    hvac_kw = 0.0
    layer_plans = []

    for layer in LAYERS.values():
        recipe = get_recipe_for_layer(layer.id)
        reading = layer.latest_reading
        light = reading.light_intensity if reading else sum(recipe.light_range) / 2
        weather_adjusted_light = light * weather["sunlight_factor"]
        natural_light_ratio = max(0, min(100, round((weather_adjusted_light / max(recipe.light_range[1], 1)) * 100)))
        base_led_kw = 0.22
        current_led_kw = base_led_kw * (layer.devices.led_intensity / 100)
        light_deficit_ratio = max(0, min(1, (recipe.light_range[0] - weather_adjusted_light) / max(recipe.light_range[0], 1)))
        fill_light_target = round(25 + light_deficit_ratio * 65)

        if strategy["mode"] == "Sunlight-first":
            target_led = max(10, min(45, fill_light_target if weather_adjusted_light < recipe.light_range[0] else 15))
        elif strategy["mode"] == "Minimal LED":
            target_led = max(15, min(35, fill_light_target if weather_adjusted_light < recipe.light_range[0] * 0.75 else 20))
        else:
            target_led = min(
                95,
                max(60, fill_light_target, layer.devices.led_intensity + 10 if weather_adjusted_light < recipe.light_range[0] else 65),
            )

        optimized_kw = base_led_kw * (target_led / 100)
        climate_level = layer.devices.climate_heating + layer.devices.climate_cooling
        reading_temp = reading.temperature if reading else sum(recipe.temperature_range) / 2
        reading_humidity = reading.humidity if reading else sum(recipe.humidity_range) / 2
        hvac_recommended_level = 0
        if reading_temp > recipe.temperature_range[1] + 1.5 or reading_temp < recipe.temperature_range[0] - 1.5:
            hvac_recommended_level = 1 if strategy["mode"] != "Off-peak growth lighting" else 2
        if reading_humidity > recipe.humidity_range[1] + 8:
            hvac_recommended_level = max(hvac_recommended_level, 1)

        hvac_layer_kw = 0.35 * climate_level
        optimized_hvac_kw = 0.35 * hvac_recommended_level
        total_led_kw += current_led_kw
        hvac_kw += hvac_layer_kw

        layer_plans.append({
            "layer_id": layer.id,
            "layer_name": layer.name,
            "crop": layer.crop,
            "natural_light_ratio": natural_light_ratio,
            "weather_adjusted_light_lux": round(weather_adjusted_light, 1),
            "current_led_percent": layer.devices.led_intensity,
            "recommended_led_percent": target_led,
            "recommended_hvac_level": hvac_recommended_level,
            "current_kw": round(current_led_kw + hvac_layer_kw, 2),
            "optimized_kw": round(optimized_kw + optimized_hvac_kw, 2),
            "reason": (
                "Sunlight-first: weather-adjusted natural light covers most crop demand, so LED stays low."
                if strategy["mode"] == "Sunlight-first" and weather_adjusted_light >= recipe.light_range[0]
                else "Sunlight-first: clouds reduce natural light, so LED only fills the deficit."
                if strategy["mode"] == "Sunlight-first"
                else "Minimal LED: avoid expensive evening load and defer growth lighting to off-peak night."
                if strategy["mode"] == "Minimal LED"
                else "Off-peak growth lighting: use cheaper night electricity to recover the light target."
            ),
        })

    current_kw = total_led_kw + hvac_kw
    optimized_kw = sum(plan["optimized_kw"] for plan in layer_plans)
    savings_kw = max(0, current_kw - optimized_kw)
    daily_savings_rm = savings_kw * tariff["rate_rm_per_kwh"] * 8
    return {
        "tariff": tariff,
        "strategy": strategy,
        "weather": weather,
        "current_kw": round(current_kw, 2),
        "optimized_kw": round(optimized_kw, 2),
        "savings_kw": round(savings_kw, 2),
        "estimated_daily_savings_rm": round(daily_savings_rm, 2),
        "estimated_monthly_savings_rm": round(daily_savings_rm * 30, 2),
        "recommendation": f"{strategy['mode']} mode is active. {strategy['led_policy']} {strategy['target_dli_shift']}",
        "layer_plans": layer_plans,
    }
