"""SQLAlchemy ORM models — persistent tables for sensor data, alerts, and logs.

These models mirror the Pydantic schemas in ``app.schemas`` but are used
for long-term SQLite storage. The in-memory deques in ``app.store`` hold
the recent rolling window; these tables hold the full history.

Table summary:
  - sensor_readings  : every ingested sensor reading
  - alerts           : every generated alert (predictive or threshold)
  - recommendations  : every AI recommendation
  - device_logs      : every manual or AI-triggered device command
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text

from app.database import Base


class SensorReadingDB(Base):
    """Persisted sensor reading from a single farm layer at a point in time."""

    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    layer_id = Column(String(20), nullable=False, index=True)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    soil_moisture = Column(Float, nullable=False)
    ph = Column(Float, nullable=False)
    light_intensity = Column(Float, nullable=False)
    water_level = Column(Float, nullable=False)
    timestamp = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    def __repr__(self) -> str:
        return (
            f"<SensorReadingDB id={self.id} layer={self.layer_id} "
            f"temp={self.temperature}°C @ {self.timestamp}>"
        )


class AlertDB(Base):
    """Persisted alert record — threshold breach or predictive warning."""

    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True)
    layer_id = Column(String(20), nullable=False, index=True)
    severity = Column(String(10), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    predictive = Column(Boolean, default=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    def __repr__(self) -> str:
        return (
            f"<AlertDB id={self.id[:8]}… layer={self.layer_id} "
            f"severity={self.severity} title='{self.title}'>"
        )


class RecommendationDB(Base):
    """Persisted AI-generated recommendation for a farm layer."""

    __tablename__ = "recommendations"

    id = Column(String(36), primary_key=True)
    layer_id = Column(String(20), nullable=False, index=True)
    action = Column(String(200), nullable=False)
    reason = Column(Text, nullable=False)
    priority = Column(String(10), nullable=False)
    confidence = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    def __repr__(self) -> str:
        return (
            f"<RecommendationDB id={self.id[:8]}… layer={self.layer_id} "
            f"action='{self.action}' priority={self.priority}>"
        )


class DeviceLogDB(Base):
    """Persisted log entry for a device command (manual or AI-triggered)."""

    __tablename__ = "device_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    layer_id = Column(String(20), nullable=False, index=True)
    device = Column(String(20), nullable=False)
    value = Column(String(10), nullable=False)
    timestamp = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    def __repr__(self) -> str:
        return (
            f"<DeviceLogDB id={self.id} layer={self.layer_id} "
            f"device={self.device} value={self.value}>"
        )


class FarmLayoutDB(Base):
    """Persisted owner-defined farm layout."""

    __tablename__ = "farm_layout"

    id = Column(Integer, primary_key=True, default=1)
    area_count = Column(Integer, nullable=False, default=3)
    layers_per_area = Column(Integer, nullable=False, default=5)
    default_crop = Column(String(60), nullable=False, default="Lettuce")
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class YieldSetupDB(Base):
    """Persisted manual grow-plan inputs for one farm layer."""

    __tablename__ = "yield_setups"

    layer_id = Column(String(20), primary_key=True)
    crop = Column(String(60), nullable=False)
    rows = Column(Integer, nullable=False, default=3)
    columns = Column(Integer, nullable=False, default=6)
    rack_layers = Column(Integer, nullable=False, default=1)
    farm_area_m2 = Column(Float, nullable=False, default=2.0)
    price_rm_per_kg = Column(Float, nullable=False, default=12.0)
    expected_kg_per_plant = Column(Float, nullable=False, default=0.08)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class HarvestLogDB(Base):
    """Persisted manual harvest record."""

    __tablename__ = "harvest_logs"

    id = Column(String(80), primary_key=True)
    layer_id = Column(String(20), nullable=False, index=True)
    layer_name = Column(String(60), nullable=False)
    crop = Column(String(60), nullable=False)
    kg = Column(Float, nullable=False)
    revenue_rm = Column(Float, nullable=False)
    harvested_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )


class UserPreferenceDB(Base):
    """Persisted small user preference payloads as JSON strings."""

    __tablename__ = "user_preferences"

    key = Column(String(80), primary_key=True)
    value_json = Column(Text, nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

class MarketCityDB(Base):
    __tablename__ = "market_cities"

    id = Column(String(80), primary_key=True)
    city_name = Column(String(120), nullable=False, index=True)
    state = Column(String(120), nullable=False, index=True)
    land_price_value = Column(Float, nullable=False, default=0)
    land_price_unit = Column(String(60), nullable=False, default="RM per sq ft")
    land_price_source = Column(Text, nullable=False, default="")
    land_price_confidence = Column(String(40), nullable=False, default="estimated")
    air_pollution_index = Column(Float, nullable=False, default=0)
    air_pollution_source = Column(Text, nullable=False, default="")
    living_cost_index = Column(Float, nullable=False, default=0)
    living_cost_source = Column(Text, nullable=False, default="")
    infrastructure_score = Column(Integer, nullable=False, default=0)
    convenience_score = Column(Integer, nullable=False, default=0)
    transportation_delivery_score = Column(Integer, nullable=False, default=0)
    overall_score = Column(Integer, nullable=False, default=0)
    analysis_summary = Column(Text, nullable=False, default="")
    score_breakdown_json = Column(Text, nullable=False, default="{}")
    strengths_json = Column(Text, nullable=False, default="[]")
    risks_json = Column(Text, nullable=False, default="[]")
    recommendation = Column(Text, nullable=False, default="")
    raw_data_json = Column(Text, nullable=False, default="{}")
    last_updated = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        index=True,
    )


class MarketCityNewsDB(Base):
    __tablename__ = "market_city_news"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city_id = Column(String(80), ForeignKey("market_cities.id"), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    url = Column(Text, nullable=False)
    source = Column(String(160), nullable=False, default="Google News")
    published_at = Column(String(120), nullable=False, default="")

