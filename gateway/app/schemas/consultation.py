from typing import Optional, List
from uuid import UUID
from pydantic import Field
from .base import BaseSchema, AuditModel

class SOAPModel(BaseSchema):
    subjective: Optional[str] = Field(None, max_length=2000)
    objective: Optional[str] = Field(None, max_length=2000)
    assessment: Optional[str] = Field(None, max_length=2000)
    plan: Optional[str] = Field(None, max_length=2000)

class ConsultationBase(BaseSchema):
    patient_id: UUID
    practitioner_id: UUID
    diagnosis: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=2000)
    status: str = Field("Completed", max_length=20)
    prescription_id: Optional[UUID] = None

class ConsultationCreate(ConsultationBase):
    soap_notes: Optional[SOAPModel] = None

class ConsultationRead(ConsultationBase, AuditModel):
    hospital_id: UUID
