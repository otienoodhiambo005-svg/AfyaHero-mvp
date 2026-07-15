from typing import Optional, List
from uuid import UUID
from pydantic import Field
from .base import BaseSchema

class ClinicalQuery(BaseSchema):
    patient_id: Optional[UUID] = None
    encounter_id: Optional[UUID] = None
    symptoms: List[str] = Field(..., min_items=1)
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[str] = Field(None, pattern="^(M|F|Other)$")
    existing_conditions: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    context: Optional[str] = None

class AIResponseModel(BaseSchema):
    result: dict
    confidence: float
    consensus_reached: bool
    models_used: List[str]

class RadiologyScan(BaseSchema):
    patient_id: UUID
    image_url: str
    scan_type: str
    notes: Optional[str] = None

class PathologyAnalysis(BaseSchema):
    patient_id: UUID
    specimen_id: str
    specimen_type: str
    notes: Optional[str] = None

class DiagnosisResult(BaseSchema):
    icd10_code: str
    condition_name: str
    confidence: float
    severity: str
    reasoning: str
    swahili: str

class GuidelineResult(BaseSchema):
    title: str
    source: str
    content: str
    topic: str
    relevance: float

class DrugInteractionResult(BaseSchema):
    drug1: str
    drug2: str
    severity: str
    warning: str
    swahili_warning: Optional[str] = None

class DAWAResponse(BaseSchema):
    diagnoses: List[DiagnosisResult]
    tests: List[str]
    medications: List[str]
    drug_interactions: List[DrugInteractionResult]
    guidelines: List[GuidelineResult]
    severity: str
    swahili_summary: str
