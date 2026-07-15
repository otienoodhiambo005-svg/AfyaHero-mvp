from typing import AsyncGenerator
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_async_session
from app.core.tenancy.rls import set_rls_context
from app.core.rbac.permissions import Permission
from app.core.rbac.dependency import require_permission


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get database session with RLS context already set.
    Use this as a dependency for all routes that access clinical data.
    """
    async with get_async_session() as session:
        await set_rls_context(session)
        yield session


def get_current_user(request: Request):
    """Get current authenticated user from request state"""
    return getattr(request.state, "user", None)


# Common permission dependencies
read_patient = Depends(require_permission(Permission.PATIENT_READ))
write_patient = Depends(require_permission(Permission.PATIENT_WRITE))
read_encounter = Depends(require_permission(Permission.ENCOUNTER_READ))
write_encounter = Depends(require_permission(Permission.ENCOUNTER_WRITE))
read_consultation = Depends(require_permission(Permission.CONSULTATION_READ))
write_consultation = Depends(require_permission(Permission.CONSULTATION_WRITE))
sign_consultation = Depends(require_permission(Permission.CONSULTATION_SIGN))
write_vitals = Depends(require_permission(Permission.VITALS_WRITE))
write_prescription = Depends(require_permission(Permission.PRESCRIPTION_WRITE))
dispense_prescription = Depends(require_permission(Permission.PRESCRIPTION_DISPENSE))
lab_request = Depends(require_permission(Permission.LAB_REQUEST))
lab_result_write = Depends(require_permission(Permission.LAB_RESULT_WRITE))
imaging_request = Depends(require_permission(Permission.IMAGING_REQUEST))
imaging_result_write = Depends(require_permission(Permission.IMAGING_RESULT_WRITE))
ai_triage = Depends(require_permission(Permission.AI_TRIAGE))
ai_documentation = Depends(require_permission(Permission.AI_DOCUMENTATION))
read_billing = Depends(require_permission(Permission.BILLING_READ))
write_billing = Depends(require_permission(Permission.BILLING_WRITE))
manage_users = Depends(require_permission(Permission.USER_MANAGE))
audit_read = Depends(require_permission(Permission.AUDIT_READ))
super_admin = Depends(require_permission(Permission.SUPER_ADMIN))