"""Persistent manual harvest log service."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import HarvestLogDB
from app.schemas import HarvestLog, HarvestLogCreate


def _to_schema(record: HarvestLogDB) -> HarvestLog:
    harvested_at = record.harvested_at
    if harvested_at.tzinfo is None:
        harvested_at = harvested_at.replace(tzinfo=timezone.utc)
    return HarvestLog(
        id=record.id,
        layer_id=record.layer_id,
        layer_name=record.layer_name,
        crop=record.crop,
        kg=record.kg,
        revenue_rm=record.revenue_rm,
        harvested_at=harvested_at,
    )


def list_harvest_logs(db: Session) -> list[HarvestLog]:
    records = db.query(HarvestLogDB).order_by(HarvestLogDB.harvested_at.desc()).all()
    return [_to_schema(record) for record in records]


def create_harvest_log(db: Session, request: HarvestLogCreate) -> HarvestLog:
    now = datetime.now(timezone.utc)
    existing = db.query(HarvestLogDB).filter(HarvestLogDB.layer_id == request.layer_id).all()
    for record in existing:
        db.delete(record)

    record = HarvestLogDB(
        id=f"{request.layer_id}:{int(now.timestamp() * 1000)}",
        layer_id=request.layer_id,
        layer_name=request.layer_name,
        crop=request.crop,
        kg=request.kg,
        revenue_rm=request.revenue_rm,
        harvested_at=now,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_schema(record)


def delete_harvest_log(db: Session, log_id: str) -> bool:
    record = db.get(HarvestLogDB, log_id)
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True
