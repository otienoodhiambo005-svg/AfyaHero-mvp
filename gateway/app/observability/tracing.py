"""
Distributed Tracing for AfyaHero
Uses OpenTelemetry to provide end-to-end tracing across services.
"""

import logging
from typing import Optional
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter as HTTPOTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.resources import Resource, Attributes
from opentelemetry.trace import Tracer
from opentelemetry.sdk.trace.sampling import ParentBasedTraceIdRatio, TraceIdRatioBased

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("afyahero.observability.tracing")

# Global tracer provider
_tracer_provider: Optional[TracerProvider] = None


def setup_tracing() -> TracerProvider:
    """
    Setup OpenTelemetry tracing with appropriate exporters based on environment.
    
    Returns:
        Configured TracerProvider
    """
    global _tracer_provider
    
    if _tracer_provider is not None:
        return _tracer_provider
    
    # Create resource with service metadata
    resource = Resource.create(attributes={
        Attributes.SERVICE_NAME: "afyahero-gateway",
        Attributes.SERVICE_VERSION: "1.0.0",
        Attributes.DEPLOYMENT_ENVIRONMENT: settings.ENVIRONMENT,
        Attributes.SERVICE_INSTANCE_ID: settings.HOSPITAL_ID_OVERRIDE or "default",
    })
    
    # Create tracer provider
    _tracer_provider = TracerProvider(resource=resource)
    
    # Configure sampling
    # In production, sample 100% of traces for debugging, 10% in staging, 1% in development
    if settings.ENVIRONMENT == "production":
        sampler = ParentBasedTraceIdRatio(TraceIdRatioBased(1.0))  # 100%
    elif settings.ENVIRONMENT == "staging":
        sampler = ParentBasedTraceIdRatio(TraceIdRatioBased(0.1))  # 10%
    else:
        sampler = ParentBasedTraceIdRatio(TraceIdRatioBased(0.01))  # 1%
    
    _tracer_provider.sampler = sampler
    
    # Setup exporters based on environment
    exporters = []
    
    # Always add console exporter for development
    if settings.DEBUG or settings.ENVIRONMENT == "development":
        console_exporter = ConsoleSpanExporter()
        exporters.append(console_exporter)
        logger.info("Console span exporter enabled")
    
    # Add OTLP exporter for production
    if settings.ENVIRONMENT != "development":
        try:
            # Try gRPC first
            otlp_exporter = OTLPSpanExporter(
                endpoint="http://otel-collector:4317",
                insecure=True
            )
            exporters.append(otlp_exporter)
            logger.info("OTLP gRPC span exporter enabled")
        except Exception as e:
            logger.warning(f"Failed to create OTLP gRPC exporter: {e}")
            
            # Fallback to HTTP
            try:
                http_exporter = HTTPOTLPSpanExporter(
                    endpoint="http://otel-collector:4318/v1/traces",
                    insecure=True
                )
                exporters.append(http_exporter)
                logger.info("OTLP HTTP span exporter enabled")
            except Exception as e2:
                logger.error(f"Failed to create OTLP HTTP exporter: {e2}")
    
    # Add batch span processors for each exporter
    for exporter in exporters:
        batch_processor = BatchSpanProcessor(
            exporter,
            batch_size=1024,
            max_queue_size=2048,
            max_export_batch_size=1024,
            export_timeout_millis=5000
        )
        _tracer_provider.add_span_processor(batch_processor)
    
    # Set as global tracer provider
    trace.set_tracer_provider(_tracer_provider)
    
    # Instrument libraries
    FastAPIInstrumentor.instrument_app_settings = {
        "suppress_instrumentation": False,
        "exclude_urls": "/health,/health/ai,/docs,/redoc",
    }
    
    # Instrument SQLAlchemy
    SQLAlchemyInstrumentor().instrument()
    
    # Instrument Redis
    RedisInstrumentor().instrument()
    
    # Instrument HTTPX
    HTTPXInstrumentor().instrument()
    
    # Instrument Requests
    RequestsInstrumentor().instrument()
    
    logger.info(f"OpenTelemetry tracing initialized for {settings.ENVIRONMENT}")
    
    return _tracer_provider


def get_tracer(name: str = "afyahero") -> Tracer:
    """
    Get a tracer with the given name.
    
    Args:
        name: Name of the tracer
        
    Returns:
        Tracer instance
    """
    if _tracer_provider is None:
        setup_tracing()
    
    return trace.get_tracer(name)


def shutdown_tracing() -> None:
    """Shutdown tracing and flush all spans."""
    global _tracer_provider
    
    if _tracer_provider is not None:
        _tracer_provider.shutdown()
        logger.info("OpenTelemetry tracing shutdown")
        _tracer_provider = None
