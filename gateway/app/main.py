from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import logging

from app.config import get_settings
from app.core.tenancy.resolver import TenantMiddleware
from app.core.audit.middleware import AuditMiddleware
from app.db import init_supabase, init_async_engine, init_redis

settings = get_settings()
logger = logging.getLogger("afyahero")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    logger.info(f"AfyaHero Hospital OS starting [{settings.ENVIRONMENT}]")

    # Initialize core services
    await init_supabase()
    await init_async_engine()
    await init_redis()

    logger.info("All services initialized successfully")
    yield
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
        for name, provider in orchestrator.providers.items():
            try:
                is_healthy = await provider.health_check()
                providers_status[name] = {
                    "status": "healthy" if is_healthy else "unhealthy",
                    "model": provider.model_name,
                }
            except Exception as e:
                providers_status[name] = {"status": "error", "error": str(e)}

        return {"status": "ok", "providers": providers_status}

    # Global error handler - never expose stack traces
    @app.exception_handler(Exception)
    async def global_error_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "internal_server_error"})

    return app


app = create_app()
