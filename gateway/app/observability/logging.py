"""
Structured Logging for AfyaHero
Provides consistent logging format across the application.
"""

import logging
import sys
import json
from datetime import datetime, UTC
from typing import Any, Dict, Optional
from pythonjsonlogger import jsonlogger

from app.config import get_settings

settings = get_settings()

# Custom JSON formatter
class AfyaHeroJSONFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter that includes additional context."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
    
    def add_fields(self, log_record, record, message_dict):
        """Add custom fields to the log record."""
        super().add_fields(log_record, record, message_dict)
        
        # Add timestamp in ISO format
        log_record['timestamp'] = datetime.now(UTC).isoformat()
        
        # Add service context
        log_record['service'] = {
            'name': 'afyahero-gateway',
            'version': '1.0.0',
            'environment': settings.ENVIRONMENT,
        }
        
        # Add hospital context if available
        if hasattr(record, 'hospital_id'):
            log_record['hospital_id'] = record.hospital_id
        
        # Add request context if available
        if hasattr(record, 'request_id'):
            log_record['request_id'] = record.request_id
        
        # Add user context if available
        if hasattr(record, 'user_id'):
            log_record['user_id'] = record.user_id


def setup_logging() -> None:
    """
    Setup structured logging for the application.
    
    In production, logs are output as JSON.
    In development, logs are output in a human-readable format.
    """
    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    
    if settings.ENVIRONMENT == "production":
        # JSON formatter for production
        formatter = AfyaHeroJSONFormatter(
            '%(timestamp)s %(levelname)s %(name)s %(message)s %(service)s'
        )
        console_handler.setFormatter(formatter)
        root_logger.info("JSON logging enabled for production")
    else:
        # Human-readable formatter for development
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(formatter)
        root_logger.info("Development logging enabled")
    
    console_handler.addFilter(HealthCheckFilter())
    root_logger.addHandler(console_handler)
    
    # Set levels for specific loggers
    logging.getLogger('uvicorn').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('fastapi').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)
    
    # Ensure afyahero loggers are at INFO level
    logging.getLogger('afyahero').setLevel(logging.INFO)
    logging.getLogger('app').setLevel(logging.INFO)


class HealthCheckFilter(logging.Filter):
    """Filter out health check requests from logs."""
    
    def filter(self, record: logging.LogRecord) -> bool:
        # Filter out health check endpoints
        if hasattr(record, 'path') and record.path in ['/health', '/health/ai']:
            return False
        return True


class RequestContextLogger:
    """Logger that includes request context."""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
    
    def _add_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Add context to the logger."""
        # Create a new logger with context
        for key, value in context.items():
            setattr(self.logger, key, value)
        return context
    
    def debug(self, message: str, context: Optional[Dict[str, Any]] = None, **kwargs):
        if context:
            self._add_context(context)
        self.logger.debug(message, extra=context or {}, **kwargs)
    
    def info(self, message: str, context: Optional[Dict[str, Any]] = None, **kwargs):
        if context:
            self._add_context(context)
        self.logger.info(message, extra=context or {}, **kwargs)
    
    def warning(self, message: str, context: Optional[Dict[str, Any]] = None, **kwargs):
        if context:
            self._add_context(context)
        self.logger.warning(message, extra=context or {}, **kwargs)
    
    def error(self, message: str, context: Optional[Dict[str, Any]] = None, **kwargs):
        if context:
            self._add_context(context)
        self.logger.error(message, extra=context or {}, **kwargs)
    
    def exception(self, message: str, context: Optional[Dict[str, Any]] = None, **kwargs):
        if context:
            self._add_context(context)
        self.logger.exception(message, extra=context or {}, **kwargs)


def get_logger(name: str = "afyahero") -> RequestContextLogger:
    """
    Get a logger with the given name.
    
    Args:
        name: Name of the logger
        
    Returns:
        RequestContextLogger instance
    """
    return RequestContextLogger(name)


# Global logger instance
logger = get_logger()
