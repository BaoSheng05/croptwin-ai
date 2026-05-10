"""Pydantic schemas for request validation, response serialization, and events.

Schemas are grouped by domain:
  1. Enums & Core Types
  2. Sensor & Farm Layer
  3. Alerts & Recommendations
  4. Device Control
  5. AI / Diagnosis
  6. Chat
  7. Analytics & Demo
  8. Real-time Events

All schemas use Pydantic v2 conventions (``model_dump``, ``Field``).
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════
# 1. Enums & Core Types
# ═══════════════════════════════════════════════════════════════════


class LayerStatus(str, Enum):
    """Health status of a single farm layer."""

    healthy = "Healthy"
    warning = "Warning"
    critical = "Critical"
    offline = "Offline"


# ═══════════════════════════════════════════════════════════════════
# 2. Sensor & Farm Layer
# ═══════════════════════════════════════════════════════════════════


class SensorReading(BaseModel):
    """A single snapshot of all sensor values for a farm layer.

    Ingested via ``POST /api/sensors/readings`` and stored both in
    the in-memory deque and the SQLite ``sensor_readings`` table.
    """

    layer_id: str = Field(..., examples=["layer_02"], description="Target farm layer ID")
    temperature: float = Field(..., ge=-20, le=80, description="Temperature in °C")
    humidity: float = Field(..., ge=0, le=100, description="Relative humidity (%)")
    soil_moisture: float = Field(..., ge=0, le=100, description="Soil moisture (%)")
    ph: float = Field(..., ge=0, le=14, description="pH level")
    light_intensity: float = Field(..., ge=0, le=2000, description="Light intensity (lux)")
    water_level: float = Field(..., ge=0, le=100, description="Water reservoir level (%)")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp of the reading",
    )


class CropRecipe(BaseModel):
    """Ideal environmental ranges for a specific crop type.

    Used by the health scorer, alert engine, and AI diagnosis to
    determine whether sensor values are within acceptable bounds.
    """

    crop: str
    temperature_range: tuple[float, float]
    humidity_range: tuple[float, float]
    soil_moisture_range: tuple[float, float]
    ph_range: tuple[float, float]
    light_range: tuple[float, float]


class DeviceState(BaseModel):
    """Current state of all controllable devices on a farm layer.

    Each layer has one DeviceState instance tracking fans, pumps,
    LED intensity, auto mode, and fertigation dosing history.
    """

    fan: bool = False
    pump: bool = False
    misting: bool = False
    climate_heating: int = Field(default=0, ge=0, le=3, description="Heating level (0–3)")
    climate_cooling: int = Field(default=0, ge=0, le=3, description="Cooling level (0–3)")
    led_intensity: int = Field(default=70, ge=0, le=100, description="LED intensity (%)")
    led_reported_intensity: int = Field(
        default=70, ge=0, le=100,
        description="LED intensity reported back by hardware",
    )
    auto_mode: bool = True
    nutrient_a_dosed_ml: float = Field(default=0, ge=0, description="Nutrient A dosed (mL)")
    nutrient_b_dosed_ml: float = Field(default=0, ge=0, description="Nutrient B dosed (mL)")
    ph_up_dosed_ml: float = Field(default=0, ge=0, description="pH Up dosed (mL)")
    ph_down_dosed_ml: float = Field(default=0, ge=0, description="pH Down dosed (mL)")
    water_topup_liters: float = Field(default=0, ge=0, description="Water top-up (L)")
    fertigation_active: bool = False
    fertigation_last_action: str | None = None


class FarmLayer(BaseModel):
    """A single vertical-farming layer within an area.

    Combines identity (id, name, area), crop assignment, live health
    metrics, the most recent sensor reading, and device states.
    """

    id: str
    area_id: str = "area_a"
    area_name: str = "Area A"
    name: str
    crop: str
    status: LayerStatus
    health_score: int = Field(..., ge=0, le=100, description="Overall layer health (0–100)")
    main_risk: str | None = None
    latest_reading: SensorReading | None = None
    devices: DeviceState


class Area(BaseModel):
    """A named wing of the farm containing multiple layers."""

    id: str
    name: str
    layer_ids: list[str]


class FarmLayoutConfig(BaseModel):
    """Owner-defined farm shape for areas and vertical layers."""

    area_count: int = Field(default=3, ge=1, le=12)
    layers_per_area: int = Field(default=5, ge=1, le=20)
    default_crop: str = "Lettuce"


# ═══════════════════════════════════════════════════════════════════
# 3. Alerts & Recommendations
# ═══════════════════════════════════════════════════════════════════


class Alert(BaseModel):
    """An alert raised when sensor values breach crop recipe thresholds.

    Alerts may be threshold-based (immediate) or predictive
    (trend-based, flagged with ``predictive=True``).
    """

    id: str
    layer_id: str
    severity: Literal["info", "warning", "critical"]
    title: str
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    predictive: bool = False


class Recommendation(BaseModel):
    """An AI-generated action recommendation for a farm layer.

    Includes a confidence score and priority level to help
    operators decide which recommendations to act on first.
    """

    id: str
    layer_id: str
    action: str
    reason: str
    priority: Literal["low", "medium", "high"]
    confidence: int = Field(..., ge=0, le=100, description="AI confidence (0–100)")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ═══════════════════════════════════════════════════════════════════
# 4. Device Control
# ═══════════════════════════════════════════════════════════════════


class DeviceCommand(BaseModel):
    """A manual device control command from the operator."""

    layer_id: str
    device: Literal[
        "fan", "pump", "misting",
        "climate_heating", "climate_cooling",
        "led_intensity", "auto_mode",
    ]
    value: bool | int


class SafeCommandRequest(BaseModel):
    """An AI-recommended device command with safety guardrails.

    Unlike DeviceCommand, this goes through the safety guardrail
    validation before execution.
    """

    layer_id: str
    device: Literal[
        "fan", "pump", "misting",
        "climate_heating", "climate_cooling",
        "led_intensity", "none",
    ]
    value: bool | int
    duration_minutes: int | None = None


# ═══════════════════════════════════════════════════════════════════
# 5. AI / Diagnosis
# ═══════════════════════════════════════════════════════════════════


class ImageDiagnosisRequest(BaseModel):
    """Request for image-based crop disease diagnosis."""

    layer_id: str
    image_base64: str


class AIDeviceCommand(BaseModel):
    """A single device action recommended by the AI diagnosis engine."""

    device: Literal[
        "fan", "pump", "misting",
        "climate_heating", "climate_cooling",
        "led_intensity", "none",
    ]
    value: bool | int
    duration_minutes: int | None = None


class AIDiagnosisRequest(BaseModel):
    """Request to run AI-powered sensor diagnosis for a layer."""

    layer_id: str


class AIDiagnosisResponse(BaseModel):
    """Full AI diagnosis result including evidence and recommended actions."""

    layer_id: str
    diagnosis: str
    severity: Literal["Low", "Medium", "High", "Critical", "Normal"]
    confidence: int = Field(..., ge=0, le=100)
    evidence: list[str]
    recommended_actions: list[str]
    device_command: AIDeviceCommand
    expected_outcome: str


class AIControlDecisionRequest(BaseModel):
    """Request for the AI control engine to decide device actions."""

    layer_id: str


class AIControlCommand(BaseModel):
    """A single device command within an AI control decision."""

    device: Literal[
        "fan", "pump", "misting",
        "climate_heating", "climate_cooling",
        "led_intensity", "none",
    ]
    value: bool | int
    duration_minutes: int | None = None
    reason: str


class AIControlDecisionResponse(BaseModel):
    """Full AI control decision with reasoning and confidence.

    The ``mode`` field indicates whether the decision came from the
    DeepSeek model, a rule-based fallback, or an error path.
    """

    layer_id: str
    mode: Literal["deepseek", "fallback", "unconfigured", "ai_error"]
    summary: str
    commands: list[AIControlCommand]
    reasoning: list[str]
    confidence: int = Field(..., ge=0, le=100)


# ═══════════════════════════════════════════════════════════════════
# 6. Chat
# ═══════════════════════════════════════════════════════════════════


class ChatMessage(BaseModel):
    """A single message in a chat conversation history."""

    role: Literal["user", "ai"]
    text: str


class ChatRequest(BaseModel):
    """Incoming chat question from the operator.

    Optionally scoped to a specific layer via ``layer_id``.
    """

    question: str
    layer_id: str | None = None
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """AI-generated answer to a chat question.

    ``mode`` is ``"local"`` for rule-based answers or ``"ai"``
    when the response came from an LLM.
    """

    answer: str
    referenced_layers: list[str] = Field(default_factory=list)
    mode: str = "local"


# ═══════════════════════════════════════════════════════════════════
# 7. Analytics & Demo
# ═══════════════════════════════════════════════════════════════════


class SustainabilitySnapshot(BaseModel):
    """Point-in-time sustainability metrics for the whole farm."""

    water_saved_liters: float
    energy_optimized_kwh: float
    estimated_cost_reduction_rm: float
    sustainability_score: int = Field(..., ge=0, le=100)


class DemoScenarioRequest(BaseModel):
    """Request to apply a demo scenario for testing/presentation.

    Scenarios simulate various farm conditions (e.g. high humidity,
    disease outbreak) to demonstrate the system's response.
    """

    scenario: Literal[
        "normal", "high_humidity", "low_moisture",
        "disease_outbreak", "energy_peak",
    ]
    layer_id: str | None = None


class NutrientAutomationRequest(BaseModel):
    """Request to execute a nutrient dosing plan for a single layer."""

    layer_id: str
    confirm: bool = True


class NutrientAutoRunRequest(BaseModel):
    """Request for batch nutrient automation across multiple layers."""

    include_medium_risk: bool = True
    max_layers: int = Field(default=5, ge=1, le=15)
    confirm: bool = True


class YieldSetup(BaseModel):
    """Manual grow-plan inputs used for yield and revenue forecasting."""

    layer_id: str
    crop: str
    rows: int = Field(default=3, ge=1, le=200)
    columns: int = Field(default=6, ge=1, le=200)
    rack_layers: int = Field(default=1, ge=1, le=50)
    farm_area_m2: float = Field(default=2.0, ge=0, le=100000)
    price_rm_per_kg: float = Field(default=12.0, ge=0, le=10000)
    expected_kg_per_plant: float = Field(default=0.08, ge=0, le=100)


class YieldSetupUpdate(BaseModel):
    """Partial update for manual grow-plan inputs."""

    crop: str | None = None
    rows: int | None = Field(default=None, ge=1, le=200)
    columns: int | None = Field(default=None, ge=1, le=200)
    rack_layers: int | None = Field(default=None, ge=1, le=50)
    farm_area_m2: float | None = Field(default=None, ge=0, le=100000)
    price_rm_per_kg: float | None = Field(default=None, ge=0, le=10000)
    expected_kg_per_plant: float | None = Field(default=None, ge=0, le=100)


class HarvestLog(BaseModel):
    """Manual harvest record kept as persistent user input."""

    id: str
    layer_id: str
    layer_name: str
    crop: str
    kg: float = Field(..., ge=0)
    revenue_rm: float = Field(..., ge=0)
    harvested_at: datetime


class HarvestLogCreate(BaseModel):
    """Request to persist a manual harvest record."""

    layer_id: str
    layer_name: str
    crop: str
    kg: float = Field(..., ge=0)
    revenue_rm: float = Field(..., ge=0)


# ═══════════════════════════════════════════════════════════════════
# 8. Real-time Events
# ═══════════════════════════════════════════════════════════════════


class LayerUpdateEvent(BaseModel):
    """WebSocket event payload sent when a layer's state changes.

    Includes the updated layer data, any new alert or recommendation,
    and IDs of alerts that have been resolved by the update.
    """

    event: Literal["layer_update"] = "layer_update"
    data: FarmLayer
    alert: Alert | None = None
    recommendation: Recommendation | None = None
    resolved_alert_ids: list[str] = Field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════
# MARKET INTEL — MALAYSIA CITY SCORING
# ═══════════════════════════════════════════════════════════════════


class MarketCitySummary(BaseModel):
    """Summary fields for a Malaysian city in the scoring table."""

    id: str
    city_name: str
    state: str
    land_price_value: float
    land_price_unit: str
    land_price_confidence: str
    air_pollution_index: float
    living_cost_index: float
    overall_score: int = Field(..., ge=0, le=100)
    last_updated: str | None = None


class MarketCityNewsItem(BaseModel):
    """Single news article attached to a Malaysian city."""

    title: str
    url: str
    source: str
    published_at: str = ""


class MarketCityDetail(MarketCitySummary):
    """Full detail payload for the city detail modal."""

    land_price_source: str
    air_pollution_source: str
    living_cost_source: str
    infrastructure_score: int
    convenience_score: int
    transportation_delivery_score: int
    analysis_summary: str
    score_breakdown: dict[str, int] = Field(default_factory=dict)
    strengths: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    recommendation: str = ""
    raw_data: dict = Field(default_factory=dict)
    news: list[MarketCityNewsItem] = Field(default_factory=list)


class MarketCitySnapshot(BaseModel):
    """Top-level Market Intel response.

    ``top_cities`` is the podium (highest overall score first); ``cities``
    is the full sortable/filterable list.
    """

    scope: Literal["Malaysia"] = "Malaysia"
    generated_at: str
    top_cities: list[MarketCitySummary]
    cities: list[MarketCitySummary]


# ═══════════════════════════════════════════════════════════════════
# WHAT-IF SIMULATION
# ═══════════════════════════════════════════════════════════════════


class WhatIfRequest(BaseModel):
    """Request payload for the digital-twin what-if simulator.

    Args:
        layer_id: Target farm layer.
        hours: Forward horizon in hours (1–168).
        action: Either ``"auto"`` (let the engine pick), ``"none"``
            (baseline only), or one of ``"fan"|"pump"|"misting"``.
    """

    layer_id: str
    hours: int = Field(default=24, ge=1, le=168)
    action: Literal["auto", "none", "fan", "pump", "misting"] = "auto"


class WhatIfTimePoint(BaseModel):
    """A single hour in a what-if projection."""

    hour: int
    temperature: float
    humidity: float
    soil_moisture: float
    health_score: int = Field(..., ge=0, le=100)


class WhatIfResponse(BaseModel):
    """Full what-if simulation result for the dashboard chart."""

    layer_id: str
    layer_name: str
    crop: str
    baseline: list[WhatIfTimePoint]
    intervention: list[WhatIfTimePoint]
    action_label: str
    summary: str
    current_health: int
    baseline_final_health: int
    intervention_final_health: int
    health_delta: int
    recommendation: str
