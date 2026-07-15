from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
from datetime import datetime, UTC
from collections import defaultdict
import time
import logging

from app.config import get_settings
from app.core.tenancy.context import set_tenant
from app.db import get_admin_client, get_redis

settings = get_settings()
logger = logging.getLogger(__name__)

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

# Simple in-memory rate limiting (can swap to Redis for production)
RATE_LIMIT_AUTH = 10  # requests per minute for auth endpoints
RATE_LIMIT_API = 100  # requests per minute for API endpoints

_rate_limit_store: dict = defaultdict(list)


async def _check_rate_limit(client_ip: str, endpoint_type: str = "auth") -> bool:
    """Simple rate limit check - returns True if allowed"""
    limit = RATE_LIMIT_AUTH if endpoint_type == "auth" else RATE_LIMIT_API

    key = f"{client_ip}:{endpoint_type}"
    redis = get_redis()
    if redis is not None:
        count = await redis.incr(f"ratelimit:{key}")
        if count == 1:
            await redis.expire(f"ratelimit:{key}", 60)
        return count <= limit

    # Fail closed in production when distributed limiter isn't configured.
    if settings.ENVIRONMENT == "production":
        return False

    now = time.time()
    window_start = now - 60  # 1 minute window
    requests = _rate_limit_store[key]
    _rate_limit_store[key] = [t for t in requests if t > window_start]
    if len(_rate_limit_store[key]) >= limit:
        return False
    _rate_limit_store[key].append(now)
    return True


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Validates JWT token and injects authenticated user into request.state.
    Sets tenant context for the current request.
    Includes rate limiting for auth endpoints.
    """

    async def dispatch(self, request: Request, call_next: callable) -> Response:
        # Apply rate limiting based on path
        endpoint_type = "auth" if request.url.path.startswith("/api/v1/auth/") else "api"
        client_ip = request.client.host if request.client else "unknown"
        
        if not await _check_rate_limit(client_ip, endpoint_type):
            logger.warning(f"Rate limit exceeded for {client_ip} on {request.url.path}")
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limit_exceeded",
                    "message": f"Too many requests. Please try again later. ({endpoint_type} limit)",
                },
            )

        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            logger.warning(f"Missing or invalid authorization header from {client_ip} on {request.url.path}")
            return JSONResponse(
                status_code=401,
                content={
                    "error": "unauthorized",
                    "message": "Missing or invalid token",
                },
            )

        token = auth_header.split(" ")[1]

        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
                options={
                    "verify_aud": False,
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_nbf": True,
                },
            )
            
            # Explicit token expiration check
            if "exp" in payload:
                exp_timestamp = payload["exp"]
                current_timestamp = datetime.now(UTC).timestamp()
                if exp_timestamp < current_timestamp:
                    return JSONResponse(
                        status_code=401,
                        content={
                            "error": "token_expired",
                            "message": "Token has expired",
                        },
                    )
            
            # Token issued at check (prevent too old tokens)
            if "iat" in payload:
                iat_timestamp = payload["iat"]
                current_timestamp = datetime.now(UTC).timestamp()
                # Reject tokens issued more than 24 hours ago
                if current_timestamp - iat_timestamp > 86400:
                    return JSONResponse(
                        status_code=401,
                        content={
                            "error": "token_too_old",
                            "message": "Token is too old, please re-authenticate",
                        },
                    )
            
            # Token not before check (if present)
            if "nbf" in payload:
                nbf_timestamp = payload["nbf"]
                current_timestamp = datetime.now(UTC).timestamp()
                if nbf_timestamp > current_timestamp:
                    return JSONResponse(
                        status_code=401,
                        content={
                            "error": "token_not_yet_valid",
                            "message": "Token is not yet valid",
                        },
                    )
            
            # Verify required claims
            if "sub" not in payload:
                return JSONResponse(
                    status_code=401,
                    content={
                        "error": "invalid_token",
                        "message": "Token missing required subject claim",
                    },
                )
                
        except JWTError as e:
            logger.warning(f"JWT validation failed from {client_ip}: {str(e)}")
            return JSONResponse(
                status_code=401,
                content={
                    "error": "invalid_token",
                    "message": f"Token is invalid or expired: {str(e)}",
                },
            )

        # Verify user exists and is active, and the hospital is active
        client = get_admin_client()
        result = await (
            client.table("profiles")
            .select("id, hospital_id, role, status, hospitals(is_active)")
            .eq("id", payload["sub"])
            .single()
            .execute()
        )

        if not result.data:
            logger.warning(f"User not found for subject {payload.get('sub')} from {client_ip}")
            return JSONResponse(
                status_code=401,
                content={"error": "invalid_user", "message": "User profile not found"},
            )

        user = result.data
        hospital = user.get("hospitals")

        # Comprehensive user status validation
        valid_statuses = ["active", "pending", "suspended", "deleted"]
        user_status = user.get("status", "unknown")
        
        if user_status not in valid_statuses:
            return JSONResponse(
                status_code=401,
                content={
                    "error": "invalid_user_status",
                    "message": f"Invalid user status: {user_status}",
                },
            )

        if user_status != "active":
            status_messages = {
                "pending": "Account pending activation",
                "suspended": "Account suspended",
                "deleted": "Account deleted",
            }
            logger.warning(f"Inactive user {user['id']} with status {user_status} from {client_ip}")
            return JSONResponse(
                status_code=401,
                content={
                    "error": "account_not_active",
                    "message": status_messages.get(user_status, f"User status is {user_status}"),
                },
            )

        # Hospital validation
        if not hospital:
            logger.warning(f"Hospital not found for user {user['id']} from {client_ip}")
            return JSONResponse(
                status_code=403,
                content={
                    "error": "hospital_not_found",
                    "message": "Associated hospital not found",
                },
            )

        hospital_active = hospital.get("is_active")
        if hospital_active is None or not hospital_active:
            logger.warning(f"Inactive hospital for user {user['id']} from {client_ip}")
            return JSONResponse(
                status_code=403,
                content={
                    "error": "hospital_inactive",
                    "message": "Hospital account is suspended or inactive",
                },
            )

        requested_hospital = getattr(request.state, "hospital_id", None)
        is_cross_tenant = getattr(request.state, "is_cross_tenant", False)

        # Reject host/header tenant mismatch for non-super-admin users.
        if (
            requested_hospital
            and not is_cross_tenant
            and str(user["hospital_id"]) != str(requested_hospital)
            and user["role"] != "super_admin"
        ):
            logger.warning(f"Tenant mismatch for user {user['id']}: requested {requested_hospital}, has {user['hospital_id']} from {client_ip}")
            return JSONResponse(
                status_code=403,
                content={
                    "error": "forbidden_tenant_mismatch",
                    "message": "Requested tenant does not match authenticated user tenant",
                },
            )

        if is_cross_tenant:
            if user["role"] != "super_admin":
                logger.warning(f"Unauthorized cross-tenant access attempt by user {user['id']} from {client_ip}")
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "forbidden_cross_tenant",
                        "message": "Cross-tenant access requires super_admin role",
                    },
                )
            logger.info(f"Super admin {user['id']} accessing cross-tenant {requested_hospital} from {client_ip}")
            set_tenant(requested_hospital, user["id"], user["role"])
        else:
            # Set tenant context for this request
            set_tenant(user["hospital_id"], user["id"], user["role"])

        # Inject user into request state
        request.state.user = {
            "sub": user["id"],
            "hospital_id": user["hospital_id"],
            "role": user["role"],
        }

        logger.info(f"Successful authentication for user {user['id']} ({user['role']}) from {client_ip} on {request.url.path}")
        return await call_next(request)
