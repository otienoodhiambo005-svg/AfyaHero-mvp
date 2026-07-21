"""
Metrics for AfyaHero
Provides custom business metrics and Prometheus integration.
"""

import logging
from typing import Dict, Any, Optional
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    Summary,
    start_http_server,
    REGISTRY,
)
from prometheus_client.openmetrics.exposition import CONTENT_TYPE_LATEST

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("afyahero.observability.metrics")

# Metrics server
_metrics_server = None

# Business Metrics
PATIENT_REGISTRATIONS = Counter(
    'afyahero_patient_registrations_total',
    'Total patient registrations',
    ['hospital_id', 'registration_source']
)

APPOINTMENT_CREATED = Counter(
    'afyahero_appointments_created_total',
    'Total appointments created',
    ['hospital_id', 'appointment_type', 'status']
)

APPOINTMENT_COMPLETED = Counter(
    'afyahero_appointments_completed_total',
    'Total appointments completed',
    ['hospital_id', 'appointment_type']
)

APPOINTMENT_CANCELLED = Counter(
    'afyahero_appointments_cancelled_total',
    'Total appointments cancelled',
    ['hospital_id', 'reason']
)

# AI Metrics
AI_RESPONSE_TIME = Histogram(
    'afyahero_ai_response_time_seconds',
    'AI provider response time in seconds',
    ['provider', 'model', 'task_type', 'hospital_id'],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 15, 30, 60]
)

AI_REQUESTS = Counter(
    'afyahero_ai_requests_total',
    'Total AI requests',
    ['provider', 'model', 'task_type', 'hospital_id', 'status']
)

AI_TOKENS_USED = Counter(
    'afyahero_ai_tokens_used_total',
    'Total tokens used by AI providers',
    ['provider', 'model', 'token_type']  # token_type: input, output, total
)

AI_CACHE_HITS = Counter(
    'afyahero_ai_cache_hits_total',
    'Total AI cache hits',
    ['provider', 'model', 'hospital_id']
)

AI_CACHE_MISSES = Counter(
    'afyahero_ai_cache_misses_total',
    'Total AI cache misses',
    ['provider', 'model', 'hospital_id']
)

# User Metrics
ACTIVE_USERS = Gauge(
    'afyahero_active_users',
    'Currently active users',
    ['hospital_id', 'role']
)

LOGGED_IN_USERS = Gauge(
    'afyahero_logged_in_users',
    'Currently logged in users',
    ['hospital_id']
)

# API Metrics
API_REQUESTS = Counter(
    'afyahero_api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status_code', 'hospital_id']
)

API_ERRORS = Counter(
    'afyahero_api_errors_total',
    'Total API errors',
    ['method', 'endpoint', 'error_type', 'hospital_id']
)

API_RESPONSE_TIME = Histogram(
    'afyahero_api_response_time_seconds',
    'API response time in seconds',
    ['method', 'endpoint', 'hospital_id'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
)

# Database Metrics
DB_QUERY_TIME = Histogram(
    'afyahero_db_query_time_seconds',
    'Database query time in seconds',
    ['operation', 'table', 'hospital_id'],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
)

DB_CONNECTIONS = Gauge(
    'afyahero_db_connections',
    'Current database connections',
    ['hospital_id']
)

DB_CONNECTION_ERRORS = Counter(
    'afyahero_db_connection_errors_total',
    'Total database connection errors',
    ['hospital_id', 'error_type']
)

# System Metrics
SYSTEM_MEMORY_USAGE = Gauge(
    'afyahero_system_memory_usage_bytes',
    'System memory usage in bytes'
)

SYSTEM_CPU_USAGE = Gauge(
    'afyahero_system_cpu_usage_percent',
    'System CPU usage percentage'
)

# Queue Metrics
QUEUE_SIZE = Gauge(
    'afyahero_queue_size',
    'Current queue size',
    ['queue_type', 'hospital_id']
)

QUEUE_PROCESSING_TIME = Histogram(
    'afyahero_queue_processing_time_seconds',
    'Queue processing time in seconds',
    ['queue_type', 'hospital_id'],
    buckets=[0.1, 0.5, 1, 5, 10, 30, 60]
)

# Clinical Metrics
CLINICAL_VITALS_RECORDED = Counter(
    'afyahero_clinical_vitals_recorded_total',
    'Total clinical vitals recorded',
    ['hospital_id', 'vital_type']
)

LAB_REQUESTS_CREATED = Counter(
    'afyahero_lab_requests_created_total',
    'Total lab requests created',
    ['hospital_id', 'test_type']
)

PRESCRIPTIONS_CREATED = Counter(
    'afyahero_prescriptions_created_total',
    'Total prescriptions created',
    ['hospital_id', 'medication_type']
)

# Billing Metrics
INVOICES_CREATED = Counter(
    'afyahero_invoices_created_total',
    'Total invoices created',
    ['hospital_id', 'invoice_type']
)

PAYMENTS_PROCESSED = Counter(
    'afyahero_payments_processed_total',
    'Total payments processed',
    ['hospital_id', 'payment_method', 'status']
)

PAYMENT_VALUE = Summary(
    'afyahero_payment_value',
    'Payment values in local currency',
    ['hospital_id', 'payment_method']
)


def setup_metrics(port: int = 9090) -> None:
    """
    Start the Prometheus metrics server.
    
    Args:
        port: Port to expose metrics on
    """
    global _metrics_server
    
    if settings.ENVIRONMENT == "production":
        try:
            _metrics_server = start_http_server(port, registry=REGISTRY)
            logger.info(f"Prometheus metrics server started on port {port}")
        except Exception as e:
            logger.error(f"Failed to start metrics server: {e}")
            _metrics_server = None
    else:
        logger.info(f"Metrics server not started in {settings.ENVIRONMENT} environment")


def get_metrics() -> Dict[str, Any]:
    """
    Get all metrics as a dictionary.
    
    Returns:
        Dictionary containing all metric values
    """
    return {
        "patient_registrations": PATIENT_REGISTRATIONS._value.get(),
        "appointments_created": APPOINTMENT_CREATED._value.get(),
        "ai_response_time": AI_RESPONSE_TIME._value.get(),
        "ai_requests": AI_REQUESTS._value.get(),
        "ai_tokens_used": AI_TOKENS_USED._value.get(),
        "active_users": ACTIVE_USERS._value.get(),
        "api_requests": API_REQUESTS._value.get(),
        "api_errors": API_ERRORS._value.get(),
        "db_query_time": DB_QUERY_TIME._value.get(),
    }


def shutdown_metrics() -> None:
    """Shutdown the metrics server."""
    global _metrics_server
    
    if _metrics_server is not None:
        _metrics_server.shutdown()
        logger.info("Metrics server shutdown")
        _metrics_server = None


class CustomCollector:
    """Custom metrics collector for business-specific metrics."""
    
    def __init__(self):
        self.metrics = {}
    
    def add_metric(self, name: str, metric):
        """Add a metric to the collector."""
        self.metrics[name] = metric
    
    def collect(self):
        """Collect all metrics."""
        for metric in self.metrics.values():
            yield from metric.collect()


# Register custom collector
custom_collector = CustomCollector()
REGISTRY.register(custom_collector)
