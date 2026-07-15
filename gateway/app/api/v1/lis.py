"""
LIS API - Lab Order Entry, Barcode, Results
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import uuid4

router = APIRouter()


class LabOrderCreate(BaseModel):
    patient_id: str
    test_codes: list[str]
    priority: str = "routine"
    notes: Optional[str] = None


class LabOrderResponse(BaseModel):
    order_id: str
    lab_id: str
    patient_id: str
    tests: list[str]
    status: str
    barcode: str
    collected_at: Optional[str] = None
    created_at: str


class LabResult(BaseModel):
    test_code: str
    value: str
    unit: str
    ref_range: Optional[str] = None
    flag: Optional[str] = None


class LabResultRecord(BaseModel):
    order_id: str
    results: list[LabResult]
    verified_by: Optional[str] = None


class LabPanelResponse(BaseModel):
    panel_id: str
    name: str
    tests: list[dict]


from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id, get_user_id


@router.get("/panels", response_model=list[LabPanelResponse])
async def get_lab_panels(
    db=Depends(get_db_session),
):
    """Get available lab test panels"""

    sql = """
        SELECT panel_id, name, tests 
        FROM lab_panels 
        WHERE is_active = true
        ORDER BY name
    """
    rows = await db.fetchall(sql)

    return [
        LabPanelResponse(
            panel_id=row["panel_id"],
            name=row["name"],
            tests=row["tests"] or [],
        )
        for row in rows
    ]


@router.get("/tests")
async def get_lab_tests(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db=Depends(get_db_session),
):
    """Get available lab tests"""

    conditions = ["is_active = true"]
    params = {}

    if search:
        conditions.append("(name ILIKE :search OR code ILIKE :search)")
        params["search"] = f"%{search}%"

    if category:
        conditions.append("category = :category")
        params["category"] = category

    where = " AND ".join(conditions)

    sql = f"""
        SELECT code, name, category, unit, ref_range_male, ref_range_female, 
               price, turnaround_hours
        FROM lab_tests
        WHERE {where}
        ORDER BY name
    """
    rows = await db.fetchall(sql, params)

    return [
        {
            "code": r["code"],
            "name": r["name"],
            "category": r["category"],
            "unit": r["unit"],
            "ref_range": r.get(
                f"ref_range_{'male' if r['ref_range_male'] else 'female'}"
            ),
            "price": float(r["price"]) if r["price"] else 0,
            "turnaround": r["turnaround_hours"],
        }
        for r in rows
    ]


@router.post("/orders", response_model=LabOrderResponse)
async def create_lab_order(
    order: LabOrderCreate,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
    user_id: str = Depends(get_user_id),
):
    """Create lab order with barcode"""

    order_id = str(uuid4())
    lab_id = f"LAB-{datetime.now().strftime('%Y%m')}-{order_id[:6].upper()}"
    barcode = f"AF{order_id[:8].upper()}"

    test_names = []
    for test_code in order.test_codes:
        test = await db.fetchone(
            "SELECT name FROM lab_tests WHERE code = :code AND is_active = true",
            {"code": test_code},
        )
        if test:
            test_names.append(test["name"])

    await db.execute(
        """INSERT INTO lab_requests (
            id, hospital_id, lab_id, patient_id, ordered_by,
            test_name, priority, status, ordered_at
        )
        VALUES (:id, :hospital_id, :lab_id, :patient_id, :ordered_by,
                :test_name, :priority, 'ordered', NOW())""",
        {
            "id": order_id,
            "hospital_id": hospital_id,
            "lab_id": lab_id,
            "patient_id": order.patient_id,
            "ordered_by": user_id,
            "test_name": ", ".join(test_names),
            "priority": order.priority,
        },
    )

    return LabOrderResponse(
        order_id=order_id,
        lab_id=lab_id,
        patient_id=order.patient_id,
        tests=test_names,
        status="ordered",
        barcode=barcode,
        created_at=datetime.now().isoformat(),
    )


@router.get("/orders", response_model=list[LabOrderResponse])
async def list_lab_orders(
    status: Optional[str] = Query(None),
    patient_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """List lab orders"""

    conditions = ["hospital_id = :hospital_id"]
    params = {
        "hospital_id": hospital_id,
        "limit": limit,
        "offset": (page - 1) * limit,
    }

    if status:
        conditions.append("status = :status")
        params["status"] = status

    if patient_id:
        conditions.append("patient_id = :patient_id")
        params["patient_id"] = patient_id

    where = " AND ".join(conditions)

    sql = f"""
        SELECT id, lab_id, patient_id, test_name, priority, status, 
               ordered_at, collected_at
        FROM lab_requests
        WHERE {where}
        ORDER BY ordered_at DESC
        LIMIT :limit OFFSET :offset
    """
    rows = await db.fetchall(sql, params)

    return [
        LabOrderResponse(
            order_id=str(r["id"]),
            lab_id=r["lab_id"],
            patient_id=str(r["patient_id"]),
            tests=r["test_name"].split(", ") if r["test_name"] else [],
            status=r["status"],
            barcode=f"AF{r['id'][:8].upper()}",
            collected_at=r["collected_at"].isoformat() if r["collected_at"] else None,
            created_at=r["ordered_at"].isoformat(),
        )
        for r in rows
    ]


@router.post("/orders/{order_id}/collect")
async def collect_sample(
    order_id: str,
    notes: Optional[str] = None,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
    user_id: str = Depends(get_user_id),
):
    """Mark sample collected"""

    result = await db.execute(
        """UPDATE lab_requests 
           SET status = 'sample-collected', collected_at = NOW(), notes = :notes, collected_by = :user_id
           WHERE id = :order_id AND hospital_id = :hospital_id
           RETURNING id""",
        {
            "order_id": order_id,
            "hospital_id": hospital_id,
            "user_id": user_id,
            "notes": notes,
        },
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Order not found")

    return {"status": "sample_collected", "order_id": order_id}


@router.post("/orders/{order_id}/results")
async def record_results(
    order_id: str,
    results: LabResultRecord,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
    user_id: str = Depends(get_user_id),
):
    """Record lab results"""

    for result in results.results:
        await db.execute(
            """INSERT INTO lab_results (order_id, test_code, value, unit, recorded_by, recorded_at)
               VALUES (:order_id, :test_code, :value, :unit, :recorded_by, NOW())""",
            {
                "order_id": order_id,
                "test_code": result.test_code,
                "value": result.value,
                "unit": result.unit,
                "recorded_by": user_id,
            },
        )

    await db.execute(
        """UPDATE lab_requests SET status = 'completed', completed_at = NOW()
           WHERE id = :order_id""",
        {"order_id": order_id},
    )

    return {"status": "results_recorded", "order_id": order_id}


@router.get("/orders/{order_id}")
async def get_order_detail(
    order_id: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get order detail with results"""

    order = await db.fetchone(
        """SELECT * FROM lab_requests 
           WHERE id = :order_id AND hospital_id = :hospital_id""",
        {"order_id": order_id, "hospital_id": hospital_id},
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    results = await db.fetchall(
        """SELECT * FROM lab_results WHERE order_id = :order_id""",
        {"order_id": order_id},
    )

    return {
        "order": dict(order),
        "results": [
            {
                "test_code": r["test_code"],
                "value": r["value"],
                "unit": r["unit"],
                "flag": r.get("flag"),
            }
            for r in results
        ],
    }


@router.post("/orders/{order_id}/verify")
async def verify_results(
    order_id: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
    user_id: str = Depends(get_user_id),
):
    """Verify lab results"""

    await db.execute(
        """UPDATE lab_requests 
           SET status = 'verified', verified_by = :user_id, verified_at = NOW()
           WHERE id = :order_id AND hospital_id = :hospital_id""",
        {"order_id": order_id, "hospital_id": hospital_id, "user_id": user_id},
    )

    return {"status": "verified", "order_id": order_id}


@router.get("/queue", response_model=list[dict])
async def get_lab_queue(
    status: str = Query("ordered"),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get lab queue by status"""

    rows = await db.fetchall(
        """SELECT lr.*, p.name as patient_name, p.phone
           FROM lab_requests lr
           LEFT JOIN patients p ON lr.patient_id = p.id
           WHERE lr.hospital_id = :hospital_id AND lr.status = :status
           ORDER BY lr.ordered_at ASC""",
        {"hospital_id": hospital_id, "status": status},
    )

    return [
        {
            "order_id": str(r["id"]),
            "lab_id": r["lab_id"],
            "patient_id": str(r["patient_id"]),
            "patient_name": r.get("patient_name"),
            "test": r["test_name"],
            "priority": r["priority"],
            "ordered_at": r["ordered_at"].isoformat() if r["ordered_at"] else None,
        }
        for r in rows
    ]
