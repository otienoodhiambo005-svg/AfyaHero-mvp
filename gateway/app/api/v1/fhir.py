"""
FHIR R4 Resource Handler - HL7 FHIR Implementation
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from uuid import uuid4
import json
import re

from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id, get_user_id
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

router = APIRouter(prefix="/fhir", tags=["FHIR R4"])

SUPPORTED_RESOURCES = [
    "Patient",
    "Observation",
    "Encounter",
    "MedicationRequest",
    "ServiceRequest",
]

CAPABILITY_STATEMENT = {
    "resourceType": "CapabilityStatement",
    "status": "active",
    "date": datetime.utcnow().isoformat() + "Z",
    "kind": "instance",
    "fhirVersion": "4.0.1",
    "format": ["json"],
    "rest": [
        {
            "mode": "server",
            "resource": [
                {
                    "type": "Patient",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"},
                        {"code": "create"},
                        {"code": "update"},
                    ],
                    "searchParam": [
                        {"name": "_id", "type": "token"},
                        {"name": "identifier", "type": "token"},
                        {"name": "name", "type": "string"},
                        {"name": "birthdate", "type": "date"},
                    ],
                },
                {
                    "type": "Observation",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"},
                        {"code": "create"},
                        {"code": "update"},
                    ],
                    "searchParam": [
                        {"name": "_id", "type": "token"},
                        {"name": "patient", "type": "reference"},
                        {"name": "date", "type": "date"},
                        {"name": "status", "type": "token"},
                        {"name": "code", "type": "token"},
                    ],
                },
                {
                    "type": "Encounter",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"},
                        {"code": "create"},
                        {"code": "update"},
                    ],
                    "searchParam": [
                        {"name": "_id", "type": "token"},
                        {"name": "patient", "type": "reference"},
                        {"name": "date", "type": "date"},
                        {"name": "status", "type": "token"},
                    ],
                },
                {
                    "type": "MedicationRequest",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"},
                        {"code": "create"},
                        {"code": "update"},
                    ],
                    "searchParam": [
                        {"name": "_id", "type": "token"},
                        {"name": "patient", "type": "reference"},
                        {"name": "status", "type": "token"},
                        {"name": "authoredon", "type": "date"},
                    ],
                },
                {
                    "type": "ServiceRequest",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"},
                        {"code": "create"},
                        {"code": "update"},
                    ],
                    "searchParam": [
                        {"name": "_id", "type": "token"},
                        {"name": "patient", "type": "reference"},
                        {"name": "status", "type": "token"},
                        {"name": "authoredon", "type": "date"},
                    ],
                },
            ],
        }
    ],
}


@router.get("/metadata", response_model=dict)
async def get_capability_statement():
    """FHIR capability statement"""
    return CAPABILITY_STATEMENT


class FHIRBundle(BaseModel):
    resourceType: str = "Bundle"
    type: str = "searchset"
    total: int = 0
    link: list[dict] = Field(default_factory=list)
    entry: list[dict] = Field(default_factory=list)


class OperationOutcome(BaseModel):
    resourceType: str = "OperationOutcome"
    issue: list[dict] = Field(default_factory=list)


def parse_fhir_date(date_str: str) -> Optional[str]:
    """Parse FHIR date parameters"""
    if not date_str:
        return None
    date_str = date_str.strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return date_str
    if re.match(r"^\d{4}-\d{2}$", date_str):
        return date_str
    if re.match(r"^\d{4}$", date_str):
        return date_str
    return None


def build_search_query(
    resource_type: str, params: dict, hospital_id: str
) -> tuple[str, str, dict]:
    """Build SQL query for FHIR search"""
    base_query = """
        SELECT id, fhir_id, resource_type, data, created_at, updated_at
        FROM fhir_resources
        WHERE resource_type = :resource_type
        AND facility_id = :facility_id
    """
    query_params = {"resource_type": resource_type, "facility_id": hospital_id}

    if "_id" in params and params["_id"]:
        base_query += " AND fhir_id = :fhir_id"
        query_params["fhir_id"] = params["_id"]

    if resource_type == "Patient":
        if params.get("identifier"):
            base_query += " AND data->'identifier' @> :identifier"
            query_params["identifier"] = json.dumps([{"value": params["identifier"]}])
        if params.get("name"):
            base_query += " AND data->'name' @> :name"
            query_params["name"] = json.dumps([{"display": {"$regex": params["name"]}}])
        if params.get("birthdate"):
            birth = parse_fhir_date(params["birthdate"])
            if birth:
                base_query += " AND data->>'birthDate' = :birthdate"
                query_params["birthdate"] = birth

    elif resource_type == "Observation":
        if params.get("patient"):
            patient_id = params["patient"].replace("Patient/", "")
            base_query += " AND data->>'subject'->>'reference' = :patient_ref"
            query_params["patient_ref"] = f"Patient/{patient_id}"
        if params.get("date"):
            date_val = parse_fhir_date(params["date"])
            if date_val:
                base_query += " AND data->>'effectiveDateTime' LIKE :date_prefix"
                query_params["date_prefix"] = f"{date_val}%"
        if params.get("status"):
            base_query += " AND data->>'status' = :status"
            query_params["status"] = params["status"]
        if params.get("code"):
            base_query += " AND data->'code'->'coding' @> :code"
            query_params["code"] = json.dumps([{"code": params["code"]}])

    elif resource_type == "Encounter":
        if params.get("patient"):
            patient_id = params["patient"].replace("Patient/", "")
            base_query += " AND data->>'subject'->>'reference' = :patient_ref"
            query_params["patient_ref"] = f"Patient/{patient_id}"
        if params.get("date"):
            date_val = parse_fhir_date(params["date"])
            if date_val:
                base_query += " AND data->>'period'->>'start' LIKE :date_prefix"
                query_params["date_prefix"] = f"{date_val}%"
        if params.get("status"):
            base_query += " AND data->>'status' = :status"
            query_params["status"] = params["status"]

    elif resource_type == "MedicationRequest":
        if params.get("patient"):
            patient_id = params["patient"].replace("Patient/", "")
            base_query += " AND data->>'subject'->>'reference' = :patient_ref"
            query_params["patient_ref"] = f"Patient/{patient_id}"
        if params.get("status"):
            base_query += " AND data->>'status' = :status"
            query_params["status"] = params["status"]
        if params.get("authoredon"):
            date_val = parse_fhir_date(params["authoredon"])
            if date_val:
                base_query += " AND data->>'authoredOn' LIKE :date_prefix"
                query_params["date_prefix"] = f"{date_val}%"

    elif resource_type == "ServiceRequest":
        if params.get("patient"):
            patient_id = params["patient"].replace("Patient/", "")
            base_query += " AND data->>'subject'->>'reference' = :patient_ref"
            query_params["patient_ref"] = f"Patient/{patient_id}"
        if params.get("status"):
            base_query += " AND data->>'status' = :status"
            query_params["status"] = params["status"]
        if params.get("authoredon"):
            date_val = parse_fhir_date(params["authoredon"])
            if date_val:
                base_query += " AND data->>'authoredOn' LIKE :date_prefix"
                query_params["date_prefix"] = f"{date_val}%"

    base_query += " ORDER BY updated_at DESC"

    count_query = base_query.replace(
        "SELECT id, fhir_id, resource_type, data, created_at, updated_at",
        "SELECT COUNT(*) as count",
    )

    return base_query, count_query, query_params


@router.get("/{resource_type}")
async def search_fhir_resources(
    resource_type: str,
    _id: Optional[str] = Query(None, alias="_id"),
    _count: Optional[int] = Query(20, alias="_count", ge=1, le=100),
    _offset: Optional[int] = Query(0, alias="_offset", ge=0),
    patient: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    identifier: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    birthdate: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    authoredon: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Search FHIR resources"""
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported resource type: {resource_type}. Supported: {', '.join(SUPPORTED_RESOURCES)}",
        )

    params = {
        "_id": _id,
        "patient": patient,
        "date": date,
        "status": status,
        "identifier": identifier,
        "name": name,
        "birthdate": birthdate,
        "code": code,
        "authoredon": authoredon,
    }
    params = {k: v for k, v in params.items() if v is not None}

    base_query, count_query, query_params = build_search_query(
        resource_type, params, hospital_id
    )

    count_result = await db.execute(text(count_query), query_params)
    total = count_result.scalar() or 0

    base_query += " LIMIT :limit OFFSET :offset"
    query_params["limit"] = _count
    query_params["offset"] = _offset

    result = await db.execute(text(base_query), query_params)
    rows = result.fetchall()

    entries = []
    for row in rows:
        data = json.loads(row.data) if isinstance(row.data, str) else row.data
        resource = {
            "fullUrl": f"urn:uuid:{row.fhir_id}",
            "resource": data,
            "search": {"mode": "match"},
        }
        entries.append(resource)

    bundle = FHIRBundle(
        type="searchset",
        total=total,
        entry=entries,
        link=[
            {"relation": "self", "url": f"?_count={_count}&_offset={_offset}"},
            {"relation": "next", "url": f"?_count={_count}&_offset={_offset + _count}"}
            if total > _offset + _count
            else None,
        ],
    )
    bundle.link = [l for l in bundle.link if l is not None]

    return bundle.model_dump(exclude_none=True)


@router.get("/{resource_type}/{resource_id}")
async def get_fhir_resource(
    resource_type: str,
    resource_id: str,
    db: AsyncSession = Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get a single FHIR resource by ID"""
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=400, detail=f"Unsupported resource type: {resource_type}"
        )

    result = await db.execute(
        text("""
            SELECT id, fhir_id, resource_type, data, created_at, updated_at
            FROM fhir_resources
            WHERE resource_type = :resource_type AND fhir_id = :resource_id AND facility_id = :facility_id
        """),
        {
            "resource_type": resource_type,
            "resource_id": resource_id,
            "facility_id": hospital_id,
        },
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(
            status_code=404, detail=f"{resource_type}/{resource_id} not found"
        )

    data = json.loads(row.data) if isinstance(row.data, str) else row.data
    return data


@router.post("/{resource_type}")
async def create_fhir_resource(
    resource_type: str,
    resource: dict,
    db: AsyncSession = Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
    user_id: str = Query(None),
):
    """Create a new FHIR resource"""
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=400, detail=f"Unsupported resource type: {resource_type}"
        )

    resource_id = resource.get("id") or str(uuid4())
    resource["id"] = resource_id

    if "meta" not in resource:
        resource["meta"] = {}
    resource["meta"]["versionId"] = "1"
    resource["meta"]["lastUpdated"] = datetime.utcnow().isoformat() + "Z"

    now = datetime.utcnow()
    await db.execute(
        text("""
            INSERT INTO fhir_resources (fhir_id, resource_type, facility_id, data, created_at, updated_at)
            VALUES (:fhir_id, :resource_type, :facility_id, :data, :created_at, :updated_at)
        """),
        {
            "fhir_id": resource_id,
            "resource_type": resource_type,
            "facility_id": hospital_id,
            "data": json.dumps(resource),
            "created_at": now,
            "updated_at": now,
        },
    )
    await db.commit()

    location_url = f"/api/v1/fhir/{resource_type}/{resource_id}"
    return resource


@router.put("/{resource_type}/{resource_id}")
async def update_fhir_resource(
    resource_type: str,
    resource_id: str,
    resource: dict,
    db: AsyncSession = Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Update an existing FHIR resource"""
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(
            status_code=400, detail=f"Unsupported resource type: {resource_type}"
        )

    result = await db.execute(
        text("""
            SELECT data FROM fhir_resources
            WHERE resource_type = :resource_type AND fhir_id = :resource_id AND facility_id = :facility_id
        """),
        {
            "resource_type": resource_type,
            "resource_id": resource_id,
            "facility_id": hospital_id,
        },
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(
            status_code=404, detail=f"{resource_type}/{resource_id} not found"
        )

    existing = json.loads(row.data) if isinstance(row.data, str) else row.data
    existing_version = int(existing.get("meta", {}).get("versionId", "1"))

    resource["id"] = resource_id
    if "meta" not in resource:
        resource["meta"] = {}
    resource["meta"]["versionId"] = str(existing_version + 1)
    resource["meta"]["lastUpdated"] = datetime.utcnow().isoformat() + "Z"

    now = datetime.utcnow()
    await db.execute(
        text("""
            UPDATE fhir_resources
            SET data = :data, updated_at = :updated_at
            WHERE fhir_id = :fhir_id AND resource_type = :resource_type AND facility_id = :facility_id
        """),
        {
            "data": json.dumps(resource),
            "updated_at": now,
            "fhir_id": resource_id,
            "resource_type": resource_type,
            "facility_id": hospital_id,
        },
    )
    await db.commit()

    return resource
