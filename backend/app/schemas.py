from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class LayerStatus(str, Enum):
    healthy = "Healthy"
    warning = "Warning"
    critical = "Critical"
    offline = "Offline"


class SensorReading(BaseModel):
    layer_id: str = Field(..., examples=["layer_02"])
    temperature: float = Field(..., ge=-20, le=80)
    humidity: float = Field(..., ge=0, le=100)
    soil_moisture: float = Field(..., ge=0, le=100)
    ph: float = Field(..., ge=0, le=14)
    light_intensity: float = Field(..., ge=0, le=2000)
    water_level: float = Field(..., ge=0, le=100)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CropRecipe(BaseModel):
    crop: str
    temperature_range: tuple[float, float]
    humidity_range: tuple[float, float]
    soil_moisture_range: tuple[float, float]
    ph_range: tuple[float, float]
    light_range: tuple[float, float]


class DeviceState(BaseModel):
    fan: bool = False
    pump: bool = False
    misting: bool = False
    led_intensity: int = Field(default=70, ge=0, le=100)
    led_reported_intensity: int = Field(default=70, ge=0, le=100)
    auto_mode: bool = True


class FarmLayer(BaseModel):
    id: str
    area_id: str = "area_a"
    area_name: str = "Area A"
    name: str
    crop: str
    status: LayerStatus
    health_score: int = Field(..., ge=0, le=100)
    main_risk: str | None = None
    latest_reading: SensorReading | None = None
    devices: DeviceState


class Area(BaseModel):
    id: str
    name: str
    layer_ids: list[str]


class Alert(BaseModel):
    id: str
    layer_id: str
    severity: Literal["info", "warning", "critical"]
    title: str
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    predictive: bool = False


class Recommendation(BaseModel):
    id: str
    layer_id: str
    action: str
    reason: str
    priority: Literal["low", "medium", "high"]
    confidence: int = Field(..., ge=0, le=100)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DeviceCommand(BaseModel):
    layer_id: str
    device: Literal["fan", "pump", "misting", "led_intensity", "auto_mode"]
    value: bool | int


class ChatMessage(BaseModel):
    role: Literal["user", "ai"]
    text: str


class ChatRequest(BaseModel):
    question: str
    layer_id: str | None = None
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    answer: str
    referenced_layers: list[str] = []
    mode: str = "local"  # "local" or "ai"


class SustainabilitySnapshot(BaseModel):
    water_saved_liters: float
    energy_optimized_kwh: float
    estimated_cost_reduction_rm: float
    sustainability_score: int = Field(..., ge=0, le=100)


class LayerUpdateEvent(BaseModel):
    event: Literal["layer_update"] = "layer_update"
    data: FarmLayer
    alert: Alert | None = None
    recommendation: Recommendation | None = None
    resolved_alert_ids: list[str] = []


class ImageDiagnosisRequest(BaseModel):
    layer_id: str
    image_base64: str


class AIDeviceCommand(BaseModel):
    device: Literal["fan", "pump", "misting", "led_intensity", "none"]
    value: bool | int
    duration_minutes: int | None = None


class AIDiagnosisResponse(BaseModel):
    layer_id: str
    diagnosis: str
    severity: Literal["Low", "Medium", "High", "Critical", "Normal"]
    confidence: int = Field(..., ge=0, le=100)
    evidence: list[str]
    recommended_actions: list[str]
    device_command: AIDeviceCommand
    expected_outcome: str


class AIDiagnosisRequest(BaseModel):
    layer_id: str


class AIControlDecisionRequest(BaseModel):
    layer_id: str


class AIControlCommand(BaseModel):
    device: Literal["fan", "pump", "misting", "led_intensity", "none"]
    value: bool | int
    duration_minutes: int | None = None
    reason: str


class AIControlDecisionResponse(BaseModel):
    layer_id: str
    mode: Literal["deepseek", "fallback", "unconfigured", "ai_error"]
    summary: str
    commands: list[AIControlCommand]
    reasoning: list[str]
    confidence: int = Field(..., ge=0, le=100)


class SafeCommandRequest(BaseModel):
    layer_id: str
    device: Literal["fan", "pump", "misting", "led_intensity", "none"]
    value: bool | int
    duration_minutes: int | None = None
