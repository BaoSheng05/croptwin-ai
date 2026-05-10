"""Pure-function tests for :mod:`app.services.market` scoring helpers."""

from __future__ import annotations

import unittest

from app.services.market import (
    _base_score,
    _clamp_score,
    _default_analysis,
    _estimate_aqi_from_pm25,
    _extract_source_from_google_title,
    _safe_json,
)


class ScoringHelperTests(unittest.TestCase):
    def test_clamp_score_bounds(self) -> None:
        self.assertEqual(_clamp_score(-10), 0)
        self.assertEqual(_clamp_score(0), 0)
        self.assertEqual(_clamp_score(50.4), 50)
        self.assertEqual(_clamp_score(99.6), 100)
        self.assertEqual(_clamp_score(250), 100)

    def test_aqi_breakpoints_match_epa_ranges(self) -> None:
        # Good (0–50): PM2.5 of 0 → 0; PM2.5 of 12 → ~50.
        self.assertEqual(_estimate_aqi_from_pm25(0), 0)
        self.assertLessEqual(abs(_estimate_aqi_from_pm25(12) - 50), 1)
        # Moderate (51–100) ends near 100.
        self.assertGreaterEqual(_estimate_aqi_from_pm25(35), 95)
        self.assertLessEqual(_estimate_aqi_from_pm25(35), 100)
        # Unhealthy for sensitive (101–150): PM2.5 of 55 ~149.
        aqi_55 = _estimate_aqi_from_pm25(55)
        self.assertGreaterEqual(aqi_55, 145)
        self.assertLessEqual(aqi_55, 151)
        # Unhealthy (151–200): PM2.5 of 100 ~ ~174.
        aqi_100 = _estimate_aqi_from_pm25(100)
        self.assertGreaterEqual(aqi_100, 165)
        self.assertLessEqual(aqi_100, 185)
        # Hazardous: very large PM2.5 must still be capped at 500.
        self.assertEqual(_estimate_aqi_from_pm25(10_000), 500)

    def test_safe_json_returns_fallback_on_invalid(self) -> None:
        self.assertEqual(_safe_json("", []), [])
        self.assertEqual(_safe_json("not-json", {"k": 1}), {"k": 1})
        self.assertEqual(_safe_json('[1,2,3]', []), [1, 2, 3])

    def test_extract_source_from_google_title(self) -> None:
        headline, source = _extract_source_from_google_title("Big farm news - The Star")
        self.assertEqual(headline, "Big farm news")
        self.assertEqual(source, "The Star")

        headline, source = _extract_source_from_google_title("No separator headline")
        self.assertEqual(headline, "No separator headline")
        self.assertIsNone(source)


class CityAnalysisTests(unittest.TestCase):
    CITY = {
        "id": "demo",
        "city_name": "Demo City",
        "state": "Demo",
        "lat": 0.0,
        "lon": 0.0,
        "land": 500,
        "living": 70,
        "infra": 90,
        "conv": 88,
        "transport": 92,
    }

    def test_base_score_returns_breakdown_and_overall(self) -> None:
        overall, breakdown = _base_score(self.CITY, aqi=60)
        self.assertGreaterEqual(overall, 0)
        self.assertLessEqual(overall, 100)
        for key in (
            "land_price", "air_quality", "living_cost",
            "infrastructure", "convenience", "transportation_delivery",
            "market_potential",
        ):
            self.assertIn(key, breakdown)
            self.assertGreaterEqual(breakdown[key], 0)
            self.assertLessEqual(breakdown[key], 100)

    def test_default_analysis_is_local_estimate_and_has_strengths(self) -> None:
        analysis = _default_analysis(self.CITY, aqi=60)
        self.assertEqual(analysis["mode"], "local_estimate")
        self.assertIn("Strong urban infrastructure and commercial readiness", analysis["strengths"])
        self.assertTrue(analysis["risks"])  # non-empty


if __name__ == "__main__":
    unittest.main()
