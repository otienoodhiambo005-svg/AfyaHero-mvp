"""
Metrics Middleware
Tracks API requests, response times, and errors for monitoring.
"""

import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.observability.metrics import (
    API_REQUESTS,
    API_ERRORS,
    API_RESPONSE_TIME,
)


class MetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware that tracks API metrics including:
    - Request counts by method, endpoint, and status code
    - Response times
    - Error counts
    """
    
    # Endpoints to exclude from metrics
    EXCLUDED_ENDPOINTS = ["/health", "/health/ai", "/health/deep", "/metrics", "/docs", "/redoc"]
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip metrics for excluded endpoints
        if any(request.url.path.startswith(ep) for ep in self.EXCLUDED_ENDPOINTS):
            return await call_next(request)
        
        # Get hospital ID from request state or headers
        hospital_id = getattr(request.state, 'hospital_id', 'unknown')
        
        # Start timer
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Get status code
        status_code = str(response.status_code)
        
        # Record metrics
        API_REQUESTS.labels(
            method=request.method,
            endpoint=request.url.path,
            status_code=status_code,
            hospital_id=hospital_id
        ).inc()
        
        API_RESPONSE_TIME.labels(
            method=request.method,
            endpoint=request.url.path,
            hospital_id=hospital_id
        ).observe(duration)
        
        # Check for errors (4xx and 5xx)
        if status_code.startswith('4') or status_code.startswith('5'):
            API_ERRORS.labels(
                method=request.method,
                endpoint=request.url.path,
                error_type=f"http_{status_code}",
                hospital_id=hospital_id
            ).inc()
        
        return response
