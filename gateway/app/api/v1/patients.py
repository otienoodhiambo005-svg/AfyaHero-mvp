from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.dependencies import get_db_session, read_patient, write_patient
from app.core.encryption.pii import encrypt_field, decrypt_field
from app.core.audit.writer import write_audit_log
from app.core.audit.events import AuditEvent
from app.core.tenancy.context import get_hospital_id, get_user_id
from app.schemas.patients import PatientCreate, PatientUpdate, PatientRead

router = APIRouter()


@router.get("/", dependencies=[read_patient], response_model=List[PatientRead])
async def list_patients(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session)
):
    """List patients for current hospital"""
    hospital_id = get_hospital_id()

    # Note: Using SQLAlchemy's text() for parameterization is handled by the session wrapper
    result = await db.execute("""
        SELECT id, full_name_enc, dob, gender, opd_number, created_at, updated_at, 
               hospital_id, status, national_id_enc, phone_enc, sha_number_enc, 
               insurance_provider, insurance_id, blood_group, allergies, county, religion, consent_given
        FROM patients
        WHERE hospital_id = :hospital_id AND status != 'archived'
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :skip
    """, {"hospital_id": hospital_id, "limit": limit, "skip": skip})

    patients = []
    for row in result.mappings().all():
        patient_dict = dict(row)
        # Decrypt PII fields
        if patient_dict.get("name_enc"):
            patient_dict["name"] = decrypt_field(patient_dict.pop("name_enc"))
        if patient_dict.get("national_id_enc"):
            patient_dict["national_id"] = decrypt_field(patient_dict.pop("national_id_enc"))
        if patient_dict.get("phone_enc"):
            patient_dict["phone"] = decrypt_field(patient_dict.pop("phone_enc"))
        if patient_dict.get("shif_number_enc"):
            patient_dict["shif_number"] = decrypt_field(patient_dict.pop("shif_number_enc"))
        
        patients.append(patient_dict)

    await write_audit_log(
        event=AuditEvent.PATIENT_SEARCHED,
        user_id=get_user_id(),
        hospital_id=hospital_id,
        detail={"skip": skip, "limit": limit, "count": len(patients)}
    )

    return patients


@router.get("/{patient_id}", dependencies=[read_patient], response_model=PatientRead)
async def get_patient(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db_session)
):
    """Get single patient by ID"""
    hospital_id = get_hospital_id()

    result = await db.execute("""
        SELECT * FROM patients
        WHERE id = :patient_id AND hospital_id = :hospital_id
    """, {"patient_id": patient_id, "hospital_id": hospital_id})

    patient = result.mappings().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Decrypt PII fields
    patient_dict = dict(patient)
    if patient_dict.get("name_enc"):
        patient_dict["name"] = decrypt_field(patient_dict.pop("name_enc"))
    if patient_dict.get("national_id_enc"):
        patient_dict["national_id"] = decrypt_field(patient_dict.pop("national_id_enc"))
    if patient_dict.get("phone_enc"):
        patient_dict["phone"] = decrypt_field(patient_dict.pop("phone_enc"))
    if patient_dict.get("shif_number_enc"):
        patient_dict["shif_number"] = decrypt_field(patient_dict.pop("shif_number_enc"))

    await write_audit_log(
        event=AuditEvent.PATIENT_VIEWED,
        user_id=get_user_id(),
        hospital_id=hospital_id,
        patient_id=str(patient_id),
        resource_type="patient",
        resource_id=str(patient_id)
    )

    return patient_dict


@router.post("/", dependencies=[write_patient], status_code=201)
async def create_patient(
    patient_data: PatientCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """Create new patient"""
    hospital_id = get_hospital_id()

    # Prepare update data
    data = patient_data.model_dump(exclude_unset=True)
    
    # Handle encrypted fields
    data["hospital_id"] = hospital_id
    if "name" in data:
        data["name_enc"] = encrypt_field(data.pop("name"))
    if "national_id" in data:
        data["national_id_enc"] = encrypt_field(data.pop("national_id"))
    if "phone" in data:
        data["phone_enc"] = encrypt_field(data.pop("phone"))
    if "shif_number" in data:
        data["shif_number_enc"] = encrypt_field(data.pop("shif_number"))

    columns = ", ".join(data.keys())
    placeholders = ", ".join([f":{k}" for k in data.keys()])

    result = await db.execute(f"""
        INSERT INTO patients ({columns})
        VALUES ({placeholders})
        RETURNING id
    """, data)

    patient_id = result.scalar_one()
    await db.commit()

    await write_audit_log(
        event=AuditEvent.PATIENT_CREATED,
        user_id=get_user_id(),
        hospital_id=hospital_id,
        patient_id=str(patient_id),
        resource_type="patient",
        resource_id=str(patient_id)
    )

    return {"id": patient_id, "status": "created"}


@router.patch("/{patient_id}", dependencies=[write_patient])
async def update_patient(
    patient_id: UUID,
    update_data: PatientUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    """Update patient details"""
    hospital_id = get_hospital_id()
    
    # Extract data to update
    data = update_data.model_dump(exclude_unset=True)
    if not data:
        return {"status": "no_changes"}

    # Handle PII re-encryption if provided
    updates = {}
    pii_fields = {"full_name", "national_id", "phone", "sha_number"}
    for field in pii_fields:
        if field in data:
            val = data.pop(field)
            if val is not None:
                updates[f"{field}_enc"] = encrypt_field(val)
    
    # Add remaining fields
    updates.update(data)
    updates["updated_at"] = "NOW()" # SQL function

    # Build SET clause
    set_clause = ", ".join([f"{k} = :{k}" if k != "updated_at" else f"{k} = {updates.pop(k)}" for k in updates.keys()])
    updates["patient_id"] = patient_id
    updates["hospital_id"] = hospital_id

    result = await db.execute(f"""
        UPDATE patients
        SET {set_clause}
        WHERE id = :patient_id AND hospital_id = :hospital_id
    """, updates)

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Patient not found or unauthorized")

    await db.commit()

    await write_audit_log(
        event=AuditEvent.PATIENT_UPDATED,
        user_id=get_user_id(),
        hospital_id=hospital_id,
        patient_id=str(patient_id),
        resource_type="patient",
        resource_id=str(patient_id),
        detail={"fields_updated": list(updates.keys())}
    )

    return {"status": "updated"}