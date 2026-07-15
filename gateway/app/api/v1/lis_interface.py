"""
HL7 v2 and ASTM E1394 Interface Handler for Laboratory Analyzers

Supports:
- HL7 v2.x (ADT, ORM, ORU messages)
- ASTM E1394 (serial/file-based communication)
- Bidirectional communication with lab equipment

Equipment support:
- Hematology analyzers (e.g., Sysmex, Mindray)
- Chemistry analyzers (e.g., Roche, Siemens)
- Immunoassay analyzers
- Urinalysis analyzers

Database tables:
- lab_devices (analyzer configuration)
- lab_results (test results)
- lis_messages (message log)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum
import re
import json
import asyncio

router = APIRouter()


class MessageType(str, Enum):
    HL7_ADT = "HL7_ADT"
    HL7_ORM = "HL7_ORM"
    HL7_ORU = "HL7_ORU"
    ASTM_E1394 = "ASTM_E1394"


class DeviceProtocol(str, Enum):
    HL7 = "HL7"
    ASTM = "ASTM"
    TCP_IP = "TCP_IP"
    SERIAL = "SERIAL"


class LISMessageDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class LabResultStatus(str, Enum):
    PENDING = "pending"
    RESULTED = "resulted"
    VERIFIED = "verified"
    FINAL = "final"


class DeviceConfig(BaseModel):
    device_id: str
    device_name: str
    device_type: str
    protocol: DeviceProtocol
    host: Optional[str] = None
    port: Optional[int] = None
    enabled: bool = True


class HL7Message(BaseModel):
    raw_message: str
    message_type: MessageType
    sender: str
    receiver: str
    patient_id: Optional[str] = None
    order_id: Optional[str] = None
    parsed_segments: Optional[dict] = None


class ASTMMessage(BaseModel):
    raw_message: str
    record_type: str
    patient_id: Optional[str] = None
    order_id: Optional[str] = None


class ParseResult(BaseModel):
    success: bool
    message_id: Optional[str] = None
    patient_id: Optional[str] = None
    order_id: Optional[str] = None
    results: Optional[dict] = None
    errors: Optional[List[str]] = None


from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id


@router.get("/devices")
async def list_lab_devices(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """List configured lab devices"""

    sql = """
        SELECT device_id, device_name, device_type, protocol, host, port, enabled
        FROM lab_devices
        WHERE hospital_id = :hospital_id
        ORDER BY device_name
    """
    rows = await db.fetchall(sql, {"hospital_id": hospital_id})

    return [
        {
            "deviceId": r["device_id"],
            "deviceName": r["device_name"],
            "deviceType": r["device_type"],
            "protocol": r["protocol"],
            "host": r["host"],
            "port": r["port"],
            "enabled": r["enabled"],
        }
        for r in rows
    ]


@router.post("/devices")
async def configure_lab_device(
    config: DeviceConfig,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Configure a new lab device"""

    await db.execute(
        """INSERT INTO lab_devices (device_id, device_name, device_type, protocol, host, port, enabled, hospital_id, created_at)
           VALUES (:device_id, :device_name, :device_type, :protocol, :host, :port, :enabled, :hospital_id, NOW())
           ON CONFLICT (device_id, hospital_id) DO UPDATE SET
             device_name = EXCLUDED.device_name,
             device_type = EXCLUDED.device_type,
             protocol = EXCLUDED.protocol,
             host = EXCLUDED.host,
             port = EXCLUDED.port,
             enabled = EXCLUDED.enabled""",
        {
            "device_id": config.device_id,
            "device_name": config.device_name,
            "device_type": config.device_type,
            "protocol": config.protocol,
            "host": config.host,
            "port": config.port,
            "enabled": config.enabled,
            "hospital_id": hospital_id,
        },
    )

    return {"status": "configured", "deviceId": config.device_id}


@router.post("/parse/hl7")
async def parse_hl7_message(
    message: HL7Message,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Parse HL7 v2 message"""

    result = parse_hl7(message.raw_message)

    if result["success"]:
        await db.execute(
            """INSERT INTO lis_messages (message_id, direction, message_type, sender, receiver, raw_content, hospital_id, processed_at)
               VALUES (:message_id, 'inbound', :message_type, :sender, :receiver, :raw, :hospital_id, NOW())""",
            {
                "message_id": result.get("message_id", f"hl7-{Date.now()}"),
                "message_type": message.message_type.value,
                "sender": message.sender,
                "receiver": message.receiver,
                "raw": message.raw_message,
                "hospital_id": hospital_id,
            },
        )

    return result


@router.post("/parse/astm")
async def parse_astm_message(
    message: ASTMMessage,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Parse ASTM E1394 message"""

    result = parse_astm(message.raw_message)

    if result["success"]:
        await db.execute(
            """INSERT INTO lis_messages (message_id, direction, message_type, sender, receiver, raw_content, hospital_id, processed_at)
               VALUES (:message_id, 'inbound', 'ASTM_E1394', :sender, :receiver, :raw, :hospital_id, NOW())""",
            {
                "message_id": result.get("message_id", f"astm-{Date.now()}"),
                "sender": "DEVICE",
                "receiver": "LIS",
                "raw": message.raw_message,
                "hospital_id": hospital_id,
            },
        )

    return result


@router.post("/send")
async def send_to_analyzer(
    device_id: str,
    order_data: dict,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Send order to lab analyzer"""

    device = await db.fetchone(
        "SELECT * FROM lab_devices WHERE device_id = :device_id AND hospital_id = :hospital_id",
        {"device_id": device_id, "hospital_id": hospital_id},
    )

    if not device or not device["enabled"]:
        raise HTTPException(status_code=404, detail="Device not found or disabled")

    if device["protocol"] == "HL7":
        message = build_hl7_order(order_data, device["device_id"])
    elif device["protocol"] == "ASTM":
        message = build_astm_order(order_data, device["device_id"])
    else:
        raise HTTPException(status_code=400, detail="Unsupported protocol")

    await db.execute(
        """INSERT INTO lis_messages (message_id, direction, message_type, sender, receiver, raw_content, hospital_id, created_at)
           VALUES (:message_id, 'outbound', :message_type, 'LIS', :receiver, :raw, :hospital_id, NOW())""",
        {
            "message_id": f"order-{order_data.get('order_id', Date.now())}",
            "message_type": device["protocol"],
            "receiver": device_id,
            "raw": message,
            "hospital_id": hospital_id,
        },
    )

    return {
        "status": "queued",
        "device": device["device_name"],
        "message": message,
    }


@router.get("/results/{order_id}")
async def get_results(
    order_id: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get results for an order"""

    sql = """
        SELECT lr.test_code, lr.test_name, lr.value, lr.unit, lr.reference_range, lr.status, lr.resulted_at
        FROM lab_results lr
        JOIN lab_orders lo ON lr.order_id = lo.id
        WHERE lo.external_order_id = :order_id AND lo.hospital_id = :hospital_id
        ORDER BY lr.test_code
    """
    rows = await db.fetchall(sql, {"order_id": order_id, "hospital_id": hospital_id})

    return [
        {
            "testCode": r["test_code"],
            "testName": r["test_name"],
            "value": r["value"],
            "unit": r["unit"],
            "referenceRange": r["reference_range"],
            "status": r["status"],
            "resultedAt": r["resulted_at"].isoformat() if r["resulted_at"] else None,
        }
        for r in rows
    ]


from datetime import datetime as Date


def parse_hl7(raw: str) -> ParseResult:
    """Parse HL7 v2 message"""

    errors = []

    try:
        segments = raw.strip().split("\r")
        if not segments:
            return ParseResult(success=False, errors=["Empty message"])

        msh = segments[0]
        if not msh.startswith("MSH"):
            return ParseResult(success=False, errors=["Missing MSH segment"])

        fields = msh.split("|")
        if len(fields) < 9:
            return ParseResult(success=False, errors=["Invalid MSH segment"])

        message_type = fields[8]
        message_id = segments[1].split("|")[2] if len(segments) > 1 else None

        patient_id = None
        pid_segment = next((s for s in segments if s.startswith("PID")), None)
        if pid_segment:
            pid_fields = pid_segment.split("|")
            patient_id = pid_fields[2] if len(pid_fields) > 2 else None

        order_id = None
        orc_segment = next((s for s in segments if s.startswith("ORC")), None)
        if orc_segment:
            orc_fields = orc_segment.split("|")
            order_id = orc_fields[2] if len(orc_fields) > 2 else None

        results = {}
        for segment in segments:
            if segment.startswith("OBX"):
                obx_fields = segment.split("|")
                if len(obx_fields) > 5:
                    test_code = (
                        obx_fields[3].split("^")[0]
                        if "^" in obx_fields[3]
                        else obx_fields[3]
                    )
                    value = obx_fields[5]
                    unit = obx_fields[6] if len(obx_fields) > 6 else None
                    results[test_code] = {"value": value, "unit": unit}

        return ParseResult(
            success=True,
            message_id=message_id,
            patient_id=patient_id,
            order_id=order_id,
            results=results,
        )

    except Exception as e:
        return ParseResult(success=False, errors=[str(e)])


def parse_astm(raw: str) -> ParseResult:
    """Parse ASTM E1394 message"""

    errors = []

    try:
        lines = raw.strip().split("\r")
        if not lines:
            return ParseResult(success=False, errors=["Empty message"])

        record_type = lines[0][0:1]
        message_id = f"astm-{Date.now().timestamp()}"
        patient_id = None
        order_id = None
        results = {}

        for line in lines:
            record_id = line[0:1]
            fields = line[1:].split("|")

            if record_id == "P":
                patient_id = fields[0] if len(fields) > 0 else None

            elif record_id == "O":
                order_id = fields[1] if len(fields) > 1 else None

            elif record_id == "R":
                if len(fields) > 4:
                    test_code = fields[0]
                    value = fields[2]
                    unit = fields[3] if len(fields) > 3 else None
                    results[test_code] = {"value": value, "unit": unit}

        return ParseResult(
            success=True,
            message_id=message_id,
            patient_id=patient_id,
            order_id=order_id,
            results=results,
        )

    except Exception as e:
        return ParseResult(success=False, errors=[str(e)])


def build_hl7_order(order_data: dict, device_id: str) -> str:
    """Build HL7 ORM message for order"""

    timestamp = Date.now().strftime("%Y%m%d%H%M%S")

    patient_id = order_data.get("patient_id", "")
    order_id = order_data.get("order_id", f"ORD{timestamp}")

    msh = f"MSH|^~\\&|LIS|AFYAHERO|{device_id}|{device_id}|{timestamp}||ORM^O01|{order_id}|P|2.5.1"
    pid = f"PID|1||{patient_id}||||||F"
    orc = f"ORC|NW|{order_id}||||||||^{order_data.get('prescriber', 'SYSTEM')}"
    obr = f"OBR|1|{order_id}||{order_data.get('panel_code', 'LAB')}^{order_data.get('panel_name', 'Laboratory')}|F||||||||{timestamp}"
    nte = f"NTE|1||{order_data.get('notes', '')}"

    return "\r".join([msh, pid, orc, obr, nte])


def build_astm_order(order_data: dict, device_id: str) -> str:
    """Build ASTM E1394 order message"""

    timestamp = Date.now().strftime("%Y%m%d%H%M%S")
    patient_id = order_data.get("patient_id", "")
    order_id = order_data.get("order_id", f"ORD{timestamp}")

    lines = [
        f"H|{device_id}|LIS|{timestamp}".ljust(160),
        f"P|{patient_id}".ljust(160),
        f"O|{order_id}|{order_data.get('panel_code', 'ALL')}||||||N".ljust(160),
        f"L|1".ljust(160),
    ]

    return "\r".join(lines)
