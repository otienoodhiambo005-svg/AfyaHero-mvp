from __future__ import annotations

import ast
import json
import time
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Any, Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.rbac.dependency import require_permission
from app.core.rbac.permissions import Permission
from app.core.tenancy.context import get_hospital_id, get_user_id
from app.db import get_redis
from app.dependencies import get_db_session

router = APIRouter()
settings = get_settings()

ReferralType = Literal["outbound", "inbound", "internal"]
ReferralUrgency = Literal["emergency", "urgent", "routine"]
ReferralStatus = Literal["requested", "received", "accepted", "in-progress", "completed", "rejected"]
TRANSITIONS = {
    "requested": {"received", "accepted", "rejected"},
    "received": {"accepted", "rejected"},
    "accepted": {"in-progress", "completed", "rejected"},
    "in-progress": {"completed", "rejected"},
    "completed": set(),
    "rejected": set(),
}
_rate_mem: dict[str, deque[float]] = defaultdict(deque)


class ReferralCreate(BaseModel):
    patient_id: str
    receiving_facility_id: str
    reason: str = Field(min_length=2, max_length=500)
    referral_type: ReferralType = "outbound"
    urgency: ReferralUrgency = "routine"
    notes: Optional[str] = Field(default=None, max_length=1000)
    encounter_id: Optional[str] = None
    receiving_facility_level: Optional[int] = Field(default=None, ge=1, le=6)


class InboundReferralCreate(BaseModel):
    patient_phone: str = Field(min_length=7, max_length=20)
    facility_name: str = Field(min_length=2, max_length=255)
    reason: str = Field(min_length=2, max_length=500)
    urgency: ReferralUrgency = "routine"


class ReferralStatusUpdate(BaseModel):
    status: ReferralStatus
    business_status: Optional[str] = Field(default=None, max_length=100)
    note: Optional[str] = Field(default=None, max_length=1000)
    rejection_reason: Optional[str] = Field(default=None, max_length=500)


class ResendCodeRequest(BaseModel):
    task_id: Optional[str] = None
    patient_id: Optional[str] = None


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _claim_code() -> str:
    return uuid4().hex[:3].upper()


def _json(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            try:
                data = ast.literal_eval(value)
                return data if isinstance(data, dict) else {}
            except (ValueError, SyntaxError):
                return {}
    return {}


async def _one(db: AsyncSession, sql: str, params: dict[str, Any]) -> Optional[dict[str, Any]]:
    result = await db.execute(text(sql), params)
    row = result.mappings().first()
    return dict(row) if row else None


async def _many(db: AsyncSession, sql: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    result = await db.execute(text(sql), params)
    return [dict(x) for x in result.mappings().all()]


async def _emit(db: AsyncSession, action: str, hospital_id: str, detail: dict[str, Any], actor_id: Optional[str] = None):
    await db.execute(
        text(
            """
            INSERT INTO audit_logs (action, actor_id, hospital_id, resource_type, resource_id, detail, created_at)
            VALUES (:action, :actor_id, :hospital_id, 'referral', :resource_id, CAST(:detail AS jsonb), NOW())
            """
        ),
        {
            "action": action,
            "actor_id": actor_id,
            "hospital_id": hospital_id,
            "resource_id": detail.get("task_id"),
            "detail": json.dumps(detail),
        },
    )


async def _queue_sms(db: AsyncSession, patient_id: Optional[str], phone: Optional[str], message: str):
    if not phone:
        return
    await db.execute(
        text(
            """
            INSERT INTO communication_queue (patient_id, phone, channel, message, status, created_at)
            VALUES (:patient_id, :phone, 'sms', :message, 'pending', NOW())
            """
        ),
        {"patient_id": patient_id, "phone": phone, "message": message},
    )


async def _check_public_rate_limit(request: Request) -> bool:
    ip = request.client.host if request.client else "unknown"
    key = f"referral:inbound:{ip}"
    redis = get_redis()
    if redis is not None:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 3600)
        return count <= 10
    if settings.ENVIRONMENT == "production":
        return False
    now = time.time()
    queue = _rate_mem[key]
    while queue and queue[0] < now - 3600:
        queue.popleft()
    if len(queue) >= 10:
        return False
    queue.append(now)
    return True


async def _get_task_context(db: AsyncSession, task_id: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    row = await _one(
        db,
        """
        SELECT t.fhir_id AS task_id, t.data AS task_data, t.facility_id AS task_facility_id,
               sr.fhir_id AS sr_id, sr.data AS sr_data, sr.facility_id AS sr_facility_id
        FROM fhir_resources t
        JOIN fhir_resources sr ON sr.fhir_id = split_part(COALESCE(t.data->'focus'->>'reference', t.data->'basedOn'->0->>'reference'), '/', 2)
        WHERE t.resource_type='Task' AND t.fhir_id=:task_id
        """,
        {"task_id": task_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Referral task not found")
    return _json(row["task_data"]), _json(row["sr_data"]), {
        "task_id": row["task_id"],
        "task_facility_id": row["task_facility_id"],
        "sr_id": row["sr_id"],
        "sr_facility_id": row["sr_facility_id"],
    }


@router.post("", dependencies=[Depends(require_permission(Permission.REFERRAL_WRITE))])
async def create_referral(referral: ReferralCreate, db: AsyncSession = Depends(get_db_session), hospital_id: str = Depends(get_hospital_id), user_id: str = Depends(get_user_id)):
    patient = await _one(db, "SELECT id,name,phone FROM patients WHERE id=:id AND hospital_id=:hospital_id", {"id": referral.patient_id, "hospital_id": hospital_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    facility = await _one(db, "SELECT id,name FROM hospitals WHERE id=:id", {"id": referral.receiving_facility_id})
    if not facility:
        raise HTTPException(status_code=404, detail="Receiving facility not found")

    target_facility = hospital_id if referral.referral_type == "internal" else referral.receiving_facility_id
    sr_id, task_id, code = str(uuid4()), str(uuid4()), _claim_code()
    sha_required = bool(referral.receiving_facility_level and referral.receiving_facility_level >= 5)

    sr = {
        "resourceType": "ServiceRequest",
        "id": sr_id,
        "status": "active",
        "intent": "order",
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "3457005"}], "text": referral.reason},
        "subject": {"reference": f"Patient/{referral.patient_id}"},
        "encounter": {"reference": f"Encounter/{referral.encounter_id}"} if referral.encounter_id else None,
        "requester": {"reference": f"Organization/{hospital_id}"},
        "performer": [{"reference": f"Organization/{target_facility}"}],
        "extension": [
            {"url": "referral_type", "valueCode": referral.referral_type},
            {"url": "urgency", "valueCode": referral.urgency},
            {"url": "claim_code", "valueString": code},
            {"url": "sha_referral_required", "valueBoolean": sha_required},
        ],
        "note": [{"text": referral.notes}] if referral.notes else [],
    }
    sr = {k: v for k, v in sr.items() if v not in (None, [], {})}
    task = {
        "resourceType": "Task",
        "id": task_id,
        "status": "requested",
        "intent": "order",
        "code": {"text": "referral"},
        "focus": {"reference": f"ServiceRequest/{sr_id}"},
        "for": {"reference": f"Patient/{referral.patient_id}"},
        "owner": {"reference": f"Organization/{target_facility}"},
        "requester": {"reference": f"Practitioner/{user_id}"},
        "businessStatus": {"text": "awaiting_acceptance"},
        "input": [{"type": {"text": "claim_code"}, "valueString": code}],
        "authoredOn": _now(),
    }

    await db.execute(text("INSERT INTO fhir_resources (resource_type,fhir_id,facility_id,data,created_at,updated_at) VALUES ('ServiceRequest',:id,:facility,CAST(:data AS jsonb),NOW(),NOW())"), {"id": sr_id, "facility": hospital_id, "data": json.dumps(sr)})
    await db.execute(text("INSERT INTO fhir_resources (resource_type,fhir_id,facility_id,data,created_at,updated_at) VALUES ('Task',:id,:facility,CAST(:data AS jsonb),NOW(),NOW())"), {"id": task_id, "facility": target_facility, "data": json.dumps(task)})

    if sha_required:
        doc = {
            "resourceType": "DocumentReference",
            "id": str(uuid4()),
            "status": "current",
            "type": {"text": "MOH Form 4 Referral"},
            "subject": {"reference": f"Patient/{referral.patient_id}"},
            "date": _now(),
            "description": f"QR:{sr_id}",
        }
        await db.execute(text("INSERT INTO fhir_resources (resource_type,fhir_id,facility_id,data,created_at,updated_at) VALUES ('DocumentReference',:id,:facility,CAST(:data AS jsonb),NOW(),NOW())"), {"id": doc["id"], "facility": hospital_id, "data": json.dumps(doc)})

    await _queue_sms(db, referral.patient_id, patient.get("phone"), f"Rufaa {code} imeundwa. Kituo: {facility['name']}.")
    await _emit(db, "referral.created", hospital_id, {"task_id": task_id, "service_request_id": sr_id, "patient_id": referral.patient_id, "sha_referral_required": sha_required}, user_id)
    await db.commit()
    return {"task_id": task_id, "service_request_id": sr_id, "status": "requested", "claim_code": code, "sha_referral_required": sha_required}


@router.post("/inbound/public")
async def create_inbound_referral(request: Request, inbound: InboundReferralCreate, db: AsyncSession = Depends(get_db_session)):
    if not await _check_public_rate_limit(request):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    facility = await _one(db, "SELECT id,name FROM hospitals WHERE lower(name)=lower(:name) LIMIT 1", {"name": inbound.facility_name})
    if not facility:
        raise HTTPException(status_code=404, detail="Receiving facility not found")
    patient = await _one(db, "SELECT id,phone FROM patients WHERE hospital_id=:h AND phone=:p ORDER BY created_at DESC LIMIT 1", {"h": facility["id"], "p": inbound.patient_phone})
    patient_id = patient["id"] if patient else None
    phone = patient["phone"] if patient else inbound.patient_phone
    sr_id, task_id, code = str(uuid4()), str(uuid4()), _claim_code()
    sr = {
        "resourceType": "ServiceRequest",
        "id": sr_id,
        "status": "active",
        "intent": "order",
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "3457005"}], "text": inbound.reason},
        "subject": {"reference": f"Patient/{patient_id}"} if patient_id else {"identifier": {"system": "phone", "value": phone}},
        "performer": [{"reference": f"Organization/{facility['id']}"}],
        "extension": [{"url": "referral_type", "valueCode": "inbound"}, {"url": "urgency", "valueCode": inbound.urgency}, {"url": "claim_code", "valueString": code}],
    }
    task = {
        "resourceType": "Task",
        "id": task_id,
        "status": "received",
        "intent": "order",
        "code": {"text": "referral"},
        "focus": {"reference": f"ServiceRequest/{sr_id}"},
        "owner": {"reference": f"Organization/{facility['id']}"},
        "businessStatus": {"text": "incoming_triage"},
        "for": {"reference": f"Patient/{patient_id}"} if patient_id else None,
        "input": [{"type": {"text": "claim_code"}, "valueString": code}],
        "authoredOn": _now(),
    }
    task = {k: v for k, v in task.items() if v is not None}
    await db.execute(text("INSERT INTO fhir_resources (resource_type,fhir_id,facility_id,data,created_at,updated_at) VALUES ('ServiceRequest',:id,:facility,CAST(:data AS jsonb),NOW(),NOW())"), {"id": sr_id, "facility": facility["id"], "data": json.dumps(sr)})
    await db.execute(text("INSERT INTO fhir_resources (resource_type,fhir_id,facility_id,data,created_at,updated_at) VALUES ('Task',:id,:facility,CAST(:data AS jsonb),NOW(),NOW())"), {"id": task_id, "facility": facility["id"], "data": json.dumps(task)})
    await _queue_sms(db, patient_id, phone, "Rufaa imepokelewa. Njoo moja kwa moja mapokezi.")
    await _emit(db, "referral.inbound_received", facility["id"], {"task_id": task_id, "service_request_id": sr_id, "patient_id": patient_id})
    await db.commit()
    return {"task_id": task_id, "service_request_id": sr_id, "status": "received", "claim_code": code}


@router.get("/inbox", dependencies=[Depends(require_permission(Permission.REFERRAL_WRITE))])
async def get_referral_inbox(status: Optional[ReferralStatus] = Query(default=None), page: int = Query(default=1, ge=1), limit: int = Query(default=20, ge=1, le=100), db: AsyncSession = Depends(get_db_session), hospital_id: str = Depends(get_hospital_id)):
    params: dict[str, Any] = {"owner_ref": f"Organization/{hospital_id}", "limit": limit, "offset": (page - 1) * limit}
    status_sql = ""
    if status:
        status_sql = " AND t.data->>'status'=:status "
        params["status"] = status
    rows = await _many(
        db,
        f"""
        SELECT t.fhir_id AS task_id, t.data AS task_data, t.created_at AS created_at,
               sr.fhir_id AS sr_id, sr.data AS sr_data, p.name AS patient_name, p.phone AS patient_phone
        FROM fhir_resources t
        JOIN fhir_resources sr ON sr.fhir_id = split_part(COALESCE(t.data->'focus'->>'reference', t.data->'basedOn'->0->>'reference'), '/', 2)
        LEFT JOIN patients p ON p.id = split_part(sr.data->'subject'->>'reference', '/', 2)
        WHERE t.resource_type='Task' AND t.data->'code'->>'text'='referral' AND t.data->'owner'->>'reference'=:owner_ref {status_sql}
        ORDER BY t.created_at DESC LIMIT :limit OFFSET :offset
        """,
        params,
    )
    items = []
    for row in rows:
        task = _json(row["task_data"])
        sr = _json(row["sr_data"])
        items.append({"task_id": row["task_id"], "service_request_id": row["sr_id"], "status": task.get("status"), "business_status": (task.get("businessStatus") or {}).get("text"), "reason": (sr.get("code") or {}).get("text"), "patient_id": (sr.get("subject") or {}).get("reference", "").split("/")[-1] if (sr.get("subject") or {}).get("reference") else None, "patient_name": row.get("patient_name"), "patient_phone": row.get("patient_phone"), "created_at": row["created_at"].isoformat() if row.get("created_at") else None})
    return {"items": items, "page": page, "limit": limit, "count": len(items)}


@router.get("/outbox", dependencies=[Depends(require_permission(Permission.REFERRAL_WRITE))])
async def get_referral_outbox(status: Optional[ReferralStatus] = Query(default=None), page: int = Query(default=1, ge=1), limit: int = Query(default=20, ge=1, le=100), db: AsyncSession = Depends(get_db_session), hospital_id: str = Depends(get_hospital_id)):
    params: dict[str, Any] = {"requester_ref": f"Organization/{hospital_id}", "limit": limit, "offset": (page - 1) * limit}
    status_sql = ""
    if status:
        status_sql = " AND t.data->>'status'=:status "
        params["status"] = status
    rows = await _many(
        db,
        f"""
        SELECT sr.fhir_id AS sr_id, sr.data AS sr_data, sr.created_at AS created_at,
               t.fhir_id AS task_id, t.data AS task_data, p.name AS patient_name, p.phone AS patient_phone,
               h.name AS receiving_facility_name
        FROM fhir_resources sr
        JOIN fhir_resources t ON split_part(COALESCE(t.data->'focus'->>'reference', t.data->'basedOn'->0->>'reference'), '/', 2)=sr.fhir_id
        LEFT JOIN patients p ON p.id = split_part(sr.data->'subject'->>'reference', '/', 2)
        LEFT JOIN hospitals h ON h.id = split_part(sr.data->'performer'->0->>'reference', '/', 2)
        WHERE sr.resource_type='ServiceRequest' AND sr.data->'requester'->>'reference'=:requester_ref AND t.resource_type='Task' {status_sql}
        ORDER BY sr.created_at DESC LIMIT :limit OFFSET :offset
        """,
        params,
    )
    items = []
    for row in rows:
        task = _json(row["task_data"])
        sr = _json(row["sr_data"])
        items.append({"task_id": row["task_id"], "service_request_id": row["sr_id"], "status": task.get("status"), "business_status": (task.get("businessStatus") or {}).get("text"), "reason": (sr.get("code") or {}).get("text"), "patient_id": (sr.get("subject") or {}).get("reference", "").split("/")[-1] if (sr.get("subject") or {}).get("reference") else None, "patient_name": row.get("patient_name"), "patient_phone": row.get("patient_phone"), "receiving_facility_name": row.get("receiving_facility_name"), "created_at": row["created_at"].isoformat() if row.get("created_at") else None})
    return {"items": items, "page": page, "limit": limit, "count": len(items)}


@router.get("/out", dependencies=[Depends(require_permission(Permission.REFERRAL_WRITE))])
async def get_referral_out_alias(status: Optional[ReferralStatus] = Query(default=None), page: int = Query(default=1, ge=1), limit: int = Query(default=20, ge=1, le=100), db: AsyncSession = Depends(get_db_session), hospital_id: str = Depends(get_hospital_id)):
    return await get_referral_outbox(status, page, limit, db, hospital_id)


@router.post("/{task_id}/status", dependencies=[Depends(require_permission(Permission.REFERRAL_WRITE))])
async def update_referral_status(task_id: str, update: ReferralStatusUpdate, db: AsyncSession = Depends(get_db_session), hospital_id: str = Depends(get_hospital_id), user_id: str = Depends(get_user_id)):
    task, sr, meta = await _get_task_context(db, task_id)
    owner_ref = (task.get("owner") or {}).get("reference")
    if owner_ref and owner_ref != f"Organization/{hospital_id}":
        raise HTTPException(status_code=403, detail="Task is not owned by this facility")
    current = task.get("status") or "requested"
    target = update.status
    if target != current and target not in TRANSITIONS.get(current, set()):
        raise HTTPException(status_code=400, detail=f"Invalid transition from {current} to {target}")
    if target == "rejected" and not (update.rejection_reason or update.note):
        raise HTTPException(status_code=400, detail="Rejection reason required")

    task["status"] = target
    if update.business_status:
        task["businessStatus"] = {"text": update.business_status}
    if update.note:
        task.setdefault("note", []).append({"text": update.note, "time": _now()})
    if target == "rejected":
        task.setdefault("output", []).append({"type": {"text": "rejection_reason"}, "valueString": update.rejection_reason or update.note})

    await db.execute(text("UPDATE fhir_resources SET data=CAST(:data AS jsonb), updated_at=NOW() WHERE resource_type='Task' AND fhir_id=:id"), {"id": task_id, "data": json.dumps(task)})
    patient_id = (sr.get("subject") or {}).get("reference", "").split("/")[-1] if (sr.get("subject") or {}).get("reference") else None
    phone_row = await _one(db, "SELECT phone FROM patients WHERE id=:id", {"id": patient_id}) if patient_id else None
    phone = phone_row.get("phone") if phone_row else None
    code = None
    for item in task.get("input", []):
        if ((item.get("type") or {}).get("text")) == "claim_code":
            code = item.get("valueString")
            break
    if target == "accepted":
        await _queue_sms(db, patient_id, phone, f"Rufaa {code or ''} imekubaliwa.")
    elif target == "completed":
        await _queue_sms(db, patient_id, phone, f"Rufaa {code or ''} imekamilika. Ripoti iko tayari.")
    elif target == "rejected":
        await _queue_sms(db, patient_id, phone, f"Rufaa {code or ''} imekataliwa.")
    await _emit(db, "referral.status_changed", meta["sr_facility_id"], {"task_id": task_id, "from_status": current, "to_status": target, "business_status": update.business_status}, user_id)
    await db.commit()
    return {"task_id": task_id, "service_request_id": meta["sr_id"], "status": target, "business_status": update.business_status}


@router.post("/{task_id}/accept", dependencies=[Depends(require_permission(Permission.REFERRAL_WRITE))])
async def accept_referral(task_id: str, update: ReferralStatusUpdate, db: AsyncSession = Depends(get_db_session), hospital_id: str = Depends(get_hospital_id), user_id: str = Depends(get_user_id)):
    return await update_referral_status(task_id, ReferralStatusUpdate(status="accepted", business_status=update.business_status or "awaiting_appointment", note=update.note), db, hospital_id, user_id)


@router.post("/{task_id}/reject", dependencies=[Depends(require_permission(Permission.REFERRAL_WRITE))])
async def reject_referral(task_id: str, update: ReferralStatusUpdate, db: AsyncSession = Depends(get_db_session), hospital_id: str = Depends(get_hospital_id), user_id: str = Depends(get_user_id)):
    return await update_referral_status(task_id, ReferralStatusUpdate(status="rejected", business_status=update.business_status or "rejected", note=update.note, rejection_reason=update.rejection_reason or update.note), db, hospital_id, user_id)


@router.get("/patient/{patient_id}", dependencies=[Depends(require_permission(Permission.PATIENT_READ))])
async def get_patient_referrals(patient_id: str, db: AsyncSession = Depends(get_db_session), hospital_id: str = Depends(get_hospital_id)):
    rows = await _many(
        db,
        """
        SELECT t.fhir_id AS task_id, t.data AS task_data, t.created_at AS created_at, sr.fhir_id AS sr_id, sr.data AS sr_data
        FROM fhir_resources t
        JOIN fhir_resources sr ON sr.fhir_id = split_part(COALESCE(t.data->'focus'->>'reference', t.data->'basedOn'->0->>'reference'), '/', 2)
        WHERE t.resource_type='Task' AND sr.resource_type='ServiceRequest'
          AND split_part(sr.data->'subject'->>'reference', '/', 2)=:patient_id
          AND (t.facility_id=:hospital_id OR sr.facility_id=:hospital_id)
        ORDER BY t.created_at DESC
        LIMIT 50
        """,
        {"patient_id": patient_id, "hospital_id": hospital_id},
    )
    items = []
    for row in rows:
        task = _json(row["task_data"])
        if task.get("status") == "completed":
            continue
        code = None
        for item in task.get("input", []):
            if ((item.get("type") or {}).get("text")) == "claim_code":
                code = item.get("valueString")
                break
        sr = _json(row["sr_data"])
        items.append({"task_id": row["task_id"], "service_request_id": row["sr_id"], "status": task.get("status"), "business_status": (task.get("businessStatus") or {}).get("text"), "claim_code": code, "reason": (sr.get("code") or {}).get("text"), "updated_at": row["created_at"].isoformat() if row.get("created_at") else None})
    return {"items": items}


@router.post("/{task_id}/arrived", dependencies=[Depends(require_permission(Permission.REFERRAL_WRITE))])
async def mark_arrived(task_id: str, db: AsyncSession = Depends(get_db_session), hospital_id: str = Depends(get_hospital_id), user_id: str = Depends(get_user_id)):
    task, _, meta = await _get_task_context(db, task_id)
    if (task.get("owner") or {}).get("reference") != f"Organization/{hospital_id}":
        raise HTTPException(status_code=403, detail="Task is not owned by this facility")
    if task.get("status") in {"requested", "received", "accepted"}:
        task["status"] = "in-progress"
    task["businessStatus"] = {"text": "patient_arrived"}
    task.setdefault("note", []).append({"text": "Patient marked arrived", "time": _now()})
    await db.execute(text("UPDATE fhir_resources SET data=CAST(:data AS jsonb), updated_at=NOW() WHERE resource_type='Task' AND fhir_id=:id"), {"id": task_id, "data": json.dumps(task)})
    await _emit(db, "referral.patient_arrived", meta["task_facility_id"], {"task_id": task_id, "status": task.get("status"), "business_status": "patient_arrived"}, user_id)
    await db.commit()
    return {"task_id": task_id, "status": task.get("status"), "business_status": "patient_arrived"}


@router.post("/resend-code", dependencies=[Depends(require_permission(Permission.REFERRAL_WRITE))])
async def resend_code(payload: ResendCodeRequest, db: AsyncSession = Depends(get_db_session), hospital_id: str = Depends(get_hospital_id)):
    if not payload.task_id and not payload.patient_id:
        raise HTTPException(status_code=400, detail="task_id or patient_id is required")
    params: dict[str, Any] = {"hospital_id": hospital_id}
    where = "1=1"
    if payload.task_id:
        where += " AND t.fhir_id=:task_id"
        params["task_id"] = payload.task_id
    if payload.patient_id:
        where += " AND split_part(sr.data->'subject'->>'reference', '/', 2)=:patient_id"
        params["patient_id"] = payload.patient_id
    row = await _one(
        db,
        f"""
        SELECT t.fhir_id AS task_id, t.data AS task_data, p.id AS patient_id, p.phone AS patient_phone
        FROM fhir_resources t
        JOIN fhir_resources sr ON sr.fhir_id = split_part(COALESCE(t.data->'focus'->>'reference', t.data->'basedOn'->0->>'reference'), '/', 2)
        LEFT JOIN patients p ON p.id = split_part(sr.data->'subject'->>'reference', '/', 2)
        WHERE t.resource_type='Task' AND (t.facility_id=:hospital_id OR sr.facility_id=:hospital_id) AND {where}
        ORDER BY t.created_at DESC LIMIT 1
        """,
        params,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Referral not found")
    task = _json(row["task_data"])
    code = None
    for item in task.get("input", []):
        if ((item.get("type") or {}).get("text")) == "claim_code":
            code = item.get("valueString")
            break
    if not code:
        raise HTTPException(status_code=404, detail="Claim code not found")
    await _queue_sms(db, row.get("patient_id"), row.get("patient_phone"), f"Nambari ya rufaa: {code}")
    await db.commit()
    return {"task_id": row["task_id"], "claim_code": code, "queued": True}
