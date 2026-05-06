import asyncio
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import SensorReadingDB, AlertDB, RecommendationDB, DeviceLogDB
from app.realtime.manager import manager
from app.schemas import ChatRequest, ChatResponse, DeviceCommand, LayerUpdateEvent, SensorReading, ImageDiagnosisRequest
from app.services.alerts import alert_is_resolved, generate_alert, generate_predictive_alert
from app.services.chat import answer_farm_question
from app.services.health import calculate_health_score, status_from_score
from app.services.diagnosis import DiagnosisRequest, DiagnosisResponse, generate_diagnosis, generate_image_diagnosis
from app.services.ai_diagnosis import run_ai_first_diagnosis
from app.services.ai_control import run_deepseek_control_decision
from app.services.safety_guardrail import validate_device_command
from app.services.whatif import WhatIfRequest, WhatIfResponse, simulate_whatif
from app.services.recommendations import generate_recommendation, recommendation_is_resolved
from app.schemas import AIDiagnosisResponse, AIDiagnosisRequest, AIControlDecisionRequest, AIControlDecisionResponse, SafeCommandRequest
from app.store import (
    ALERTS,
    AREAS,
    LAYERS,
    READINGS,
    RECOMMENDATIONS,
    get_recipe_for_layer,
    latest_alerts,
    latest_recommendations,
    save_reading,
    seed_latest_readings,
    sustainability_snapshot,
)

router = APIRouter()
ALERT_REFRESH_INTERVAL = timedelta(minutes=30)


def _update_reported_led_feedback(layer_id: str) -> None:
    devices = LAYERS[layer_id].devices
    target = devices.led_intensity
    reported = devices.led_reported_intensity
    if reported == target:
        return
    step = max(1, round(abs(target - reported) * 0.4))
    if reported < target:
        devices.led_reported_intensity = min(target, reported + step)
    else:
        devices.led_reported_intensity = max(target, reported - step)


async def _turn_device_off_later(layer_id: str, device: str, duration_minutes: int) -> None:
    await asyncio.sleep(duration_minutes * 60)
    if layer_id not in LAYERS or device not in {"fan", "pump", "misting"}:
        return
    devices = LAYERS[layer_id].devices
    setattr(devices, device, False)
    await manager.broadcast_json(
        {
            "event": "device_command",
            "data": {
                "layer_id": layer_id,
                "device": device,
                "value": False,
                "devices": devices.model_dump(mode="json"),
                "source": "scheduled_auto_off",
            },
        }
    )


async def _apply_device_command(command: DeviceCommand, db: Session) -> dict:
    devices = LAYERS[command.layer_id].devices
    setattr(devices, command.device, command.value)
    if command.device == "auto_mode" and command.value is True:
        devices.fan = False
        devices.pump = False
        devices.misting = False

    # ── Log to SQLite ────────────────────────────────────────────
    db.add(DeviceLogDB(
        layer_id=command.layer_id,
        device=command.device,
        value=str(command.value),
    ))
    db.commit()

    await manager.broadcast_json(
        {
            "event": "device_command",
            "data": {
                "layer_id": command.layer_id,
                "device": command.device,
                "value": command.value,
                "devices": devices.model_dump(mode="json"),
            },
        }
    )
    return {"ok": True, "layer_id": command.layer_id, "devices": devices}


def _record_alert_if_due(alert, db: Session) -> bool:
    now = datetime.now(timezone.utc)
    existing = next(
        (
            item for item in ALERTS
            if item.layer_id == alert.layer_id
            and item.title == alert.title
            and item.predictive == alert.predictive
        ),
        None,
    )
    if existing:
        if now - existing.created_at < ALERT_REFRESH_INTERVAL:
            return False
        ALERTS.remove(existing)

    ALERTS.append(alert)
    db.add(AlertDB(
        id=alert.id, layer_id=alert.layer_id, severity=alert.severity,
        title=alert.title, message=alert.message, predictive=alert.predictive,
        created_at=alert.created_at,
    ))
    return True


def _record_recommendation_if_due(recommendation, db: Session) -> bool:
    now = datetime.now(timezone.utc)
    existing = next(
        (
            item for item in RECOMMENDATIONS
            if item.layer_id == recommendation.layer_id
            and item.action == recommendation.action
        ),
        None,
    )
    if existing:
        if now - existing.created_at < ALERT_REFRESH_INTERVAL:
            return False
        RECOMMENDATIONS.remove(existing)

    RECOMMENDATIONS.append(recommendation)
    db.add(RecommendationDB(
        id=recommendation.id, layer_id=recommendation.layer_id,
        action=recommendation.action, reason=recommendation.reason,
        priority=recommendation.priority, confidence=recommendation.confidence,
        created_at=recommendation.created_at,
    ))
    return True


def _resolve_current_alerts_for_layer(layer_id: str) -> list[str]:
    layer = LAYERS.get(layer_id)
    reading = layer.latest_reading if layer else None
    if not layer or not reading:
        return []

    recipe = get_recipe_for_layer(layer_id)
    resolved_ids = []
    for alert in list(ALERTS):
        if alert.layer_id != layer_id:
            continue
        if alert_is_resolved(alert, reading, recipe):
            ALERTS.remove(alert)
            resolved_ids.append(alert.id)

    return resolved_ids


def _resolve_current_recommendations_for_layer(layer_id: str) -> None:
    """Remove recommendations whose underlying condition is now within range."""
    layer = LAYERS.get(layer_id)
    reading = layer.latest_reading if layer else None
    if not layer or not reading:
        return
    recipe = get_recipe_for_layer(layer_id)
    for rec in list(RECOMMENDATIONS):
        if rec.layer_id != layer_id:
            continue
        if recommendation_is_resolved(rec, reading, recipe):
            RECOMMENDATIONS.remove(rec)


def _resolve_all_current_alerts() -> list[str]:
    resolved_ids = []
    for layer_id in list(LAYERS.keys()):
        resolved_ids.extend(_resolve_current_alerts_for_layer(layer_id))
    return resolved_ids


def _resolve_all_current_recommendations() -> None:
    for layer_id in list(LAYERS.keys()):
        _resolve_current_recommendations_for_layer(layer_id)


# ── Existing real-time endpoints ─────────────────────────────────

@router.get("/farm")
def get_farm_overview() -> dict:
    seed_latest_readings()
    _resolve_all_current_alerts()
    _resolve_all_current_recommendations()
    avg_health = round(sum(layer.health_score for layer in LAYERS.values()) / len(LAYERS))
    return {
        "name": "CropTwin AI Vertical Farm",
        "average_health_score": avg_health,
        "active_alerts": len(latest_alerts()),
        "layers": list(LAYERS.values()),
        "sustainability": sustainability_snapshot(),
    }


@router.get("/layers")
def get_layers() -> list:
    seed_latest_readings()
    return list(LAYERS.values())


@router.get("/areas")
def get_areas() -> list:
    return list(AREAS.values())


@router.get("/alerts")
def get_alerts() -> list:
    seed_latest_readings()
    _resolve_all_current_alerts()
    return latest_alerts()


@router.post("/alerts/auto-resolve")
def auto_resolve_alerts() -> dict:
    seed_latest_readings()
    resolved = []

    for alert in list(ALERTS):
        layer = LAYERS.get(alert.layer_id)
        reading = layer.latest_reading if layer else None
        if not layer or not reading:
            continue

        recipe = get_recipe_for_layer(alert.layer_id)
        if alert_is_resolved(alert, reading, recipe):
            ALERTS.remove(alert)
            resolved.append({
                "id": alert.id,
                "layer_id": alert.layer_id,
                "title": alert.title,
                "message": f"Solved: {layer.name} {alert.title.lower()} is back within the crop recipe range.",
            })

    for layer in LAYERS.values():
        current_alert = generate_alert(layer.latest_reading, get_recipe_for_layer(layer.id)) if layer.latest_reading else None
        layer.main_risk = current_alert.title if current_alert else None

    return {
        "resolved_count": len(resolved),
        "active_count": len(ALERTS),
        "resolved": resolved,
        "message": "Solved" if resolved else "No solved alerts yet",
    }


@router.get("/recommendations")
def get_recommendations() -> list:
    seed_latest_readings()
    _resolve_all_current_recommendations()
    return latest_recommendations()


@router.post("/sensors/readings")
async def ingest_reading(reading: SensorReading, db: Session = Depends(get_db)) -> LayerUpdateEvent:
    if reading.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")

    recipe = get_recipe_for_layer(reading.layer_id)
    save_reading(reading)
    resolved_alert_ids = _resolve_current_alerts_for_layer(reading.layer_id)
    _resolve_current_recommendations_for_layer(reading.layer_id)

    # ── Persist to SQLite ────────────────────────────────────────
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

    score = calculate_health_score(reading, recipe)
    layer = LAYERS[reading.layer_id]
    _update_reported_led_feedback(reading.layer_id)
    layer.health_score = score
    layer.status = status_from_score(score)

    alert = generate_alert(reading, recipe) or generate_predictive_alert(list(READINGS[reading.layer_id]), recipe)
    recommendation = generate_recommendation(reading, recipe, devices=layer.devices)
    layer.main_risk = alert.title if alert else None

    if alert and not _record_alert_if_due(alert, db):
        alert = None

    if not _record_recommendation_if_due(recommendation, db):
        recommendation = None

    db.commit()

    event = LayerUpdateEvent(data=layer, alert=alert, recommendation=recommendation, resolved_alert_ids=resolved_alert_ids)
    await manager.broadcast_json(event.model_dump(mode="json"))
    return event


@router.post("/devices/commands")
async def send_device_command(command: DeviceCommand, db: Session = Depends(get_db)) -> dict:
    if command.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")

    devices = LAYERS[command.layer_id].devices

    manual_devices = {"fan", "pump", "misting", "led_intensity"}
    if devices.auto_mode and command.device in manual_devices:
        raise HTTPException(status_code=400, detail="Manual device control is disabled while AI Control is on")

    return await _apply_device_command(command, db)


@router.post("/chat", response_model=ChatResponse)
def chat_to_farm(request: ChatRequest) -> ChatResponse:
    return answer_farm_question(request.question, request.layer_id, request.history)


@router.post("/diagnosis/run", response_model=DiagnosisResponse)
def run_diagnosis(request: DiagnosisRequest) -> DiagnosisResponse:
    if request.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
    return generate_diagnosis(request.layer_id)


@router.post("/diagnosis/image", response_model=DiagnosisResponse)
def run_image_diagnosis(request: ImageDiagnosisRequest) -> DiagnosisResponse:
    if request.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
    return generate_image_diagnosis(request.layer_id, request.image_base64)


@router.post("/whatif/simulate", response_model=WhatIfResponse)
def run_whatif(request: WhatIfRequest) -> WhatIfResponse:
    if request.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
    return simulate_whatif(request.layer_id, request.hours, request.action)


@router.post("/ai/diagnose", response_model=AIDiagnosisResponse)
def ai_diagnose(request: AIDiagnosisRequest) -> AIDiagnosisResponse:
    if request.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
    return run_ai_first_diagnosis(request.layer_id)


@router.post("/ai/control-decision", response_model=AIControlDecisionResponse)
def ai_control_decision(request: AIControlDecisionRequest) -> AIControlDecisionResponse:
    if request.layer_id not in LAYERS:
        raise HTTPException(status_code=404, detail="Unknown farm layer")
    seed_latest_readings()
    return run_deepseek_control_decision(request.layer_id)


@router.post("/ai/execute-safe-command")
async def execute_safe_command(request: SafeCommandRequest, db: Session = Depends(get_db)):
    val = validate_device_command(request.layer_id, request.device, request.value, request.duration_minutes)
    if not val["valid"]:
        raise HTTPException(status_code=400, detail=val["reason"])
        
    cmd = DeviceCommand(layer_id=request.layer_id, device=request.device, value=request.value)
    result = await _apply_device_command(cmd, db)
    if request.value is True and request.duration_minutes and request.device in {"fan", "pump", "misting"}:
        asyncio.create_task(_turn_device_off_later(request.layer_id, request.device, request.duration_minutes))
        result["scheduled_auto_off_minutes"] = request.duration_minutes
    return result


# ── NEW: Database-backed historical endpoints ────────────────────

@router.get("/db/stats")
def db_stats(db: Session = Depends(get_db)) -> dict:
    """Database statistics — proves real persistence."""
    return {
        "total_readings": db.query(func.count(SensorReadingDB.id)).scalar() or 0,
        "total_alerts": db.query(func.count(AlertDB.id)).scalar() or 0,
        "total_recommendations": db.query(func.count(RecommendationDB.id)).scalar() or 0,
        "total_device_logs": db.query(func.count(DeviceLogDB.id)).scalar() or 0,
        "database": "SQLite (croptwin.db)",
    }


@router.get("/db/readings/{layer_id}")
def db_readings(layer_id: str, limit: int = Query(50, le=500), db: Session = Depends(get_db)) -> list[dict]:
    """Historical sensor readings from SQLite for a specific layer."""
    rows = (
        db.query(SensorReadingDB)
        .filter(SensorReadingDB.layer_id == layer_id)
        .order_by(SensorReadingDB.timestamp.desc())
        .limit(limit)
        .all()
    )
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
    rows = (
        db.query(AlertDB)
        .order_by(AlertDB.created_at.desc())
        .limit(limit)
        .all()
    )
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
    rows = (
        db.query(DeviceLogDB)
        .order_by(DeviceLogDB.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id, "layer_id": r.layer_id, "device": r.device,
            "value": r.value, "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]


# ── WebSocket ────────────────────────────────────────────────────

@router.websocket("/ws/farm")
async def farm_websocket(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        await websocket.send_json({"event": "snapshot", "data": [layer.model_dump(mode="json") for layer in LAYERS.values()]})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
