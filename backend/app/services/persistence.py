"""Thin persistence helpers to DRY up repeated try/commit/rollback blocks."""

from sqlalchemy.orm import Session

from app.models import SensorReadingDB
from app.schemas import SensorReading


def safe_commit(db: Session) -> str | None:
    """Attempt to commit and return ``None`` on success or an error snippet."""
    try:
        db.commit()
        return None
    except Exception as exc:
        db.rollback()
        error = str(exc)[:200]
        print(f"DB commit skipped: {error}")
        return error


def persist_reading(db: Session, reading: SensorReading) -> None:
    """Add a sensor reading row to the session (caller must commit)."""
    db.add(SensorReadingDB(
        layer_id=reading.layer_id,
        temperature=reading.temperature,
        humidity=reading.humidity,
        soil_moisture=reading.soil_moisture,
        ph=reading.ph,
        light_intensity=reading.light_intensity,
        water_level=reading.water_level,
        timestamp=reading.timestamp,
    ))
