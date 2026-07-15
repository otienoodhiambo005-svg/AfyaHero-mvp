from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional

class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class UUIDModel(BaseSchema):
    id: UUID

class TimestampModel(BaseSchema):
    created_at: datetime
    updated_at: Optional[datetime] = None

class AuditModel(TimestampModel, UUIDModel):
    pass
