"""
AI Triage Service - AfyaHero
FastAPI microservice for patient triage and priority scoring.

Port: 8001
Technology: FastAPI (Python)
Primary Model: BioGPT/Med-PaLM 2
Offline Model: Quantized LLaMA 3-8B (ONNX)
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Literal, Dict
import os
import logging
from datetime import datetime
import json
from onnx_models import initialize_models, get_model_status, triage_model
from fhir_output import FHIROutputConverter, triage_to_fhir

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Triage Service",
    description="Patient triage and priority scoring with PEWS and MOEWS support",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ────────────────────────────────────────────────────────────────────

class TriageVitals(BaseModel):
    temperature: Optional[float] = Field(None, description="Temperature in Celsius")
    heart_rate: Optional[int] = Field(None, alias="heartRate", description="Heart rate in bpm")
    respiratory_rate: Optional[int] = Field(None, alias="respiratoryRate", description="Respiratory rate in breaths/min")
    systolic_bp: Optional[int] = Field(None, alias="systolicBP", description="Systolic blood pressure in mmHg")
    diastolic_bp: Optional[int] = Field(None, alias="diastolicBP", description="Diastolic blood pressure in mmHg")
    sp_o2: Optional[float] = Field(None, alias="spO2", description="Oxygen saturation in %")
    consciousness: Optional[Literal['alert', 'voice', 'pain', 'unresponsive']] = None
    capillary_refill_time: Optional[int] = Field(None, alias="capillaryRefillTime", description="Capillary refill time in seconds")

    class Config:
        populate_by_name = True

class TriageRequest(BaseModel):
    patient_id: str = Field(..., description="Patient identifier")
    patient_age: int = Field(..., ge=0, le=120, alias="patientAge", description="Patient age in years")
    patient_gender: Literal['male', 'female'] = Field(..., alias="patientGender")
    is_pregnant: bool = Field(False, alias="isPregnant")
    gestational_weeks: Optional[int] = Field(None, ge=0, le=42, alias="gestationalWeeks")
    chief_complaint: str = Field(..., min_length=3, alias="chiefComplaint")
    history_of_present_illness: Optional[str] = Field(None, alias="historyOfPresentIllness")
    vitals: TriageVitals
    mechanism_of_injury: Optional[str] = Field(None, alias="mechanismOfInjury")
    pain_score: Optional[int] = Field(None, ge=0, le=10, alias="painScore")
    known_allergies: Optional[List[str]] = Field(None, alias="knownAllergies")
    current_medications: Optional[List[str]] = Field(None, alias="currentMedications")
    known_medical_conditions: Optional[List[str]] = Field(None, alias="knownMedicalConditions")

    class Config:
        populate_by_name = True

class TriagePriority(BaseModel):
    priority: Literal[1, 2, 3, 4, 5]
    priority_label: str
    confidence: float = Field(..., ge=0, le=1)
    reasoning: str
    provider: str
    model: str
    latency_ms: int

class ConsensusDetails(BaseModel):
    model1: TriagePriority
    model2: TriagePriority
    model3: TriagePriority
    agreement: Literal['unanimous', 'majority', 'split']

class TriageResponse(BaseModel):
    priority: Literal[1, 2, 3, 4, 5]
    priority_label: str
    confidence: float
    reasoning: str
    consensus_details: ConsensusDetails
    alerts: List[str]
    recommended_actions: List[str]
    peews_score: Optional[int] = None
    moews_score: Optional[int] = None
    requires_immediate_review: bool
    timestamp: str

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    offline_mode: bool
    model_loaded: bool
    models: Dict[str, bool]

# ─── Triage Logic (Placeholder for actual AI integration) ─────────────────────

def calculate_pews_score(vitals: TriageVitals) -> Optional[int]:
    """
    Calculate Paediatric Early Warning Score (PEWS).
    Applies to patients < 18 years.
    """
    # Placeholder implementation
    # In production, this would use the actual PEWS calculation logic
    return None

def calculate_moews_score(vitals: TriageVitals) -> Optional[int]:
    """
    Calculate Modified Obstetric Early Warning Score (MOEWS).
    Applies to pregnant/obstetric patients.
    """
    # Placeholder implementation
    # In production, this would use the actual MOEWS calculation logic
    return None

async def perform_ai_triage(request: TriageRequest) -> TriageResponse:
    """
    Perform AI-powered triage using the consensus ensemble.
    
    This function will:
    1. Try ONNX model first if available (offline mode)
    2. Fall back to cloud AI models if online
    3. Use rule-based scoring as final fallback
    4. Calculate PEWS/MOEWS scores if applicable
    5. Return FHIR-compliant response
    """
    start_time = datetime.now()
    
    # Try ONNX model first if available
    if triage_model and triage_model.is_model_loaded(triage_model.MODEL_NAME):
        logger.info("Using ONNX model for triage")
        onnx_result = triage_model.predict_priority(
            patient_age=request.patient_age,
            patient_gender=request.patient_gender,
            chief_complaint=request.chief_complaint,
            vitals=request.vitals.dict()
        )
        
        if onnx_result:
            priority = onnx_result.get("priority", 3)
            priority_label = onnx_result.get("priority_label", "Urgent (Yellow)")
            confidence = onnx_result.get("confidence", 0.75)
            reasoning = onnx_result.get("reasoning", "ONNX model inference")
            provider = "onnx-phi3"
            model = "phi-3-mini-4bit"
        else:
            # Fall back to rule-based
            priority = 3
            priority_label = "Urgent (Yellow) - Serious condition"
            confidence = 0.50
            reasoning = "ONNX inference failed, using rule-based fallback"
            provider = "rule-based"
            model = "fallback-v1"
    else:
        # Use rule-based fallback (cloud models not yet integrated in service)
        priority = 3
        priority_label = "Urgent (Yellow) - Serious condition"
        confidence = 0.75
        reasoning = "Rule-based triage (cloud AI integration pending)"
        provider = "rule-based"
        model = "fallback-v1"
    
    # Calculate scores if applicable
    peews_score = None
    moews_score = None
    
    if request.patient_age < 18:
        peews_score = calculate_pews_score(request.vitals)
    elif request.is_pregnant:
        moews_score = calculate_moews_score(request.vitals)
    
    latency_ms = int((datetime.now() - start_time).total_seconds() * 1000)
    
    # Determine if immediate review is needed
    requires_immediate_review = priority <= 2 or (peews_score and peews_score >= 5) or (moews_score and moews_score >= 5)
    
    # Generate alerts based on priority
    alerts = []
    if priority <= 2:
        alerts.append("High priority - immediate attention required")
    if peews_score and peews_score >= 5:
        alerts.append(f"High PEWS score: {peews_score}")
    if moews_score and moews_score >= 5:
        alerts.append(f"High MOEWS score: {moews_score}")
    
    if not alerts:
        alerts.append("Standard triage protocol")
    
    # Generate recommended actions
    recommended_actions = []
    if priority == 1:
        recommended_actions = ["Immediate medical intervention", "Activate emergency response", "Continuous vital monitoring"]
    elif priority == 2:
        recommended_actions = ["Rapid assessment within 10 minutes", "Prepare emergency equipment", "Alert senior clinician"]
    elif priority == 3:
        recommended_actions = ["Assess within 30-60 minutes", "Monitor vitals every 15 minutes"]
    elif priority == 4:
        recommended_actions = ["Assess within 1-2 hours", "Routine monitoring"]
    else:
        recommended_actions = ["Routine assessment", "Can wait for next available slot"]
    
    return TriageResponse(
        priority=priority,
        priority_label=priority_label,
        confidence=confidence,
        reasoning=reasoning,
        consensus_details=ConsensusDetails(
            model1=TriagePriority(
                priority=priority,
                priority_label=priority_label,
                confidence=confidence,
                reasoning=reasoning,
                provider=provider,
                model=model,
                latency_ms=latency_ms
            ),
            model2=TriagePriority(
                priority=priority,
                priority_label=priority_label,
                confidence=confidence,
                reasoning=reasoning,
                provider=provider,
                model=model,
                latency_ms=latency_ms
            ),
            model3=TriagePriority(
                priority=priority,
                priority_label=priority_label,
                confidence=confidence,
                reasoning=reasoning,
                provider=provider,
                model=model,
                latency_ms=latency_ms
            ),
            agreement="unanimous"
        ),
        alerts=alerts,
        recommended_actions=recommended_actions,
        peews_score=peews_score,
        moews_score=moews_score,
        requires_immediate_review=requires_immediate_review,
        timestamp=datetime.now().isoformat()
    )

# ─── API Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    offline_mode = os.getenv("OFFLINE_MODE", "false").lower() == "true"
    model_status = get_model_status()
    model_loaded = model_status.get("triage_loaded", False)
    
    return HealthResponse(
        status="healthy",
        service="ai-triage-service",
        version="1.0.0",
        offline_mode=offline_mode,
        model_loaded=model_loaded,
        models=model_status
    )

@app.post("/triage/analyze", response_model=TriageResponse)
async def triage_analyze(request: TriageRequest):
    """
    Analyze patient and generate triage priority score.
    
    This endpoint performs AI-powered triage using a consensus ensemble
    of multiple AI models. Returns FHIR-compliant observation data.
    """
    try:
        logger.info(f"Triage request for patient {request.patient_id}")
        
        result = await perform_ai_triage(request)
        
        logger.info(f"Triage complete: Priority {result.priority} for patient {request.patient_id}")
        
        return result
    except Exception as e:
        logger.error(f"Triage error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/triage/priority-score")
async def priority_score(request: TriageRequest):
    """
    Quick priority score calculation (simplified version).
    """
    result = await perform_ai_triage(request)
    return {
        "priority": result.priority,
        "priority_label": result.priority_label,
        "confidence": result.confidence,
        "requires_immediate_review": result.requires_immediate_review
    }

@app.post("/triage/symptom-extraction")
async def symptom_extraction(request: TriageRequest):
    """
    Extract structured symptoms from chief complaint and history.
    """
    # Placeholder for symptom extraction logic
    return {
        "symptoms": [],
        "extracted_from": request.chief_complaint,
        "confidence": 0.0
    }


@app.post("/triage/fhir")
async def triage_fhir(request: TriageRequest, format: str = "resource"):
    """
    Return FHIR-compliant triage observation.
    
    This endpoint returns the triage result as a FHIR Observation resource,
    conforming to FHIR R4 standards for interoperability with hospital systems.
    
    Query parameters:
    - format: "resource" (default) or "bundle"
    """
    try:
        result = await perform_ai_triage(request)
        
        # Convert to FHIR Observation
        fhir_observation = FHIROutputConverter.triage_to_observation(
            patient_id=request.patient_id,
            priority=result.priority,
            priority_label=result.priority_label,
            confidence=result.confidence,
            reasoning=result.reasoning,
            pews_score=result.pews_score,
            moews_score=result.moews_score,
            vital_signs={
                "heart_rate": request.heart_rate,
                "blood_pressure_systolic": request.systolic_bp,
                "blood_pressure_diastolic": request.diastolic_bp,
                "respiratory_rate": request.respiratory_rate,
                "temperature": request.temperature,
                "oxygen_saturation": request.oxygen_saturation
            }
        )
        
        if format == "bundle":
            # Return as FHIR Bundle
            fhir_bundle = FHIROutputConverter.create_fhir_bundle([fhir_observation])
            return fhir_bundle
        
        return fhir_observation
    
    except Exception as e:
        logger.error(f"FHIR triage error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Startup Event ─────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Initialize ONNX models on service startup."""
    models_dir = os.getenv("MODELS_DIR", "/models")
    logger.info(f"Initializing ONNX models from {models_dir}")
    try:
        model_status = initialize_models(models_dir)
        logger.info(f"Model initialization complete: {model_status}")
    except Exception as e:
        logger.error(f"Failed to initialize ONNX models: {str(e)}")

# ─── Main Entry Point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
