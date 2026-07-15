from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.audit.writer import write_audit_log
from app.core.audit.events import AuditEvent


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Auto-audit middleware - logs every patient record access.
    KDPA Article 28 compliance requirement.

    Automatically audits:
    - GET /patients/*
    - GET /api/v1/patients/*
    - GET /api/v1/encounters/*
    """

    AUDIT_PATHS = (
        "/patients/",
        "/api/v1/patients/",
        "/api/v1/encounters/",
    )

    async def dispatch(self, request: Request, call_next: callable) -> Response:
        # Skip audit for non-GET requests
        if request.method != "GET":
            return await call_next(request)

        # Check if path requires auditing
        path = request.url.path
        should_audit = any(path.startswith(p) for p in self.AUDIT_PATHS)

        if not should_audit:
            return await call_next(request)

        # Extract patient ID from path if present
        patient_id = self._extract_id_from_path(path, "patients")
        encounter_id = self._extract_id_from_path(path, "encounters")

        # Only log if we have authenticated user context
        if hasattr(request.state, "user") and hasattr(request.state, "hospital_id"):
            await write_audit_log(
                event=AuditEvent.PATIENT_RECORD_ACCESSED,
                user_id=request.state.user["sub"],
                hospital_id=request.state.hospital_id,
                patient_id=patient_id,
                resource_type="encounter" if encounter_id else "patient",
                resource_id=encounter_id if encounter_id else patient_id,
                detail={
                    "path": path,
                    "method": request.method,
                },
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )

        return await call_next(request)

    def _extract_id_from_path(self, path: str, resource: str) -> str | None:
        """Extract UUID from path: /api/v1/patients/<uuid>"""
        parts = path.split("/")
        try:
            idx = parts.index(resource)
            if idx + 1 < len(parts) and len(parts[idx + 1]) == 36:
                return parts[idx + 1]
        except ValueError:
            pass
        return None