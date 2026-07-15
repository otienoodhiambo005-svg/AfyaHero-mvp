"""
Device Integration API - BLE Medical Devices + Lab Analyzers
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()


# ──────────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────────


class DevicePairRequest(BaseModel):
    device_type: str  # 'bp_monitor', 'glucose_meter', 'spo2_monitor', 'thermometer
    device_id: str
    device_name: Optional[str] = None


class DeviceReading(BaseModel):
    device_type: str
    reading_type: str  # 'systolic', 'diastolic', 'heart_rate', 'glucose', 'spo2', 'temp
    value: float
    unit: str
    timestamp: Optional[str] = None


class DeviceResponse(BaseModel):
    device_id: str
    device_name: str
    device_type: str
    status: str
    last_reading: Optional[dict] = None


class LabAnalyzerResponse(BaseModel):
    device_id: str
    device_name: str
    device_type: str
    manufacturer: str
    status: str
    last_sync: Optional[str] = None


class AnalyzerReadingRequest(BaseModel):
    test_code: str
    value: float
    unit: str
    flags: Optional[dict] = None


# ──────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────

from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id, get_user_id


@router.get("/mobile")
async def list_patient_devices(
    patient_id: str,
    db=Depends(get_db_session),
):
    """List patient's paired mobile devices"""

    sql = """
        SELECT device_id, device_type, device_name, last_reading, last_sync, is_active
        FROM mobile_devices
        WHERE patient_id = :patient_id AND is_active = true
        ORDER BY last_sync DESC
    """
    rows = await db.fetchall(sql, {"patient_id": patient_id})

    return [
        {
            "device_id": r["device_id"],
            "device_name": r["device_name"],
            "device_type": r["device_type"],
            "status": "active" if r["is_active"] else "inactive",
            "last_reading": r["last_reading"],
            "last_sync": r["last_sync"].isoformat() if r["last_sync"] else None,
        }
        for r in rows
    ]


@router.post("/mobile/pair")
async def pair_mobile_device(
    patient_id: str,
    device: DevicePairRequest,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Pair BLE device to patient"""

    existing = await db.fetchone(
        """SELECT id FROM mobile_devices 
           WHERE patient_id = :patient_id AND device_id = :device_id""",
        {"patient_id": patient_id, "device_id": device.device_id},
    )

    if existing:
        raise HTTPException(status_code=409, detail="Device already paired")

    await db.execute(
        """INSERT INTO mobile_devices (
            patient_id, device_type, device_id, device_name, is_active, created_at
        )
        VALUES (:patient_id, :device_type, :device_id, :device_name, true, NOW())""",
        {
            "patient_id": patient_id,
            "device_type": device.device_type,
            "device_id": device.device_id,
            "device_name": device.device_name or device.device_id,
        },
    )

    return {
        "status": "paired",
        "device_id": device.device_id,
        "device_type": device.device_type,
    }


@router.post("/mobile/{device_id}/reading")
async def record_device_reading(
    device_id: str,
    reading: DeviceReading,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Record reading from BLE device"""

    device = await db.fetchone(
        "SELECT * FROM mobile_devices WHERE device_id = :device_id",
        {"device_id": device_id},
    )

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    reading_data = {
        "type": reading.reading_type,
        "value": reading.value,
        "unit": reading.unit,
        "timestamp": reading.timestamp or datetime.now().isoformat(),
    }

    await db.execute(
        """UPDATE mobile_devices 
           SET last_reading = :reading, last_sync = NOW()
           WHERE device_id = :device_id""",
        {"reading": str(reading_data), "device_id": device_id},
    )

    # Create ClinicalVital if applicable
    patient_id = device["patient_id"]
    vital_types = {
        "bp_monitor": {
            "systolic": reading.value if reading.reading_type == "systolic" else None
        },
        "glucose_meter": {"blood_glucose": reading.value},
        "spo2_monitor": {"spo2": reading.value},
        "thermometer": {"temp_c": reading.value},
    }

    if device.device_type in vital_types:
        vitals = vital_types[device.device_type]
        if reading.reading_type in ["systolic", "diastolic"]:
            bp_val = await db.fetchone(
                "SELECT last_reading FROM mobile_devices WHERE device_id = :id",
                {"id": device_id},
            )
            bp = bp_val["last_reading"] if bp_val else {}

        await db.execute(
            """INSERT INTO clinical_vitals (
                hospital_id, patient_id, recorded_at
            ) VALUES (:hospital_id, :patient_id, NOW())""",
            {"hospital_id": hospital_id, "patient_id": patient_id},
        )

    return {
        "status": "recorded",
        "device_id": device_id,
        "reading": reading_data,
    }


@router.delete("/mobile/{device_id}/unpair")
async def unpair_device(
    device_id: str,
    db=Depends(get_db_session),
):
    """Unpair device from patient"""

    await db.execute(
        "UPDATE mobile_devices SET is_active = false WHERE device_id = :device_id",
        {"device_id": device_id},
    )

    return {"status": "unpaired", "device_id": device_id}


# ──────────────────────────────────────────────────────────────
# Lab Analyzers
# ──────────────────────────────────────────────────────────────


@router.get("/analyzers", response_model=list[LabAnalyzerResponse])
async def list_lab_analyzers(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """List facility lab analyzers"""

    sql = """
        SELECT device_id, device_name, device_type, manufacturer, model,
               serial_number, status, last_sync
        FROM lab_analyzers
        WHERE facility_id = :hospital_id
        ORDER BY device_name
    """
    rows = await db.fetchall(sql, {"hospital_id": hospital_id})

    return [
        LabAnalyzerResponse(
            device_id=r["device_id"],
            device_name=r["device_name"],
            device_type=r["device_type"],
            manufacturer=r["manufacturer"] or "Unknown",
            status=r["status"],
            last_sync=r["last_sync"].isoformat() if r["last_sync"] else None,
        )
        for r in rows
    ]


@router.post("/analyzers/register")
async def register_lab_analyzer(
    device_id: str,
    device_name: str,
    device_type: str,
    manufacturer: Optional[str] = None,
    model: Optional[str] = None,
    serial_number: Optional[str] = None,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Register new lab analyzer"""

    existing = await db.fetchone(
        "SELECT id FROM lab_analyzers WHERE device_id = :device_id AND facility_id = :hospital_id",
        {"device_id": device_id, "hospital_id": hospital_id},
    )

    if existing:
        raise HTTPException(status_code=409, detail="Analyzer already registered")

    await db.execute(
        """INSERT INTO lab_analyzers (
            facility_id, device_id, device_name, device_type, 
            manufacturer, model, serial_number, status, created_at
        )
        VALUES (:hospital_id, :device_id, :device_name, :device_type,
                :manufacturer, :model, :serial_number, 'online', NOW())""",
        {
            "hospital_id": hospital_id,
            "device_id": device_id,
            "device_name": device_name,
            "device_type": device_type,
            "manufacturer": manufacturer,
            "model": model,
            "serial_number": serial_number,
        },
    )

    return {
        "status": "registered",
        "device_id": device_id,
        "device_name": device_name,
    }


@router.post("/analyzers/{device_id}/reading")
async def record_analyzer_result(
    device_id: str,
    result: AnalyzerReadingRequest,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Record result from lab analyzer"""

    analyzer = await db.fetchone(
        "SELECT * FROM lab_analyzers WHERE device_id = :device_id AND facility_id = :hospital_id",
        {"device_id": device_id, "hospital_id": hospital_id},
    )

    if not analyzer:
        raise HTTPException(status_code=404, detail="Analyzer not found")

    reading_data = {
        "test_code": result.test_code,
        "value": result.value,
        "unit": result.unit,
        "flags": result.flags,
        "timestamp": datetime.now().isoformat(),
    }

    await db.execute(
        """UPDATE lab_analyzers 
           SET last_reading = :reading, last_sync = NOW()
           WHERE device_id = :device_id""",
        {"reading": str(reading_data), "device_id": device_id},
    )

    return {
        "status": "recorded",
        "device_id": device_id,
        "test_code": result.test_code,
    }


@router.put("/analyzers/{device_id}/status")
async def update_analyzer_status(
    device_id: str,
    status: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Update analyzer status (online/offline/maintenance)"""

    if status not in ["online", "offline", "maintenance"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    result = await db.execute(
        """UPDATE lab_analyzers SET status = :status WHERE device_id = :device_id AND facility_id = :hospital_id""",
        {"status": status, "device_id": device_id, "hospital_id": hospital_id},
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Analyzer not found")

    return {"status": "updated", "device_id": device_id, "new_status": status}


@router.get("/analyzers/{device_id}")
async def get_analyzer_detail(
    device_id: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get detailed analyzer info"""

    analyzer = await db.fetchone(
        "SELECT * FROM lab_analyzers WHERE device_id = :device_id AND facility_id = :hospital_id",
        {"device_id": device_id, "hospital_id": hospital_id},
    )

    if not analyzer:
        raise HTTPException(status_code=404, detail="Analyzer not found")

    return dict(analyzer)
