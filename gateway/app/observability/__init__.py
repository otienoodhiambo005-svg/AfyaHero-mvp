"""
Observability Module for AfyaHero
Provides distributed tracing, metrics, and logging for the application.
"""

from .tracing import setup_tracing, get_tracer
from .metrics import (
    setup_metrics,
    get_metrics,
    PATIENT_REGISTRATIONS,
    APPOINTMENT_CREATED,
    AI_RESPONSE_TIME,
    ACTIVE_USERS,
    API_REQUESTS,
    API_ERRORS,
    DB_QUERY_TIME,
)
from .logging import setup_logging, get_logger

__all__ = [
    "setup_tracing",
    "get_tracer",
    "setup_metrics",
    "get_metrics",
    "setup_logging",
    "get_logger",
    "PATIENT_REGISTRATIONS",
    "APPOINTMENT_CREATED",
    "AI_RESPONSE_TIME",
    "ACTIVE_USERS",
    "API_REQUESTS",
    "API_ERRORS",
    "DB_QUERY_TIME",
]
