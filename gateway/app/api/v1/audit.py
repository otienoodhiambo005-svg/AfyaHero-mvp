"""
Audit Log API Endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

from app.db import get_admin_client

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


class AuditLogResponse(BaseModel):
    id: str
    action: str
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    hospital_id: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    detail: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    logs: list[AuditLogResponse]
    total: int
    page: int
    page_size: int


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    actor: Optional[str] = Query(None, description="Filter by actor ID or email"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    resource_id: Optional[str] = Query(None, description="Filter by resource ID"),
    hospital_id: Optional[str] = Query(None, description="Filter by hospital ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
):
    """
    List audit logs with optional filters.
    """
    client = get_admin_client()

    query = client.table("audit_logs").select("*", count="exact")

    if actor:
        query = query.or_(f"actor_id.eq.{actor},actor_email.ilike.%{actor}%")
    if action:
        query = query.eq("action", action)
    if resource_type:
        query = query.eq("resource_type", resource_type)
    if resource_id:
        query = query.eq("resource_id", resource_id)
    if hospital_id:
        query = query.eq("hospital_id", hospital_id)

    query = query.order("created_at", desc=True)
    query = query.range((page - 1) * page_size, page * page_size)

    result = query.execute()

    logs = [
        AuditLogResponse(
            id=row["id"],
            action=row["action"],
            actor_id=row.get("actor_id"),
            actor_email=row.get("actor_email"),
            actor_role=row.get("actor_role"),
            hospital_id=row.get("hospital_id"),
            resource_type=row.get("resource_type"),
            resource_id=row.get("resource_id"),
            detail=row.get("detail"),
            ip_address=row.get("ip_address"),
            created_at=datetime.fromisoformat(row["created_at"]),
        )
        for row in result.data
    ]

    return AuditLogListResponse(
        logs=logs,
        total=result.count or 0,
        page=page,
        page_size=page_size,
    )


@router.get("/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(log_id: UUID):
    """
    Get a single audit log entry by ID.
    """
    client = get_admin_client()

    result = client.table("audit_logs").select("*").eq("id", str(log_id)).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Audit log not found")

    row = result.data[0]

    return AuditLogResponse(
        id=row["id"],
        action=row["action"],
        actor_id=row.get("actor_id"),
        actor_email=row.get("actor_email"),
        actor_role=row.get("actor_role"),
        hospital_id=row.get("hospital_id"),
        resource_type=row.get("resource_type"),
        resource_id=row.get("resource_id"),
        detail=row.get("detail"),
        ip_address=row.get("ip_address"),
        created_at=datetime.fromisoformat(row["created_at"]),
    )
