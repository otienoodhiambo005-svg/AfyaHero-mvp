"""
WebSocket Authentication Dependency
Ensures real-time streaming endpoints adhere to multi-tenant boundaries by extracting
hospital_id from valid JWT tokens rather than trusting payloads.
"""

from fastapi import WebSocket, WebSocketException, status
from jose import jwt, JWTError
from typing import Dict, Any

from app.config import get_settings
from app.db import get_admin_client
from app.core.tenancy.context import set_tenant

settings = get_settings()

async def get_websocket_user(websocket: WebSocket) -> Dict[str, Any]:
    """
    Dependency that authenticates the WebSocket using a JWT token.
    If authenticated, returns the user dict containing tenant (hospital_id).
    
    Expected behavior:
    1. Checks connection query params `?token=` (React Native/Next.js native WebSocket API limitation)
    2. Alternatively checks headers `Authorization: Bearer <token>`
    3. Decodes JWT to verify identity and tenant.
    4. Rejects connection proactively on invalid tokens.
    """
    token = websocket.query_params.get("token")
    if not token:
        # Fallback to headers
        auth_header = websocket.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Missing authentication token")

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_aud": False},
        )
    except JWTError:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")

    client = get_admin_client()
    result = await (
        client.table("users")
        .select("id, hospital_id, role, is_active")
        .eq("id", payload["sub"])
        .single()
        .execute()
    )

    if not result.data or not result.data.get("is_active"):
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Account disabled or not found")

    user = result.data
    
    # Establish Global Tenant Context for async workers triggered by WS
    set_tenant(user["hospital_id"], user["id"], user["role"])

    return {
        "sub": user["id"],
        "hospital_id": user["hospital_id"],
        "role": user["role"]
    }
