"""
Stock API - Lot tracking, FEFO dispensing
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import uuid4

router = APIRouter()


class StockLotCreate(BaseModel):
    sha_code: str
    batch_number: str
    expiry_date: date
    qty_on_hand: int
    unit_cost: Optional[float] = None
    supplier: Optional[str] = None


class StockLotUpdate(BaseModel):
    qty_on_hand: Optional[int] = None
    unit_cost: Optional[float] = None


class StockLotResponse(BaseModel):
    id: str
    facility_id: str
    sha_code: str
    batch_number: str
    expiry_date: date
    qty_on_hand: int
    qty_allocated: int
    unit_cost: Optional[float]
    received_at: str
    supplier: Optional[str]
    days_to_expiry: int
    is_expiring_soon: bool
    is_low_stock: bool


class StockDispenseRequest(BaseModel):
    patient_id: str
    sha_code: str
    quantity: int
    prescriber_id: str
    encounter_id: Optional[str] = None
    notes: Optional[str] = None


class DispenseResponse(BaseModel):
    dispense_id: str
    patient_id: str
    sha_code: str
    quantity: int
    batch_number: str
    expires: date
    dispensed_by: str
    dispensed_at: str


class StockStatsResponse(BaseModel):
    total_drugs: int
    total_stock_units: int
    expiring_90d: int
    low_stock: int
    out_of_stock: int


from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id, get_user_id
from app.core.rbac.dependency import require_role


@router.get("", response_model=list[StockLotResponse])
async def list_stock(
    sha_code: Optional[str] = Query(None, description="Filter by drug"),
    show_expired: bool = Query(False, description="Show expired lots"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """List stock lots for facility"""

    conditions = ["facility_id = :hospital_id"]
    params = {
        "hospital_id": hospital_id,
        "limit": limit,
        "offset": (page - 1) * limit,
    }

    if sha_code:
        conditions.append("sha_code = :sha_code")
        params["sha_code"] = sha_code

    if not show_expired:
        conditions.append("expiry_date >= CURRENT_DATE")

    where_clause = " AND ".join(conditions)

    sql = f"""
        SELECT id, facility_id, sha_code, batch_number, expiry_date,
               qty_on_hand, qty_allocated, unit_cost, received_at, supplier,
               EXTRACT(DAY FROM (expiry_date - CURRENT_DATE)) as days_to_expiry
        FROM stock_lots
        WHERE {where_clause}
        ORDER BY expiry_date ASC
        LIMIT :limit OFFSET :offset
    """
    rows = await db.fetchall(sql, params)

    today = date.today()
    items = [
        StockLotResponse(
            id=str(row["id"]),
            facility_id=str(row["facility_id"]),
            sha_code=row["sha_code"],
            batch_number=row["batch_number"],
            expiry_date=row["expiry_date"],
            qty_on_hand=row["qty_on_hand"],
            qty_allocated=row["qty_allocated"],
            unit_cost=float(row["unit_cost"]) if row["unit_cost"] else None,
            received_at=row["received_at"].isoformat(),
            supplier=row["supplier"],
            days_to_expiry=int(row["days_to_expiry"]),
            is_expiring_soon=row["expiry_date"]
            <= today.replace(year=today.year + 0, month=today.month + 3)
            if row["expiry_date"]
            else False,
            is_low_stock=(row["qty_on_hand"] - row["qty_allocated"]) < 100,
        )
        for row in rows
    ]

    return items


@router.get("/stats", response_model=StockStatsResponse)
async def get_stock_stats(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get stock statistics dashboard"""

    today = date.today()
    expiry_threshold = today.replace(year=today.year, month=today.month + 3)

    sql = """
        SELECT 
            COUNT(DISTINCT sha_code) as total_drugs,
            SUM(qty_on_hand) as total_stock_units,
            COUNT(CASE WHEN expiry_date <= :expiry_threshold THEN 1 END) as expiring_90d,
            COUNT(CASE WHEN qty_on_hand - qty_allocated < 100 THEN 1 END) as low_stock,
            COUNT(CASE WHEN qty_on_hand = 0 THEN 1 END) as out_of_stock
        FROM stock_lots
        WHERE facility_id = :hospital_id AND expiry_date > CURRENT_DATE
    """
    row = await db.fetchone(
        sql, {"hospital_id": hospital_id, "expiry_threshold": expiry_threshold}
    )

    return StockStatsResponse(
        total_drugs=row["total_drugs"] or 0,
        total_stock_units=int(row["total_stock_units"] or 0),
        expiring_90d=row["expiring_90d"] or 0,
        low_stock=row["low_stock"] or 0,
        out_of_stock=row["out_of_stock"] or 0,
    )


@router.post("/receive", response_model=StockLotResponse)
async def receive_stock(
    lot: StockLotCreate,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Receive new stock lot"""

    # Check formulary exists
    formulary = await db.fetchone(
        "SELECT name FROM formulary WHERE sha_code = :sha_code AND is_active = true",
        {"sha_code": lot.sha_code},
    )
    if not formulary:
        raise HTTPException(
            status_code=400, detail=f"Drug {lot.sha_code} not in formulary"
        )

    # Check for duplicate batch
    existing = await db.fetchone(
        """SELECT id FROM stock_lots 
           WHERE facility_id = :hospital_id 
           AND sha_code = :sha_code 
           AND batch_number = :batch_number""",
        {
            "hospital_id": hospital_id,
            "sha_code": lot.sha_code,
            "batch_number": lot.batch_number,
        },
    )
    if existing:
        raise HTTPException(status_code=409, detail="Batch number already exists")

    # Insert lot
    sql = """
        INSERT INTO stock_lots (
            facility_id, sha_code, batch_number, expiry_date,
            qty_on_hand, unit_cost, supplier
        )
        VALUES (
            :facility_id, :sha_code, :batch_number, :expiry_date,
            :qty_on_hand, :unit_cost, :supplier
        )
        RETURNING id, facility_id, sha_code, batch_number, expiry_date,
                 qty_on_hand, qty_allocated, unit_cost, received_at, supplier,
                 EXTRACT(DAY FROM (expiry_date - CURRENT_DATE)) as days_to_expiry
    """
    row = await db.fetchone(
        sql,
        {
            "facility_id": hospital_id,
            "sha_code": lot.sha_code,
            "batch_number": lot.batch_number,
            "expiry_date": lot.expiry_date,
            "qty_on_hand": lot.qty_on_hand,
            "unit_cost": lot.unit_cost,
            "supplier": lot.supplier,
        },
    )

    return StockLotResponse(
        id=str(row["id"]),
        facility_id=str(row["facility_id"]),
        sha_code=row["sha_code"],
        batch_number=row["batch_number"],
        expiry_date=row["expiry_date"],
        qty_on_hand=row["qty_on_hand"],
        qty_allocated=row["qty_allocated"],
        unit_cost=float(row["unit_cost"]) if row["unit_cost"] else None,
        received_at=row["received_at"].isoformat(),
        supplier=row["supplier"],
        days_to_expiry=int(row["days_to_expiry"]),
        is_expiring_soon=row["expiry_date"]
        <= date.today().replace(month=date.today().month + 3),
        is_low_stock=False,
    )


@router.post("/dispense", response_model=DispenseResponse)
async def dispense_medication(
    request: StockDispenseRequest,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
    user_id: str = Depends(get_user_id),
):
    """Dispense medication with FEFO"""

    remaining = request.quantity
    selected_lot = None
    batches = []

    # FEFO: select earliest expiry lots first
    lots_sql = """
        SELECT id, batch_number, expiry_date, qty_on_hand
        FROM stock_lots
        WHERE facility_id = :hospital_id
        AND sha_code = :sha_code
        AND qty_on_hand > qty_allocated
        AND expiry_date > CURRENT_DATE
        ORDER BY expiry_date ASC
        FOR UPDATE OF qty_on_hand
    """
    lots = await db.fetchall(
        lots_sql,
        {
            "hospital_id": hospital_id,
            "sha_code": request.sha_code,
        },
    )

    if not lots:
        raise HTTPException(status_code=400, detail=f"Out of stock: {request.sha_code}")

    total_available = sum(l["qty_on_hand"] - l["qty_allocated"] for l in lots)
    if total_available < request.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock: need {request.quantity}, have {total_available}",
        )

    # Allocate from FEFO lots
    for lot in lots:
        if remaining <= 0:
            break
        available = lot["qty_on_hand"] - lot["qty_allocated"]
        allocate = min(available, remaining)

        # Update lot
        await db.execute(
            """UPDATE stock_lots 
               SET qty_on_hand = qty_on_hand - :allocate,
                   qty_allocated = qty_allocated + :allocate
               WHERE id = :id""",
            {"allocate": allocate, "id": lot["id"]},
        )

        if not selected_lot:
            selected_lot = lot
        remaining -= allocate
        batches.append({"batch": lot["batch_number"], "qty": allocate})

    # Create FHIR MedicationDispense
    now = datetime.now()
    dispense_id = str(uuid4())

    fhir_dispense = {
        "resourceType": "MedicationDispense",
        "status": "completed",
        "id": dispense_id,
        "medicationCodeableConcept": {
            "coding": [{"code": request.sha_code, "system": "sha"}]
        },
        "subject": {"reference": f"Patient/{request.patient_id}"},
        "authorizingPrescription": [
            {"reference": f"MedicationRequest/{request.prescriber_id}"}
        ],
        "quantity": {"value": request.quantity, "unit": "unit"},
        "whenHandedOver": now.isoformat(),
        "performer": [{"actor": {"reference": f"Practitioner/{user_id}"}}],
        "extension": [
            {"url": "batch", "valueString": selected_lot["batch_number"]},
            {"url": "expiry", "valueDate": selected_lot["expiry_date"].isoformat()},
        ],
    }

    # Insert FHIR resource
    await db.execute(
        """INSERT INTO fhir_resources (resource_type, fhir_id, facility_id, data)
           VALUES ('MedicationDispense', :fhir_id, :facility_id, :data)""",
        {
            "fhir_id": dispense_id,
            "facility_id": hospital_id,
            "data": str(fhir_dispense),
        },
    )

    # Update inventory consumption for today
    today_date = date.today()
    await db.execute(
        """INSERT INTO inventory_consumption (facility_id, sha_code, day, qty_dispensed)
           VALUES (:facility_id, :sha_code, :day, :qty)
           ON CONFLICT (facility_id, sha_code, day) 
           DO UPDATE SET qty_dispensed = inventory_consumption.qty_dispensed + :qty""",
        {
            "facility_id": hospital_id,
            "sha_code": request.sha_code,
            "day": today_date,
            "qty": request.quantity,
        },
    )

    return DispenseResponse(
        dispense_id=dispense_id,
        patient_id=request.patient_id,
        sha_code=request.sha_code,
        quantity=request.quantity,
        batch_number=selected_lot["batch_number"],
        expires=selected_lot["expiry_date"],
        dispensed_by=user_id,
        dispensed_at=now.isoformat(),
    )


@router.put("/{lot_id}/adjust", response_model=StockLotResponse)
async def adjust_stock(
    lot_id: str,
    adjustment: StockLotUpdate,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Adjust stock quantity (audit logged)"""

    updates = []
    params = {"lot_id": lot_id, "hospital_id": hospital_id}

    if adjustment.qty_on_hand is not None:
        updates.append("qty_on_hand = :qty_on_hand")
        params["qty_on_hand"] = adjustment.qty_on_hand

    if adjustment.unit_cost is not None:
        updates.append("unit_cost = :unit_cost")
        params["unit_cost"] = adjustment.unit_cost

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to adjust")

    sql = f"""
        UPDATE stock_lots
        SET {", ".join(updates)}, updated_at = NOW()
        WHERE id = :lot_id AND facility_id = :hospital_id
        RETURNING id, facility_id, sha_code, batch_number, expiry_date,
                 qty_on_hand, qty_allocated, unit_cost, received_at, supplier,
                 EXTRACT(DAY FROM (expiry_date - CURRENT_DATE)) as days_to_expiry
    """
    row = await db.fetchone(sql, params)

    if not row:
        raise HTTPException(status_code=404, detail="Stock lot not found")

    return StockLotResponse(
        id=str(row["id"]),
        facility_id=str(row["facility_id"]),
        sha_code=row["sha_code"],
        batch_number=row["batch_number"],
        expiry_date=row["expiry_date"],
        qty_on_hand=row["qty_on_hand"],
        qty_allocated=row["qty_allocated"],
        unit_cost=float(row["unit_cost"]) if row["unit_cost"] else None,
        received_at=row["received_at"].isoformat(),
        supplier=row["supplier"],
        days_to_expiry=int(row["days_to_expiry"]),
        is_expiring_soon=row["expiry_date"]
        <= date.today().replace(month=date.today().month + 3),
        is_low_stock=(row["qty_on_hand"] - row["qty_allocated"]) < 100,
    )
