"""
Communication API - WhatsApp, USSD, SMS notifications
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()


class WhatsAppMessage(BaseModel):
    phone: str
    message: str
    media_url: Optional[str] = None


class WhatsAppStatus(BaseModel):
    message_id: str
    status: str
    sent_at: str


class USSDResponse(BaseModel):
    session_id: str
    response: str
    endpoint: Optional[str] = None


class PatientNotification(BaseModel):
    patient_id: str
    channel: str = "whatsapp"
    template: str
    variables: Optional[dict] = None


class NotificationResponse(BaseModel):
    queued: bool
    message_id: Optional[str] = None


from app.dependencies import get_db_session
from app.core.tenancy.context import get_hospital_id
from app.config import get_settings


@router.post("/whatsapp/send", response_model=WhatsAppStatus)
async def send_whatsapp(
    message: WhatsAppMessage,
    db=Depends(get_db_session),
):
    """Send WhatsApp message via queue"""

    import uuid

    message_id = str(uuid4())

    await db.execute(
        """INSERT INTO communication_queue (phone, channel, message, status, created_at)
           VALUES (:phone, 'whatsapp', :message, 'pending', NOW())""",
        {"phone": message.phone, "message": message.message},
    )

    return WhatsAppStatus(
        message_id=message_id,
        status="queued",
        sent_at=datetime.now().isoformat(),
    )


@router.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request, db=Depends(get_db_session)):
    """Handle incoming WhatsApp messages"""

    body = await request.json()

    from_uuid = body.get("From", "")
    body_text = body.get("Body", "")

    detected_lang = "sw"
    if any(w in body_text.lower() for w in ["hello", "hi", "how"]):
        detected_lang = "en"
    if any(w in body_text.lower() for w in ["poa", "msee", "noma"]):
        detected_lang = "sheng"

    session = await db.fetchone(
        "SELECT * FROM communication_sessions WHERE phone = :phone ORDER BY created_at DESC LIMIT 1",
        {"phone": from_uuid},
    )

    menu = """
    AfyaHero - Chagua:
    1. - Kusajili
    2. - Kuona Appointment
    3. - Malipo
    4. - Lab Results
    5. - Dawa
    6. - Msaada
    """

    response = "Habari! AfyaHero.\n" + menu

    if session:
        state = session.get("state", "menu")
        
        # WhatsApp AI Triage Trigger
        if "umwa" in body_text.lower() or "sakit" in body_text.lower() or "pain" in body_text.lower():
            # Quick async trigger for AI Triage
            from app.services.ai.orchestrator import AIOrchestrator, AIRequest, AITask
            orchestrator = AIOrchestrator()
            
            # Extract basic context for triage
            ai_request = AIRequest(
                task=AITask.TRIAGE,
                hospital_id=session.get("hospital_id", "GLOBAL"), # Fallback to Global if not logged in
                user_id="WHATSAPP_USER",
                payload={"symptoms": body_text, "channel": "whatsapp", "phone": from_uuid},
                patient_id=session.get("patient_id")
            )
            
            # Fire and forget / Queue for WhatsApp response
            asyncio.create_task(orchestrator.process(ai_request))
            response = "AfyaAI is analyzing your symptoms... Please wait for a clinician to be alerted if needed."
            return {"messages": [{"type": "text", "text": response}]}

        if state == "menu":
            if body_text == "1":
                response = "Andika jina la mgonjwa kuanza usajili:"
            elif body_text == "2":
                response = "Tuma namba yako ya usajili (Patient ID):"
            else:
                response = menu

    return {"messages": [{"type": "text", "text": response}]}


@router.post("/ussd", response_model=USSDResponse)
async def handle_ussd(
    session_id: str,
    text: Optional[str] = "",
    db=Depends(get_db_session),
):
    """Handle USSD session"""

    session = await db.fetchone(
        "SELECT * FROM ussd_sessions WHERE session_id = :session_id",
        {"session_id": session_id},
    )

    if not text:
        response = "Welcome to AfyaHero.\n*483*8#"
        await db.execute(
            """INSERT INTO ussd_sessions (session_id, state, created_at)
               VALUES (:session_id, 'start', NOW())""",
            {"session_id": session_id},
        )
    else:
        response = handle_ussd_menu(text, session)

    return USSDResponse(
        session_id=session_id,
        response=response,
    )


def handle_ussd_menu(text: str, session: dict) -> str:
    """Process USSD menu selection"""

    state = session.get("state", "start")
    menu_level = session.get("menu_level", "main")

    if text == "*" or text == "":
        return "1. Kuajili Patient\n2. Appointment\n3. Malipo\n4. Ondoka"

    choice = text.strip()

    if menu_level == "main":
        if choice == "1":
            return "CON Karibu Triage.\nJe, una maumivu ya kifua au shida ya kupumua?\n1. Ndio\n2. Hapana"
        elif choice == "2":
            return "CON Namba ya appointment:"
        elif choice == "3":
            return "CON Tarehe ya malipo (DD/MM/YYYY):"
        elif choice == "4":
            return "END Asante kwa kutumia AfyaHero. Kwa heri!"
            
    # Triage Symptom State
    if choice == "1" and menu_level == "main":
         # Logic to transition to emergency state if "Ndio"
         pass

    return "CON Karibu AfyaHero Portal\n1. Clinical Triage\n2. Appointment\n3. Malipo\n4. Ondoka"


@router.post("/notify", response_model=NotificationResponse)
async def send_patient_notification(
    notification: PatientNotification,
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Send templated notification to patient"""

    patient = await db.fetchone(
        "SELECT phone, name FROM patients WHERE id = :patient_id",
        {"patient_id": notification.patient_id},
    )

    if not patient or not patient.get("phone"):
        raise HTTPException(status_code=404, detail="Patient phone not found")

    templates = {
        "appointment_reminder": f"AfyaHero: M扽gonjwa {patient['name']}, umepewa appointment kesho Saa {notification.variables.get('time', '10:00')}.",
        "lab_ready": f"AfyaHero: Matokeo ya lab yako tayari. Njia: {notification.variables.get('location', 'reception')}.",
        "dispense_ready": f"AfyaHero: Dawa yako tayari kuchukua. Njia: pharmacy.",
        "discharge": f"AfyaHero: Umeruhusiwa. Njia: reception kuhamia mgonjwa wako.",
        "referral": f"AfyaHero: Umepelekwa {notification.variables.get('facility', 'hospitali')}. Njia: {notification.variables.get('location')}.",
        "payment_reminder": f"AfyaHero: Malipo ya KES {notification.variables.get('amount', 0)} yanasubiri.",
    }

    message = templates.get(notification.template, notification.template)

    import uuid

    message_id = str(uuid4())

    await db.execute(
        """INSERT INTO communication_queue (patient_id, phone, channel, message, status, created_at)
           VALUES (:patient_id, :phone, :channel, :message, 'pending', NOW())""",
        {
            "patient_id": notification.patient_id,
            "phone": patient["phone"],
            "channel": notification.channel,
            "message": message,
        },
    )

    return NotificationResponse(
        queued=True,
        message_id=message_id,
    )


@router.get("/queue")
async def get_message_queue(
    status: Optional[str] = None,
    channel: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_db_session),
    hospital_id: str = Depends(get_hospital_id),
):
    """Get queued messages"""

    conditions = []
    params = {"hospital_id": hospital_id, "limit": limit}

    if status:
        conditions.append("status = :status")
        params["status"] = status

    if channel:
        conditions.append("channel = :channel")
        params["channel"] = channel

    where = " AND ".join(conditions) if conditions else "true"

    sql = f"""
        SELECT q.*, p.name as patient_name
        FROM communication_queue q
        LEFT JOIN patients p ON q.patient_id = p.id
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT :limit
    """
    rows = await db.fetchall(sql, params)

    return [
        {
            "id": str(r["id"]),
            "phone": r["phone"],
            "message": r["message"],
            "channel": r["channel"],
            "status": r["status"],
            "patient": r.get("patient_name"),
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]


@router.post("/queue/{message_id}/retry")
async def retry_message(
    message_id: str,
    db=Depends(get_db_session),
):
    """Retry failed message"""

    await db.execute(
        "UPDATE communication_queue SET status = 'pending' WHERE id = :id AND status = 'failed'",
        {"id": message_id},
    )

    return {"status": "retry_queued"}


from uuid import uuid4
