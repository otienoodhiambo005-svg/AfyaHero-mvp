"""
Bed Management API - Location-based bed tracking
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import uuid4

router = APIRouter()


class BedCreate(BaseModel):
    ward_name: str
    bed_number: str
    bed_type: Optional[str] = "general"


class BedUpdate(BaseModel):
    ward_name: Optional[str] = None
    bed_type: Optional[str] = None
    status: Optional[str] = None


class BedResponse(BaseModel):
    location_id: str
    facility_id: str
    ward_name: str
    bed_number: str
    bed_type: str
    status: str
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    admitted_at: Optional[str] = None
    expected_discharge: Optional[str] = None
    encounter_id: Optional[str] = None
    days_admitted: Optional[int] = None


class AdmissionRequest(BaseModel):
    patient_id: str
    bed_id: str
    expected_los: Optional[int] = 3  # days
    admitting_dx: Optional[str] = None
    encounter_id: Optional[str] = None


class DischargeRequest(BaseModel):
    disposition: str  # 'home', 'transfer'
    summary: Optional[str] = None
    meds: Optional[list[str]] = None


class BedStatsResponse(BaseModel):
    total_beds: int
    occupied: int
    available: int
    cleaning: int
    occupancy_rate: float


from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id, get_user_id


@router.get("", response_model=list[BedResponse])
async def list_beds(
    ward: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    show_blocked: bool = Query(False),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """List beds, optionally by ward"""

    conditions = ["bs.facility_id = :hospital_id"]
    params = {"hospital_id": hospital_id}

    if ward:
        conditions.append("bs.ward_name = :ward")
        params["ward"] = ward

    if status_filter:
        conditions.append("bs.status = :status")
        params["status"] = status_filter
    elif not show_blocked:
        conditions.append("bs.status != 'blocked'")

    where_clause = " AND ".join(conditions)

    sql = f"""
        SELECT bs.location_id, bs.facility_id, bs.ward_name, bs.bed_number,
               bs.bed_type, bs.status, bs.patient_id, bs.patient_name,
               bs.admitted_at, bs.expected_discharge, bs.encounter_id,
               EXTRACT(DAY FROM (NOW() - bs.admitted_at)) as days_admitted
        FROM bed_status bs
        WHERE {where_clause}
        ORDER BY bs.ward_name, bs.bed_number
    """
    rows = await db.fetchall(sql, params)

    return [
        BedResponse(
            location_id=str(row["location_id"]),
            facility_id=str(row["facility_id"]),
            ward_name=row["ward_name"],
            bed_number=row["bed_number"],
            bed_type=row["bed_type"],
            status=row["status"],
            patient_id=str(row["patient_id"]) if row["patient_id"] else None,
            patient_name=row["patient_name"],
            admitted_at=row["admitted_at"].isoformat() if row["admitted_at"] else None,
            expected_discharge=row["expected_discharge"].isoformat()
            if row["expected_discharge"]
            else None,
            encounter_id=str(row["encounter_id"]) if row["encounter_id"] else None,
            days_admitted=int(row["days_admitted"]) if row["days_admitted"] else None,
        )
        for row in rows
    ]


@router.get("/wards")
async def list_wards(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """List wards with bed counts"""

    sql = """
        SELECT ward_name, bed_type,
               COUNT(*) as total,
               COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
               COUNT(CASE WHEN status = 'free' THEN 1 END) as available,
               COUNT(CASE WHEN status = 'cleaning' THEN 1 END) as cleaning
        FROM bed_status
        WHERE facility_id = :hospital_id
        GROUP BY ward_name, bed_type
        ORDER BY ward_name
    """
    rows = await db.fetchall(sql, {"hospital_id": hospital_id})

    return [{"ward": row["ward_name"], **row} for row in rows]


@router.get("/stats", response_model=BedStatsResponse)
async def get_bed_stats(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get bed statistics"""

    sql = """
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
            COUNT(CASE WHEN status = 'free' THEN 1 END) as available,
            COUNT(CASE WHEN status = 'cleaning' THEN 1 END) as cleaning
        FROM bed_status
        WHERE facility_id = :hospital_id
    """
    row = await db.fetchone(sql, {"hospital_id": hospital_id})

    total = row["total"] or 0
    occupied = row["occupied"] or 0

    return BedStatsResponse(
        total_beds=total,
        occupied=occupied,
        available=row["available"] or 0,
        cleaning=row["cleaning"] or 0,
        occupancy_rate=round((occupied / total) * 100, 1) if total > 0 else 0,
    )


@router.post("", response_model=BedResponse)
async def create_bed(
    bed: BedCreate,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Create new bed"""

    location_id = str(uuid4())

    # Create Location FHIR resource
    fhir_location = {
        "resourceType": "Location",
        "id": location_id,
        "status": "active",
        "physicalType": {"coding": [{"code": "bd"}]},
        "name": bed.bed_number,
        "type": [{"text": bed.bed_type}],
        "partOf": {"display": bed.ward_name},
        "managingOrganization": {"reference": f"Organization/{hospital_id}"},
    }

    await db.execute(
        """INSERT INTO fhir_resources (resource_type, fhir_id, facility_id, data)
           VALUES ('Location', :location_id, :facility_id, :data)""",
        {
            "location_id": location_id,
            "facility_id": hospital_id,
            "data": str(fhir_location),
        },
    )

    await db.execute(
        """INSERT INTO bed_status (location_id, facility_id, ward_name, bed_number, bed_type, status)
           VALUES (:location_id, :facility_id, :ward_name, :bed_number, :bed_type, 'free')""",
        {
            "location_id": location_id,
            "facility_id": hospital_id,
            "ward_name": bed.ward_name,
            "bed_number": bed.bed_number,
            "bed_type": bed.bed_type,
        },
    )

    return BedResponse(
        location_id=location_id,
        facility_id=hospital_id,
        ward_name=bed.ward_name,
        bed_number=bed.bed_number,
        bed_type=bed.bed_type,
        status="free",
    )


@router.post("/admit", response_model=BedResponse)
async def admit_patient(
    request: AdmissionRequest,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
    user_id: str = Depends(get_user_id),
):
    """Admit patient to bed"""

    # Check bed is available
    bed = await db.fetchone(
        """SELECT * FROM bed_status 
           WHERE location_id = :bed_id AND facility_id = :hospital_id 
           AND status = 'free'""",
        {"bed_id": request.bed_id, "hospital_id": hospital_id},
    )

    if not bed:
        raise HTTPException(status_code=400, detail="Bed not available or not found")

    # Get patient
    patient = await db.fetchone(
        "SELECT name FROM patients WHERE id = :patient_id",
        {"patient_id": request.patient_id},
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Create/update Encounter
    encounter_id = request.encounter_id or str(uuid4())

    await db.execute(
        """INSERT INTO encounters (id, hospital_id, patient_id, practitioner_id, status)
           VALUES (:id, :hospital_id, :patient_id, :practitioner_id, 'in-progress')
           ON CONFLICT (id) DO UPDATE SET status = 'in-progress'""",
        {
            "id": encounter_id,
            "hospital_id": hospital_id,
            "patient_id": request.patient_id,
            "practitioner_id": user_id,
        },
    )

    # Update Location with occupiedBy
    await db.execute(
        """UPDATE fhir_resources 
           SET data = jsonb_set(data, '{{extension}}', 
               jsonb_build_array(jsonb_build_object('url', 'occupiedBy', 'valueReference', :encounter_ref))),
               updated_at = NOW()
           WHERE fhir_id = :bed_id AND resource_type = 'Location'""",
        {"bed_id": request.bed_id, "encounter_ref": f"Encounter/{encounter_id}"},
    )

    # Update bed_status
    expected_discharge = date.today() + (request.expected_los or 3)

    await db.execute(
        """UPDATE bed_status 
           SET status = 'occupied', patient_id = :patient_id, patient_name = :patient_name,
               admitted_at = NOW(), expected_discharge = :expected_discharge, encounter_id = :encounter_id
           WHERE location_id = :bed_id""",
        {
            "patient_id": request.patient_id,
            "patient_name": patient["name"],
            "expected_discharge": expected_discharge,
            "encounter_id": encounter_id,
            "bed_id": request.bed_id,
        },
    )

    # Create housekeeping Task
    task_id = str(uuid4())
    await db.execute(
        """INSERT INTO fhir_resources (resource_type, fhir_id, facility_id, data)
           VALUES ('Task', :task_id, :facility_id, :data)""",
        {
            "task_id": task_id,
            "facility_id": hospital_id,
            "data": str(
                {
                    "resourceType": "Task",
                    "id": task_id,
                    "status": "requested",
                    "intent": "order",
                    "code": {"text": "housekeeping"},
                    "for": {"reference": f"Location/{request.bed_id}"},
                    "owner": {"reference": f"Organization/{hospital_id}"},
                }
            ),
        },
    )

    return BedResponse(
        location_id=request.bed_id,
        facility_id=hospital_id,
        ward_name=bed["ward_name"],
        bed_number=bed["bed_number"],
        bed_type=bed["bed_type"],
        status="occupied",
        patient_id=request.patient_id,
        patient_name=patient["name"],
        admitted_at=datetime.now().isoformat(),
        expected_discharge=expected_discharge.isoformat(),
        encounter_id=encounter_id,
        days_admitted=0,
    )


@router.post("/{bed_id}/discharge", response_model=BedResponse)
async def discharge_patient(
    bed_id: str,
    request: DischargeRequest,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Discharge patient, free bed"""

    # Get bed
    bed = await db.fetchone(
        "SELECT * FROM bed_status WHERE location_id = :bed_id AND facility_id = :hospital_id AND status = 'occupied'",
        {"bed_id": bed_id, "hospital_id": hospital_id},
    )

    if not bed:
        raise HTTPException(status_code=400, detail="No patient in this bed")

    # Update Encounter
    if bed["encounter_id"]:
        await db.execute(
            """UPDATE encounters 
               SET status = 'finished', 
                   hospitalization = jsonb_build_object('dischargeDisposition', :disposition)
               WHERE id = :encounter_id""",
            {"disposition": request.disposition, "encounter_id": bed["encounter_id"]},
        )

    # Clear Location extension
    await db.execute(
        """UPDATE fhir_resources 
           SET data = jsonb_set(data, '{{extension}}', '[]', true),
               updated_at = NOW()
           WHERE fhir_id = :bed_id AND resource_type = 'Location'""",
        {"bed_id": bed_id},
    )

    # Set bed to cleaning
    await db.execute(
        """UPDATE bed_status 
           SET status = 'cleaning', patient_id = NULL, patient_name = NULL,
               encounter_id = NULL, admitted_at = NULL
           WHERE location_id = :bed_id""",
        {"bed_id": bed_id},
    )

    # Update housekeeping task
    await db.execute(
        """UPDATE fhir_resources 
           SET data = jsonb_set(data, '{{status}}', '"requested"')
           WHERE data->'code'->>'text' = 'housekeeping'
           AND data->'for'->>'reference' = :bed_ref""",
        {"bed_ref": f"Location/{bed_id}"},
    )

    # Send WhatsApp to patient
    if bed["patient_id"]:
        patient_phone = await db.fetchone(
            "SELECT phone FROM patients WHERE id = :patient_id",
            {"patient_id": bed["patient_id"]},
        )

        if patient_phone and patient_phone["phone"]:
            await db.execute(
                """INSERT INTO communication_queue (patient_id, phone, channel, message, status)
                   VALUES (:patient_id, :phone, 'whatsapp', :message, 'pending')""",
                {
                    "patient_id": bed["patient_id"],
                    "phone": patient_phone["phone"],
                    "message": f"Umeruhusiwa. Muhtasari: {request.summary or 'link'}. Dawa: {', '.join(request.meds) if request.med else 'hakuna'}.",
                },
            )

    return BedResponse(
        location_id=bed_id,
        facility_id=hospital_id,
        ward_name=bed["ward_name"],
        bed_number=bed["bed_number"],
        bed_type=bed["bed_type"],
        status="cleaning",
    )


@router.post("/{bed_id}/clean", response_model=BedResponse)
async def mark_cleaned(
    bed_id: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Mark bed as cleaned/available"""

    result = await db.execute(
        """UPDATE bed_status SET status = 'free' 
           WHERE location_id = :bed_id AND facility_id = :hospital_id AND status = 'cleaning'""",
        {"bed_id": bed_id, "hospital_id": hospital_id},
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=400, detail="Bed not found or not in cleaning status"
        )

    bed = await db.fetchone(
        "SELECT * FROM bed_status WHERE location_id = :bed_id", {"bed_id": bed_id}
    )

    return BedResponse(
        location_id=bed_id,
        facility_id=str(bed["facility_id"]),
        ward_name=bed["ward_name"],
        bed_number=bed["bed_number"],
        bed_type=bed["bed_type"],
        status="free",
    )


@router.get("/queue", response_model=list[dict])
async def get_admission_queue(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get patients waiting for admission (from referrals)"""

    sql = """
        SELECT sr.fhir_id, sr.data->'subject'->>'reference' as patient_ref,
               p.name as patient_name, p.phone,
               sr.data->'code'->>'text' as reason,
               sr.created_at
        FROM fhir_resources sr
        JOIN fhir_resources t ON split_part(t.data->'basedOn'->0->>'reference', '/', 2) = sr.fhir_id
        LEFT JOIN patients p ON p.id = split_part(sr.data->'subject'->>'reference', '/', 2)
        WHERE sr.resource_type = 'ServiceRequest'
        AND sr.data->'category'->0->'coding'->0->>'code' = 'referral'
        AND sr.data->'status' = 'active'
        AND t.data->'status' = 'accepted'
        AND sr.data->'performer'->0->>'reference' = :facility_ref
        AND NOT EXISTS (
            SELECT 1 FROM encounters e
            WHERE e.patient_id = split_part(sr.data->'subject'->>'reference', '/', 2)
            AND e.status = 'in-progress'
        )
        ORDER BY sr.created_at ASC
    """
    rows = await db.fetchall(sql, {"facility_ref": f"Organization/{hospital_id}"})

    return [
        {
            "referral_id": row["fhir_id"],
            "patient_id": row["patient_ref"].split("/")[-1]
            if row["patient_ref"]
            else None,
            "patient_name": row["patient_name"],
            "phone": row["phone"],
            "reason": row["reason"],
            "waiting_since": row["created_at"].isoformat()
            if row["created_at"]
            else None,
        }
        for row in rows
    ]
