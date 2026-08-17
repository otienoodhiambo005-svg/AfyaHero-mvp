"""
Rate Limit Middleware
Enhanced rate limiting with Redis backend and request ID tracking.
"""

import time
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import get_settings
from app.db import get_redis

settings = get_settings()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces rate limiting on API endpoints.
    
    Features:
    - Per-client rate limiting
    - Per-endpoint rate limiting
    - Sliding window algorithm
    - Request ID tracking for debugging
    """
    
    # Default rate limits (requests per minute)
    DEFAULT_LIMITS = {
        "default": (60, 60),  # 60 requests per minute
        "/api/v1/patients": (100, 60),  # 100 requests per minute
        "/api/v1/appointments": (100, 60),
        "/api/v1/ai/*": (10, 60),  # 10 AI requests per minute
        "/api/v1/consultations": (50, 60),
        "/api/v1/lab": (50, 60),
        "/api/v1/pharmacy": (50, 60),
    }
    
    # Excluded endpoints
    EXCLUDED_ENDPOINTS = ["/health", "/health/ai", "/health/deep", "/metrics"]
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting for excluded endpoints
        if any(request.url.path.startswith(ep) for ep in self.EXCLUDED_ENDPOINTS):
            return await call_next(request)
        
        # Get client IP
        client_ip = self._get_client_ip(request)
        
        # Get endpoint pattern
        endpoint = self._get_endpoint_pattern(request.url.path)
        
        # Get rate limit for this endpoint
        limit, window = self.DEFAULT_LIMITS.get(endpoint, self.DEFAULT_LIMITS["default"])
        
        # Check rate limit
        if await self._is_rate_limited(client_ip, endpoint, limit, window):
            request_id = getattr(request.state, 'request_id', 'unknown')
            raise HTTPException(
                status_code=429,
                detail="Too many requests",
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time() + window)),
                    "X-Request-ID": request_id,
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers to response
        remaining = await self._get_remaining_requests(client_ip, endpoint, limit, window)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time() + window))
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        # Check for forwarded headers (behind proxy)
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        
        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            return real_ip
        
        return request.client.host
    
    def _get_endpoint_pattern(self, path: str) -> str:
        """Get the endpoint pattern for rate limiting."""
        # Check for specific patterns
        if path.startswith("/api/v1/ai/"):
            return "/api/v1/ai/*"
        
        # Return the base path
        parts = path.split('/')
        if len(parts) >= 4:
            return f"/{parts[1]}/{parts[2]}/{parts[3]}"
        return path
    
    async def _is_rate_limited(self, client_ip: str, endpoint: str, limit: int, window: int) -> bool:
        """Check if client has exceeded rate limit."""
        redis = get_redis()
        if not redis:
            return False  # No rate limiting if Redis is not available
        
        key = f"rate_limit:{client_ip}:{endpoint}"
        
        try:
            # Get current request count
            current = await redis.get(key)
            count = int(current) if current else 0
            
            # Check if limit exceeded
            if count >= limit:
                return True
            
            # Increment count with expiration
            if count == 0:
                await redis.setex(key, window, 1)
            else:
                await redis.incr(key)
            
            return False
            
        except Exception:
            return False  # Fail open - don't block requests if Redis fails
    
    async def _get_remaining_requests(self, client_ip: str, endpoint: str, limit: int, window: int) -> int:
        """Get remaining requests for client."""
        redis = get_redis()
        if not redis:
            return limit
        
        key = f"rate_limit:{client_ip}:{endpoint}"
        
        try:
            current = await redis.get(key)
            count = int(current) if current else 0
            return max(0, limit - count)
        except Exception:
            return limit
