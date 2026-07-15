"""
Offline Sync API - Conflict Resolution and Data Synchronization
For Patient App and CHW App offline-first operation
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from typing import Any, Optional, List
from datetime import datetime, UTC
import re

from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id

router = APIRouter()


ALLOWED_SYNC_TABLES = frozenset({
    "patients",
    "encounters",
    "prescriptions",
    "appointments",
    "vitals",
    "pharmacy_inventory",
})
ALLOWED_SYNC_OPERATIONS = frozenset({"INSERT", "UPDATE", "DELETE"})
ALLOWED_CONFLICT_RESOLUTIONS = frozenset({"use_local", "use_remote", "merge"})
IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


# Sync Schemas
class SyncRecord(BaseModel):
    table_name: str
    record_id: str
    operation: str  # INSERT, UPDATE, DELETE
    data: dict[str, Any]
    timestamp: str

    @field_validator("table_name")
    @classmethod
    def validate_table_name(cls, value: str) -> str:
        if value not in ALLOWED_SYNC_TABLES:
            raise ValueError("table_name is not enabled for offline sync")
        return value

    @field_validator("operation")
    @classmethod
    def validate_operation(cls, value: str) -> str:
        normalized = value.upper()
        if normalized not in ALLOWED_SYNC_OPERATIONS:
            raise ValueError("operation must be INSERT, UPDATE, or DELETE")
        return normalized


class SyncBatchRequest(BaseModel):
    device_id: str
    last_sync: Optional[str] = None
    records: List[SyncRecord]
    app_version: Optional[str] = None


class ConflictResolution(BaseModel):
    record_id: str
    table_name: str
    resolution: str  # "use_local", "use_remote", "merge"
    merged_data: Optional[dict[str, Any]] = None

    @field_validator("table_name")
    @classmethod
    def validate_table_name(cls, value: str) -> str:
        if value not in ALLOWED_SYNC_TABLES:
            raise ValueError("table_name is not enabled for offline sync")
        return value

    @field_validator("resolution")
    @classmethod
    def validate_resolution(cls, value: str) -> str:
        if value not in ALLOWED_CONFLICT_RESOLUTIONS:
            raise ValueError("resolution must be use_local, use_remote, or merge")
        return value


# ─── Sync Endpoints ─────────────────────────────────────────────────

@router.post("/push")
async def push_sync_batch(
    request: SyncBatchRequest,
    db=Depends(get_db_session)
):
    """Push offline records to server"""
    hospital_id = get_hospital_id()
    device_id = request.device_id
    now = datetime.now(UTC).isoformat()
    
    processed = []
    conflicts = []
    errors = []
    
    for record in request.records:
        try:
            result = await _process_sync_record(
                db, hospital_id, record, request.last_sync
            )
            
            if result.get("conflict"):
                conflicts.append(result)
            else:
                processed.append({
                    "record_id": record.record_id,
                    "table": record.table_name,
                    "status": "synced",
                    "server_id": result.get("server_id")
                })
                
        except HTTPException:
            raise
        except Exception as e:
            errors.append({
                "record_id": record.record_id,
                "error": str(e)
            })
    
    await db.commit()
    
    return {
        "synced": len(processed),
        "conflicts": len(conflicts),
        "errors": len(errors),
        "conflict_details": conflicts,
        "error_details": errors,
        "sync_timestamp": now
    }


@router.get("/pull")
async def pull_changes(
    since: Optional[str] = None,
    tables: Optional[str] = None,  # comma-separated list
    db=Depends(get_db_session)
):
    """Pull changes since last sync"""
    hospital_id = get_hospital_id()
    
    # Default tables for offline sync
    default_tables = [
        "patients", "encounters", "prescriptions", 
        "appointments", "vitals", "pharmacy_inventory"
    ]
    
    target_tables = [
        _validate_sync_table(table.strip())
        for table in tables.split(",")
    ] if tables else default_tables
    
    changes = {}
    for table in target_tables:
        table_changes = await _get_table_changes(db, hospital_id, table, since)
        changes[table] = table_changes
    
    return {
        "changes": changes,
        "synced_at": datetime.now(UTC).isoformat()
    }


@router.post("/resolve-conflicts")
async def resolve_conflicts(
    resolutions: List[ConflictResolution],
    db=Depends(get_db_session)
):
    """Resolve sync conflicts"""
    hospital_id = get_hospital_id()
    resolved = []
    
    for res in resolutions:
        result = await _resolve_conflict(
            db, hospital_id, res
        )
        resolved.append(result)
    
    await db.commit()
    
    return {
        "resolved": len(resolved),
        "details": resolved
    }


@router.get("/status")
async def sync_status(db=Depends(get_db_session)):
    """Get sync status for current device"""
    hospital_id = get_hospital_id()
    
    # Get latest sync for each table
    status = {}
    tables = ["patients", "encounters", "prescriptions", "vitals"]
    
    for table in tables:
        q = await db.execute(f"""
            SELECT MAX(created_at) as latest FROM {table}
            WHERE hospital_id = :hospital_id
        """, {"hospital_id": hospital_id})
        
        result = q.fetchone()
        status[table] = {
            "last_sync": result.latest.isoformat() if result and result.latest else None
        }
    
    return {
        "hospital_id": hospital_id,
        "tables": status,
        "status": "online"
    }


# ─── Helper Functions ─────────────────────────────────────

def _validate_sync_table(table: str) -> str:
    """Return a known sync table name safe for SQL identifier interpolation."""
    if table not in ALLOWED_SYNC_TABLES:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_sync_table",
                "table": table,
            },
        )
    return table


def _validate_record_data(data: dict[str, Any]) -> dict[str, Any]:
    """Copy payload data after rejecting unsafe or tenant-controlled columns."""
    safe_data: dict[str, Any] = {}
    for key, value in data.items():
        if key in ("id", "hospital_id"):
            continue
        if not IDENTIFIER_RE.fullmatch(key):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "invalid_sync_column",
                    "column": key,
                },
            )
        safe_data[key] = value
    return safe_data


async def _process_sync_record(
    db, hospital_id: str, record: SyncRecord, last_sync: Optional[str]
) -> dict:
    """Process a single sync record"""
    table = _validate_sync_table(record.table_name)
    record_id = record.record_id
    operation = record.operation
    
    # Check if record exists on server
    existing = await db.execute(f"""
        SELECT id, updated_at FROM {table}
        WHERE id = :id AND hospital_id = :hospital_id
    """, {"id": record_id, "hospital_id": hospital_id})
    
    server_record = existing.fetchone()
    
    # Parse timestamps
    local_timestamp = datetime.fromisoformat(record.timestamp) if record.timestamp else None
    
    if not server_record:
        # Record doesn't exist - insert
        if operation == "DELETE":
            return {"record_id": record_id, "status": "ignored"}
        
        return await _insert_record(db, hospital_id, table, record_id, record.data)
    
    # Record exists - check for conflict
    server_updated = server_record.updated_at
    
    if operation == "DELETE":
        await db.execute(
            f"DELETE FROM {table} WHERE id = :id AND hospital_id = :hospital_id",
            {"id": record_id, "hospital_id": hospital_id},
        )
        return {"record_id": record_id, "status": "deleted"}
    
    # Compare timestamps
    if server_updated and local_timestamp and server_updated > local_timestamp:
        # Server is newer - conflict
        return {
            "record_id": record_id,
            "table": table,
            "conflict": True,
            "local_timestamp": record.timestamp,
            "server_timestamp": server_updated.isoformat()
        }
    
    # Local is newer or same - update
    return await _update_record(db, hospital_id, table, record_id, record.data)


async def _insert_record(
    db, hospital_id: str, table: str, record_id: str, data: dict[str, Any]
) -> dict:
    """Insert a new record"""
    table = _validate_sync_table(table)
    insert_data = _validate_record_data(data)
    insert_data["id"] = record_id
    insert_data["hospital_id"] = hospital_id
    insert_data["created_at"] = datetime.now(UTC).isoformat()
    insert_data["updated_at"] = insert_data["created_at"]
    
    columns = ", ".join(insert_data.keys())
    placeholders = ", ".join([f":{k}" for k in insert_data.keys()])
    
    await db.execute(f"""
        INSERT INTO {table} ({columns})
        VALUES ({placeholders})
        ON CONFLICT (id) DO NOTHING
    """, insert_data)
    
    return {"record_id": record_id, "server_id": record_id, "status": "inserted"}


async def _update_record(
    db, hospital_id: str, table: str, record_id: str, data: dict[str, Any]
) -> dict:
    """Update an existing record"""
    table = _validate_sync_table(table)
    update_data = _validate_record_data(data)
    update_data["updated_at"] = datetime.now(UTC).isoformat()
    update_data["id"] = record_id
    update_data["hospital_id"] = hospital_id
    
    set_clauses = [
        f"{k} = :{k}"
        for k in update_data.keys()
        if k not in ("id", "hospital_id")
    ]
    
    await db.execute(f"""
        UPDATE {table}
        SET {', '.join(set_clauses)}
        WHERE id = :id AND hospital_id = :hospital_id
    """, update_data)
    
    return {"record_id": record_id, "server_id": record_id, "status": "updated"}


async def _get_table_changes(
    db, hospital_id: str, table: str, since: Optional[str]
) -> List[dict]:
    """Get changes for a table since timestamp"""
    table = _validate_sync_table(table)
    query = f"""
        SELECT * FROM {table}
        WHERE hospital_id = :hospital_id
    """
    params = {"hospital_id": hospital_id}
    
    if since:
        query += " AND updated_at > :since"
        params["since"] = since
    
    query += " ORDER BY updated_at DESC LIMIT 1000"
    
    result = await db.execute(query, params)
    records = result.fetchall()
    
    return [
        {
            "id": r.id,
            "data": {c: getattr(r, c) for c in r._keys if c not in ("hospital_id",)},
            "updated_at": r.updated_at.isoformat() if r.updated_at else None
        }
        for r in records
    ]


async def _resolve_conflict(
    db, hospital_id: str, resolution: ConflictResolution
) -> dict:
    """Resolve a sync conflict"""
    table = _validate_sync_table(resolution.table_name)
    record_id = resolution.record_id
    
    if resolution.resolution == "use_local":
        # Use local data
        if resolution.merged_data:
            await _update_record(db, hospital_id, table, record_id, resolution.merged_data)
            
    elif resolution.resolution == "use_remote":
        # Keep server data - no action needed
        pass
        
    elif resolution.resolution == "merge" and resolution.merged_data:
        # Merge data
        await _update_record(db, hospital_id, table, record_id, resolution.merged_data)
    
    return {
        "record_id": record_id,
        "table": table,
        "resolution": resolution.resolution,
        "status": "resolved"
    }
