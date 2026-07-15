"""
DeepSeek Provider - OpenRouter DeepSeek R1
Chain-of-thought reasoning - catches edge cases the other two miss
Chinese SOTA for full-stack, strong reasoning
"""

import time
import json
import logging
from typing import Any, Optional

from app.services.ai.providers.base import BaseAIProvider, ProviderResponse

logger = logging.getLogger("ai.deepseek")


class DeepSeekProvider(BaseAIProvider):
    """DeepSeek R1 via OpenRouter - Priority Free Tier"""

    MODEL_NAME = "deepseek/deepseek-r1"
    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self):
        from app.config import get_settings

        self.settings = get_settings()
        # Use OPENROUTER_API_KEY as priority - free tier
        self._api_key = (
            self.settings.OPENROUTER_API_KEY or self.settings.DEEPSEEK_API_KEY
        )

    async def call(
        self,
        system_prompt: str,
        user_prompt: str,
        payload: Optional[dict[str, Any]] = None,
    ) -> ProviderResponse:
        start = time.monotonic()

        try:
            import httpx

            full_prompt = f"{system_prompt}\n\nPatient Data:\n{json.dumps(payload) if payload else 'None'}\n\nQuestion:\n{user_prompt}"

            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    f"{self.OPENROUTER_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://afyahero.com",
                        "X-Title": "AfyaHero",
                    },
                    json={
                        "model": self.MODEL_NAME,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": full_prompt},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 1024,
                        "top_p": 0.95,
                    },
                )

            if response.status_code != 200:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                logger.warning(f"DeepSeek error: {error_msg}")
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
                confidence=parsed.get("confidence", 0.75),
                processing_ms=int((time.monotonic() - start) * 1000),
            )

        except Exception as e:
            logger.error(f"DeepSeek call failed: {e}")
            return ProviderResponse(
                model_name=self.MODEL_NAME,
                primary_recommendation="",
                full_output={},
                confidence=0.0,
                error=str(e),
                processing_ms=int((time.monotonic() - start) * 1000),
            )

    async def health_check(self) -> bool:
        """Check if DeepSeek is available"""
        try:
            result = await self.call(
                "You are a medical assistant.", "Reply 'healthy'", {}
            )
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

        # DeepSeek R1 includes reasoning, extract JSON after </think>
        if "</think>" in text:
            text = text.split("</think>")[-1]

        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        return {"raw_output": text.strip()}
