"""Tests for :mod:`app.services.historical` against an in-memory SQLite DB."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import AlertDB, DeviceLogDB, SensorReadingDB
from app.services.historical import (
    database_stats,
    historical_alerts,
    historical_device_logs,
    historical_readings,
)


class HistoricalQueriesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self) -> None:
        self.db = self.Session()

    def tearDown(self) -> None:
        for model in (AlertDB, SensorReadingDB, DeviceLogDB):
            self.db.query(model).delete()
        self.db.commit()
        self.db.close()

    def test_database_stats_empty(self) -> None:
        stats = database_stats(self.db)
        self.assertEqual(stats["total_readings"], 0)
        self.assertEqual(stats["total_alerts"], 0)
        self.assertEqual(stats["total_device_logs"], 0)
        self.assertNotIn("database_error", stats)

    def test_historical_readings_filters_by_layer(self) -> None:
        now = datetime.now(timezone.utc)
        self.db.add_all([
            SensorReadingDB(
                layer_id="a_01", temperature=22.0, humidity=60.0,
                soil_moisture=50.0, ph=6.5, light_intensity=300,
                water_level=80, timestamp=now,
            ),
            SensorReadingDB(
                layer_id="b_02", temperature=24.0, humidity=65.0,
                soil_moisture=55.0, ph=6.4, light_intensity=320,
                water_level=78, timestamp=now,
            ),
        ])
        self.db.commit()

        rows = historical_readings(self.db, "a_01", limit=10)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["layer_id"], "a_01")

    def test_historical_alerts_orders_newest_first(self) -> None:
        older = datetime(2024, 1, 1, tzinfo=timezone.utc)
        newer = datetime(2024, 6, 1, tzinfo=timezone.utc)
        self.db.add_all([
            AlertDB(id="a", layer_id="x", severity="warning",
                    title="Old", message="m", predictive=False, created_at=older),
            AlertDB(id="b", layer_id="x", severity="warning",
                    title="New", message="m", predictive=False, created_at=newer),
        ])
        self.db.commit()

        rows = historical_alerts(self.db, limit=10)
        self.assertEqual([row["title"] for row in rows], ["New", "Old"])

    def test_historical_device_logs_returns_empty_for_empty_db(self) -> None:
        self.assertEqual(historical_device_logs(self.db, limit=10), [])


if __name__ == "__main__":
    unittest.main()
