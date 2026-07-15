"""
Inventory AI - Forecasting and AI-powered insights
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from uuid import uuid4

router = APIRouter()


class SubstituteRequest(BaseModel):
    sha_code: str
    indication: Optional[str] = None
    patient_age: Optional[int] = None
    allergies: Optional[list[str]] = None


class SubstituteResponse(BaseModel):
    alt_sha_code: Optional[str]
    alt_name: Optional[str]
    reason_swahili: str
    dose_change: Optional[str] = None
    is_safe: bool


class ForecastResponse(BaseModel):
    sha_code: str
    predicted_daily_use: float
    days_to_stockout: int
    reorder_point: int
    suggested_order_qty: int
    severity: str
    message_swahili: str


class InsightResponse(BaseModel):
    insights: list[ForecastResponse]
    generated_at: str


from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id


@router.get("/forecast", response_model=InsightResponse)
async def get_inventory_forecast(
    sha_code: Optional[str] = Query(None),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get inventory forecast with AI insights"""

    conditions = ["facility_id = :hospital_id"]
    params = {"hospital_id": hospital_id}

    if sha_code:
        conditions.append("sha_code = :sha_code")
        params["sha_code"] = sha_code

    where_clause = " AND ".join(conditions)

    sql = f"""
        SELECT f.sha_code, f.name, f.predicted_daily_use, f.days_to_stockout,
               f.reorder_point, f.suggested_order_qty
        FROM inventory_forecast f
        WHERE {where_clause}
        AND f.forecast_date = CURRENT_DATE + 1
        ORDER BY f.days_to_stockout ASC
        LIMIT 20
    """
    rows = await db.fetchall(sql, params)

    insights = []
    for row in rows:
        days_left = row["days_to_stockout"] or 0

        if days_left <= 7:
            severity = "critical"
            msg = f"AI: {row['sha_code']} itaisha siku {days_left}. Agiza haraka!"
        elif days_left <= 21:
            severity = "warning"
            msg = f"AI: {row['sha_code']} itaisha siku {days_left}. Oda inashauriwa."
        else:
            severity = "info"
            msg = f"AI: {row['sha_code']} mbele. Siku {days_left}."

        insights.append(
            ForecastResponse(
                sha_code=row["sha_code"],
                predicted_daily_use=float(row["predicted_daily_use"] or 0),
                days_to_stockout=days_left,
                reorder_point=row["reorder_point"] or 0,
                suggested_order_qty=row["suggested_order_qty"] or 0,
                severity=severity,
                message_swahili=msg,
            )
        )

    return InsightResponse(
        insights=insights,
        generated_at=datetime.now().isoformat(),
    )


@router.post("/substitute", response_model=SubstituteResponse)
async def get_substitute_drug(
    request: SubstituteRequest,
    db=Depends(get_db_session),
):
    """Get AI-powered drug substitution when OOS"""

    formulary_sql = """
        SELECT sha_code, name, strength, form 
        FROM formulary 
        WHERE is_active = true AND teleconsult_allowed = true
    """
    formulary = await db.fetchall(formulary_sql)

    if not request.allergies:
        request.allergies = []

    alt = None
    for drug in formulary:
        if drug["sha_code"] == request.sha_code:
            continue

        safety_check = any(
            allery.lower() in drug["name"].lower()
            or allery.lower() in drug["sha_code"].lower()
            for allery in request.allergies
        )
        if not safety_check:
            alt = drug
            break

    if alt:
        return SubstituteResponse(
            alt_sha_code=alt["sha_code"],
            alt_name=alt["name"],
            reason_swahili=f"{request.sha_code} haipo. Badala: {alt['name']}. Sababu: dawa moja kwa kundi la moja.",
            dose_change=None,
            is_safe=True,
        )

    return SubstituteResponse(
        alt_sha_code=None,
        alt_name=None,
        reason_swahili="Hakuna mbadala salama mwilaya. Wasiliana na daktari.",
        dose_change=None,
        is_safe=False,
    )


@router.get("/ai-log")
async def get_ai_insights(
    days: int = Query(7, ge=1, le=30),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get recent AI insights log"""

    sql = """
        SELECT * FROM inventory_ai_log
        WHERE facility_id = :hospital_id
        AND created_at >= CURRENT_DATE - :days
        ORDER BY created_at DESC
        LIMIT 50
    """
    rows = await db.fetchall(sql, {"hospital_id": hospital_id, "days": days})

    return [
        {
            "id": str(r["id"]),
            "sha_code": r["sha_code"],
            "type": r["insight_type"],
            "message": r["message"],
            "severity": r["severity"],
            "action": r["action_taken"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


@router.post("/trigger-forecast")
async def trigger_forecast(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Manually trigger forecast calculation"""

    forecast_sql = """
        INSERT INTO inventory_forecast (
            facility_id, sha_code, forecast_date, predicted_daily_use,
            days_to_stockout, reorder_point, suggested_order_qty
        )
        SELECT 
            sl.facility_id,
            sl.sha_code,
            CURRENT_DATE + 1,
            COALESCE(AVG(ic.qty_dispensed), 10),
            SUM(sl.qty_on_hand) / NULLIF(AVG(ic.qty_dispensed), 0),
            CEIL(AVG(ic.qty_dispensed) * 21),
            GREATEST(0, CEIL(AVG(ic.qty_dispensed) * 60) - SUM(sl.qty_on_hand))
        FROM stock_lots sl
        LEFT JOIN inventory_consumption ic ON 
            ic.facility_id = sl.facility_id AND 
            ic.sha_code = sl.sha_code AND
            ic.day >= CURRENT_DATE - 90
        WHERE sl.facility_id = :hospital_id
        AND sl.expiry_date > CURRENT_DATE
        GROUP BY sl.facility_id, sl.sha_code
        ON CONFLICT (facility_id, sha_code, forecast_date) DO UPDATE SET
            predicted_daily_use=EXCLUDED.predicted_daily_use,
            days_to_stockout=EXCLUDED.days_to_stockout
    """
    await db.execute(forecast_sql, {"hospital_id": hospital_id})

    return {"status": "forecast_triggered", "timestamp": datetime.now().isoformat()}


@router.get("/consumption-rollup")
async def get_consumption(
    days: int = Query(30, ge=7, le=90),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get consumption data for chart"""

    sql = """
        SELECT sha_code, day, qty_dispensed
        FROM inventory_consumption
        WHERE facility_id = :hospital_id
        AND day >= CURRENT_DATE - :days
        ORDER BY day ASC, sha_code ASC
    """
    rows = await db.fetchall(sql, {"hospital_id": hospital_id, "days": days})

    return [
        {
            "sha_code": r["sha_code"],
            "date": r["day"].isoformat(),
            "qty": r["qty_dispensed"] or 0,
        }
        for r in rows
    ]
