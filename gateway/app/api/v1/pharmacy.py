"""
Pharmacy Module API - Prescriptions and Dispensing
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, UTC
from uuid import uuid4

from app.dependencies import get_db_session, write_prescription, dispense_prescription
from app.core.tenancy.context import get_hospital_id, get_user_id
from app.core.audit.writer import write_audit_log
from app.core.audit.events import AuditEvent

router = APIRouter()


# Pydantic Schemas
class MedicationItem(BaseModel):
    name: str
    dose: float
    unit: str = "mg"
    frequency: str
    duration_days: Optional[int] = None
    route: str = "oral"
    quantity: int


class PrescriptionCreate(BaseModel):
    patient_id: str
    encounter_id: Optional[str] = None
    medications: list[MedicationItem]
    notes: Optional[str] = None
    is_shif_claim: bool = False


class DispenseCreate(BaseModel):
    prescription_id: str
    dispensed_by: str
    items: list[dict]


class PrescriptionResponse(BaseModel):
    id: str
    patient_id: str
    status: str
    medications: list
    created_at: str
    dispensed_at: Optional[str] = None


@router.post("/prescriptions", status_code=201, dependencies=[write_prescription])
async def create_prescription(
    prescription: PrescriptionCreate, db=Depends(get_db_session)
):
    """Create a new prescription"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()
    prescription_id = str(uuid4())

    now = datetime.now(UTC).isoformat()

    # Build medication records
    medication_records = []
    for med in prescription.medications:
        medication_records.append(
            {
                "name": med.name,
                "dose": med.dose,
                "unit": med.unit,
                "frequency": med.frequency,
                "duration_days": med.duration_days,
                "route": med.route,
                "quantity": med.quantity,
            }
        )

    # Insert prescription
    result = await db.execute(
        """
        INSERT INTO prescriptions (
            id, hospital_id, patient_id, encounter_id,
            medications, status, created_by, created_at, is_shif_claim
        )
        VALUES (
            :id, :hospital_id, :patient_id, :encounter_id,
            :medications, 'pending', :user_id, :now, :is_shif_claim
        )
        RETURNING id
    """,
        {
            "id": prescription_id,
            "hospital_id": hospital_id,
            "patient_id": prescription.patient_id,
            "encounter_id": prescription.encounter_id,
            "medications": str(medication_records),
            "user_id": user_id,
            "now": now,
            "is_shif_claim": prescription.is_shif_claim,
        },
    )

    prescription_db_id = result.scalar_one()
    await db.commit()

    # Audit log
    await write_audit_log(
        event=AuditEvent.PRESCRIPTION_CREATED,
        user_id=user_id,
        hospital_id=hospital_id,
        patient_id=prescription.patient_id,
        resource_type="prescription",
        resource_id=prescription_id,
        detail={
            "medication_count": len(prescription.medications),
            "is_shif_claim": prescription.is_shif_claim,
        },
    )

    return {
        "id": prescription_id,
        "status": "pending",
        "created_at": now,
        "message": "Prescription created successfully",
    }


@router.get("/prescriptions/pending")
async def get_pending_prescriptions(
    patient_id: Optional[str] = None, db=Depends(get_db_session)
):
    """Get pending prescriptions for dispensing"""
    hospital_id = get_hospital_id()

    query = """
        SELECT id, patient_id, encounter_id, medications, created_at, created_by
        FROM prescriptions
        WHERE hospital_id = :hospital_id AND status = 'pending'
    """
    params = {"hospital_id": hospital_id}

    if patient_id:
        query += " AND patient_id = :patient_id"
        params["patient_id"] = patient_id

    query += " ORDER BY created_at DESC LIMIT 50"

    result = await db.execute(query, params)
    prescriptions = result.fetchall()

    return {
        "prescriptions": [
            {
                "id": p.id,
                "patient_id": p.patient_id,
                "encounter_id": p.encounter_id,
                "medications": eval(p.medications)
                if isinstance(p.medications, str)
                else p.medications,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in prescriptions
        ]
    }


@router.post(
    "/prescriptions/{prescription_id}/dispense", dependencies=[dispense_prescription]
)
async def dispense_prescription(
    prescription_id: str, dispense: DispenseCreate, db=Depends(get_db_session)
):
    """Mark prescription as dispensed"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()

    now = datetime.now(UTC).isoformat()

    # Check prescription exists and is pending
    check = await db.execute(
        """
        SELECT id, status FROM prescriptions
        WHERE id = :id AND hospital_id = :hospital_id
    """,
        {"id": prescription_id, "hospital_id": hospital_id},
    )

    prescription = check.fetchone()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")

    if prescription.status != "pending":
        raise HTTPException(
            status_code=400, detail=f"Prescription already {prescription.status}"
        )

    # Update prescription status
    await db.execute(
        """
        UPDATE prescriptions
        SET status = 'dispensed',
            dispensed_by = :user_id,
            dispensed_at = :now,
            dispensed_items = :items
        WHERE id = :id
    """,
        {
            "id": prescription_id,
            "user_id": user_id,
            "now": now,
            "items": str(dispense.items),
        },
    )

    await db.commit()

    # Audit log
    await write_audit_log(
        event=AuditEvent.PRESCRIPTION_DISPENSED,
        user_id=user_id,
        hospital_id=hospital_id,
        patient_id=prescription.patient_id,
        resource_type="prescription",
        resource_id=prescription_id,
        detail={"dispensed_by": dispense.dispensed_by},
    )

    return {
        "id": prescription_id,
        "status": "dispensed",
        "dispensed_at": now,
        "message": "Prescription dispensed successfully",
    }


@router.post("/prescriptions/{prescription_id}/reject")
async def reject_prescription(
    prescription_id: str, reason: dict, db=Depends(get_db_session)
):
    """Reject a prescription"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()

    now = datetime.now(UTC).isoformat()

    await db.execute(
        """
        UPDATE prescriptions
        SET status = 'rejected',
            rejected_by = :user_id,
            rejected_at = :now,
            rejection_reason = :reason
        WHERE id = :id AND hospital_id = :hospital_id
    """,
        {
            "id": prescription_id,
            "user_id": user_id,
            "now": now,
            "reason": reason.get("reason", "No reason provided"),
        },
    )

    await db.commit()

    return {
        "id": prescription_id,
        "status": "rejected",
        "message": "Prescription rejected",
    }


@router.get("/inventory")
async def get_inventory(
    search: Optional[str] = None,
    low_stock_only: bool = False,
    db=Depends(get_db_session),
):
    """Get pharmacy inventory"""
    hospital_id = get_hospital_id()

    query = "SELECT * FROM pharmacy_inventory WHERE hospital_id = :hospital_id"
    params = {"hospital_id": hospital_id}

    if search:
        query += " AND (name ILIKE :search OR code ILIKE :search)"
        params["search"] = f"%{search}%"

    if low_stock_only:
        query += " AND current_stock <= reorder_level"

    query += " ORDER BY name LIMIT 100"

    result = await db.execute(query, params)
    items = result.fetchall()

    return {
        "items": [
            {
                "id": item.id,
                "name": item.name,
                "code": item.code,
                "current_stock": item.current_stock,
                "reorder_level": item.reorder_level,
                "unit_price": float(item.unit_price) if item.unit_price else 0,
                "expiry_date": item.expiry_date.isoformat()
                if item.expiry_date
                else None,
            }
            for item in items
        ]
    }


@router.post("/inventory/{item_id}/adjust")
async def adjust_inventory(item_id: str, adjustment: dict, db=Depends(get_db_session)):
    """Adjust inventory (receive stock, damage, etc.)"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()

    adjustment_type = adjustment.get(
        "type"
    )  # "receive", "damage", "expired", "returned"
    quantity = adjustment.get("quantity", 0)
    reason = adjustment.get("reason", "")

    # Get current stock
    check = await db.execute(
        """
        SELECT current_stock FROM pharmacy_inventory
        WHERE id = :id AND hospital_id = :hospital_id
    """,
        {"id": item_id, "hospital_id": hospital_id},
    )

    item = check.fetchone()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Calculate new stock
    if adjustment_type in ("receive", "returned"):
        new_stock = item.current_stock + quantity
    else:  # damage, expired
        new_stock = item.current_stock - quantity

    # Update
    await db.execute(
        """
        UPDATE pharmacy_inventory
        SET current_stock = :new_stock, updated_at = NOW()
        WHERE id = :id
    """,
        {"id": item_id, "new_stock": new_stock},
    )

    await db.commit()

    return {
        "id": item_id,
        "previous_stock": item.current_stock,
        "new_stock": new_stock,
        "adjustment_type": adjustment_type,
    }
