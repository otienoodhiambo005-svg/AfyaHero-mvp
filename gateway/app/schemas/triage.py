from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import Field
from .base import BaseSchema, AuditModel

class VitalsBase(BaseSchema):
    temp_c: Optional[Decimal] = Field(None, ge=30, le=45)
    sbp: Optional[int] = Field(None, ge=40, le=300)
    dbp: Optional[int] = Field(None, ge=20, le=200)
    heart_rate: Optional[int] = Field(None, ge=20, le=250)
    resp_rate: Optional[int] = Field(None, ge=5, le=60)
    spo2: Optional[int] = Field(None, ge=50, le=100)
    weight: Optional[Decimal] = Field(None, ge=0.5, le=300)
    height: Optional[Decimal] = Field(None, ge=20, le=250)
    bmi: Optional[Decimal] = Field(None, ge=5, le=80)

class VitalsCreate(VitalsBase):
    patient_id: UUID

class VitalsRead(VitalsBase, AuditModel):
    hospital_id: UUID
    recorded_by: Optional[UUID] = None
