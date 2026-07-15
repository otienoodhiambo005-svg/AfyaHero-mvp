"""
Teleconsultation API - Video Rooms + Google Meet Integration
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import uuid4

router = APIRouter()


class CreateRoomRequest(BaseModel):
    patient_id: str
    mode: str = "video"  # video, call, text
    scheduled_at: Optional[str] = None


class JoinRoomRequest(BaseModel):
    user_id: str
    user_role: str  # patient, practitioner


class RoomResponse(BaseModel):
    room_id: str
    room_code: str
    patient_id: str
    practitioner_id: Optional[str]
    mode: str
    status: str
    join_url: str


class AppointmentRequest(BaseModel):
    patient_id: str
    patient_name: str
    patient_phone: str
    appointment_time: str
    clinician_name: str
    mode: str = "video"


# ──────────────────────────────────────────────────────────────

from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id, get_user_id


@router.post("/rooms", response_model=RoomResponse)
async def create_video_room(
    request: CreateRoomRequest,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
    user_id: str = Depends(get_user_id),
):
    """Create video/teleconsult room"""

    room_id = str(uuid4())
    room_code = f"VID-{room_code[:6].upper()}"
    join_url = f"https://afyahero.com/tele/{room_code}"

    await db.execute(
        """INSERT INTO video_rooms (
            id, room_code, patient_id, practitioner_id, mode, status, created_at
        )
        VALUES (:id, :code, :patient_id, :practitioner_id, :mode, 'waiting', NOW())""",
        {
            "id": room_id,
            "code": room_code,
            "patient_id": request.patient_id,
            "practitioner_id": user_id,
            "mode": request.mode,
        },
    )

    # Also create in waitroom
    await db.execute(
        """INSERT INTO teleconsult_waitroom (
            hospital_id, waitroom_code, patient_name, waiting_for, mode, created_at
        )
        VALUES (:hospital_id, :code, :patient_name, :clinician, :mode, NOW())""",
        {
            "hospital_id": hospital_id,
            "code": room_code,
            "patient_name": request.patient_id,
            "clinician": user_id,
            "mode": request.mode,
        },
    )

    return RoomResponse(
        room_id=room_id,
        room_code=room_code,
        patient_id=request.patient_id,
        practitioner_id=user_id,
        mode=request.mode,
        status="waiting",
        join_url=join_url,
    )


@router.get("/rooms/{room_code}", response_model=RoomResponse)
async def get_room(
    room_code: str,
    db=Depends(get_db_session),
):
    """Get room details"""

    room = await db.fetchone(
        "SELECT * FROM video_rooms WHERE room_code = :code", {"code": room_code}
    )

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    join_url = f"https://afyahero.com/tele/{room_code}"

    return RoomResponse(
        room_id=str(room["id"]),
        room_code=room["room_code"],
        patient_id=str(room["patient_id"]),
        practitioner_id=str(room["practitioner_id"])
        if room["practitioner_id"]
        else None,
        mode=room["mode"],
        status=room["status"],
        join_url=join_url,
    )


@router.post("/rooms/{room_code}/join")
async def join_room(
    room_code: str,
    request: JoinRoomRequest,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Join a teleconsult room"""

    room = await db.fetchone(
        "SELECT * FROM video_rooms WHERE room_code = :code", {"code": room_code}
    )

    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room["status"] == "ended":
        raise HTTPException(status_code=400, detail="Session has ended")

    # Start session if waiting
    if room["status"] == "waiting":
        await db.execute(
            """UPDATE video_rooms SET status = 'in_progress', started_at = NOW()
               WHERE room_code = :code""",
            {"code": room_code},
        )

        # Remove from waitroom
        await db.execute(
            "DELETE FROM teleconsult_waitroom WHERE waitroom_code = :code",
            {"code": room_code},
        )

    join_url = f"https://afyahero.com/tele/{room_code}?user={request.user_id}"

    return {
        "room_id": str(room["id"]),
        "room_code": room_code,
        "status": "in_progress",
        "join_url": join_url,
        "mode": room["mode"],
    }


@router.post("/rooms/{room_code}/end")
async def end_room(
    room_code: str,
    db=Depends(get_db_session),
    user_id: str = Depends(get_user_id),
):
    """End teleconsult session"""

    result = await db.execute(
        """UPDATE video_rooms 
           SET status = 'ended', ended_at = NOW()
           WHERE room_code = :code AND practitioner_id = :user_id""",
        {"code": room_code, "user_id": user_id},
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=403, detail="Not authorized to end this session"
        )

    return {"status": "ended", "room_code": room_code}


@router.get("/waitroom")
async def get_waitroom(
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get current waitroom"""

    sql = """
        SELECT waitroom_code, patient_name, waiting_for, mode, priority, wait_minutes
        FROM teleconsult_waitroom
        WHERE hospital_id = :hospital_id
        ORDER BY priority DESC, created_at ASC
    """
    rows = await db.fetchall(sql, {"hospital_id": hospital_id})

    return [
        {
            "code": r["waitroom_code"],
            "patient": r["patient_name"],
            "clinician": r["waiting_for"],
            "mode": r["mode"],
            "priority": r["priority"],
            "wait_minutes": r["wait_minutes"],
        }
        for r in rows
    ]


# ──────────────────────────────────────────────────────────────
# Appointments (using existing TeleconsultAppointment)
# ──────────────────────────────────────────────────────────────


@router.post("/appointments", status_code=201)
async def create_teleconsult_appointment(
    appointment: AppointmentRequest,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Create teleconsult appointment"""

    appt_id = str(uuid4())
    appt_code = f"TC-{datetime.now().strftime('%Y%m')}-{appt_id[:4].upper()}"

    await db.execute(
        """INSERT INTO teleconsult_appointments (
            id, hospital_id, appointment_code, patient_name, 
            appointment_time, mode, clinician_name, status, created_at
        )
        VALUES (:id, :hospital_id, :code, :patient_name, :time, :mode, 
                :clinician, 'Scheduled', NOW())""",
        {
            "id": appt_id,
            "hospital_id": hospital_id,
            "code": appt_code,
            "patient_name": appointment.patient_name,
            "time": appointment.appointment_time,
            "mode": appointment.mode,
            "clinician": appointment.clinician_name,
        },
    )

    # Send WhatsApp notification
    patient_phone = appointment.patient_phone
    if patient_phone:
        await db.execute(
            """INSERT INTO communication_queue (phone, channel, message, status, created_at)
               VALUES (:phone, 'whatsapp', :message, 'pending', NOW())""",
            {
                "phone": patient_phone,
                "message": f"AfyaHero: Umepewa appointment ya {appointment.mode} tarehe {appointment.appointment_time}. Code: {appt_code}. Bonyeza kuingia.",
            },
        )

    return {
        "appointment_id": appt_id,
        "appointment_code": appt_code,
        "status": "scheduled",
    }


@router.get("/appointments")
async def list_teleconsult_appointments(
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """List teleconsult appointments"""

    conditions = ["hospital_id = :hospital_id"]
    params = {"hospital_id": hospital_id}

    if status:
        conditions.append("status = :status")
        params["status"] = status

    where = " AND ".join(conditions)

    sql = f"""
        SELECT id, appointment_code, patient_name, appointment_time, 
               mode, clinician_name, status, created_at
        FROM teleconsult_appointments
        WHERE {where}
        ORDER BY appointment_time ASC
    """
    rows = await db.fetchall(sql, params)

    return [
        {
            "id": str(r["id"]),
            "code": r["appointment_code"],
            "patient": r["patient_name"],
            "time": r["appointment_time"],
            "mode": r["mode"],
            "clinician": r["clinician_name"],
            "status": r["status"],
        }
        for r in rows
    ]


@router.get("/appointments/{appt_id}")
async def get_appointment(
    appt_id: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get appointment details"""

    appt = await db.fetchone(
        "SELECT * FROM teleconsult_appointments WHERE id = :id AND hospital_id = :hospital_id",
        {"id": appt_id, "hospital_id": hospital_id},
    )

    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    return dict(appt)


@router.put("/appointments/{appt_id}/confirm")
async def confirm_appointment(
    appt_id: str,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Confirm appointment"""

    await db.execute(
        "UPDATE teleconsult_appointments SET status = 'Confirmed' WHERE id = :id",
        {"id": appt_id},
    )

    return {"status": "confirmed"}


@router.put("/appointments/{appt_id}/cancel")
async def cancel_appointment(
    appt_id: str,
    reason: Optional[str] = None,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Cancel appointment"""

    await db.execute(
        "UPDATE teleconsult_appointments SET status = 'Cancelled' WHERE id = :id",
        {"id": appt_id},
    )

    return {"status": "cancelled"}
