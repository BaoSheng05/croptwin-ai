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

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text

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
