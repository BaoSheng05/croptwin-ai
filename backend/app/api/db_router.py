"""Database-backed historical query endpoints.

These endpoints query the SQLite database directly (not the in-memory
store) to provide persistent historical data. They are used by the
frontend to show trends, historical alerts, and device command logs.

All queries are wrapped in try/except to gracefully handle database
errors without crashing the API.
"""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AlertDB, DeviceLogDB, RecommendationDB, SensorReadingDB

logger = logging.getLogger(__name__)

router = APIRouter()


def _format_db_error(exc: Exception) -> str:
    """Extract a concise, single-line error message from a database exception.

    Args:
        exc: The caught SQLAlchemy exception.

    Returns:
        A truncated first line of the error (max 200 chars).
    """
    return str(exc).splitlines()[0][:200]


# ── Database Statistics ──────────────────────────────────────────


@router.get("/db/stats")
def db_stats(db: Session = Depends(get_db)) -> dict:
    """Return row counts for all persistent tables.

    This endpoint proves that the system is actually writing to
    the SQLite database — useful for demos and debugging.
    """
    try:
        return {
            "total_readings": db.query(func.count(SensorReadingDB.id)).scalar() or 0,
            "total_alerts": db.query(func.count(AlertDB.id)).scalar() or 0,
            "total_recommendations": db.query(func.count(RecommendationDB.id)).scalar() or 0,
            "total_device_logs": db.query(func.count(DeviceLogDB.id)).scalar() or 0,
            "database": "SQLite (croptwin.db)",
        }
    except SQLAlchemyError as exc:
        db.rollback()
        logger.warning("Failed to query DB stats: %s", _format_db_error(exc))
        return {
            "total_readings": 0,
            "total_alerts": 0,
            "total_recommendations": 0,
            "total_device_logs": 0,
            "database": "SQLite (croptwin.db)",
            "database_error": _format_db_error(exc),
        }


# ── Historical Sensor Readings ───────────────────────────────────


@router.get("/db/readings/{layer_id}")
def db_readings(
    layer_id: str,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return historical sensor readings for a specific layer.

    Results are ordered by timestamp descending (newest first).

    Args:
        layer_id: The farm layer to query readings for.
        limit: Maximum number of rows to return (default 50, max 500).
    """
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
        logger.warning("Failed to query readings for %s: %s", layer_id, _format_db_error(exc))
        return []

    return [
        {
            "id": r.id,
            "layer_id": r.layer_id,
            "temperature": r.temperature,
            "humidity": r.humidity,
            "soil_moisture": r.soil_moisture,
            "ph": r.ph,
            "light_intensity": r.light_intensity,
            "water_level": r.water_level,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]


# ── Historical Alerts ────────────────────────────────────────────


@router.get("/db/alerts")
def db_alerts(
    limit: int = Query(20, le=200),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return historical alerts from the database.

    Results are ordered by creation time descending (newest first).

    Args:
        limit: Maximum number of rows to return (default 20, max 200).
    """
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
            "id": r.id,
            "layer_id": r.layer_id,
            "severity": r.severity,
            "title": r.title,
            "message": r.message,
            "predictive": r.predictive,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ── Historical Device Logs ───────────────────────────────────────


@router.get("/db/device-logs")
def db_device_logs(
    limit: int = Query(20, le=200),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return historical device command logs from the database.

    Results are ordered by timestamp descending (newest first).

    Args:
        limit: Maximum number of rows to return (default 20, max 200).
    """
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
            "id": r.id,
            "layer_id": r.layer_id,
            "device": r.device,
            "value": r.value,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]
