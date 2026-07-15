import logging
import httpx
from typing import Any, Optional
from app.config import get_settings

logger = logging.getLogger("core.realtime")

async def broadcast_clinical_event(hospital_id: str, event_type: str, payload: dict[str, Any]) -> bool:
    """
    Broadcast a clinical event to the Supabase Realtime 'clinical_alerts' topic.
    This uses the Supabase REST API with the service role key to perform a broadcast.
    """
    settings = get_settings()
    
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        logger.warning("Supabase credentials missing. Realtime broadcast skipped.")
        return False

    # Supabase Realtime HTTP Broadcast endpoint format:
    # POST /realtime/v1/api/broadcast
    url = f"{settings.SUPABASE_URL}/realtime/v1/api/broadcast"
    
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Supabase Realtime broadcast payload structure
    body = {
        "topic": f"hospital:{hospital_id}",
        "event": event_type,
        "payload": {
            "hospital_id": hospital_id,
            "timestamp": payload.get("timestamp"),
            "data": payload
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, json=body, headers=headers)
            if response.status_code >= 400:
                logger.error(f"Supabase broadcast failed with status {response.status_code}: {response.text}")
                return False
            return True
    except Exception as e:
        logger.error(f"Exception during Supabase broadcast: {str(e)}")
        return False
