"""AI-powered endpoints: diagnosis, control decisions, and chat.

This router groups all AI-driven features:
  - Chat: natural-language Q&A about the farm
  - Diagnosis: rule-based and image-based crop health diagnosis
  - AI Diagnosis: LLM-powered diagnosis using sensor context
  - AI Control: LLM-powered device control decisions
"""

from fastapi import APIRouter

from app.api import require_valid_layer
from app.schemas import (
    AIControlDecisionRequest,
    AIControlDecisionResponse,
    AIDiagnosisRequest,
    AIDiagnosisResponse,
    ChatRequest,
    ChatResponse,
    ImageDiagnosisRequest,
)
from app.services.ai_control import run_deepseek_control_decision
from app.services.ai_diagnosis import run_ai_first_diagnosis
from app.services.chat import answer_farm_question
from app.services.diagnosis import (
    DiagnosisRequest,
    DiagnosisResponse,
    generate_diagnosis,
    generate_image_diagnosis,
)
from app.store import seed_latest_readings

router = APIRouter()


# ── Chat ─────────────────────────────────────────────────────────


@router.post("/chat", response_model=ChatResponse)
def chat_to_farm(request: ChatRequest) -> ChatResponse:
    """Answer a natural-language question about the farm.

    Uses a combination of local rule matching and LLM-based
    responses depending on the question type and available API keys.
    """
    return answer_farm_question(request.question, request.layer_id, request.history)


# ── Rule-Based Diagnosis ─────────────────────────────────────────


@router.post("/diagnosis/run", response_model=DiagnosisResponse)
def run_diagnosis(request: DiagnosisRequest) -> DiagnosisResponse:
    """Run a rule-based sensor diagnosis for a specific layer.

    Evaluates the latest sensor reading against the crop recipe
    and generates a structured diagnosis report.
    """
    require_valid_layer(request.layer_id)
    return generate_diagnosis(request.layer_id)


@router.post("/diagnosis/image", response_model=DiagnosisResponse)
def run_image_diagnosis(request: ImageDiagnosisRequest) -> DiagnosisResponse:
    """Run a simulated image-based crop disease diagnosis.

    Accepts a base64-encoded image and generates a diagnosis
    report as if visual inspection was performed.
    """
    require_valid_layer(request.layer_id)
    return generate_image_diagnosis(request.layer_id, request.image_base64)


# ── LLM-Powered AI ──────────────────────────────────────────────


@router.post("/ai/diagnose", response_model=AIDiagnosisResponse)
def ai_diagnose(request: AIDiagnosisRequest) -> AIDiagnosisResponse:
    """Run an LLM-powered diagnosis using full sensor context.

    Sends the layer's current readings, crop recipe, and alert
    history to the AI model for a comprehensive health assessment.
    """
    require_valid_layer(request.layer_id)
    return run_ai_first_diagnosis(request.layer_id)


@router.post("/ai/control-decision", response_model=AIControlDecisionResponse)
def ai_control_decision(request: AIControlDecisionRequest) -> AIControlDecisionResponse:
    """Ask the AI to decide which device actions to take for a layer.

    The AI evaluates current sensor readings, crop recipe thresholds,
    and recent alert history to recommend specific device commands
    with reasoning and confidence scores.
    """
    require_valid_layer(request.layer_id)
    seed_latest_readings()
    return run_deepseek_control_decision(request.layer_id)
