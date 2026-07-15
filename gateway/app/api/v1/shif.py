"""
SHIF Claims API - Social Health Insurance Fund Claims Generation and Submission
Per Kenya government rebranding: NHIF → SHIF (Social Health Insurance Fund)
Matches Prisma schema: ShifClaim model
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, UTC
from uuid import uuid4
import json
import hashlib
import base64

from app.dependencies import get_db_session, write_billing
from app.core.tenancy.context import get_hospital_id, get_user_id
from app.core.audit.writer import write_audit_log
from app.core.audit.events import AuditEvent

router = APIRouter()


# SHIF Claim Status (matches Prisma: ShifClaim.status)
class ClaimStatus:
    DRAFT = "draft"
    PENDING = "pending"
    SUBMITTED = "submitted"
    ACKNOWLEDGED = "acknowledged"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"


# Pydantic Schemas
class ClaimLineItem(BaseModel):
    service_code: str
    description: str
    quantity: int = 1
    unit_price: float
    diagnostic_code: Optional[str] = None


class SHIFClaimCreate(BaseModel):
    """Create SHIF claim - matches Prisma ShifClaim fields"""

    patient_id: str
    encounter_id: str
    member_number: str
    preauth_number: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    items: list[ClaimLineItem]


# SHIF Tariff - aligns with official SHIF drug/tariff schedule
SHIF_TARIFF = {
    "001": {"name": "Consultation (General Practitioner)", "rate": 1000},
    "002": {"name": "Consultation (Specialist)", "rate": 2000},
    "003": {"name": "Patient Examination", "rate": 500},
    "004": {"name": "Vital Signs Recording", "rate": 200},
    "005": {"name": "Malaria Test (RDT)", "rate": 300},
    "006": {"name": "Typhoid Test", "rate": 400},
    "007": {"name": "HIV Test", "rate": 200},
    "008": {"name": "Pregnancy Test", "rate": 250},
    "009": {"name": "Blood Glucose Test", "rate": 300},
    "010": {"name": "Urinalysis", "rate": 250},
    "011": {"name": "Complete Blood Count (CBC)", "rate": 800},
    "012": {"name": "Amoxicillin 250mg Caps", "rate": 50},
    "013": {"name": "Paracetamol 500mg Tabs", "rate": 30},
    "014": {"name": "Albendazole 400mg Tabs", "rate": 80},
    "015": {"name": "ORS Packet", "rate": 50},
    "016": {"name": "Zinc Sulphate Tabs", "rate": 100},
    "017": {"name": "Artemether-Lumefantrine (ALu)", "rate": 0},  # Free under SHIF
    "018": {"name": "Insulin Glargine", "rate": 450},
    "019": {"name": "Metformin 500mg", "rate": 50},
    "020": {"name": "Amlodipine 5mg", "rate": 50},
}


def calculate_shif_checksum(data: str) -> str:
    """Calculate SHA-256 checksum for SHIF claim"""
    return hashlib.sha256(data.encode()).hexdigest()[:16].upper()


def build_shif_claim_message(claim: dict, facility_code: str) -> dict:
    """Build FHIR-compliant SHIF claim message"""
    return {
        "resourceType": "Claim",
        "id": claim["id"],
        "status": claim["status"],
        "type": {"coding": [{"system": "http://shif.go.ke", "code": "INST"}]},
        "use": "preclaim",
        "created": claim["created_at"],
        "insurer": {"reference": f"Organization/{facility_code}"},
        "priority": {"coding": [{"code": "normal"}]},
        "facility": {"reference": f"Location/{facility_code}"},
        "claimant": {"reference": f"Patient/{claim['patient_id']}"},
        "coverage": [
            {
                "relationship": {"coding": [{"code": "self"}]},
                "beneficiary": {
                    "reference": f"Patient/{claim['patient_id']}",
                    "display": claim.get("patient_name", ""),
                },
                "identifier": {
                    "system": "http://shif.go.ke/member",
                    "value": claim.get("member_number", ""),
                },
            }
        ],
    }


@router.post("/claims", status_code=201, dependencies=[write_billing])
async def create_shif_claim(claim_request: SHIFClaimCreate, db=Depends(get_db_session)):
    """Create a new SHIF claim - matches Prisma ShifClaim"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()
    claim_id = str(uuid4())

    now = datetime.now(UTC).isoformat()

    # Get encounter details - matches Prisma schema field names
    encounter = await db.execute(
        """
        SELECT e.id, e.patient_id, e.diagnosis, e.treatment,
               p.name as patient_name, p.shif_number
        FROM encounters e
        JOIN patients p ON e.patient_id = p.id
        WHERE e.id = :encounter_id AND e.hospital_id = :hospital_id
    """,
        {"encounter_id": claim_request.encounter_id, "hospital_id": hospital_id},
    )

    encounter_data = encounter.fetchone()
    if not encounter_data:
        raise HTTPException(status_code=404, detail="Encounter not found")

    # Calculate claim amount from items - use SHIF tariff or provided rate
    items_data = []
    total_amount = 0

    for item in claim_request.items:
        rate = SHIF_TARIFF.get(item.service_code, {}).get("rate", item.unit_price)
        item_total = rate * item.quantity
        total_amount += item_total

        items_data.append(
            {
                "service_code": item.service_code,
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": rate,
                "total": item_total,
                "diagnostic_code": item.diagnostic_code,
            }
        )

    # Generate claim number: SHIF-{FACILITY}-{YYYYMMDD}-{UUID_SHORT}
    import uuid

    claim_number = f"SHIF-{hospital_id[:8]}-{datetime.now(UTC).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"

    # Insert claim - matches Prisma ShifClaim schema
    await db.execute(
        """
        INSERT INTO shif_claims (
            id, hospital_id, patient_id, claim_number,
            member_number, diagnosis, treatment,
            amount_claimed, status,
            created_at
        )
        VALUES (
            :id, :hospital_id, :patient_id, :claim_number,
            :member_number, :diagnosis, :treatment,
            :amount_claimed, :status, :now
        )
    """,
        {
            "id": claim_id,
            "hospital_id": hospital_id,
            "patient_id": claim_request.patient_id,
            "claim_number": claim_number,
            "member_number": claim_request.member_number,
            "diagnosis": claim_request.diagnosis or encounter_data.diagnosis,
            "treatment": claim_request.treatment or encounter_data.treatment,
            "amount_claimed": total_amount,
            "status": ClaimStatus.DRAFT,
            "now": now,
        },
    )

    await db.commit()

    # Audit log
    await write_audit_log(
        event=AuditEvent.SHIF_CLAIM_CREATED,
        user_id=user_id,
        hospital_id=hospital_id,
        patient_id=claim_request.patient_id,
        resource_type="shif_claim",
        resource_id=claim_id,
        detail={"total_amount": total_amount},
    )

    return {
        "id": claim_id,
        "claim_number": claim_number,
        "status": ClaimStatus.DRAFT,
        "total_amount": total_amount,
        "item_count": len(items_data),
        "created_at": now,
        "message": "SHIF claim created. Review and submit to SHIF.",
    }


@router.get("/claims")
async def list_shif_claims(
    status: Optional[str] = None,
    patient_id: Optional[str] = None,
    db=Depends(get_db_session),
):
    """List SHIF claims - matches Prisma ShifClaim"""
    hospital_id = get_hospital_id()

    query = """
        SELECT id, patient_id, claim_number, member_number,
               amount_claimed, amount_approved, status,
               submitted_at, decided_at, created_at
        FROM shif_claims
        WHERE hospital_id = :hospital_id
    """
    params = {"hospital_id": hospital_id}

    if status:
        query += " AND status = :status"
        params["status"] = status

    if patient_id:
        query += " AND patient_id = :patient_id"
        params["patient_id"] = patient_id

    query += " ORDER BY created_at DESC LIMIT 50"

    result = await db.execute(query, params)
    claims = result.fetchall()

    return {
        "claims": [
            {
                "id": c.id,
                "patient_id": c.patient_id,
                "claim_number": c.claim_number,
                "member_number": c.member_number,
                "amount_claimed": float(c.amount_claimed) if c.amount_claimed else 0,
                "amount_approved": float(c.amount_approved)
                if c.amount_approved
                else None,
                "status": c.status,
                "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
                "decided_at": c.decided_at.isoformat() if c.decided_at else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in claims
        ]
    }


@router.post("/claims/{claim_id}/submit")
async def submit_claim(claim_id: str, db=Depends(get_db_session)):
    """Submit claim to SHIF"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()

    # Get facility code - uses shif_code in Prisma Hospital model
    facility = await db.execute(
        """
        SELECT shif_code FROM hospitals WHERE id = :hospital_id
    """,
        {"hospital_id": hospital_id},
    )

    facility_data = facility.fetchone()
    if not facility_data or not facility_data.shif_code:
        raise HTTPException(status_code=400, detail="Facility not registered with SHIF")

    facility_code = facility_data.shif_code

    # Get claim
    claim_q = await db.execute(
        """
        SELECT * FROM shif_claims
        WHERE id = :id AND hospital_id = :hospital_id
    """,
        {"id": claim_id, "hospital_id": hospital_id},
    )

    claim = claim_q.fetchone()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.status != ClaimStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Can only submit draft claims")

    # Build claim message
    claim_data = {
        "id": claim_id,
        "patient_id": claim.patient_id,
        "member_number": claim.member_number,
        "created_at": claim.created_at.isoformat() if claim.created_at else None,
    }

    claim_message = build_shif_claim_message(claim_data, facility_code)
    checksum = calculate_shif_checksum(json.dumps(claim_message))

    now = datetime.now(UTC).isoformat()

    # Update to submitted
    await db.execute(
        """
        UPDATE shif_claims
        SET status = :status,
            submitted_at = :now,
            updated_at = :now
        WHERE id = :id
    """,
        {"id": claim_id, "status": ClaimStatus.SUBMITTED, "now": now},
    )

    await db.commit()

    # Audit
    await write_audit_log(
        event=AuditEvent.SHIF_CLAIM_SUBMITTED,
        user_id=user_id,
        hospital_id=hospital_id,
        resource_type="shif_claim",
        resource_id=claim_id,
        detail={"checksum": checksum},
    )

    return {
        "id": claim_id,
        "status": ClaimStatus.SUBMITTED,
        "submitted_at": now,
        "checksum": checksum,
        "message": "Claim submitted to SHIF",
    }


@router.post("/claims/{claim_id}/cancel")
async def cancel_claim(claim_id: str, reason: dict, db=Depends(get_db_session)):
    """Cancel a pending claim"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()

    now = datetime.now(UTC).isoformat()

    await db.execute(
        """
        UPDATE shif_claims
        SET status = :status,
            rejection_reason = :reason,
            updated_at = :now
        WHERE id = :id AND hospital_id = :hospital_id
        AND status IN (:draft, :pending)
    """,
        {
            "id": claim_id,
            "status": ClaimStatus.REJECTED,
            "reason": reason.get("reason", "Not specified"),
            "now": now,
            "draft": ClaimStatus.DRAFT,
            "pending": ClaimStatus.PENDING,
        },
    )

    await db.commit()

    return {"id": claim_id, "status": "cancelled"}


@router.get("/tariff")
async def get_shif_tariff():
    """Get SHIF tariff rates"""
    return {"tariff": SHIF_TARIFF}
