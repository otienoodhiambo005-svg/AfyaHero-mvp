import asyncio
import time
import logging
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime, UTC
from typing import Any, Optional, Dict, List

from app.services.ai.providers.base import ProviderResponse
from app.services.ai.cache import AIResponseCache, get_ai_cache
from app.services.ai.cache.circuit_breaker import AICircuitBreaker, ai_breaker, CircuitBreakerOpenError

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
    cached: bool = False
    timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


# Provider cascades by task type
PROVIDER_CASCADES = {
    AITask.TRIAGE: ["llama_405b", "qwen_32b", "llama_70b", "claude_opus", "gpt_5"],
    AITask.DIFFERENTIAL: ["llama_405b", "qwen_32b", "llama_70b", "claude_opus"],
    AITask.DOSAGE_CALC: ["llama_405b", "qwen_32b", "llama"],
    AITask.RISK_SCORING: ["llama_405b", "qwen_32b", "llama_70b"],
    AITask.IMAGE_ANALYSIS: ["radiology", "gemini", "llama_405b"],
    AITask.ICD10_CODING: ["llama_405b", "qwen_32b", "llama"],
    AITask.SOAP_NOTE: ["llama_405b", "claude_opus", "gpt_5"],
    AITask.PATIENT_SUMMARY: ["llama_405b", "claude_opus"],
    AITask.TRANSCRIBE: ["medasr", "whisper", "llama_405b"],
    AITask.DRUG_INTERACTION: ["llama_405b", "qwen_32b", "llama"],
    AITask.STOCK_PREDICTION: ["gemma", "llama", "qwen_32b"],
    AITask.INVENTORY_AI: ["gemma", "llama", "qwen_32b"],
}


class BaseOrchestrator:
    """Base class for specialized AI agents with caching and circuit breaking"""

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
        from app.services.ai.providers.medasr import MedASRProvider

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
            "medasr": MedASRProvider(),
        }
        
        # Initialize cache
        self._cache: Optional[AIResponseCache] = None
        self._cache_initialized = False
    
    async def _get_cache(self) -> Optional[AIResponseCache]:
        """Get or initialize the AI response cache."""
        if not self._cache_initialized:
            try:
                self._cache = await get_ai_cache()
                self._cache_initialized = True
                logger.info("AI Response Cache initialized for orchestrator")
            except Exception as e:
                logger.warning(f"Failed to initialize AI cache: {e}")
                self._cache = None
        return self._cache
    
    async def _is_online(self) -> bool:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.head("https://generativelanguage.googleapis.com/")
                return response.status_code < 500
        except Exception:
            return False

    def _build_response(
        self, task: AITask, result: dict, start_time: float, queued: bool = False, cached: bool = False
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
            cached=cached,
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
                        "cached": resp.cached,
                        "created_at": resp.timestamp,
                    }
                )
                .execute()
            )
        except Exception as e:
            logger.error(f"Failed to log AI interaction: {e}")

    async def _call_provider_with_circuit_breaker(
        self, 
        provider_name: str, 
        system_prompt: str, 
        user_prompt: str, 
        payload: dict
    ) -> Optional[ProviderResponse]:
        """Call a provider with circuit breaker protection."""
        breaker = ai_breaker(provider_name)
        
        try:
            # Check cache first
            cache = await self._get_cache()
            if cache:
                cache_key_data = {
                    "hospital_id": payload.get("hospital_id", ""),
                    "provider": provider_name,
                    "model": self.providers[provider_name].model_name,
                    "prompt": user_prompt,
                    "parameters": payload
                }
                cached_response = await cache.get(
                    cache_key_data["hospital_id"],
                    cache_key_data["provider"],
                    cache_key_data["model"],
                    cache_key_data["prompt"],
                    cache_key_data["parameters"]
                )
                
                if cached_response:
                    logger.info(f"Cache hit for {provider_name} - {cache_key_data['prompt'][:50]}...")
                    return ProviderResponse(
                        model_name=provider_name,
                        primary_recommendation=cached_response.get("primary_recommendation", ""),
                        full_output=cached_response.get("output", {}),
                        confidence=cached_response.get("confidence", 0.8),
                        error=None
                    )
            
            # Call provider with circuit breaker
            provider = self.providers[provider_name]
            response = await breaker.call(
                provider.call, 
                system_prompt, 
                user_prompt, 
                payload
            )
            
            # Cache the response
            if cache and response and not response.error:
                await cache.set(
                    payload.get("hospital_id", ""),
                    provider_name,
                    provider.model_name,
                    user_prompt,
                    response.full_output,
                    payload
                )
            
            return response
            
        except CircuitBreakerOpenError as e:
            logger.warning(f"Circuit breaker open for {provider_name}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error calling {provider_name}: {e}")
            return None


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

        # 2. Get provider cascade for this task
        cascade = PROVIDER_CASCADES.get(req.task, ["llama_405b", "qwen_32b", "llama_70b"])
        
        sys_prompt = self._get_medic_prompt(req.task)
        user_prompt = f"Task: {req.task.value}\n\nInput: {req.payload}"
        
        # Add hospital_id to payload for caching
        payload_with_hospital = {**req.payload, "hospital_id": req.hospital_id}

        # Try providers in cascade order
        results: List[ProviderResponse] = []
        for provider_name in cascade:
            if provider_name not in self.providers:
                continue
                
            result = await self._call_provider_with_circuit_breaker(
                provider_name, 
                sys_prompt, 
                user_prompt, 
                payload_with_hospital
            )
            
            if result and not result.error:
                results.append(result)
                
                # If we have enough results for consensus, stop
                if len(results) >= 3:
                    break

        if not results:
            # Fallback to base Llama 3.3 if specialized models fail
            fallback = await self._call_provider_with_circuit_breaker(
                "llama", sys_prompt, user_prompt, payload_with_hospital
            )
            if fallback and not fallback.error:
                results = [fallback]

        if not results:
            return AIResponse(
                task=req.task,
                output={"error": "All AI providers unavailable"},
                confidence=0.0,
                models_used=[],
                consensus_reached=False,
                dissenting_models=[],
                requires_clinician_review=True,
                offline_queued=False,
                processing_ms=int((time.monotonic() - start) * 1000),
                cached=False
            )

        consensus = self._calculate_consensus(results)

        # 3. Complex Case Cascade (Claude 3.7 Opus / GPT-5)
        # Trigger if confidence is low OR consensus wasn't reached on critical triage
        if not consensus["consensus_reached"] or consensus["confidence"] < 0.8:
            logger.info("Clinical ambiguity detected - cascading to Claude/GPT-5 Tier")
            cascade_resp = await self._call_provider_with_circuit_breaker(
                "claude_opus", 
                sys_prompt + " [COMPLEX CASE ESCALATION]", 
                user_prompt + "\n\nPrevious model disagreement noted. Provide final clinical arbitration.",
                payload_with_hospital
            )
            if cascade_resp and not cascade_resp.error:
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
        
        payload_with_hospital = {**req.payload, "hospital_id": req.hospital_id}

        # Use provider cascade for inventory tasks
        cascade = PROVIDER_CASCADES.get(req.task, ["gemma", "llama", "qwen_32b"])
        
        for provider_name in cascade:
            if provider_name not in self.providers:
                continue
                
            result = await self._call_provider_with_circuit_breaker(
                provider_name, 
                sys_prompt, 
                user_prompt, 
                payload_with_hospital
            )
            
            if result and not result.error:
                resp = self._build_response(req.task, result.full_output, start, cached=result.error is None)
                asyncio.create_task(self._log_interaction(req, resp))
                return resp
        
        # Fallback if all providers fail
        return AIResponse(
            task=req.task,
            output={"error": "All AI providers unavailable for inventory task"},
            confidence=0.0,
            models_used=[],
            consensus_reached=False,
            dissenting_models=[],
            requires_clinician_review=False,
            offline_queued=False,
            processing_ms=int((time.monotonic() - start) * 1000),
            cached=False
        )


class AfyaScribeOrchestrator(BaseOrchestrator):
    """Documentation specialist for medical records"""

    async def process(self, req: AIRequest) -> AIResponse:
        start = time.monotonic()
        sys_prompt = "You are AfyaScribe. Extract structured SOAP notes from medical conversation transcripts."
        user_prompt = f"Transcript: {req.payload}"
        
        payload_with_hospital = {**req.payload, "hospital_id": req.hospital_id}

        # Use provider cascade for documentation tasks
        cascade = PROVIDER_CASCADES.get(req.task, ["llama_405b", "claude_opus", "gpt_5"])
        
        for provider_name in cascade:
            if provider_name not in self.providers:
                continue
                
            result = await self._call_provider_with_circuit_breaker(
                provider_name, 
                sys_prompt, 
                user_prompt, 
                payload_with_hospital
            )
            
            if result and not result.error:
                resp = self._build_response(req.task, result.full_output, start, cached=result.error is None)
                asyncio.create_task(self._log_interaction(req, resp))
                return resp
        
        # Fallback
        return AIResponse(
            task=req.task,
            output={"error": "All AI providers unavailable for documentation task"},
            confidence=0.0,
            models_used=[],
            consensus_reached=False,
            dissenting_models=[],
            requires_clinician_review=False,
            offline_queued=False,
            processing_ms=int((time.monotonic() - start) * 1000),
            cached=False
        )


class AfyaRadiologyOrchestrator(BaseOrchestrator):
    """Imaging specialist routing to SOTA vendors (Aidoc, Viz, VisiRad)"""

    async def process(self, req: AIRequest) -> AIResponse:
        start = time.monotonic()
        sys_prompt = "You are AfyaRadiology. Identify life-critical findings (ICH, LVO, Pneumothorax) from scans."
        
        payload_with_hospital = {**req.payload, "hospital_id": req.hospital_id}

        # Use imaging-specific cascade
        cascade = PROVIDER_CASCADES.get(req.task, ["radiology", "gemini", "llama_405b"])
        
        for provider_name in cascade:
            if provider_name not in self.providers:
                continue
                
            result = await self._call_provider_with_circuit_breaker(
                provider_name, 
                sys_prompt, 
                "Analyze imaging data", 
                payload_with_hospital
            )
            
            if result and not result.error:
                resp = self._build_response(req.task, result.full_output, start, cached=result.error is None)
                asyncio.create_task(self._log_interaction(req, resp))
                return resp
        
        # Fallback
        return AIResponse(
            task=req.task,
            output={"error": "All AI providers unavailable for radiology task"},
            confidence=0.0,
            models_used=[],
            consensus_reached=False,
            dissenting_models=[],
            requires_clinician_review=True,
            offline_queued=False,
            processing_ms=int((time.monotonic() - start) * 1000),
            cached=False
        )


class AfyaPathologyOrchestrator(BaseOrchestrator):
    """Specimen specialist using Foundation Models (Virchow2, UNI-v2)"""

    async def process(self, req: AIRequest) -> AIResponse:
        start = time.monotonic()
        sys_prompt = "You are AfyaPathology. Provide deep histological analysis of specimen slides."
        
        payload_with_hospital = {**req.payload, "hospital_id": req.hospital_id}

        # Use pathology-specific cascade
        cascade = PROVIDER_CASCADES.get(req.task, ["pathology", "gemini", "llama_405b"])
        
        for provider_name in cascade:
            if provider_name not in self.providers:
                continue
                
            result = await self._call_provider_with_circuit_breaker(
                provider_name, 
                sys_prompt, 
                "Analyze pathology specimen", 
                payload_with_hospital
            )
            
            if result and not result.error:
                resp = self._build_response(req.task, result.full_output, start, cached=result.error is None)
                asyncio.create_task(self._log_interaction(req, resp))
                return resp
        
        # Fallback
        return AIResponse(
            task=req.task,
            output={"error": "All AI providers unavailable for pathology task"},
            confidence=0.0,
            models_used=[],
            consensus_reached=False,
            dissenting_models=[],
            requires_clinician_review=True,
            offline_queued=False,
            processing_ms=int((time.monotonic() - start) * 1000),
            cached=False
        )


# Main orchestrator that routes to specialized orchestrators
class AIOrchestrator:
    """Main orchestrator that routes requests to specialized agents"""
    
    def __init__(self):
        self.medic = AfyaMedicOrchestrator()
        self.dawa = DAWAOrchestrator()
        self.scribe = AfyaScribeOrchestrator()
        self.radiology = AfyaRadiologyOrchestrator()
        self.pathology = AfyaPathologyOrchestrator()
        
        # Task to orchestrator mapping
        self._task_router = {
            AITask.TRIAGE: self.medic,
            AITask.DIFFERENTIAL: self.medic,
            AITask.DOSAGE_CALC: self.medic,
            AITask.RISK_SCORING: self.medic,
            AITask.IMAGE_ANALYSIS: self.radiology,
            AITask.ICD10_CODING: self.medic,
            AITask.SOAP_NOTE: self.scribe,
            AITask.PATIENT_SUMMARY: self.scribe,
            AITask.TRANSCRIBE: self.scribe,
            AITask.DRUG_INTERACTION: self.dawa,
            AITask.STOCK_PREDICTION: self.dawa,
            AITask.INVENTORY_AI: self.dawa,
        }
    
    async def process(self, req: AIRequest) -> AIResponse:
        """Route request to appropriate orchestrator."""
        orchestrator = self._task_router.get(req.task)
        
        if orchestrator:
            return await orchestrator.process(req)
        else:
            # Default to medic orchestrator for unknown tasks
            logger.warning(f"Unknown task type: {req.task}, routing to AfyaMedic")
            return await self.medic.process(req)
    
    async def get_cache_stats(self) -> Optional[Dict[str, Any]]:
        """Get cache statistics."""
        cache = await self.medic._get_cache()
        if cache:
            return cache.get_stats()
        return None
    
    async def get_circuit_breaker_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get circuit breaker statistics for all providers."""
        from app.services.ai.cache.circuit_breaker import get_all_breaker_stats
        return await get_all_breaker_stats()
