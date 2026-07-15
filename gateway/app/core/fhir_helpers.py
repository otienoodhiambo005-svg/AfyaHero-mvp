"""
FHIR Bundle Builder Helpers - HL7 FHIR R4 Utilities
"""

from typing import Any, Optional
from datetime import datetime
from uuid import uuid4


def build_bundle(
    resources: list[dict[str, Any]],
    bundle_type: str = "searchset",
    total: Optional[int] = None,
) -> dict[str, Any]:
    """
    Build a FHIR Bundle resource.

    Args:
        resources: List of FHIR resources to include in the bundle
        bundle_type: Type of bundle (searchset, collection, transaction, etc.)
        total: Total number of resources (if None, uses len(resources))

    Returns:
        FHIR Bundle JSON structure
    """
    return {
        "resourceType": "Bundle",
        "id": str(uuid4()),
        "type": bundle_type,
        "total": total if total is not None else len(resources),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "entry": [build_entry(resource, None) for resource in resources],
    }


def build_entry(
    resource: dict[str, Any],
    full_url: Optional[str] = None,
) -> dict[str, Any]:
    """
    Build a FHIR Bundle Entry.

    Args:
        resource: The FHIR resource to wrap in an entry
        full_url: The full URL for the resource's identity

    Returns:
        FHIR Bundle Entry JSON structure
    """
    entry: dict[str, Any] = {
        "resource": resource,
    }

    if full_url:
        entry["fullUrl"] = full_url
    elif resource.get("id"):
        base_url = f"urn:uuid:{resource['id']}"
        entry["fullUrl"] = base_url

    return entry


def parse_search_params(
    query_params: dict[str, Any],
    allowed_params: list[str],
) -> dict[str, tuple[str, Any]]:
    """
    Parse and validate FHIR search parameters.

    Args:
        query_params: Raw query parameters from request
        allowed_params: List of allowed parameter names

    Returns:
        Dictionary of validated (param_name, value) tuples
    """
    parsed: dict[str, tuple[str, Any]] = {}

    for param_name, param_value in query_params.items():
        if param_name.startswith("_"):
            continue

        if param_name not in allowed_params:
            continue

        if param_value is None or param_value == "":
            continue

        modifier = None
        actual_param = param_name

        if ":" in param_name:
            actual_param, modifier = param_name.split(":", 1)

        if actual_param not in allowed_params:
            continue

        parsed[param_name] = (actual_param, param_value)

    return parsed


def build_bundle(
    resources: list[dict[str, Any]],
    bundle_type: str = "searchset",
    total: Optional[int] = None,
) -> dict[str, Any]:
    """
    Build a FHIR Bundle resource.

    Args:
        resources: List of FHIR resources to include in the bundle
        bundle_type: Type of bundle (searchset, collection, transaction, etc.)
        total: Total number of resources (if None, uses len(resources))

    Returns:
        FHIR Bundle JSON structure
    """
    return {
        "resourceType": "Bundle",
        "id": str(uuid4()),
        "type": bundle_type,
        "total": total if total is not None else len(resources),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "entry": [build_entry(resource, None) for resource in resources],
    }


def build_entry(
    resource: dict[str, Any],
    full_url: Optional[str] = None,
) -> dict[str, Any]:
    """
    Build a FHIR Bundle Entry.

    Args:
        resource: The FHIR resource to wrap in an entry
        full_url: The full URL for the resource's identity

    Returns:
        FHIR Bundle Entry JSON structure
    """
    entry: dict[str, Any] = {
        "resource": resource,
    }

    if full_url:
        entry["fullUrl"] = full_url
    elif resource.get("id"):
        entry["fullUrl"] = f"urn:uuid:{resource['id']}"

    return entry


def parse_search_params(
    query_params: dict[str, Any],
    allowed_params: list[str],
) -> dict[str, tuple[str, Any]]:
    """
    Parse and validate FHIR search parameters.

    Args:
        query_params: Raw query parameters from request
        allowed_params: List of allowed parameter names

    Returns:
        Dictionary of validated (param_name, value) tuples
    """
    parsed: dict[str, tuple[str, Any]] = {}

    for param_name, param_value in query_params.items():
        if param_name.startswith("_"):
            continue

        if param_name not in allowed_params:
            continue

        if param_value is None or param_value == "":
            continue

        if param_name not in allowed_params:
            continue

        parsed[param_name] = (param_name, param_value)

    return parsed
