from typing import Optional, List
from uuid import UUID
from datetime import date as date_type
from pydantic import Field, EmailStr
from .base import BaseSchema, AuditModel

class PatientBase(BaseSchema):
    name: str = Field(..., min_length=2, max_length=120)
    gender: Optional[str] = Field(None, pattern="^(M|F|Other)$")
    dob: date_type
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    national_id: Optional[str] = Field(None, max_length=20)
    insurance_provider: Optional[str] = Field(None, max_length=50)
    insurance_id: Optional[str] = Field(None, max_length=30)
    shif_number: Optional[str] = Field(None, max_length=30)
    blood_group: Optional[str] = Field(None, max_length=5)
    allergies: List[str] = Field(default_factory=list)
    county: Optional[str] = Field(None, max_length=50)
    opd_number: Optional[str] = Field(None, max_length=20)
    religion: Optional[str] = Field(None, max_length=50)
    consent_given: bool = False

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseSchema):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    gender: Optional[str] = Field(None, pattern="^(M|F|Other)$")
    dob: Optional[date_type] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    national_id: Optional[str] = Field(None, max_length=20)
    insurance_provider: Optional[str] = Field(None, max_length=50)
    insurance_id: Optional[str] = Field(None, max_length=30)
    shif_number: Optional[str] = Field(None, max_length=30)
    blood_group: Optional[str] = Field(None, max_length=5)
    allergies: Optional[List[str]] = None
    county: Optional[str] = Field(None, max_length=50)
    opd_number: Optional[str] = Field(None, max_length=20)
    religion: Optional[str] = Field(None, max_length=50)
    consent_given: Optional[bool] = None

class PatientRead(PatientBase, AuditModel):
    hospital_id: UUID
    status: str = "Stable"
