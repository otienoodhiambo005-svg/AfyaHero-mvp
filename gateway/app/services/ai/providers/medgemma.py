"""
MedGemma Provider - Vertex AI MedGemma 1.5
Primary clinical model - lowest hallucination risk for clinical context
"""

import time
import json
import logging
from typing import Any, Optional

from app.services.ai.providers.base import BaseAIProvider, ProviderResponse

logger = logging.getLogger("ai.medgemma")


class MedGemmaProvider(BaseAIProvider):
    """MedGemma 1.5 via Vertex AI"""

    MODEL_NAME = "medgemma-1.5-001"
    VERTEX_LOCATION = "us-central1"

    def __init__(self):
        from app.config import get_settings

        self.settings = get_settings()
        self._client = None

    async def _get_client(self):
        """Lazy init Vertex AI client"""
        if self._client is None:
            try:
                import google.auth
                from google.cloud import aiplatform

                credentials, _ = google.auth.default(
                    scopes=["https://www.googleapis.com/auth/cloud-platform"]
                )
                aiplatform.init(
                    project=self.settings.GCP_PROJECT_ID,
                    location=self.VERTEX_LOCATION,
                    credentials=credentials,
                )
                self._client = aiplatform
            except Exception as e:
                logger.error(f"Failed to init Vertex AI: {e}")
                return None
        return self._client

    async def call(
        self,
        system_prompt: str,
        user_prompt: str,
        payload: Optional[dict[str, Any]] = None,
    ) -> ProviderResponse:
        start = time.monotonic()

        try:
            client = await self._get_client()
            if not client:
                return ProviderResponse(
                    model_name=self.MODEL_NAME,
                    primary_recommendation="",
                    full_output={},
                    confidence=0.0,
                    error="Vertex AI not available",
                )

            # Prepare the prompt with clinical context
            full_prompt = f"{system_prompt}\n\nPatient Information:\n{json.dumps(payload) if payload else 'No structured data'}\n\nClinical Query:\n{user_prompt}"

            response = client.PredictionServiceClient.predict(
                endpoint=f"projects/{self.settings.GCP_PROJECT_ID}/locations/{self.VERTEX_LOCATION}/publishers/google/models/{self.MODEL_NAME}",
                instances=[{"content": full_prompt}],
                parameters={
                    "temperature": 0.2,
                    "maxOutputTokens": 1024,
                    "topP": 0.95,
                    "topK": 40,
                },
            )

            # Parse response
            result_text = response.predictions[0].get("content", "")
            parsed = self._parse_json_response(result_text)

            return ProviderResponse(
                model_name=self.MODEL_NAME,
                primary_recommendation=parsed.get(
                    "recommended_action", parsed.get("urgency_level", "")
                ),
                full_output=parsed,
                confidence=parsed.get("confidence", 0.85),
                processing_ms=int((time.monotonic() - start) * 1000),
            )

        except Exception as e:
            logger.error(f"MedGemma call failed: {e}")
            return ProviderResponse(
                model_name=self.MODEL_NAME,
                primary_recommendation="",
                full_output={},
                confidence=0.0,
                error=str(e),
                processing_ms=int((time.monotonic() - start) * 1000),
            )

    async def health_check(self) -> bool:
        """Check if MedGemma is available"""
        try:
            client = await self._get_client()
            if not client:
                return False
            # Light health check
            test_result = await self.call(
                "You are a medical assistant.", "Reply with 'healthy'", {}
            )
            return test_result.error is None
        except Exception:
            return False

    @property
    def model_name(self) -> str:
        return self.MODEL_NAME

    @property
    def supports_vision(self) -> bool:
        return False

    def _parse_json_response(self, text: str) -> dict[str, Any]:
        """Parse JSON from model response"""
        import re

        # Try direct JSON parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting JSON from text with markdown
        json_match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        # Return text as-is if no JSON found
        return {"raw_output": text}
