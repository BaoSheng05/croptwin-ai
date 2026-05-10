"""Database-backed historical query endpoints.

These endpoints expose persisted SQLite data (readings, alerts, device
logs) for the dashboard. All query logic lives in
:mod:`app.services.historical` so the router only handles request
parsing and response shaping.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.historical import (
    database_stats,
    historical_alerts,
    historical_device_logs,
    historical_readings,
)

router = APIRouter()


@router.get("/db/stats")
def db_stats(db: Session = Depends(get_db)) -> dict:
    """Return row counts across all persistent tables."""
    return database_stats(db)


@router.get("/db/readings/{layer_id}")
def db_readings(
    layer_id: str,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return historical sensor readings for ``layer_id`` (newest first)."""
    return historical_readings(db, layer_id, limit)


@router.get("/db/alerts")
def db_alerts(
    limit: int = Query(20, le=200),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return historical alerts ordered by creation time descending."""
    return historical_alerts(db, limit)


@router.get("/db/device-logs")
def db_device_logs(
    limit: int = Query(20, le=200),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return historical device command logs ordered by timestamp descending."""
    return historical_device_logs(db, limit)
