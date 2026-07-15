"""
KDPA Consent API - Data Protection & Privacy
Required for Kenya Data Protection Act compliance
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, UTC
from uuid import uuid4

from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id, get_user_id
from app.core.audit.writer import write_audit_log
from app.core.audit.events import AuditEvent

router = APIRouter()


# Consent Types
class ConsentType:
    PHI_ACCESS = "phi_access"
    AI_DECISION_SUPPORT = "ai_decision_support"
    TELECONSULT = "teleconsult"
    DATA_SHARE_THIRD_PARTY = "data_share_third_party"
    MARKETING = "marketing"
    RESEARCH = "research"


# Schemas
class ConsentCreate(BaseModel):
    consent_type: str
    granted: bool
    version: str  # Privacy policy version
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ConsentQuery(BaseModel):
    patient_id: str
    lookup_key: str = "patient_id"


class ErasureRequest(BaseModel):
    patient_id: str
    reason: Optional[str] = None


class DataExportRequest(BaseModel):
    patient_id: str
    format: str = "json"  # json, pdf


# ─── Consent Management ───────────────────────────────────


@router.post("/consent", status_code=201)
async def grant_consent(consent: ConsentCreate, db=Depends(get_db_session)):
    """Grant or revoke consent (patient-facing)"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()
    consent_id = str(uuid4())

    now = datetime.now(UTC).isoformat()

    # Validate consent type
    valid_types = [
        ConsentType.PHI_ACCESS,
        ConsentType.AI_DECISION_SUPPORT,
        ConsentType.TELECONSULT,
        ConsentType.DATA_SHARE_THIRD_PARTY,
        ConsentType.MARKETING,
        ConsentType.RESEARCH,
    ]

    if consent.consent_type not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid consent type")

    # Check if consent already exists
    check = await db.execute(
        """
        SELECT id FROM patient_consents
        WHERE patient_id = :patient_id
        AND consent_type = :consent_type
        AND (revoked_at IS NULL OR revoked_at > :now)
    """,
        {"patient_id": user_id, "consent_type": consent.consent_type, "now": now},
    )

    existing = check.fetchone()

    if existing and consent.granted:
        # Update existing consent
        await db.execute(
            """
            UPDATE patient_consents
            SET granted = :granted,
                version = :version,
                granted_at = :now,
                revoked_at = NULL,
                ip_address = :ip,
                user_agent = :ua
            WHERE id = :id
        """,
            {
                "id": existing.id,
                "granted": consent.granted,
                "version": consent.version,
                "now": now,
                "ip": consent.ip_address,
                "ua": consent.user_agent,
            },
        )

    elif not existing:
        # Insert new consent
        await db.execute(
            """
            INSERT INTO patient_consents (
                id, patient_id, consent_type, granted,
                version, granted_at, ip_address, user_agent
            )
            VALUES (
                :id, :patient_id, :consent_type, :granted,
                :version, :now, :ip, :ua
            )
        """,
            {
                "id": consent_id,
                "patient_id": user_id,
                "consent_type": consent.consent_type,
                "granted": consent.granted,
                "version": consent.version,
                "now": now,
                "ip": consent.ip_address,
                "ua": consent.user_agent,
            },
        )

    await db.commit()

    # Audit
    await write_audit_log(
        event=AuditEvent.CONSENT_GRANTED
        if consent.granted
        else AuditEvent.CONSENT_REVOKED,
        user_id=user_id,
        hospital_id=hospital_id,
        patient_id=user_id,
        detail={"consent_type": consent.consent_type, "version": consent.version},
    )

    return {
        "consent_type": consent.consent_type,
        "granted": consent.granted,
        "version": consent.version,
        "timestamp": now,
        "message": "Consent recorded successfully",
    }


@router.get("/consent/status")
async def get_consent_status(
    patient_id: Optional[str] = None, db=Depends(get_db_session)
):
    """Get all consent statuses for a patient"""
    user_id = get_user_id()
    query_id = patient_id or user_id

    result = await db.execute(
        """
        SELECT consent_type, granted, version, granted_at, revoked_at
        FROM patient_consents
        WHERE patient_id = :patient_id
        ORDER BY granted_at DESC
    """,
        {"patient_id": query_id},
    )

    consents = result.fetchall()

    # Build status map
    status_map = {}
    now = datetime.now(UTC).isoformat()

    for c in consents:
        key = c.consent_type
        if key not in status_map:
            status_map[key] = {
                "granted": c.granted,
                "version": c.version,
                "granted_at": c.granted_at.isoformat() if c.granted_at else None,
            }

    return {"patient_id": query_id, "consents": status_map}


# ─── Right to Erasure ─────────────────────────────────────


@router.post("/erasure-request", status_code=201)
async def request_erasure(request: ErasureRequest, db=Depends(get_db_session)):
    """Request data erasure (KDPA right to erasure)"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()
    erasure_id = str(uuid4())

    now = datetime.now(UTC).isoformat()

    # Create erasure request
    await db.execute(
        """
        INSERT INTO kdpa_erasure_requests (
            id, patient_id, hospital_id, reason, status, requested_at,
            requested_by
        )
        VALUES (
            :id, :patient_id, :hospital_id, :reason, 'pending', :now,
            :requested_by
        )
    """,
        {
            "id": erasure_id,
            "patient_id": request.patient_id,
            "hospital_id": hospital_id,
            "reason": request.reason or "Not specified",
            "now": now,
            "requested_by": user_id,
        },
    )

    await db.commit()

    # Audit
    await write_audit_log(
        event=AuditEvent.DATA_ERASURE_REQUESTED,
        user_id=user_id,
        hospital_id=hospital_id,
        patient_id=request.patient_id,
        detail={"erasure_id": erasure_id, "reason": request.reason},
    )

    return {
        "erasure_id": erasure_id,
        "status": "pending",
        "message": "Erasure request submitted. Processing may take up to 30 days.",
        "timeline": "KDPA allows 30 days to process erasure requests",
    }


@router.get("/erasure-requests")
async def list_erasure_requests(
    status: Optional[str] = None, db=Depends(get_db_session)
):
    """List erasure requests (for compliance admin)"""
    hospital_id = get_hospital_id()

    query = """
        SELECT id, patient_id, reason, status, requested_at, 
               processed_at, processed_by
        FROM kdpa_erasure_requests
        WHERE hospital_id = :hospital_id
    """
    params = {"hospital_id": hospital_id}

    if status:
        query += " AND status = :status"
        params["status"] = status

    query += " ORDER BY requested_at DESC LIMIT 50"

    result = await db.execute(query, params)
    requests = result.fetchall()

    return {
        "requests": [
            {
                "id": r.id,
                "patient_id": r.patient_id,
                "reason": r.reason,
                "status": r.status,
                "requested_at": r.requested_at.isoformat() if r.requested_at else None,
                "processed_at": r.processed_at.isoformat() if r.processed_at else None,
            }
            for r in requests
        ]
    }


@router.post("/erasure-requests/{erasure_id}/process")
async def process_erasure(erasure_id: str, action: dict, db=Depends(get_db_session)):
    """Process erasure request (anonymize or reject)"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()

    action_type = action.get("action")  # "anonymize" or "reject"
    now = datetime.now(UTC).isoformat()

    if action_type == "anonymize":
        # Anonymize patient data
        await db.execute(
            """
            UPDATE patients
            SET 
                name = '[ANONYMIZED]',
                id_number = NULL,
                phone = NULL,
                email = NULL,
                address = NULL,
                shif_number = NULL,
                updated_at = :now
            WHERE id = (
                SELECT patient_id FROM kdpa_erasure_requests
                WHERE id = :erasure_id
            )
        """,
            {"erasure_id": erasure_id, "now": now},
        )

        # Mark as processed
        await db.execute(
            """
            UPDATE kdpa_erasure_requests
            SET status = 'completed',
                processed_at = :now,
                processed_by = :user_id
            WHERE id = :erasure_id
        """,
            {"erasure_id": erasure_id, "now": now, "user_id": user_id},
        )

    elif action_type == "reject":
        await db.execute(
            """
            UPDATE kdpa_erasure_requests
            SET status = 'rejected',
                rejection_reason = :reason,
                processed_at = :now,
                processed_by = :user_id
            WHERE id = :erasure_id
        """,
            {
                "erasure_id": erasure_id,
                "reason": action.get("reason", "Request denied"),
                "now": now,
                "user_id": user_id,
            },
        )

    await db.commit()

    return {
        "erasure_id": erasure_id,
        "status": "completed" if action_type == "anonymize" else "rejected",
        "processed_at": now,
    }


# ─── Data Portability ─────────────────────────────────────


@router.post("/export-request", status_code=201)
async def request_data_export(request: DataExportRequest, db=Depends(get_db_session)):
    """Request data export (KDPA right to data portability)"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()
    export_id = str(uuid4())

    now = datetime.now(UTC).isoformat()

    # Create export request
    await db.execute(
        """
        INSERT INTO kdpa_export_requests (
            id, patient_id, hospital_id, format, status,
            requested_at, requested_by
        )
        VALUES (
            :id, :patient_id, :hospital_id, :format, 'pending', :now,
            :requested_by
        )
    """,
        {
            "id": export_id,
            "patient_id": request.patient_id,
            "hospital_id": hospital_id,
            "format": request.format,
            "now": now,
            "requested_by": user_id,
        },
    )

    await db.commit()

    return {
        "export_id": export_id,
        "status": "pending",
        "message": "Data export being prepared. Will be available for download shortly.",
    }


@router.get("/export-requests")
async def list_export_requests(
    status: Optional[str] = None, db=Depends(get_db_session)
):
    """List export requests"""
    hospital_id = get_hospital_id()

    query = """
        SELECT id, patient_id, format, status, requested_at, 
               completed_at, download_url
        FROM kdpa_export_requests
        WHERE hospital_id = :hospital_id
    """
    params = {"hospital_id": hospital_id}

    if status:
        query += " AND status = :status"
        params["status"] = status

    query += " ORDER BY requested_at DESC LIMIT 50"

    result = await db.execute(query, params)
    requests = result.fetchall()

    return {
        "requests": [
            {
                "id": r.id,
                "patient_id": r.patient_id,
                "format": r.format,
                "status": r.status,
                "requested_at": r.requested_at.isoformat() if r.requested_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in requests
        ]
    }
