from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db import get_admin_client

settings = get_settings()

# Routes that do not require tenant context
PUBLIC_PATHS = {
    "/health",
    "/api/v1/auth/login",
    "/api/v1/auth/otp/send",
    "/api/v1/auth/otp/verify",
    "/api/v1/webhooks/mpesa",
    "/api/v1/webhooks/sha",
    "/api/v1/webhooks/africastalking",
    "/api/v1/ussd",
    "/api/v1/referrals/inbound/public",
}


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Resolves hospital_id and sets it in request.state before auth middleware runs.

    Resolution strategy:
    1. On-premise mode: HOSPITAL_ID_OVERRIDE environment variable (single tenant)
    2. SaaS mode: Subdomain from Host header
    3. Super admin cross-tenant: X-Hospital-ID header (validated by auth middleware)
    """

    async def dispatch(self, request: Request, call_next: callable) -> Response:
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # On-premise deployment: single hospital ID from environment
        if settings.DEPLOYMENT_MODE == "onpremise" and settings.HOSPITAL_ID_OVERRIDE:
            request.state.hospital_id = settings.HOSPITAL_ID_OVERRIDE
            request.state.tenant_source = "onpremise"
            return await call_next(request)

        # SaaS deployment: resolve from subdomain
        host = request.headers.get("host", "")
        parts = host.split(".")
        subdomain = parts[0] if len(parts) >= 3 else None

        if subdomain and subdomain not in ("api", "admin", "www", "app"):
            hospital = await self._resolve_by_subdomain(subdomain)
            if hospital:
                request.state.hospital_id = str(hospital["id"])
                request.state.tenant_source = "subdomain"
                return await call_next(request)

        # Super admin cross-tenant access
        if "X-Hospital-ID" in request.headers:
            request.state.hospital_id = request.headers["X-Hospital-ID"]
            request.state.tenant_source = "header"
            request.state.is_cross_tenant = True
            return await call_next(request)

        # No tenant context could be resolved
        return JSONResponse(
            status_code=400,
            content={
                "error": "tenant_unresolvable",
                "message": "Could not identify hospital from request"
            }
        )

    async def _resolve_by_subdomain(self, subdomain: str) -> dict | None:
        """Resolve hospital by subdomain"""
        client = get_admin_client()
        try:
            result = await (
                client.table("hospitals")
                .select("id, is_active")
                .eq("subdomain", subdomain)
                .single()
                .execute()
            )
            if result.data and result.data["is_active"]:
                return result.data
            return None
        except Exception as e:
            print(f"Subdomain resolution error: {e}")
            return None
