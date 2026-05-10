"""Tests for :func:`app.services.demo_scenarios.apply_scenario`."""

from __future__ import annotations

import asyncio
import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_demo_scenario.db")

from app.database import Base, SessionLocal, engine, init_db
from app.services.demo_scenarios import apply_scenario, build_scenario_reading
from app.store import ALERTS, LAYERS, RECOMMENDATIONS, seed_latest_readings


class DemoScenarioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        Base.metadata.create_all(engine)
        init_db()
        seed_latest_readings()
        cls.layer_id = next(iter(LAYERS.keys()))

    @classmethod
    def tearDownClass(cls) -> None:
        try:
            os.remove("./test_demo_scenario.db")
        except OSError:
            pass

    def setUp(self) -> None:
        self.db = SessionLocal()

    def tearDown(self) -> None:
        self.db.close()

    def test_build_scenario_reading_high_humidity_pushes_humidity_above_recipe(self) -> None:
        reading = build_scenario_reading(self.layer_id, "high_humidity")
        self.assertEqual(reading.layer_id, self.layer_id)
        self.assertGreater(reading.humidity, 80)

    def test_apply_normal_scenario_clears_alerts_for_layer(self) -> None:
        # Pre-populate a fake alert/recommendation for the target layer.
        from app.schemas import Alert
        from datetime import datetime, timezone

        ALERTS.append(
            Alert(
                id="dummy-alert",
                layer_id=self.layer_id,
                severity="warning",
                title="dummy",
                message="dummy",
                predictive=False,
                created_at=datetime.now(timezone.utc),
            )
        )
        result = asyncio.run(apply_scenario(self.layer_id, "normal", self.db))

        self.assertTrue(result["ok"])
        self.assertEqual(result["scenario"], "normal")
        self.assertIsNone(result["alert"])
        self.assertIsNone(result["recommendation"])
        # No alerts/recommendations remain for this layer.
        self.assertFalse([a for a in ALERTS if a.layer_id == self.layer_id])
        self.assertFalse([r for r in RECOMMENDATIONS if r.layer_id == self.layer_id])

    def test_apply_high_humidity_returns_layer_payload(self) -> None:
        result = asyncio.run(apply_scenario(self.layer_id, "high_humidity", self.db))
        self.assertTrue(result["ok"])
        self.assertEqual(result["scenario"], "high_humidity")
        self.assertEqual(result["layer"]["id"], self.layer_id)
        # impact + energy snapshots are always returned.
        self.assertIn("impact", result)
        self.assertIn("energy", result)


if __name__ == "__main__":
    unittest.main()
