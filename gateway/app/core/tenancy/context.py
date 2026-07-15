from contextvars import ContextVar
from uuid import UUID


# Isolated per-request context variables
# No cross-request contamination under any concurrency level
_hospital_id: ContextVar[UUID | None] = ContextVar("hospital_id", default=None)
_user_id:     ContextVar[UUID | None] = ContextVar("user_id",     default=None)
_user_role:   ContextVar[str | None]  = ContextVar("user_role",   default=None)


def set_tenant(hospital_id: UUID, user_id: UUID, role: str) -> None:
    """Set tenant context for current request"""
    _hospital_id.set(hospital_id)
    _user_id.set(user_id)
    _user_role.set(role)


def get_hospital_id() -> UUID:
    """Get current hospital ID"""
    hid = _hospital_id.get()
    if hid is None:
        raise RuntimeError(
            "No tenant context found. "
            "Ensure TenantMiddleware runs before this code path."
        )
    return hid


def get_user_id() -> UUID:
    """Get current user ID"""
    uid = _user_id.get()
    if uid is None:
        raise RuntimeError("No user context found.")
    return uid


def get_user_role() -> str:
    """Get current user role"""
    return _user_role.get() or "anonymous"


def clear_tenant_context() -> None:
    """Clear tenant context (for testing)"""
    _hospital_id.set(None)
    _user_id.set(None)
    _user_role.set(None)