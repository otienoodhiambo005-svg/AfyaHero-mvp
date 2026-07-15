"""
Dashboard API - Aggregated dashboard data
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter()


class DashboardStats(BaseModel):
    patients_today: int
    appointments_today: int
    lab_orders_today: int
    prescriptions_today: int
    beds_occupied: int
    beds_available: int
    queue_waiting: int
    pending_claims: float


class DepartmentStats(BaseModel):
    department: str
    count: int
    avg_wait: Optional[float] = None


class HourlyStats(BaseModel):
    hour: int
    count: int


from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id


@router.get("", response_model=DashboardStats)
async def get_dashboard_stats(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get main dashboard KPIs"""

    today = datetime.now().date()

    patients_sql = """
        SELECT COUNT(*) as count FROM patients 
        WHERE DATE(created_at) = :today AND hospital_id = :hospital_id
    """
    patients_row = await db.fetchone(
        patients_sql, {"today": today, "hospital_id": hospital_id}
    )

    appointments_sql = """
        SELECT COUNT(*) as count FROM appointments 
        WHERE DATE(appointment_date) = :today AND hospital_id = :hospital_id
    """
    appt_row = await db.fetchone(
        appointments_sql, {"today": today, "hospital_id": hospital_id}
    )

    lab_sql = """
        SELECT COUNT(*) as count FROM lab_requests 
        WHERE DATE(ordered_at) = :today AND hospital_id = :hospital_id
    """
    lab_row = await db.fetchone(lab_sql, {"today": today, "hospital_id": hospital_id})

    rx_sql = """
        SELECT COUNT(*) as count FROM prescriptions 
        WHERE DATE(prescribed_at) = :today AND hospital_id = :hospital_id
    """
    rx_row = await db.fetchone(rx_sql, {"today": today, "hospital_id": hospital_id})

    beds_sql = """
        SELECT 
            COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
            COUNT(CASE WHEN status = 'free' THEN 1 END) as available
        FROM bed_status
        WHERE facility_id = :hospital_id
    """
    beds_row = await db.fetchone(beds_sql, {"hospital_id": hospital_id})

    queue_sql = """
        SELECT COUNT(*) as count FROM hospital_queue 
        WHERE hospital_id = :hospital_id AND status = 'waiting'
    """
    queue_row = await db.fetchone(queue_sql, {"hospital_id": hospital_id})

    claims_sql = """
        SELECT COALESCE(SUM(amount_claimed), 0) as total
        FROM shif_claims 
        WHERE hospital_id = :hospital_id AND status = 'pending'
    """
    claims_row = await db.fetchone(claims_sql, {"hospital_id": hospital_id})

    return DashboardStats(
        patients_today=patients_row["count"] or 0,
        appointments_today=appt_row["count"] or 0,
        lab_orders_today=lab_row["count"] or 0,
        prescriptions_today=rx_row["count"] or 0,
        beds_occupied=beds_row["occupied"] or 0,
        beds_available=beds_row["available"] or 0,
        queue_waiting=queue_row["count"] or 0,
        pending_claims=float(claims_row["total"] or 0),
    )


@router.get("/queue-trend")
async def get_queue_trend(
    days: int = Query(7, ge=1, le=30),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get queue trend over time"""

    sql = """
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM hospital_queue
        WHERE hospital_id = :hospital_id
        AND created_at >= CURRENT_DATE - :days
        GROUP BY DATE(created_at)
        ORDER BY day
    """
    rows = await db.fetchall(sql, {"hospital_id": hospital_id, "days": days})

    return [
        {"date": r["day"].isoformat() if r["day"] else None, "count": r["count"]}
        for r in rows
    ]


@router.get("/hourly-activity")
async def get_hourly_activity(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get hourly activity distribution"""

    sql = """
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
        FROM hospital_queue
        WHERE hospital_id = :hospital_id
        AND created_at >= CURRENT_DATE
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
    """
    rows = await db.fetchall(sql, {"hospital_id": hospital_id})

    return [HourlyStats(hour=int(r["hour"] or 0), count=r["count"]) for r in rows]


@router.get("/top-drugs")
async def get_top_drugs(
    limit: int = Query(10, ge=1, le=20),
    days: int = Query(30, ge=7, le=90),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get top dispensed drugs"""

    sql = """
        SELECT sha_code, SUM(qty_dispensed) as total
        FROM inventory_consumption
        WHERE facility_id = :hospital_id
        AND day >= CURRENT_DATE - :days
        GROUP BY sha_code
        ORDER BY total DESC
        LIMIT :limit
    """
    rows = await db.fetchall(
        sql, {"hospital_id": hospital_id, "days": days, "limit": limit}
    )

    return [{"drug": r["sha_code"], "qty": r["total"]} for r in rows]


@router.get("/top-diagnoses")
async def get_top_diagnoses(
    limit: int = Query(10, ge=1, le=20),
    days: int = Query(30, ge=7, le=90),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get top diagnoses"""

    sql = """
        SELECT diagnosis, COUNT(*) as count
        FROM consultations
        WHERE hospital_id = :hospital_id
        AND created_at >= CURRENT_DATE - :days
        AND diagnosis IS NOT NULL
        GROUP BY diagnosis
        ORDER BY count DESC
        LIMIT :limit
    """
    rows = await db.fetchall(
        sql, {"hospital_id": hospital_id, "days": days, "limit": limit}
    )

    return [{"diagnosis": r["diagnosis"], "count": r["count"]} for r in rows]


from fastapi import HTTPException


@router.get("/alerts")
async def get_dashboard_alerts(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get active alerts for dashboard"""

    alerts = []

    # Check low stock
    stock_sql = """
        SELECT sha_code, SUM(qty_on_hand) as total
        FROM stock_lots
        WHERE facility_id = :hospital_id
        AND expiry_date > CURRENT_DATE
        GROUP BY sha_code
        HAVING SUM(qty_on_hand) < 100
        LIMIT 5
    """
    stock_rows = await db.fetchall(stock_sql, {"hospital_id": hospital_id})

    for r in stock_rows:
        alerts.append(
            {
                "type": "warning",
                "title": "Stock Low",
                "message": f"Dawa {r['sha_code']} inashuka. Kiasi: {r['total']}",
                "area": "pharmacy",
            }
        )

    # Check pending referrals
    ref_sql = """
        SELECT COUNT(*) as count
        FROM fhir_resources
        WHERE resource_type = 'Task'
        AND data->'code'->>'text' = 'referral'
        AND data->>'status' = 'requested'
    """
    ref_row = await db.fetchone(ref_sql)

    if ref_row and ref_row["count"] > 0:
        alerts.append(
            {
                "type": "info",
                "title": "Pending Referrals",
                "message": f"Rufaa {ref_row['count']} zinasubiri kukubaliwa",
                "area": "referrals",
            }
        )

    # Check bed occupancy
    beds_sql = """
        SELECT 
            COUNT(CASE WHEN status = 'occupied' THEN 1 END)::float / 
            NULLIF(COUNT(*), 0) * 100 as rate
        FROM bed_status
        WHERE facility_id = :hospital_id
    """
    beds_row = await db.fetchone(beds_sql, {"hospital_id": hospital_id})

    if beds_row and beds_row["rate"] and beds_row["rate"] > 90:
        alerts.append(
            {
                "type": "warning",
                "title": "Bed Occupancy High",
                "message": f"Vilala {int(beds_row['rate'])}% kujazwa. Hakuna nafasi.",
                "area": "beds",
            }
        )

    # Check rejected claims
    claims_sql = """
        SELECT COUNT(*) as count, SUM(amount_claimed) as amount
        FROM shif_claims
        WHERE hospital_id = :hospital_id
        AND status = 'rejected'
        AND created_at >= CURRENT_DATE - 7
    """
    claims_row = await db.fetchone(claims_sql, {"hospital_id": hospital_id})

    if claims_row and claims_row["count"] and claims_row["count"] > 0:
        alerts.append(
            {
                "type": "error",
                "title": "Claims Rejected",
                "message": f"Madai {claims_row['count']} yamekataliwa. KES {claims_row['amount']}",
                "area": "claims",
            }
        )

    return alerts


@router.get("/realtime")
async def get_realtime_counts(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get realtime counts via polling"""

    queue = await db.fetchone(
        "SELECT COUNT(*) as c FROM hospital_queue WHERE hospital_id = :h AND status = 'waiting'",
        {"h": hospital_id},
    )

    beds = await db.fetchone(
        """SELECT COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occ,
                  COUNT(CASE WHEN status = 'free' THEN 1 END) as free
           FROM bed_status WHERE facility_id = :h""",
        {"h": hospital_id},
    )

    return {
        "queue": queue["c"] if queue else 0,
        "beds_occupied": beds["occ"] if beds else 0,
        "beds_free": beds["free"] if beds else 0,
        "updated_at": datetime.now().isoformat(),
    }
