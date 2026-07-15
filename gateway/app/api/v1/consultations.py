from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.dependencies import get_db_session, write_patient, read_patient
from app.core.tenancy.context import get_hospital_id, get_user_id
from app.core.audit.writer import write_audit_log
from app.core.audit.events import AuditEvent
from app.schemas.consultation import ConsultationCreate, ConsultationRead

router = APIRouter()

@router.post("/", status_code=201, response_model=dict)
async def create_consultation(
    consultation: ConsultationCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """Record a clinical consultation (physical or teleconsult)"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()

    # Convert SOAP notes to JSON for the notes field if present
    notes_content = consultation.notes
    if consultation.soap_notes:
        import json
        notes_content = json.dumps(consultation.soap_notes.model_dump(exclude_none=True))

    db_data = {
        "id": consultation.id if hasattr(consultation, 'id') and consultation.id else None,
        "hospital_id": hospital_id,
        "patient_id": consultation.patient_id,
        "practitioner_id": consultation.practitioner_id or user_id,
        "notes": notes_content,
        "diagnosis": consultation.diagnosis,
        "prescription_id": consultation.prescription_id,
        "status": consultation.status,
    }

    # Filter out None values to let DB defaults work
    db_data = {k: v for k, v in db_data.items() if v is not None}

    columns = ", ".join(db_data.keys())
    placeholders = ", ".join([f":{k}" for k in db_data.keys()])

    result = await db.execute(f"""
        INSERT INTO consultations ({columns})
        VALUES ({placeholders})
        RETURNING id
    """, db_data)

    consultation_id = result.scalar_one()
    await db.commit()

    await write_audit_log(
        event=AuditEvent.CONSULTATION_COMPLETED,
        user_id=user_id,
        hospital_id=hospital_id,
        patient_id=str(consultation.patient_id),
        resource_type="consultation",
        resource_id=str(consultation_id)
    )

    return {"id": consultation_id, "status": "recorded"}

@router.get("/", response_model=List[ConsultationRead])
async def list_consultations(
    patient_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session)
):
    """List consultations for current hospital, optionally filtered by patient"""
    hospital_id = get_hospital_id()

    query = "SELECT * FROM consultations WHERE hospital_id = :hospital_id"
    params = {"hospital_id": hospital_id, "limit": limit, "skip": skip}

    if patient_id:
        query += " AND patient_id = :patient_id"
        params["patient_id"] = patient_id

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"

    result = await db.execute(query, params)
    
    return [dict(row) for row in result.mappings().all()]

@router.get("/{consultation_id}", response_model=ConsultationRead)
async def get_consultation(
    consultation_id: UUID,
    db: AsyncSession = Depends(get_db_session)
):
    """Get single consultation details"""
    hospital_id = get_hospital_id()

    result = await db.execute("""
        SELECT * FROM consultations
        WHERE id = :consultation_id AND hospital_id = :hospital_id
    """, {"consultation_id": consultation_id, "hospital_id": hospital_id})

    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Consultation not found")

    return dict(row)
