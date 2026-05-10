"""Urban expansion what-if model.

Given a fixed catalogue of candidate Malaysian/regional sites, this
module scores each site against the current climate-risk snapshot and
returns a ranked recommendation suitable for the dashboard's
“Expansion” card. There are no external dependencies beyond the
climate service — the math is intentionally simple and deterministic.
"""

from datetime import datetime, timezone

from app.services.climate import climate_risk_snapshot


URBAN_SITE_PROFILES = {
    "Johor Bahru": {
        "land_cost_index": 42,
        "rent_rm_m2_month": 28,
        "electricity_index": 48,
        "air_pollution_index": 46,
        "market_demand_index": 72,
        "policy_support_index": 66,
        "logistics_index": 82,
        "climate_risk_index": 58,
        "notes": "Lower land cost and close access to Singapore demand.",
    },
    "Kuala Lumpur": {
        "land_cost_index": 68,
        "rent_rm_m2_month": 52,
        "electricity_index": 52,
        "air_pollution_index": 62,
        "market_demand_index": 84,
        "policy_support_index": 70,
        "logistics_index": 78,
        "climate_risk_index": 55,
        "notes": "Strong urban demand but higher rent pressure.",
    },
    "Singapore": {
        "land_cost_index": 95,
        "rent_rm_m2_month": 138,
        "electricity_index": 74,
        "air_pollution_index": 35,
        "market_demand_index": 96,
        "policy_support_index": 88,
        "logistics_index": 92,
        "climate_risk_index": 42,
        "notes": "High food security demand, very high land cost.",
    },
    "Bangkok": {
        "land_cost_index": 61,
        "rent_rm_m2_month": 45,
        "electricity_index": 55,
        "air_pollution_index": 78,
        "market_demand_index": 86,
        "policy_support_index": 60,
        "logistics_index": 75,
        "climate_risk_index": 67,
        "notes": "Large market, but air quality and heat risk require stronger filtration.",
    },
    "Dubai": {
        "land_cost_index": 76,
        "rent_rm_m2_month": 92,
        "electricity_index": 63,
        "air_pollution_index": 58,
        "market_demand_index": 90,
        "policy_support_index": 82,
        "logistics_index": 80,
        "climate_risk_index": 85,
        "notes": "Premium produce demand, but cooling load is the main risk.",
    },
}


def _deployment_mode_for_site(profile: dict) -> str:
    """Pick a deployment archetype label based on the site profile."""
    if profile["land_cost_index"] >= 85:
        return "Micro vertical farm / supermarket in-store farm"
    if profile["market_demand_index"] >= 85 and profile["rent_rm_m2_month"] < 70:
        return "Warehouse-scale leafy green hub"
    if profile["air_pollution_index"] >= 70:
        return "Sealed indoor farm with upgraded filtration"
    if profile["climate_risk_index"] >= 75:
        return "High-insulation indoor farm with climate buffering"
    return "Modular rooftop or shoplot vertical farm"


def urban_expansion_whatif() -> dict:
    """Return a ranked expansion-suitability snapshot for the dashboard.

    Combines the static :data:`URBAN_SITE_PROFILES` catalogue with the
    current climate-risk score so sites are penalised when the local
    forecast is unfavourable.
    """
    climate = climate_risk_snapshot()
    climate_penalty = 0
    if climate["overall_risk"] == "High":
        climate_penalty = 5
    elif climate["overall_risk"] == "Critical":
        climate_penalty = 10

    sites = []
    for city, profile in URBAN_SITE_PROFILES.items():
        affordability = 100 - profile["land_cost_index"]
        operating_cost = 100 - profile["electricity_index"]
        clean_air_need = profile["air_pollution_index"]
        score = round(
            profile["market_demand_index"] * 0.28
            + profile["policy_support_index"] * 0.18
            + profile["logistics_index"] * 0.16
            + affordability * 0.16
            + operating_cost * 0.10
            + (100 - profile["climate_risk_index"]) * 0.08
            + (100 - clean_air_need) * 0.04
            - (climate_penalty if city in {"Johor Bahru", "Kuala Lumpur"} else 0)
        )
        capex_pressure = "High" if profile["land_cost_index"] > 75 else "Medium" if profile["land_cost_index"] > 55 else "Low"
        payback_months = round(max(8, 34 - score * 0.24 + profile["rent_rm_m2_month"] * 0.06), 1)
        sites.append({
            "city": city,
            **profile,
            "expansion_score": max(0, min(100, score)),
            "deployment_mode": _deployment_mode_for_site(profile),
            "capex_pressure": capex_pressure,
            "estimated_payback_months": payback_months,
            "recommendation": (
                "Recommended first expansion candidate."
                if score >= 76 and capex_pressure != "High"
                else "Good strategic market, but use a smaller footprint first."
                if score >= 72
                else "Pilot only; validate cost and demand before scaling."
            ),
        })

    sites.sort(key=lambda item: item["expansion_score"], reverse=True)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": "Urban Expansion What-if v1",
        "summary": "Compares land pressure, pollution, electricity cost, climate risk, demand, logistics, and policy support.",
        "best_city": sites[0]["city"],
        "best_deployment_mode": sites[0]["deployment_mode"],
        "sites": sites,
        "owner_takeaway": [
            "High land-cost cities should use micro or in-store farms instead of warehouse farms.",
            "Lower-rent cities near premium demand can host warehouse-scale production.",
            "Polluted or hot cities require sealed farms, filtration, and stronger climate buffering.",
        ],
    }
