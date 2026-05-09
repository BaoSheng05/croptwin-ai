"""API route package — domain routers registered in ``app.main``.

Router inventory:
  - farm_router      : farm overview, layer listing, area listing, WebSocket
  - sensor_router    : sensor reading ingestion pipeline
  - device_router    : manual & AI-safe device control
  - alert_router     : alert listing, auto-resolve, recommendations
  - demo_router      : demo scenario application
  - ai_router        : AI diagnosis, control decisions, chat
  - analytics_router : energy, business, operations, yield, market, climate, nutrients, what-if
  - db_router        : historical database queries (SQLite)
"""

from fastapi import HTTPException

from app.store import LAYERS


def require_valid_layer(layer_id: str) -> None:
    """Raise HTTP 404 if ``layer_id`` is not a known farm layer.

    This is a shared guard used across multiple routers to avoid
    repeating the same check in every endpoint.

    Args:
        layer_id: The layer identifier to validate.

    Raises:
        HTTPException: 404 if the layer does not exist.
    """
    if layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
