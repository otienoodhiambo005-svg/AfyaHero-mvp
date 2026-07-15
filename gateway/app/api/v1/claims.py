"""
Claims Dashboard API - SHIF claims analytics
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date, timedelta

router = APIRouter()


class ClaimsStatsResponse(BaseModel):
    today_billed: float
    today_paid: float
    week_billed: float
    week_paid: float
    month_billed: float
    month_paid: float
    ytd_billed: float
    ytd_paid: float
    pending: float
    rejected: float
    reject_rate: float


class ClaimItemResponse(BaseModel):
    claim_id: str
    claim_number: str
    patient_id: str
    patient_name: str
    service: str
    billed: float
    approved: float
    status: str
    created_at: str


class ClaimsListResponse(BaseModel):
    items: list[ClaimItemResponse]
    total: int
    total_billed: float
    total_approved: float
    pending_count: int
    rejected_count: int


class ClaimDetailResponse(BaseModel):
    claim_id: str
    claim_number: str
    patient_id: str
    patient_name: str
    diagnosis: Optional[str]
    treatment: Optional[str]
    amount_claimed: float
    amount_approved: Optional[float]
    status: str
    preauth_number: Optional[str]
    created_at: str
    submitted_at: Optional[str]
    decided_at: Optional[str]
    rejection_reason: Optional[str]
    line_items: list[dict]


from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id


@router.get("/stats", response_model=ClaimsStatsResponse)
async def get_claims_stats(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get claims KPIs"""

    today = date.today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    year_ago = today.replace(year=today.year - 1)

    sql = """
        SELECT 
            SUM(CASE WHEN DATE(created_at) = :today THEN amount_claimed ELSE 0 END) as today_billed,
            SUM(CASE WHEN DATE(created_at) = :today THEN COALESCE(amount_approved, 0) ELSE 0 END) as today_paid,
            SUM(CASE WHEN created_at >= :week_ago THEN amount_claimed ELSE 0 END) as week_billed,
            SUM(CASE WHEN created_at >= :week_ago THEN COALESCE(amount_approved, 0) ELSE 0 END) as week_paid,
            SUM(CASE WHEN created_at >= :month_ago THEN amount_claimed ELSE 0 END) as month_billed,
            SUM(CASE WHEN created_at >= :month_ago THEN COALESCE(amount_approved, 0) ELSE 0 END) as month_paid,
            SUM(CASE WHEN created_at >= :year_ago THEN amount_claimed ELSE 0 END) as ytd_billed,
            SUM(CASE WHEN created_at >= :year_ago THEN COALESCE(amount_approved, 0) ELSE 0 END) as ytd_paid,
            SUM(CASE WHEN status = 'pending' THEN amount_claimed ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'rejected' THEN amount_claimed ELSE 0 END) as rejected,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as reject_rate
        FROM shif_claims
        WHERE hospital_id = :hospital_id
    """
    row = await db.fetchone(
        sql,
        {
            "hospital_id": hospital_id,
            "today": today,
            "week_ago": week_ago,
            "month_ago": month_ago,
            "year_ago": year_ago,
        },
    )

    return ClaimsStatsResponse(
        today_billed=float(row["today_billed"] or 0),
        today_paid=float(row["today_paid"] or 0),
        week_billed=float(row["week_billed"] or 0),
        week_paid=float(row["week_paid"] or 0),
        month_billed=float(row["month_billed"] or 0),
        month_paid=float(row["month_paid"] or 0),
        ytd_billed=float(row["ytd_billed"] or 0),
        ytd_paid=float(row["ytd_paid"] or 0),
        pending=float(row["pending"] or 0),
        rejected=float(row["rejected"] or 0),
        reject_rate=float(row["reject_rate"] or 0),
    )


@router.get("", response_model=ClaimsListResponse)
async def list_claims(
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    min_amount: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """List claims with filters"""

    conditions = ["sc.hospital_id = :hospital_id"]
    params = {
        "hospital_id": hospital_id,
        "limit": limit,
        "offset": (page - 1) * limit,
    }

    if status_filter:
        conditions.append("sc.status = :status")
        params["status"] = status_filter

    if date_from:
        conditions.append("sc.created_at >= :date_from")
        params["date_from"] = date_from

    if date_to:
        conditions.append("sc.created_at <= :date_to")
        params["date_to"] = date_to

    if min_amount:
        conditions.append("sc.amount_claimed >= :min_amount")
        params["min_amount"] = min_amount

    where_clause = " AND ".join(conditions)

    # Count
    count_sql = f"""
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
               SUM(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
               SUM(sc.amount_claimed) as total_billed,
               SUM(COALESCE(sc.amount_approved, 0)) as total_approved
        FROM shif_claims sc
        WHERE {where_clause}
    """
    counts = await db.fetchone(count_sql, params)

    # Get items
    sql = f"""
        SELECT sc.id, sc.claim_number, sc.patient_id, p.name as patient_name,
               sc.diagnosis, sc.treatment, sc.amount_claimed, sc.amount_approved,
               sc.status, sc.created_at
        FROM shif_claims sc
        LEFT JOIN patients p ON sc.patient_id = p.id
        WHERE {where_clause}
        ORDER BY sc.created_at DESC
        LIMIT :limit OFFSET :offset
    """
    rows = await db.fetchall(sql, params)

    items = [
        ClaimItemResponse(
            claim_id=str(row["id"]),
            claim_number=row["claim_number"],
            patient_id=str(row["patient_id"]),
            patient_name=row["patient_name"] or "Unknown",
            service=row["diagnosis"] or row["treatment"] or "N/A",
            billed=float(row["amount_claimed"]),
            approved=float(row["amount_approved"]) if row["amount_approved"] else 0,
            status=row["status"],
            created_at=row["created_at"].isoformat(),
        )
        for row in rows
    ]

    return ClaimsListResponse(
        items=items,
        total=counts["total"] or 0,
        total_billed=float(counts["total_billed"] or 0),
        total_approved=float(counts["total_approved"] or 0),
        pending_count=counts["pending_count"] or 0,
        rejected_count=counts["rejected_count"] or 0,
    )


@router.get("/{claim_id}", response_model=ClaimDetailResponse)
async def get_claim_detail(
    claim_id: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get claim detail with line items"""

    sql = """
        SELECT sc.*, p.name as patient_name
        FROM shif_claims sc
        LEFT JOIN patients p ON sc.patient_id = p.id
        WHERE sc.id = :claim_id AND sc.hospital_id = :hospital_id
    """
    row = await db.fetchone(sql, {"claim_id": claim_id, "hospital_id": hospital_id})

    if not row:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Get line items from related resources
    line_items = await db.fetchall(
        """SELECT data->'item' as item, data->'unitPrice' as unit_price, data->'net' as net
           FROM fhir_resources
           WHERE resource_type = 'ClaimItem' AND data->>'claim' = :claim_id""",
        {"claim_id": claim_id},
    )

    return ClaimDetailResponse(
        claim_id=str(row["id"]),
        claim_number=row["claim_number"],
        patient_id=str(row["patient_id"]),
        patient_name=row["patient_name"] or "Unknown",
        diagnosis=row["diagnosis"],
        treatment=row["treatment"],
        amount_claimed=float(row["amount_claimed"]),
        amount_approved=float(row["amount_approved"])
        if row["amount_approved"]
        else None,
        status=row["status"],
        preauth_number=row["preauth_number"],
        created_at=row["created_at"].isoformat(),
        submitted_at=row["submitted_at"].isoformat() if row["submitted_at"] else None,
        decided_at=row["decided_at"].isoformat() if row["decided_at"] else None,
        rejection_reason=row["rejection_reason"],
        line_items=[dict(li) for li in line_items],
    )


@router.get("/by-encounter/{encounter_id}")
async def get_claims_by_encounter(
    encounter_id: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get all claims for an encounter"""

    sql = """
        SELECT sc.id, sc.claim_number, sc.status, sc.amount_claimed, 
               sc.amount_approved, sc.created_at
        FROM shif_claims sc
        WHERE sc.patient_id IN (
            SELECT patient_id FROM encounters WHERE id = :encounter_id
        )
        AND sc.hospital_id = :hospital_id
        ORDER BY sc.created_at DESC
    """
    rows = await db.fetchone(
        sql, {"encounter_id": encounter_id, "hospital_id": hospital_id}
    )

    if not rows:
        return []

    return [
        {
            "claim_id": str(r["id"]),
            "claim_number": r["claim_number"],
            "status": r["status"],
            "amount_claimed": float(r["amount_claimed"]),
            "amount_approved": float(r["amount_approved"])
            if r["amount_approved"]
            else None,
        }
        for r in rows
    ]


from fastapi import HTTPException


@router.post("/resubmit/{claim_id}")
async def resubmit_claim(
    claim_id: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Resubmit rejected claim after fixing issues"""

    # Check claim exists and is rejected
    claim = await db.fetchone(
        """SELECT * FROM shif_claims 
           WHERE id = :claim_id AND hospital_id = :hospital_id AND status = 'rejected'""",
        {"claim_id": claim_id, "hospital_id": hospital_id},
    )

    if not claim:
        raise HTTPException(status_code=400, detail="Claim not found or not rejected")

    # Reset to pending
    await db.execute(
        """UPDATE shif_claims 
           SET status = 'pending', rejection_reason = NULL, created_at = NOW()
           WHERE id = :claim_id""",
        {"claim_id": claim_id},
    )

    return {"status": "pending", "message": "Claim resubmitted"}


@router.get("/summary/chart")
async def claims_chart(
    days: int = Query(30, ge=7, le=90),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get claims over time for chart"""

    sql = """
        SELECT DATE_TRUNC('day', created_at) as day,
               SUM(amount_claimed) as billed,
               SUM(COALESCE(amount_approved, 0)) as paid,
               COUNT(*) FILTER (WHERE status = 'rejected') as rejected
        FROM shif_claims
        WHERE hospital_id = :hospital_id
        AND created_at >= CURRENT_DATE - :days
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY day
    """
    rows = await db.fetchall(sql, {"hospital_id": hospital_id, "days": days})

    return [
        {
            "date": row["day"].isoformat() if row["day"] else None,
            "billed": float(row["billed"] or 0),
            "paid": float(row["paid"] or 0),
            "rejected": row["rejected"] or 0,
        }
        for row in rows
    ]


@router.get("/summary/by-type")
async def claims_by_type(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get claims by type (OP/IP/Pharmacy/Lab)"""

    sql = """
        SELECT 
            CASE 
                WHEN diagnosis ILIKE '%admit%' THEN 'IP'
                WHEN diagnosis ILIKE '%pharmacy%' OR treatment ILIKE '%drug%' THEN 'Pharmacy'
                WHEN diagnosis ILIKE '%test%' OR diagnosis ILIKE '%lab%' THEN 'Lab'
                ELSE 'OP'
            END as claim_type,
            COUNT(*) as count,
            SUM(amount_claimed) as billed,
            SUM(COALESCE(amount_approved, 0)) as paid
        FROM shif_claims
        WHERE hospital_id = :hospital_id
        GROUP BY 1
    """
    rows = await db.fetchall(sql, {"hospital_id": hospital_id})

    return [
        {
            "type": row["claim_type"],
            "count": row["count"],
            "billed": float(row["billed"] or 0),
            "paid": float(row["paid"] or 0),
        }
        for row in rows
    ]
