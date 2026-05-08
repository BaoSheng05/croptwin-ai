"""AI-powered endpoints: diagnosis, control decisions, and chat."""

from fastapi import APIRouter, HTTPException

from app.schemas import (
    AIDiagnosisRequest,
    AIDiagnosisResponse,
    AIControlDecisionRequest,
    AIControlDecisionResponse,
    ChatRequest,
    ChatResponse,
    ImageDiagnosisRequest,
)
from app.services.ai_diagnosis import run_ai_first_diagnosis
from app.services.ai_control import run_deepseek_control_decision
from app.services.chat import answer_farm_question
from app.services.diagnosis import DiagnosisRequest, DiagnosisResponse, generate_diagnosis, generate_image_diagnosis
from app.store import LAYERS, seed_latest_readings

router = APIRouter()


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
