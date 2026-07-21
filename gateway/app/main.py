from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import logging

from app.config import get_settings
from app.core.tenancy.resolver import TenantMiddleware
from app.core.audit.middleware import AuditMiddleware
from app.db import init_supabase, init_async_engine, init_redis, close_connections
from app.observability import setup_tracing, setup_metrics, setup_logging
from app.observability.metrics import (
    API_REQUESTS,
    API_ERRORS,
    API_RESPONSE_TIME,
)

settings = get_settings()
logger = logging.getLogger("afyahero")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Initialize observability first
    setup_logging()
    setup_tracing()
    setup_metrics(9090)
    
    logger.info(f"AfyaHero Hospital OS starting [{settings.ENVIRONMENT}]")

    # Initialize core services
    await init_supabase()
    await init_async_engine()
    await init_redis()

    logger.info("All services initialized successfully")
    yield
    
    # Shutdown observability
    from app.observability import shutdown_tracing, shutdown_metrics
    shutdown_metrics()
    shutdown_tracing()
    
    # Close database connections
    await close_connections()
    
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    app = FastAPI(
        title="AfyaHero Hospital OS",
        version="1.0.0",
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # Middleware stack - ORDER IS CRITICAL

    # 1. Trusted host validation
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=(
            ["*.afyahero.com", "localhost", "127.0.0.1"]
            if settings.ENVIRONMENT != "production"
            else ["*.afyahero.com"]
        ),
    )

    # 2. CORS configuration
    dev_origins = ["http://localhost:3003", "http://localhost:3000", "http://localhost:19000"]
    configured_prod_origins = [
        origin.strip()
        for origin in (settings.CORS_ALLOWED_ORIGINS or "").split(",")
        if origin.strip()
    ] if hasattr(settings, "CORS_ALLOWED_ORIGINS") else []

    allow_origins = configured_prod_origins if settings.ENVIRONMENT == "production" else dev_origins
    allow_origin_regex = r"^https:\/\/([a-z0-9-]+\.)?afyahero\.com$" if settings.ENVIRONMENT == "production" else None

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_origin_regex=allow_origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Hospital-ID", "X-Request-ID"],
    )

    # 3. Tenant resolution - MUST run before auth and audit
    app.add_middleware(TenantMiddleware)

    # 4. Authentication - injects user context
    from app.core.auth.middleware import AuthMiddleware

    app.add_middleware(AuthMiddleware)

    # 5. Automatic audit logging for patient access
    app.add_middleware(AuditMiddleware)

    # 6. Request ID middleware for tracing
    from app.core.middleware.request_id import RequestIdMiddleware
    app.add_middleware(RequestIdMiddleware)

    # 7. Metrics middleware
    from app.core.middleware.metrics import MetricsMiddleware
    app.add_middleware(MetricsMiddleware)

    # Include API v1 routes
    from app.api.v1.router import v1_router

    app.include_router(v1_router, prefix="/api/v1")

    # Health check endpoint
    @app.get("/health", include_in_schema=False)
    async def health_check():
        return {"status": "ok", "environment": settings.ENVIRONMENT}

    @app.get("/health/ai", include_in_schema=False)
    async def ai_health_check():
        """Check AI provider health status"""
        from app.services.ai.providers.base import BaseAIProvider
        from app.services.ai.orchestrator import AIOrchestrator

        # Test providers
        orchestrator = AIOrchestrator()

        providers_status = {}
        for name, provider in orchestrator.medic.providers.items():
            try:
                is_healthy = await provider.health_check()
                providers_status[name] = {
                    "status": "healthy" if is_healthy else "unhealthy",
                    "model": provider.model_name,
                }
            except Exception as e:
                providers_status[name] = {"status": "error", "error": str(e)}

        return {"status": "ok", "providers": providers_status}

    @app.get("/health/deep", include_in_schema=False)
    async def deep_health_check():
        """Deep health check with database and Redis connectivity"""
        from app.db import get_async_session, get_redis
        from sqlalchemy import text
        
        health = {
            "status": "ok",
            "database": "unknown",
            "redis": "unknown",
            "ai_providers": "unknown",
        }
        
        # Check database
        try:
            async with get_async_session() as session:
                await session.execute(text("SELECT 1"))
            health["database"] = "healthy"
        except Exception as e:
            health["database"] = f"unhealthy: {str(e)}"
        
        # Check Redis
        try:
            redis = get_redis()
            if redis:
                await redis.ping()
                health["redis"] = "healthy"
            else:
                health["redis"] = "not configured"
        except Exception as e:
            health["redis"] = f"unhealthy: {str(e)}"
        
        # Check AI providers
        try:
            orchestrator = AIOrchestrator()
            for name, provider in orchestrator.medic.providers.items():
                try:
                    is_healthy = await provider.health_check()
                    if not is_healthy:
                        health["ai_providers"] = "degraded"
                        break
                except:
                    health["ai_providers"] = "degraded"
                    break
            else:
                health["ai_providers"] = "healthy"
        except Exception as e:
            health["ai_providers"] = f"error: {str(e)}"
        
        return health

    @app.get("/metrics", include_in_schema=False)
    async def metrics_endpoint():
        """Prometheus metrics endpoint"""
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
        return generate_latest(), 200, {"Content-Type": CONTENT_TYPE_LATEST}

    # Global error handler - never expose stack traces
    @app.exception_handler(Exception)
    async def global_error_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        
        # Record error metric
        API_ERRORS.labels(
            method=request.method,
            endpoint=request.url.path,
            error_type=type(exc).__name__,
            hospital_id=getattr(request.state, 'hospital_id', 'unknown')
        ).inc()
        
        return JSONResponse(status_code=500, content={"error": "internal_server_error"})

    return app


app = create_app()
