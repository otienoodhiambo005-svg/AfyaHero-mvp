"""
Formulary API - Drug formulary management
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import uuid4

router = APIRouter()


class FormularyCreate(BaseModel):
    sha_code: str
    name: str
    strength: Optional[str] = None
    form: Optional[str] = "tablet"
    unit_ucum: Optional[str] = "{tablet}"
    pack_size: Optional[int] = 100
    unit_price: Optional[float] = None
    sha_price: Optional[float] = None
    requires_auth: Optional[bool] = False
    teleconsult_allowed: Optional[bool] = True
    loinc_code: Optional[str] = None
    chw_formulary: Optional[bool] = False


class FormularyUpdate(BaseModel):
    name: Optional[str] = None
    strength: Optional[str] = None
    form: Optional[str] = None
    unit_ucum: Optional[str] = None
    pack_size: Optional[int] = None
    unit_price: Optional[float] = None
    sha_price: Optional[float] = None
    requires_auth: Optional[bool] = None
    teleconsult_allowed: Optional[bool] = None
    loinc_code: Optional[str] = None
    chw_formulary: Optional[bool] = None
    is_active: Optional[bool] = None


class FormularyResponse(BaseModel):
    id: int
    sha_code: str
    name: str
    strength: Optional[str]
    form: Optional[str]
    unit_ucum: str
    pack_size: int
    unit_price: Optional[float]
    sha_price: Optional[float]
    requires_auth: bool
    teleconsult_allowed: bool
    loinc_code: Optional[str]
    chw_formulary: bool
    is_active: bool


class FormularyListResponse(BaseModel):
    items: list[FormularyResponse]
    total: int


from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id
from app.core.rbac.dependency import require_role


@router.get("", response_model=FormularyListResponse)
async def list_formulary(
    search: Optional[str] = Query(None, description="Search by name or code"),
    form: Optional[str] = Query(None, description="Filter by form"),
    only_chw: bool = Query(False, description="CHW formulary only"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """List formulary drugs with search and filters"""

    # Build query
    conditions = ["is_active = true"]
    params = {"limit": limit, "offset": (page - 1) * limit}

    if search:
        conditions.append("(name ILIKE :search OR sha_code ILIKE :search)")
        params["search"] = f"%{search}%"

    if form:
        conditions.append("form = :form")
        params["form"] = form

    if only_chw:
        conditions.append("chw_formulary = true")

    where_clause = " AND ".join(conditions)

    # Get total count
    count_sql = f"SELECT COUNT(*) as total FROM formulary WHERE {where_clause}"
    count_result = await db.fetchone(count_sql, params)
    total = count_result["total"] if count_result else 0

    # Get items
    sql = f"""
        SELECT id, sha_code, name, strength, form, unit_ucum, pack_size,
               unit_price, sha_price, requires_auth, teleconsult_allowed,
               loinc_code, chw_formulary, is_active
        FROM formulary
        WHERE {where_clause}
        ORDER BY name
        LIMIT :limit OFFSET :offset
    """
    rows = await db.fetchall(sql, params)

    items = [
        FormularyResponse(
            id=row["id"],
            sha_code=row["sha_code"],
            name=row["name"],
            strength=row["strength"],
            form=row["form"],
            unit_ucum=row["unit_ucum"],
            pack_size=row["pack_size"],
            unit_price=float(row["unit_price"]) if row["unit_price"] else None,
            sha_price=float(row["sha_price"]) if row["sha_price"] else None,
            requires_auth=row["requires_auth"],
            teleconsult_allowed=row["teleconsult_allowed"],
            loinc_code=row["loinc_code"],
            chw_formulary=row["chw_formulary"],
            is_active=row["is_active"],
        )
        for row in rows
    ]

    return FormularyListResponse(items=items, total=total)


@router.get("/{sha_code}", response_model=FormularyResponse)
async def get_formulary_by_code(
    sha_code: str,
    db=Depends(get_db_session),
):
    """Get drug by SHA code"""

    sql = """
        SELECT id, sha_code, name, strength, form, unit_ucum, pack_size,
               unit_price, sha_price, requires_auth, teleconsult_allowed,
               loinc_code, chw_formulary, is_active
        FROM formulary WHERE sha_code = :sha_code
    """
    row = await db.fetchone(sql, {"sha_code": sha_code})

    if not row:
        raise HTTPException(status_code=404, detail="Drug not found in formulary")

    return FormularyResponse(
        id=row["id"],
        sha_code=row["sha_code"],
        name=row["name"],
        strength=row["strength"],
        form=row["form"],
        unit_ucum=row["unit_ucum"],
        pack_size=row["pack_size"],
        unit_price=float(row["unit_price"]) if row["unit_price"] else None,
        sha_price=float(row["sha_price"]) if row["sha_price"] else None,
        requires_auth=row["requires_auth"],
        teleconsult_allowed=row["teleconsult_allowed"],
        loinc_code=row["loinc_code"],
        chw_formulary=row["chw_formulary"],
        is_active=row["is_active"],
    )


@router.post("", status_code=201, response_model=FormularyResponse)
async def create_formulary(
    formulary: FormularyCreate,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Add drug to formulary (admin only)"""

    # Check for duplicate
    existing = await db.fetchone(
        "SELECT id FROM formulary WHERE sha_code = :sha_code",
        {"sha_code": formulary.sha_code},
    )
    if existing:
        raise HTTPException(status_code=409, detail="SHA code already exists")

    # Insert
    sql = """
        INSERT INTO formulary (
            sha_code, name, strength, form, unit_ucum, pack_size,
            unit_price, sha_price, requires_auth, teleconsult_allowed,
            loinc_code, chw_formulary
        )
        VALUES (
            :sha_code, :name, :strength, :form, :unit_ucum, :pack_size,
            :unit_price, :sha_price, :requires_auth, :teleconsult_allowed,
            :loinc_code, :chw_formulary
        )
        RETURNING id, sha_code, name, strength, form, unit_ucum, pack_size,
                  unit_price, sha_price, requires_auth, teleconsult_allowed,
                  loinc_code, chw_formulary, is_active
    """
    row = await db.fetchone(
        sql,
        {
            "sha_code": formulary.sha_code,
            "name": formulary.name,
            "strength": formulary.strength,
            "form": formulary.form,
            "unit_ucum": formulary.unit_ucum,
            "pack_size": formulary.pack_size,
            "unit_price": formulary.unit_price,
            "sha_price": formulary.sha_price,
            "requires_auth": formulary.requires_auth,
            "teleconsult_allowed": formulary.teleconsult_allowed,
            "loinc_code": formulary.loinc_code,
            "chw_formulary": formulary.chw_formulary,
        },
    )

    return FormularyResponse(
        id=row["id"],
        sha_code=row["sha_code"],
        name=row["name"],
        strength=row["strength"],
        form=row["form"],
        unit_ucum=row["unit_ucum"],
        pack_size=row["pack_size"],
        unit_price=float(row["unit_price"]) if row["unit_price"] else None,
        sha_price=float(row["sha_price"]) if row["sha_price"] else None,
        requires_auth=row["requires_auth"],
        teleconsult_allowed=row["teleconsult_allowed"],
        loinc_code=row["loinc_code"],
        chw_formulary=row["chw_formulary"],
        is_active=row["is_active"],
    )


@router.put("/{sha_code}", response_model=FormularyResponse)
async def update_formulary(
    sha_code: str,
    formulary: FormularyUpdate,
    db=Depends(get_db_session),
):
    """Update formulary drug (admin only)"""

    # Build update dynamically
    updates = []
    params = {"sha_code": sha_code}

    for field, value in formulary.model_dump(exclude_none=True).items():
        updates.append(f"{field} = :{field}")
        params[field] = value

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    sql = f"""
        UPDATE formulary
        SET {", ".join(updates)}, updated_at = NOW()
        WHERE sha_code = :sha_code
        RETURNING id, sha_code, name, strength, form, unit_ucum, pack_size,
                  unit_price, sha_price, requires_auth, teleconsult_allowed,
                  loinc_code, chw_formulary, is_active
    """
    row = await db.fetchone(sql, params)

    if not row:
        raise HTTPException(status_code=404, detail="Drug not found in formulary")

    return FormularyResponse(
        id=row["id"],
        sha_code=row["sha_code"],
        name=row["name"],
        strength=row["strength"],
        form=row["form"],
        unit_ucum=row["unit_ucum"],
        pack_size=row["pack_size"],
        unit_price=float(row["unit_price"]) if row["unit_price"] else None,
        sha_price=float(row["sha_price"]) if row["sha_price"] else None,
        requires_auth=row["requires_auth"],
        teleconsult_allowed=row["teleconsult_allowed"],
        loinc_code=row["loinc_code"],
        chw_formulary=row["chw_formulary"],
        is_active=row["is_active"],
    )


@router.delete("/{sha_code}", status_code=204)
async def deactivate_formulary(
    sha_code: str,
    db=Depends(get_db_session),
):
    """Soft delete drug from formulary (admin only)"""

    result = await db.execute(
        "UPDATE formulary SET is_active = false, updated_at = NOW() WHERE sha_code = :sha_code",
        {"sha_code": sha_code},
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Drug not found in formulary")

    return None
