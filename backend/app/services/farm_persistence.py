"""Persistence helpers for owner farm layout and manual yield setup."""

from sqlalchemy.orm import Session

from app.models import FarmLayoutDB, YieldSetupDB
from app.schemas import FarmLayoutConfig, YieldSetup


def load_farm_layout(db: Session) -> FarmLayoutConfig | None:
    record = db.get(FarmLayoutDB, 1)
    if not record:
        return None
    return FarmLayoutConfig(
        area_count=record.area_count,
        layers_per_area=record.layers_per_area,
        default_crop=record.default_crop,
    )


def save_farm_layout(db: Session, config: FarmLayoutConfig) -> None:
    record = db.get(FarmLayoutDB, 1)
    if not record:
        record = FarmLayoutDB(id=1)
        db.add(record)
    record.area_count = config.area_count
    record.layers_per_area = config.layers_per_area
    record.default_crop = config.default_crop
    db.commit()


def load_yield_setups(db: Session) -> dict[str, YieldSetup]:
    records = db.query(YieldSetupDB).all()
    return {
        record.layer_id: YieldSetup(
            layer_id=record.layer_id,
            crop=record.crop,
            rows=record.rows,
            columns=record.columns,
            rack_layers=record.rack_layers,
            farm_area_m2=record.farm_area_m2,
            price_rm_per_kg=record.price_rm_per_kg,
            expected_kg_per_plant=record.expected_kg_per_plant,
        )
        for record in records
    }


def save_yield_setup_record(db: Session, setup: YieldSetup) -> None:
    record = db.get(YieldSetupDB, setup.layer_id)
    if not record:
        record = YieldSetupDB(layer_id=setup.layer_id)
        db.add(record)
    record.crop = setup.crop
    record.rows = setup.rows
    record.columns = setup.columns
    record.rack_layers = setup.rack_layers
    record.farm_area_m2 = setup.farm_area_m2
    record.price_rm_per_kg = setup.price_rm_per_kg
    record.expected_kg_per_plant = setup.expected_kg_per_plant
    db.commit()


def prune_yield_setups(db: Session, valid_layer_ids: set[str]) -> None:
    stale = db.query(YieldSetupDB).filter(~YieldSetupDB.layer_id.in_(valid_layer_ids)).all()
    for record in stale:
        db.delete(record)
    if stale:
        db.commit()
