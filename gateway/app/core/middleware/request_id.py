"""
Request ID Middleware
Adds unique request IDs to all incoming requests for tracing and debugging.
"""

import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds a unique request ID to each request.
    
    The request ID is:
    - Generated if not provided in X-Request-ID header
    - Added to request.state for use in handlers
    - Added to response headers for client correlation
    """
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Get or generate request ID
        request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        
        # Store request ID in request state
        request.state.request_id = request_id
        
        # Process request
        response = await call_next(request)
        
        # Add request ID to response headers
        response.headers['X-Request-ID'] = request_id
        
        return response
