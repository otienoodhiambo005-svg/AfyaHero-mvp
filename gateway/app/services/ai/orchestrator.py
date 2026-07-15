import asyncio
import time
import logging
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime, UTC
from typing import Any, Optional

from app.services.ai.providers.base import ProviderResponse

logger = logging.getLogger("ai.orchestrator")


class AITask(str, Enum):
    # AfyaMedic (Clinical)
    TRIAGE = "triage"
    DIFFERENTIAL = "differential"
    DOSAGE_CALC = "dosage_calc"
    RISK_SCORING = "risk_scoring"
    IMAGE_ANALYSIS = "image_analysis"
    ICD10_CODING = "icd10_coding"

    # AfyaScribe (Documentation)
    SOAP_NOTE = "soap_note"
    PATIENT_SUMMARY = "patient_summary"
    TRANSCRIBE = "transcribe"

    # DAWA (Inventory & Workflow)
    DRUG_INTERACTION = "drug_interaction"
    STOCK_PREDICTION = "stock_prediction"
    INVENTORY_AI = "inventory_ai"


@dataclass
class AIRequest:
    task: AITask
    hospital_id: str
    user_id: str
    payload: dict[str, Any]
    patient_id: Optional[str] = None
    encounter_id: Optional[str] = None
    urgency: str = "normal"


@dataclass
class AIResponse:
    task: AITask
    output: dict[str, Any]
    confidence: float
    models_used: list[str]
    consensus_reached: bool
    dissenting_models: list[str]
    requires_clinician_review: bool
    offline_queued: bool
    processing_ms: int
    timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


class BaseOrchestrator:
    """Base class for specialized AI agents"""

    def __init__(self):
        from app.services.ai.providers.gemma import GemmaProvider
        from app.services.ai.providers.gemini_flash import GeminiFlashProvider
        from app.services.ai.providers.llama import LlamaProvider
        from app.services.ai.providers.deepseek import DeepSeekProvider
        from app.services.ai.providers.medgemma import MedGemmaProvider
        from app.services.ai.providers.gemini import GeminiProvider
        from app.services.ai.providers.openrouter_specialized import OpenRouterSpecializedProvider
        from app.services.ai.providers.radiology import RadiologyProvider
        from app.services.ai.providers.pathology import PathologyProvider

        self.providers = {
            "gemma": GemmaProvider(),
            "gemini_flash": GeminiFlashProvider(),
            "llama": LlamaProvider(),
            "deepseek": DeepSeekProvider(),
            "medgemma": MedGemmaProvider(),
            "gemini": GeminiProvider(),
            "llama_405b": OpenRouterSpecializedProvider("llama_405b"),
            "llama_70b": OpenRouterSpecializedProvider("llama_70b"),
            "qwen_32b": OpenRouterSpecializedProvider("qwen_32b"),
            "claude_opus": OpenRouterSpecializedProvider("claude_opus"),
            "gpt_5": OpenRouterSpecializedProvider("gpt_5"),
            "radiology": RadiologyProvider(),
            "pathology": PathologyProvider(),
        }

    async def _is_online(self) -> bool:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.head("https://generativelanguage.googleapis.com/")
                return response.status_code < 500
        except Exception:
            return False

    def _build_response(
        self, task: AITask, result: dict, start_time: float, queued: bool = False
    ) -> AIResponse:
        return AIResponse(
            task=task,
            output=result.get("output", result),
            confidence=result.get("confidence", 0.8),
            models_used=result.get("models_used", []),
            consensus_reached=result.get("consensus_reached", True),
            dissenting_models=result.get("dissenting_models", []),
            requires_clinician_review=result.get("confidence", 0.8) < 0.75,
            offline_queued=queued,
            processing_ms=int((time.monotonic() - start_time) * 1000),
        )

    async def _log_interaction(self, req: AIRequest, resp: AIResponse) -> None:
        try:
            from app.db import get_admin_client
            from uuid import uuid4

            await (
                get_admin_client()
                .table("ai_interactions")
                .insert(
                    {
                        "id": str(uuid4()),
                        "hospital_id": req.hospital_id,
                        "user_id": req.user_id,
                        "patient_id": req.patient_id,
                        "encounter_id": req.encounter_id,
                        "task": req.task.value,
                        "models_used": resp.models_used,
                        "consensus_reached": resp.consensus_reached,
                        "confidence_score": resp.confidence,
                        "output_payload": resp.output,
                        "processing_ms": resp.processing_ms,
                        "offline_queued": resp.offline_queued,
                        "created_at": resp.timestamp,
                    }
                )
                .execute()
            )
        except Exception as e:
            logger.error(f"Failed to log AI interaction: {e}")


class AfyaMedicOrchestrator(BaseOrchestrator):
    """Deep clinical support agent with 3-model consensus & emergency triggers"""

    AUTOMATIC_HIGH_SEVERITY = [
        "chest pain",
        "difficulty breathing",
        "unconscious",
        "severe bleeding",
        "stroke",
        "seizure",
    ]

    async def process(self, req: AIRequest) -> AIResponse:
        start = time.monotonic()

        # 1. Check for emergency symptoms
        payload_text = str(req.payload).lower()
        is_emergency = any(s in payload_text for s in self.AUTOMATIC_HIGH_SEVERITY)

        # 2. Run High-Integrity Trio Ensemble (Llama 405B, Qwen 32B, Llama 70B)
        sys_prompt = self._get_medic_prompt(req.task)
        user_prompt = f"Task: {req.task.value}\n\nInput: {req.payload}"

        results = await asyncio.gather(
            self.providers["llama_405b"].call(sys_prompt, user_prompt, req.payload),
            self.providers["qwen_32b"].call(sys_prompt, user_prompt, req.payload),
            self.providers["llama_70b"].call(sys_prompt, user_prompt, req.payload),
            return_exceptions=True,
        )

        valid_results = [
            r for r in results if isinstance(r, ProviderResponse) and not r.error
        ]

        if not valid_results:
            # Fallback to base Llama 3.3 if specialized models fail
            fallback = await self.providers["llama"].call(sys_prompt, user_prompt, req.payload)
            valid_results = [fallback]

        consensus = self._calculate_consensus(valid_results)

        # 3. Complex Case Cascade (Claude 3.7 Opus / GPT-5)
        # Trigger if confidence is low OR consensus wasn't reached on critical triage
        if not consensus["consensus_reached"] or consensus["confidence"] < 0.8:
            logger.info("Clinical ambiguity detected - cascading to Claude/GPT-5 Tier")
            cascade_resp = await self.providers["claude_opus"].call(
                sys_prompt + " [COMPLEX CASE ESCALATION]", 
                user_prompt + "\n\nPrevious model disagreement noted. Provide final clinical arbitration.",
                req.payload
            )
            if not cascade_resp.error:
                consensus["output"]["final_arbitration"] = cascade_resp.full_output
                consensus["confidence"] = max(consensus["confidence"], cascade_resp.confidence)
                consensus["models_used"].append(cascade_resp.model_name)

        # 4. Trigger Realtime Alert if High Severity
        if is_emergency or consensus["output"].get("urgency_level") == 1:
            from app.core.realtime import broadcast_clinical_event
            await broadcast_clinical_event(
                req.hospital_id,
                "EMERGENCY_TRIAGE",
                {"message": f"CRITICAL: {req.payload.get('summary', 'High priority patient')}"},
            )

        resp = self._build_response(req.task, consensus, start)
        asyncio.create_task(self._log_interaction(req, resp))
        return resp

    def _get_medic_prompt(self, task: AITask) -> str:
        base = (
            "You are AfyaMedic, a clinical specialist for East Africa. "
            "Prioritize KE MoH guidelines (malaria, TB, tropical infections). "
            "Accuracy is life-critical. JSON format."
        )
        prompts = {
            AITask.TRIAGE: "Assess urgency 1-5. 1=Immediate.",
            AITask.DIFFERENTIAL: "Rank differential diagnosis with supporting features.",
        }
        return f"{base} {prompts.get(task, '')}"

    def _calculate_consensus(self, results: list[ProviderResponse]) -> dict[str, Any]:
        from collections import Counter

        recommendations = [r.primary_recommendation for r in results]
        top_recommendation, count = Counter(recommendations).most_common(1)[0]
        consensus_reached = count >= 2

        avg_confidence = sum(r.confidence for r in results) / len(results)
        final_confidence = avg_confidence * (1.0 if consensus_reached else 0.65)

        return {
            "output": {
                "primary_recommendation": top_recommendation,
                "consensus_reached": consensus_reached,
                "all_outputs": [r.full_output for r in results],
            },
            "confidence": min(final_confidence, 0.99),
            "models_used": [r.model_name for r in results],
            "consensus_reached": consensus_reached,
            "dissenting_models": [
                r.model_name
                for r in results
                if r.primary_recommendation != top_recommendation
            ],
        }


class DAWAOrchestrator(BaseOrchestrator):
    """Autonomous workflow assistant for inventory and logistics"""

    async def process(self, req: AIRequest) -> AIResponse:
        start = time.monotonic()
        sys_prompt = "You are DAWA, an autonomous inventory assistant. Focus on stock, logistics, and cost-efficiency."
        user_prompt = f"Request: {req.payload}"

        result = await self.providers["gemma"].call(sys_prompt, user_prompt, req.payload)
        resp = self._build_response(req.task, result.full_output, start)
        asyncio.create_task(self._log_interaction(req, resp))
        return resp


class AfyaScribeOrchestrator(BaseOrchestrator):
    """Documentation specialist for medical records"""

    async def process(self, req: AIRequest) -> AIResponse:
        start = time.monotonic()
        sys_prompt = "You are AfyaScribe. Extract structured SOAP notes from medical conversation transcripts."
        user_prompt = f"Transcript: {req.payload}"

        result = await self.providers["llama"].call(sys_prompt, user_prompt, req.payload)
        resp = self._build_response(req.task, result.full_output, start)
        asyncio.create_task(self._log_interaction(req, resp))
        return resp


class AfyaRadiologyOrchestrator(BaseOrchestrator):
    """Imaging specialist routing to SOTA vendors (Aidoc, Viz, VisiRad)"""

    async def process(self, req: AIRequest) -> AIResponse:
        start = time.monotonic()
        sys_prompt = "You are AfyaRadiology. Identify life-critical findings (ICH, LVO, Pneumothorax) from scans."
        result = await self.providers["radiology"].call(sys_prompt, "Analyze imaging data", req.payload)
        resp = self._build_response(req.task, result.full_output, start)
        asyncio.create_task(self._log_interaction(req, resp))
        return resp

class AfyaPathologyOrchestrator(BaseOrchestrator):
    """Specimen specialist using Foundation Models (Virchow2, UNI-v2)"""

    async def process(self, req: AIRequest) -> AIResponse:
        start = time.monotonic()
        sys_prompt = "You are AfyaPathology. Provide deep histological analysis of specimen slides."
        result = await self.providers["pathology"].call(sys_prompt, "Analyze pathology specimen", req.payload)
        resp = self._build_response(req.task, result.full_output, start)
        asyncio.create_task(self._log_interaction(req, resp))
        return resp

def get_orchestrator(agent_type: str) -> BaseOrchestrator:
    """Factory to get the right specialized agent"""
    if agent_type == "medic":
        return AfyaMedicOrchestrator()
    if agent_type == "dawa":
        return DAWAOrchestrator()
    if agent_type == "radiology":
        return AfyaRadiologyOrchestrator()
    if agent_type == "pathology":
        return AfyaPathologyOrchestrator()
    return AfyaScribeOrchestrator()


class AIOrchestrator(BaseOrchestrator):
    """Main AI Orchestrator that delegates tasks to specialized agents"""
    ENSEMBLE_TASKS = [AITask.TRIAGE, AITask.DIFFERENTIAL]
    OFFLINE_TASKS = []

    async def process(self, req: AIRequest) -> AIResponse:
        task = req.task
        if task in (
            AITask.TRIAGE,
            AITask.DIFFERENTIAL,
            AITask.DOSAGE_CALC,
            AITask.RISK_SCORING,
            AITask.ICD10_CODING,
        ):
            agent = get_orchestrator("medic")
        elif task in (
            AITask.DRUG_INTERACTION,
            AITask.STOCK_PREDICTION,
            AITask.INVENTORY_AI,
        ):
            agent = get_orchestrator("dawa")
        elif task == AITask.IMAGE_ANALYSIS:
            agent = get_orchestrator("radiology")
        else:
            agent = get_orchestrator("scribe")

        return await agent.process(req)

