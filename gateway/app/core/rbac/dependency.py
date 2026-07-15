from fastapi import Depends, HTTPException, Request
from app.core.rbac.permissions import Permission, ROLE_PERMISSIONS
from app.core.audit.writer import write_audit_log
from app.core.audit.events import AuditEvent
from app.core.tenancy.context import get_hospital_id


def require_permission(permission: Permission):
    """
    FastAPI dependency factory for RBAC authorization.

    Usage:
        @router.get(
            "/patients/{id}",
            dependencies=[Depends(require_permission(Permission.PATIENT_READ))]
        )
    """
    async def _enforce(request: Request):
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        role = user.get("role", "")
        allowed = ROLE_PERMISSIONS.get(role, frozenset())

        if permission not in allowed:
            await write_audit_log(
                event=AuditEvent.PERMISSION_DENIED,
                user_id=user["sub"],
                hospital_id=str(get_hospital_id()),
                detail={
                    "attempted": permission.value,
                    "role": role,
                    "path": str(request.url.path),
                },
                ip_address=request.client.host if request.client else None,
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "insufficient_permissions",
                    "required": permission.value,
                    "your_role": role,
                }
            )
        return user
    return _enforce


def require_role(role: str):
    """FastAPI dependency factory for role-based authorization"""
    async def _enforce(request: Request):
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        if user.get("role", "") != role:
            raise HTTPException(status_code=403, detail="Forbidden: insufficient role")
        return user
    return _enforce