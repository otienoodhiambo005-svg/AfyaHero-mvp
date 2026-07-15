"""
Google Gemma 4 26B A4B via OpenRouter (Free Tier)
High performance open source MoE model from Google via OpenRouter free credits
gemma-4-26b-a4b-it: 26B MoE, 3.8B active, near-31B quality at fraction of compute
Released April 3, 2026 - FREE on OpenRouter
"""

import time
import json
import logging
from typing import Any, Optional

from app.services.ai.providers.base import BaseAIProvider, ProviderResponse

logger = logging.getLogger("ai.gemma")


class GemmaProvider(BaseAIProvider):
    """Google Gemma 4 26B A4B via OpenRouter - Free Tier

    Gemma 4 26B A4B IT (Mixture-of-Experts) - near-31B quality at fraction of compute.
    FREE on OpenRouter as of April 3, 2026.
    """

    MODEL_NAME = "google/gemma-4-26b-a4b-it"
    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self):
        from app.config import get_settings

        self.settings = get_settings()
        # Use OpenRouter API key (free tier)
        self._api_key = self.settings.OPENROUTER_API_KEY

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://afyahero.com",
            "X-Title": "AfyaHero",
        }

    async def call(
        self,
        system_prompt: str,
        user_prompt: str,
        payload: Optional[dict[str, Any]] = None,
    ) -> ProviderResponse:
        start = time.monotonic()

        try:
            import httpx

            full_prompt = f"{system_prompt}\n\nPatient Data:\n{json.dumps(payload) if payload else 'None'}\n\nQuery:\n{user_prompt}"

            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(
                    f"{self.OPENROUTER_BASE_URL}/chat/completions",
                    headers=self._get_headers(),
                    json={
                        "model": self.MODEL_NAME,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": full_prompt},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 2048,
                        "top_p": 0.95,
                    },
                )

            if response.status_code != 200:
                error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                logger.warning(f"Gemma OpenRouter error: {error_msg}")
                return ProviderResponse(
                    model_name=self.MODEL_NAME,
                    primary_recommendation="",
                    full_output={},
                    confidence=0.0,
                    error=error_msg,
                    processing_ms=int((time.monotonic() - start) * 1000),
                )

            result = response.json()
            text = result.get("choices", [{}])[0].get("message", {}).get("content", "")

            parsed = self._parse_json_response(text)

            return ProviderResponse(
                model_name=self.MODEL_NAME,
                primary_recommendation=parsed.get(
                    "urgency_level", parsed.get("recommended_action", "")
                ),
                full_output=parsed,
                confidence=parsed.get("confidence", 0.80),
                processing_ms=int((time.monotonic() - start) * 1000),
            )

        except Exception as e:
            logger.error(f"Gemma call failed: {e}")
            return ProviderResponse(
                model_name=self.MODEL_NAME,
                primary_recommendation="",
                full_output={},
                confidence=0.0,
                error=str(e),
                processing_ms=int((time.monotonic() - start) * 1000),
            )

    async def health_check(self) -> bool:
        """Check if Gemma is available"""
        try:
            result = await self.call("You are a medical assistant.", "Reply 'ok'", {})
            return result.error is None
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
