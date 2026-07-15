"""
CHW API - Community Health Worker operations
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()


class CHWRegisterRequest(BaseModel):
    profile_id: str
    catchment_area: str
    village: Optional[str] = None
    sub_location: Optional[str] = None
    phone_number: str


class CHWKitRestockRequest(BaseModel):
    sha_code: str
    quantity: int


class CHWReferralCreate(BaseModel):
    patient_name: str
    patient_phone: Optional[str] = None
    symptoms: str
    urgency: str = "normal"


class CHWReferralResponse(BaseModel):
    referral_id: str
    status: str
    created_at: str


# ──────────────────────────────────────────────────────────────

from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id


@router.get("/profile")
async def get_chw_profile(
    db=Depends(get_db_session),
    user_id: str = Depends(lambda: "current"),
):
    """Get CHW profile"""

    chw = await db.fetchone(
        "SELECT * FROM chw_profiles WHERE profile_id = :profile_id",
        {"profile_id": user_id},
    )

    if not chw:
        raise HTTPException(status_code=404, detail="CHW profile not found")

    return dict(chw)


@router.post("/register")
async def register_chw(
    chw: CHWRegisterRequest,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Register CHW"""

    import uuid

    chw_id = str(uuid4())

    await db.execute(
        """INSERT INTO chw_profiles (
            id, profile_id, facility_id, catchment_area, village, 
            sub_location, phone_number, is_active, created_at
        )
        VALUES (:id, :profile_id, :hospital_id, :area, :village, 
                :sub_location, :phone, true, NOW())""",
        {
            "id": chw_id,
            "profile_id": chw.profile_id,
            "hospital_id": hospital_id,
            "area": chw.catchment_area,
            "village": chw.village,
            "sub_location": chw.sub_location,
            "phone": chw.phone_number,
        },
    )

    return {"status": "registered", "chw_id": chw_id}


@router.get("/kit")
async def get_chw_kit(
    db=Depends(get_db_session),
    user_id: str = Depends(lambda: "current"),
):
    """Get CHW kit inventory"""

    chw = await db.fetchone(
        "SELECT id FROM chw_profiles WHERE profile_id = :profile_id",
        {"profile_id": user_id},
    )

    if not chw:
        raise HTTPException(status_code=404, detail="CHW not found")

    sql = """
        SELECT ck.sha_code, f.name, f.strength, ck.current_qty, 
               ck.min_level, ck.max_level, ck.last_restock
        FROM chw_kits ck
        JOIN formulary f ON f.sha_code = ck.sha_code
        WHERE ck.chw_id = :chw_id
        ORDER BY ck.current_qty ASC
    """
    rows = await db.fetchall(sql, {"chw_id": chw["id"]})

    return [
        {
            "drug": r["sha_code"],
            "name": r["name"],
            "strength": r["strength"],
            "qty": r["current_qty"],
            "min": r["min_level"],
            "max": r["max_level"],
            "needs_restock": r["current_qty"] < r["min_level"],
            "last_restock": r["last_restock"].isoformat()
            if r["last_restock"]
            else None,
        }
        for r in rows
    ]


@router.post("/kit/restock")
async def restock_kit(
    request: CHWKitRestockRequest,
    db=Depends(get_db_session),
    user_id: str = Depends(lambda: "current"),
):
    """Restock CHW kit"""

    chw = await db.fetchone(
        "SELECT id FROM chw_profiles WHERE profile_id = :profile_id",
        {"profile_id": user_id},
    )

    if not chw:
        raise HTTPException(status_code=404, detail="CHW not found")

    kit = await db.fetchone(
        "SELECT * FROM chw_kits WHERE chw_id = :chw_id AND sha_code = :sha_code",
        {"chw_id": chw["id"], "sha_code": request.sha_code},
    )

    if kit:
        await db.execute(
            """UPDATE chw_kits SET current_qty = current_qty + :qty, 
               last_restock = NOW(), updated_at = NOW()
               WHERE chw_id = :chw_id AND sha_code = :sha_code""",
            {
                "qty": request.quantity,
                "chw_id": chw["id"],
                "sha_code": request.sha_code,
            },
        )
    else:
        await db.execute(
            """INSERT INTO chw_kits (chw_id, sha_code, current_qty, min_level, max_level, last_restock)
               VALUES (:chw_id, :sha_code, :qty, 10, 50, NOW())""",
            {
                "chw_id": chw["id"],
                "sha_code": request.sha_code,
                "qty": request.quantity,
            },
        )

    return {
        "status": "restocked",
        "drug": request.sha_code,
        "new_qty": request.quantity,
    }


@router.post("/dispense")
async def chw_dispense(
    patient_id: str,
    sha_code: str,
    quantity: int,
    db=Depends(get_db_session),
    user_id: str = Depends(lambda: "current"),
):
    """Dispense from CHW kit"""

    chw = await db.fetchone(
        "SELECT id FROM chw_profiles WHERE profile_id = :profile_id",
        {"profile_id": user_id},
    )

    if not chw:
        raise HTTPException(status_code=404, detail="CHW not found")

    kit = await db.fetchone(
        "SELECT current_qty FROM chw_kits WHERE chw_id = :chw_id AND sha_code = :sha_code",
        {"chw_id": chw["id"], "sha_code": sha_code},
    )

    if not kit or kit["current_qty"] < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    # Decrement kit
    await db.execute(
        "UPDATE chw_kits SET current_qty = current_qty - :qty WHERE chw_id = :chw_id",
        {"qty": quantity, "chw_id": chw["id"]},
    )

    # Record as MedicationDispense
    import uuid

    dispense_id = str(uuid4())

    await db.execute(
        """INSERT INTO fhir_resources (resource_type, fhir_id, data)
           VALUES ('MedicationDispense', :id, :data)""",
        {
            "id": dispense_id,
            "data": str(
                {
                    "resourceType": "MedicationDispense",
                    "status": "completed",
                    "id": dispense_id,
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "performer": [{"actor": {"reference": f"CHW/{chw['id']}"}}],
                    "quantity": {"value": quantity},
                }
            ),
        },
    )

    return {"status": "dispensed", "quantity": quantity}


# ──────────────────────────────────────────────────────────────
# CHW Referrals
# ──────────────────────────────────────────────────────────────


@router.post("/referrals", response_model=CHWReferralResponse)
async def create_chw_referral(
    referral: CHWReferralCreate,
    facility_id: str,
    db=Depends(get_db_session),
    user_id: str = Depends(lambda: "current"),
):
    """Create CHW referral to facility"""

    chw = await db.fetchone(
        "SELECT id FROM chw_profiles WHERE profile_id = :profile_id",
        {"profile_id": user_id},
    )

    if not chw:
        raise HTTPException(status_code=404, detail="CHW not found")

    import uuid

    ref_id = str(uuid4())

    await db.execute(
        """INSERT INTO chw_referrals (
            id, chw_id, patient_name, patient_phone, symptoms, urgency,
            facility_id, status, created_at
        )
        VALUES (:id, :chw_id, :patient_name, :patient_phone, :symptoms,
                :urgency, :facility_id, 'pending', NOW())""",
        {
            "id": ref_id,
            "chw_id": chw["id"],
            "patient_name": referral.patient_name,
            "patient_phone": referral.patient_phone,
            "symptoms": referral.symptoms,
            "urgency": referral.urgency,
            "facility_id": facility_id,
        },
    )

    return CHWReferralResponse(
        referral_id=ref_id,
        status="pending",
        created_at=datetime.now().isoformat(),
    )


@router.get("/referrals")
async def list_chw_referrals(
    status: Optional[str] = Query(None),
    db=Depends(get_db_session),
    user_id: str = Depends(lambda: "current"),
):
    """List CHW's referrals"""

    chw = await db.fetchone(
        "SELECT id FROM chw_profiles WHERE profile_id = :profile_id",
        {"profile_id": user_id},
    )

    if not chw:
        return []

    params = {"chw_id": chw["id"]}
    where = "chw_id = :chw_id"

    if status:
        where += " AND status = :status"
        params["status"] = status

    sql = f"""
        SELECT id, patient_name, patient_phone, symptoms, urgency, 
               facility_id, status, created_at
        FROM chw_referrals
        WHERE {where}
        ORDER BY created_at DESC
    """
    rows = await db.fetchall(sql, params)

    return [
        {
            "id": str(r["id"]),
            "patient": r["patient_name"],
            "phone": r["patient_phone"],
            "symptoms": r["symptoms"],
            "urgency": r["urgency"],
            "facility": r["facility_id"],
            "status": r["status"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.get("/referrals/pending")
async def get_pending_referrals(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get pending referrals for facility"""

    rows = await db.fetchall(
        """SELECT r.*, c.catchment_area, c.village
           FROM chw_referrals r
           JOIN chw_profiles c ON r.chw_id = c.id
           WHERE r.facility_id = :hospital_id AND r.status = 'pending'
           ORDER BY 
               CASE r.urgency 
                   WHEN 'critical' THEN 1 
                   WHEN 'urgent' THEN 2 
                   ELSE 3 
               END, r.created_at ASC""",
        {"hospital_id": hospital_id},
    )

    return [
        {
            "id": str(r["id"]),
            "patient": r["patient_name"],
            "phone": r["patient_phone"],
            "symptoms": r["symptoms"],
            "urgency": r["urgency"],
            "chw_area": r["catchment_area"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.put("/referrals/{referral_id}/respond")
async def respond_to_referral(
    referral_id: str,
    response: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Facility responds to CHW referral"""

    result = await db.execute(
        """UPDATE chw_referrals 
           SET status = 'acknowledged', facility_response = :response, updated_at = NOW()
           WHERE id = :id AND facility_id = :hospital_id""",
        {"id": referral_id, "response": response, "hospital_id": hospital_id},
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Referral not found")

    return {"status": "acknowledged", "referral_id": referral_id}


# ──────────────────────────────────────────────────────────────
# Health Tips
# ──────────────────────────────────────────────────────────────


@router.get("/health-tips")
async def get_health_tips(
    category: Optional[str] = Query(None),
    limit: int = Query(5, ge=1, le=20),
    db=Depends(get_db_session),
):
    """Get health tips for patients"""

    params = {"limit": limit}
    where = "true"

    if category:
        where = "category = :category"
        params["category"] = category

    sql = f"""
        SELECT id, title_sw, content_sw, category
        FROM health_tips
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT :limit
    """
    rows = await db.fetchall(sql, params)

    return [
        {
            "id": r["id"],
            "title": r["title_sw"],
            "content": r["content_sw"][:200] + "...",
            "category": r["category"],
        }
        for r in rows
    ]


@router.get("/stats")
async def get_chw_stats(
    db=Depends(get_db_session),
    user_id: str = Depends(lambda: "current"),
):
    """Get CHW dashboard stats"""

    chw = await db.fetchone(
        "SELECT id FROM chw_profiles WHERE profile_id = :profile_id",
        {"profile_id": user_id},
    )

    if not chw:
        return {"patients": 0, "referrals": 0, "dispenses": 0}

    patients = await db.fetchone(
        """SELECT COUNT(DISTINCT patient_id) as c 
           FROM chw_referrals WHERE chw_id = :chw_id""",
        {"chw_id": chw["id"]},
    )

    referrals = await db.fetchone(
        """SELECT COUNT(*) as c FROM chw_referrals 
           WHERE chw_id = :chw_id AND created_at >= CURRENT_DATE - 30""",
        {"chw_id": chw["id"]},
    )

    return {
        "patients": patients["c"] if patients else 0,
        "referrals_30d": referrals["c"] if referrals else 0,
    }
