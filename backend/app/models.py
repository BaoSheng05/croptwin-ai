"""SQLAlchemy ORM models — persistent tables for readings, alerts, recommendations."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Boolean, Text
from app.database import Base


class SensorReadingDB(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    layer_id = Column(String(20), nullable=False, index=True)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    soil_moisture = Column(Float, nullable=False)
    ph = Column(Float, nullable=False)
    light_intensity = Column(Float, nullable=False)
    water_level = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class AlertDB(Base):
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True)
    layer_id = Column(String(20), nullable=False, index=True)
    severity = Column(String(10), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    predictive = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class RecommendationDB(Base):
    __tablename__ = "recommendations"

    id = Column(String(36), primary_key=True)
    layer_id = Column(String(20), nullable=False, index=True)
    action = Column(String(200), nullable=False)
    reason = Column(Text, nullable=False)
    priority = Column(String(10), nullable=False)
    confidence = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class DeviceLogDB(Base):
    __tablename__ = "device_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    layer_id = Column(String(20), nullable=False, index=True)
    device = Column(String(20), nullable=False)
    value = Column(String(10), nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
