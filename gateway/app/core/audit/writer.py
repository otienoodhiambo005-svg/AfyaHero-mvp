import logging
from datetime import datetime, UTC
from uuid import uuid4

from app.core.audit.events import AuditEvent
from app.db import get_admin_client

logger = logging.getLogger("audit")


async def write_audit_log(
    event: AuditEvent,
    user_id: str,
    hospital_id: str,
    patient_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    detail: dict | str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """
    Write audit log entry - NEVER raises exceptions.

    Uses service role client that bypasses RLS intentionally.
    Audit logs must be written regardless of tenant context.
    Failures are logged at CRITICAL level but never break clinical workflows.
    """
    try:
        client = get_admin_client()

        await client.table("audit_logs").insert({
            "id": str(uuid4()),
            "event": event.value,
            "hospital_id": hospital_id,
            "user_id": user_id,
            "patient_id": patient_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "detail": (
                detail if isinstance(detail, dict)
                else {"message": str(detail)}
            ),
            "ip_address": ip_address,
            "user_agent": user_agent,
            "created_at": datetime.now(UTC).isoformat(),
        }).execute()

    except Exception as exc:
        logger.critical(
            f"AUDIT WRITE FAILED | event={event.value} "
            f"user={user_id} hospital={hospital_id} | {exc}"
        )