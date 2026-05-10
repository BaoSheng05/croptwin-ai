"""Determinism + structural tests for the what-if simulator."""

from __future__ import annotations

import unittest

from app.services.whatif import simulate_whatif
from app.store import LAYERS, seed_latest_readings


class WhatIfSimulatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        seed_latest_readings()
        cls.layer_id = next(iter(LAYERS.keys()))

    def test_response_shape(self) -> None:
        result = simulate_whatif(self.layer_id, hours=12, action="none")
        self.assertEqual(result.layer_id, self.layer_id)
        # baseline and intervention must include hour 0 .. hours inclusive.
        self.assertEqual(len(result.baseline), 13)
        self.assertEqual(len(result.intervention), 13)
        self.assertEqual(result.baseline[0].hour, 0)
        self.assertEqual(result.baseline[-1].hour, 12)
        # health scores must stay within bounds
        for point in result.baseline + result.intervention:
            self.assertGreaterEqual(point.health_score, 0)
            self.assertLessEqual(point.health_score, 100)

    def test_simulation_is_deterministic(self) -> None:
        first = simulate_whatif(self.layer_id, hours=6, action="fan")
        second = simulate_whatif(self.layer_id, hours=6, action="fan")
        self.assertEqual(
            [(p.hour, p.health_score) for p in first.intervention],
            [(p.hour, p.health_score) for p in second.intervention],
        )

    def test_action_label_is_human_readable(self) -> None:
        result = simulate_whatif(self.layer_id, hours=6, action="pump")
        self.assertEqual(result.action_label, "Turn on water pump now")

    def test_health_delta_matches_final_difference(self) -> None:
        result = simulate_whatif(self.layer_id, hours=8, action="misting")
        self.assertEqual(
            result.health_delta,
            result.intervention_final_health - result.baseline_final_health,
        )


if __name__ == "__main__":
    unittest.main()
