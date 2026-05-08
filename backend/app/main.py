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
from app.database import init_db
from app.store import seed_latest_readings

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register domain routers — each owns a cohesive set of endpoints
for router in [
    farm_router,
    sensor_router,
    device_router,
    alert_router,
    demo_router,
    ai_router,
    analytics_router,
    db_router,
]:
    app.include_router(router, prefix="/api")


@app.on_event("startup")
def startup() -> None:
    init_db()
    seed_latest_readings()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.app_name}
