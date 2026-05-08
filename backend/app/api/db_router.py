"""Database-backed historical query endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AlertDB, DeviceLogDB, RecommendationDB, SensorReadingDB

router = APIRouter()


def _database_error(exc: Exception) -> str:
    return str(exc).splitlines()[0][:200]


@router.get("/db/stats")
def db_stats(db: Session = Depends(get_db)) -> dict:
    """Database statistics — proves real persistence."""
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
        return {
            "total_readings": 0,
            "total_alerts": 0,
            "total_recommendations": 0,
            "total_device_logs": 0,
            "database": "SQLite (croptwin.db)",
            "database_error": _database_error(exc),
        }


@router.get("/db/readings/{layer_id}")
def db_readings(layer_id: str, limit: int = Query(50, le=500), db: Session = Depends(get_db)) -> list[dict]:
    """Historical sensor readings from SQLite for a specific layer."""
    try:
        rows = (
            db.query(SensorReadingDB)
            .filter(SensorReadingDB.layer_id == layer_id)
            .order_by(SensorReadingDB.timestamp.desc())
            .limit(limit)
            .all()
        )
    except SQLAlchemyError:
        db.rollback()
        return []
    return [
        {
            "id": r.id, "layer_id": r.layer_id,
            "temperature": r.temperature, "humidity": r.humidity,
            "soil_moisture": r.soil_moisture, "ph": r.ph,
            "light_intensity": r.light_intensity, "water_level": r.water_level,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]


@router.get("/db/alerts")
def db_alerts(limit: int = Query(20, le=200), db: Session = Depends(get_db)) -> list[dict]:
    """Historical alerts from SQLite."""
    try:
        rows = (
            db.query(AlertDB)
            .order_by(AlertDB.created_at.desc())
            .limit(limit)
            .all()
        )
    except SQLAlchemyError:
        db.rollback()
        return []
    return [
        {
            "id": r.id, "layer_id": r.layer_id, "severity": r.severity,
            "title": r.title, "message": r.message, "predictive": r.predictive,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/db/device-logs")
def db_device_logs(limit: int = Query(20, le=200), db: Session = Depends(get_db)) -> list[dict]:
    """Historical device command logs from SQLite."""
    try:
        rows = (
            db.query(DeviceLogDB)
            .order_by(DeviceLogDB.timestamp.desc())
            .limit(limit)
            .all()
        )
    except SQLAlchemyError:
        db.rollback()
        return []
    return [
        {
            "id": r.id, "layer_id": r.layer_id, "device": r.device,
            "value": r.value, "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]
