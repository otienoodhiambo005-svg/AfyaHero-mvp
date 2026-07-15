"""
AI Job Queue - Offline Processing with Retry Logic
Implements exponential backoff for failed AI tasks
"""

import asyncio
import json
import logging
from datetime import datetime, UTC
from uuid import uuid4
from typing import Optional

from app.services.ai.orchestrator import AIRequest, AITask

logger = logging.getLogger("ai.job_queue")


# Job states
class JobState:
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRY_EXHAUSTED = "retry_exhausted"


# Retry configuration
MAX_RETRIES = 3
RETRY_DELAYS = [5, 30, 120]  # seconds: 5s, 30s, 2min


async def enqueue_ai_job(req: AIRequest) -> str:
    """Add AI job to offline queue"""
    job_id = str(uuid4())

    try:
        from app.db import get_redis

        redis = get_redis()

        job_data = {
            "id": job_id,
            "task": req.task.value,
            "hospital_id": req.hospital_id,
            "user_id": req.user_id,
            "patient_id": req.patient_id,
            "encounter_id": req.encounter_id,
            "payload": json.dumps(req.payload),
            "urgency": req.urgency,
            "state": JobState.PENDING,
            "retry_count": 0,
            "created_at": datetime.now(UTC).isoformat(),
        }

        await redis.hset(f"ai:job:{job_id}", mapping=job_data)
        await redis.zadd("ai:pending_jobs", {job_id: datetime.now(UTC).timestamp()})

        logger.info(f"Enqueued AI job {job_id} for task {req.task}")
        return job_id

    except Exception as e:
        logger.error(f"Failed to enqueue job: {e}")
        raise


async def get_job(job_id: str) -> Optional[dict]:
    """Get job from queue"""
    try:
        from app.db import get_redis

        redis = get_redis()
        return await redis.hgetall(f"ai:job:{job_id}")
    except Exception:
        return None


async def process_job(job_id: str) -> dict:
    """Process a queued AI job"""
    job = await get_job(job_id)
    if not job:
        return {"success": False, "error": "Job not found"}

    retry_count = int(job.get("retry_count", 0))
    if job["state"] == JobState.RETRY_EXHAUSTED:
        return {"success": False, "error": "Max retries exceeded"}

    # Mark as processing
    await _update_job_state(job_id, JobState.PROCESSING)

    try:
        # Reconstruct request
        req = AIRequest(
            task=AITask(job["task"]),
            hospital_id=job["hospital_id"],
            user_id=job["user_id"],
            payload=json.loads(job["payload"]),
            patient_id=job.get("patient_id"),
            encounter_id=job.get("encounter_id"),
            urgency=job.get("urgency", "normal"),
        )

        # Process the job
        from app.services.ai.orchestrator import AIOrchestrator

        orchestrator = AIOrchestrator()
        result = await orchestrator.process(req)

        # Mark completed
        await _update_job_state(job_id, JobState.COMPLETED)

        return {"success": True, "result": result}

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")

        if retry_count < MAX_RETRIES:
            # Schedule retry
            await _schedule_retry(job_id, retry_count)
            return {"success": False, "error": str(e), "retry_scheduled": True}
        else:
            await _update_job_state(job_id, JobState.RETRY_EXHAUSTED)
            return {"success": False, "error": "Max retries exceeded"}


async def _update_job_state(job_id: str, state: str) -> None:
    """Update job state"""
    try:
        from app.db import get_redis

        redis = get_redis()
        await redis.hset(f"ai:job:{job_id}", "state", state)
        await redis.hset(
            f"ai:job:{job_id}", "updated_at", datetime.now(UTC).isoformat()
        )
    except Exception as e:
        logger.error(f"Failed to update job state: {e}")


async def _schedule_retry(job_id: str, retry_count: int) -> None:
    """Schedule job retry with exponential backoff"""
    delay = RETRY_DELAYS[min(retry_count, len(RETRY_DELAYS) - 1)]

    try:
        from app.db import get_redis

        redis = get_redis()

        await redis.hset(f"ai:job:{job_id}", "state", JobState.PENDING)
        await redis.hset(f"ai:job:{job_id}", "retry_count", str(retry_count + 1))

        # Add to retry sorted set with timestamp
        retry_at = datetime.now(UTC).timestamp() + delay
        await redis.zadd("ai:retry_jobs", {job_id: retry_at})

        logger.info(
            f"Job {job_id} scheduled for retry in {delay}s (retry {retry_count + 1})"
        )

    except Exception as e:
        logger.error(f"Failed to schedule retry: {e}")


async def process_pending_jobs() -> int:
    """Process all pending jobs - called by worker"""
    try:
        from app.db import get_redis

        redis = get_redis()

        # Get all pending jobs
        pending = await redis.zrange("ai:pending_jobs", 0, -1)
        processed = 0

        for job_id in pending:
            result = await process_job(
                job_id.decode() if isinstance(job_id, bytes) else job_id
            )
            if result.get("success"):
                await redis.zrem("ai:pending_jobs", job_id)
                processed += 1

        return processed

    except Exception as e:
        logger.error(f"Failed to process pending jobs: {e}")
        return 0


async def cleanup_old_jobs(max_age_hours: int = 24) -> int:
    """Clean up old completed jobs"""
    try:
        from app.db import get_redis

        redis = get_redis()

        cutoff = datetime.now(UTC).timestamp() - (max_age_hours * 3600)
        removed = await redis.zremrangingscore("ai:retry_jobs", 0, cutoff)

        return removed

    except Exception:
        return 0
