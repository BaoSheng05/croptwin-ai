"""Sensor reading ingestion endpoint.

This router is a thin HTTP boundary around
:func:`app.services.sensor_pipeline.process_reading`. The router is
responsible for validating the request and broadcasting the resulting
event over WebSocket; all business logic lives in the service layer.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import require_valid_layer
from app.database import get_db
from app.realtime.manager import manager
from app.schemas import LayerUpdateEvent, SensorReading
from app.services.sensor_pipeline import process_reading

router = APIRouter()


@router.post("/sensors/readings", response_model=LayerUpdateEvent)
async def ingest_reading(
    reading: SensorReading,
    db: Session = Depends(get_db),
) -> LayerUpdateEvent:
    """Ingest a sensor reading and broadcast the resulting layer event.

    Args:
        reading: The incoming sensor snapshot for a single layer.
        db: Database session injected by FastAPI.

    Returns:
        A :class:`LayerUpdateEvent` describing the updated layer plus
        any alert/recommendation triggered by this reading.

    Raises:
        NotFoundError: If ``reading.layer_id`` is not a registered farm layer.
    """
    require_valid_layer(reading.layer_id)
    event = process_reading(reading, db)
    await manager.broadcast_json(event.model_dump(mode="json"))
    return event
