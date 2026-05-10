"""End-to-end tests for the sensor ingestion endpoint.

These exercise both the new exception envelope (404 for unknown layer)
and the happy-path return shape from
:func:`app.services.sensor_pipeline.process_reading`.
"""

from __future__ import annotations

import os
import unittest

# Use an isolated SQLite file for the test app's lifespan.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_croptwin.db")

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.store import LAYERS


def _sample_payload(layer_id: str) -> dict:
    """Build a minimal valid SensorReading payload."""
    return {
        "layer_id": layer_id,
        "temperature": 22.5,
        "humidity": 65.0,
        "soil_moisture": 60.0,
        "ph": 6.4,
        "light_intensity": 320.0,
        "water_level": 80.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


class SensorIngestionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)
        cls.client.__enter__()  # trigger FastAPI lifespan startup

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.__exit__(None, None, None)
        # Clean up the test SQLite file we created.
        try:
            os.remove("./test_croptwin.db")
        except OSError:
            pass

    def test_unknown_layer_returns_404_envelope(self) -> None:
        response = self.client.post(
            "/api/sensors/readings",
            json=_sample_payload("does-not-exist"),
        )
        self.assertEqual(response.status_code, 404)
        body = response.json()
        self.assertEqual(body["error"]["code"], "not_found")
        self.assertIn("layer_id", body["error"]["details"])

    def test_valid_layer_returns_layer_update_event(self) -> None:
        layer_id = next(iter(LAYERS.keys()))
        response = self.client.post(
            "/api/sensors/readings",
            json=_sample_payload(layer_id),
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["event"], "layer_update")
        self.assertEqual(body["data"]["id"], layer_id)
        self.assertIn("resolved_alert_ids", body)


if __name__ == "__main__":
    unittest.main()
