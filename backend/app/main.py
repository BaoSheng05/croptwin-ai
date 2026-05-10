"""CropTwin AI — FastAPI application entry point.

Configures CORS, registers all domain routers under ``/api``, and
runs startup tasks (database init, seed data) via the lifespan
context manager.

Start the server::

    uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.ai_router import router as ai_router
from app.api.alert_router import router as alert_router
from app.api.analytics_router import router as analytics_router
from app.api.db_router import router as db_router
from app.api.demo_router import router as demo_router
from app.api.device_router import router as device_router
from app.api.farm_router import router as farm_router
from app.api.sensor_router import router as sensor_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.database import SessionLocal, init_db
from app.services.farm_persistence import load_farm_layout, load_yield_setups, prune_yield_setups
from app.store import LAYERS, load_persisted_farm_state, seed_latest_readings

logger = logging.getLogger(__name__)

settings = get_settings()

# ── All domain routers to register under /api ────────────────────
_ROUTERS = [
    farm_router,
    sensor_router,
    device_router,
    alert_router,
    demo_router,
    ai_router,
    analytics_router,
    db_router,
]


# ── Lifespan (replaces deprecated @app.on_event) ────────────────


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan — runs startup and shutdown tasks.

    Startup:
      1. Initialise database tables (idempotent).
      2. Seed initial sensor readings for all layers.

    Shutdown:
      (nothing required at the moment)
    """
    # ── Startup ──────────────────────────────────────────────────
    init_db()
    db = SessionLocal()
    try:
        load_persisted_farm_state(load_farm_layout(db), load_yield_setups(db))
        prune_yield_setups(db, set(LAYERS.keys()))
    finally:
        db.close()
    seed_latest_readings()
    logger.info(
        "%s v%s started — %d routers registered.",
        settings.app_name,
        "0.1.0",
        len(_ROUTERS),
    )
    yield
    # ── Shutdown ─────────────────────────────────────────────────
    logger.info("%s shutting down.", settings.app_name)


# ── Application factory ─────────────────────────────────────────

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

# ── Global exception handlers ───────────────────────────────────

register_exception_handlers(app)

# ── CORS ─────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ────────────────────────────────────────────

for router in _ROUTERS:
    app.include_router(router, prefix="/api")


# ── Health check ─────────────────────────────────────────────────


@app.get("/")
def root() -> dict:
    return {
        "service": settings.app_name,
        "status": "ok",
        "message": "CropTwin AI backend is running.",
        "links": {
            "health": "/health",
            "docs": "/docs",
            "farm": "/api/farm",
            "layers": "/api/layers",
            "alerts": "/api/alerts",
        },
    }


@app.get("/health")
def health() -> dict:
    """Simple liveness probe for load balancers and monitoring."""
    return {"status": "ok", "service": settings.app_name}
