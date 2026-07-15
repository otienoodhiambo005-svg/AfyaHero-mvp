"""
Gemini Provider - Google AI Gemini 2.5 Flash
Fast, cheap, strong reasoning - Google health safety filters
"""

import time
import json
import logging
from typing import Any, Optional

from app.services.ai.providers.base import BaseAIProvider, ProviderResponse

logger = logging.getLogger("ai.gemini")


class GeminiProvider(BaseAIProvider):
    """Gemini 2.5 Flash via Google Generative Language API"""

    MODEL_NAME = "gemini-2.0-flash"

    def __init__(self):
        from app.config import get_settings

        self.settings = get_settings()
        self._api_key = self.settings.GEMINI_API_KEY

    async def call(
        self,
        system_prompt: str,
        user_prompt: str,
        payload: Optional[dict[str, Any]] = None,
    ) -> ProviderResponse:
        start = time.monotonic()

        try:
            import httpx

            # Build full prompt
            full_prompt = f"{system_prompt}\n\nPatient Information:\n{json.dumps(payload) if payload else 'No structured data'}\n\nQuery:\n{user_prompt}"

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{self.MODEL_NAME}:generateContent",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "contents": [{"parts": [{"text": full_prompt}]}],
                        "generationConfig": {
                            "temperature": 0.3,
                            "maxOutputTokens": 1024,
                            "topP": 0.95,
                            "topK": 40,
                        },
                        "systemInstruction": {"parts": [{"text": system_prompt}]},
                    },
                )

            if response.status_code != 200:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                logger.warning(f"Gemini error: {error_msg}")
                return ProviderResponse(
                    model_name=self.MODEL_NAME,
                    primary_recommendation="",
                    full_output={},
                    confidence=0.0,
                    error=error_msg,
                    processing_ms=int((time.monotonic() - start) * 1000),
                )

            result = response.json()
            text = (
                result.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )

            parsed = self._parse_json_response(text)

            return ProviderResponse(
                model_name=self.MODEL_NAME,
                primary_recommendation=parsed.get(
                    "urgency_level", parsed.get("recommended_action", "")
                ),
                full_output=parsed,
                confidence=parsed.get("-confidence", 0.80),
                processing_ms=int((time.monotonic() - start) * 1000),
            )

        except Exception as e:
            logger.error(f"Gemini call failed: {e}")
            return ProviderResponse(
                model_name=self.MODEL_NAME,
                primary_recommendation="",
                full_output={},
                confidence=0.0,
                error=str(e),
                processing_ms=int((time.monotonic() - start) * 1000),
            )

    async def health_check(self) -> bool:
        """Check if Gemini is available"""
        try:
            result = await self.call(
                "You are a helpful assistant.", "Reply 'healthy'", {}
            )
            return result.error is None
        except Exception as e:
            logger.error(f"Health check exception: {e}")
            return False

    @property
    def model_name(self) -> str:
        return self.MODEL_NAME

    @property
    def supports_vision(self) -> bool:
        return True

    def _parse_json_response(self, text: str) -> dict[str, Any]:
        """Parse JSON from model response"""
        import re

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Extract JSON from markdown code blocks
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        return {"raw_output": text}
