"""Historical (SQLite) read queries used by the dashboard.

These helpers wrap the persistence-layer queries so the
:mod:`app.api.db_router` module stays a thin HTTP boundary.

Each helper degrades gracefully on database errors: it logs the failure
and returns an empty result rather than raising, because dashboards
should keep rendering even if a single query fails.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import AlertDB, DeviceLogDB, RecommendationDB, SensorReadingDB

logger = logging.getLogger(__name__)


def _format_db_error(exc: Exception) -> str:
    """Return a single-line, length-bounded representation of a DB error."""
    return str(exc).splitlines()[0][:200]


def database_stats(db: Session) -> dict[str, Any]:
    """Return row counts across the persistent tables for the dashboard."""
    base = {
        "total_readings": 0,
        "total_alerts": 0,
        "total_recommendations": 0,
        "total_device_logs": 0,
        "database": "SQLite (croptwin.db)",
    }
    try:
        base.update({
            "total_readings": db.query(func.count(SensorReadingDB.id)).scalar() or 0,
            "total_alerts": db.query(func.count(AlertDB.id)).scalar() or 0,
            "total_recommendations": db.query(func.count(RecommendationDB.id)).scalar() or 0,
            "total_device_logs": db.query(func.count(DeviceLogDB.id)).scalar() or 0,
        })
        return base
    except SQLAlchemyError as exc:
        db.rollback()
        logger.warning("Failed to query DB stats: %s", _format_db_error(exc))
        return {**base, "database_error": _format_db_error(exc)}


def historical_readings(db: Session, layer_id: str, limit: int) -> list[dict[str, Any]]:
    """Return recent persisted sensor readings for ``layer_id``."""
    try:
        rows = (
            db.query(SensorReadingDB)
            .filter(SensorReadingDB.layer_id == layer_id)
            .order_by(SensorReadingDB.timestamp.desc())
            .limit(limit)
            .all()
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.warning(
            "Failed to query readings for %s: %s", layer_id, _format_db_error(exc),
        )
        return []

    return [
        {
            "id": row.id,
            "layer_id": row.layer_id,
            "temperature": row.temperature,
            "humidity": row.humidity,
            "soil_moisture": row.soil_moisture,
            "ph": row.ph,
            "light_intensity": row.light_intensity,
            "water_level": row.water_level,
            "timestamp": row.timestamp.isoformat() if row.timestamp else None,
        }
        for row in rows
    ]


def historical_alerts(db: Session, limit: int) -> list[dict[str, Any]]:
    """Return the most recent persisted alerts."""
    try:
        rows = (
            db.query(AlertDB)
            .order_by(AlertDB.created_at.desc())
            .limit(limit)
            .all()
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.warning("Failed to query alerts: %s", _format_db_error(exc))
        return []

    return [
        {
            "id": row.id,
            "layer_id": row.layer_id,
            "severity": row.severity,
            "title": row.title,
            "message": row.message,
            "predictive": row.predictive,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


def historical_device_logs(db: Session, limit: int) -> list[dict[str, Any]]:
    """Return the most recent persisted device command logs."""
    try:
        rows = (
            db.query(DeviceLogDB)
            .order_by(DeviceLogDB.timestamp.desc())
            .limit(limit)
            .all()
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.warning("Failed to query device logs: %s", _format_db_error(exc))
        return []

    return [
        {
            "id": row.id,
            "layer_id": row.layer_id,
            "device": row.device,
            "value": row.value,
            "timestamp": row.timestamp.isoformat() if row.timestamp else None,
        }
        for row in rows
    ]
