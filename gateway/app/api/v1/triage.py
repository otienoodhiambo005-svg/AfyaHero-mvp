from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.dependencies import get_db_session, ai_triage, write_vitals
from app.services.ai.orchestrator import AIOrchestrator, AIRequest, AITask
from app.services.ai.tasks.risk_models import NEWS2Calculator
from app.core.tenancy.context import get_hospital_id, get_user_id
from app.core.audit.writer import write_audit_log
from app.core.audit.events import AuditEvent
from app.schemas.triage import VitalsCreate, VitalsRead
from app.schemas.clinical_ai import ClinicalQuery

router = APIRouter()
orchestrator = AIOrchestrator()
news2 = NEWS2Calculator()


@router.post("/vitals", dependencies=[write_vitals], status_code=201)
async def submit_vitals(
    vitals_data: VitalsCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """Submit patient vitals with automatic NEWS2 calculation"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()

    # Calculate NEWS2 score locally (always offline)
    # Convert Pydantic to dict for calculator which may expect dict
    vitals_dict = vitals_data.model_dump()
    news2_result = news2.calculate(vitals_dict)

    # Store vitals
    vitals_dict = vitals_data.model_dump(exclude_unset=True)
    
    # Map sbp/dbp back to blood_pressure string for legacy DB schema compatibility
    if "sbp" in vitals_dict and "dbp" in vitals_dict:
        vitals_dict["blood_pressure"] = f"{vitals_dict.pop('sbp')}/{vitals_dict.pop('dbp')}"
    elif "sbp" in vitals_dict:
        vitals_dict["blood_pressure"] = f"{vitals_dict.pop('sbp')}/?"
    elif "dbp" in vitals_dict:
        vitals_dict["blood_pressure"] = f"?/{vitals_dict.pop('dbp')}"

    db_data = {
        **vitals_dict,
        "hospital_id": hospital_id,
        "recorded_by": user_id,
        "ai_news2_score": news2_result["score"],
        "ai_alert_level": news2_result["level"],
        "ai_alert_detail": news2_result
    }

    columns = ", ".join(db_data.keys())
    placeholders = ", ".join([f":{k}" for k in db_data.keys()])

    result = await db.execute(f"""
        INSERT INTO clinical_vitals ({columns})
        VALUES ({placeholders})
        RETURNING id
    """, db_data)

    vitals_id = result.scalar_one()
    await db.commit()

    await write_audit_log(
        event=AuditEvent.VITALS_RECORDED,
        user_id=user_id,
        hospital_id=hospital_id,
        patient_id=str(vitals_data.patient_id),
        resource_type="vitals",
        resource_id=str(vitals_id),
        detail={"news2_score": news2_result["score"]}
    )

    return {
        "id": vitals_id,
        "news2_result": news2_result,
        "status": "recorded"
    }


@router.post("/ai-triage", dependencies=[ai_triage])
async def ai_triage_assessment(
    query: ClinicalQuery
):
    """AI triage assessment with 3-model consensus"""
    hospital_id = get_hospital_id()
    user_id = get_user_id()

    ai_request = AIRequest(
        task=AITask.TRIAGE,
        hospital_id=hospital_id,
        user_id=user_id,
        payload=query.model_dump(),
        patient_id=str(query.patient_id) if query.patient_id else None,
        encounter_id=str(query.encounter_id) if query.encounter_id else None
    )

    response = await orchestrator.process(ai_request)

    await write_audit_log(
        event=AuditEvent.AI_TRIAGE_COMPLETED,
        user_id=user_id,
        hospital_id=hospital_id,
        patient_id=str(query.patient_id) if query.patient_id else None,
        detail={
            "confidence": response.confidence,
            "consensus_reached": response.consensus_reached,
            "models_used": response.models_used
        }
    )

    return response


from fastapi import WebSocket, WebSocketDisconnect, Depends
import json
import logging
from app.core.auth.websocket_auth import get_websocket_user

logger = logging.getLogger(__name__)

@router.websocket("/ws")
async def ws_ai_triage_assessment(
    websocket: WebSocket,
    user: dict = Depends(get_websocket_user)
):
    """
    Real-time AI triage assessment endpoint over WebSocket.
    Manages state for LangGraph streams without timing out like standard HTTP.
    """
    await websocket.accept()
    try:
        while True:
            data_str = await websocket.receive_text()
            request_data = json.loads(data_str)
            
            # Validate input via ClinicalQuery model
            try:
                query = ClinicalQuery(**request_data)
            except Exception as e:
                await websocket.send_json({"error": "validation_error", "detail": str(e)})
                continue

            # Use authenticated token dependencies
            hospital_id = user["hospital_id"]
            user_id = user["sub"]

            ai_request = AIRequest(
                task=AITask.TRIAGE,
                hospital_id=hospital_id,
                user_id=user_id,
                payload=query.model_dump(),
                patient_id=str(query.patient_id) if query.patient_id else None,
                encounter_id=str(query.encounter_id) if query.encounter_id else None
            )
            
            # Stream orchestrator updates back
            await websocket.send_json({"status": "processing", "message": "LangGraph started"})
            response = await orchestrator.process(ai_request)
            
            await websocket.send_json({
                "status": "complete",
                "result": response.model_dump()
            })
            
    except WebSocketDisconnect:
        logger.info("Client disconnected from triage WS")
    except Exception as e:
        await websocket.send_json({"error": "internal_error", "detail": str(e)})