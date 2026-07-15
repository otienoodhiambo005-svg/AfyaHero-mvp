"""
OpenRouter Specialized Provider
Supports Llama 3.1 405B, Qwen-1.5 32B, and Llama 3.1 70B trio.
Also used for complex case cascades (Claude 3.7, GPT-5).
"""

import time
import json
import logging
from typing import Any, Optional

from app.services.ai.providers.base import BaseAIProvider, ProviderResponse

logger = logging.getLogger("ai.openrouter")

class OpenRouterSpecializedProvider(BaseAIProvider):
    """Bridge for SOTA models via OpenRouter"""

    DEFAULT_MODELS = {
        "llama_405b": "meta-llama/llama-3.1-405b-instruct",
        "qwen_32b": "qwen/qwen-1.5-32b-chat",
        "llama_70b": "meta-llama/llama-3.1-70b-instruct",
        "claude_opus": "anthropic/claude-3-opus-20240229",
        "gpt_5": "openai/gpt-5-preview" # Placeholder for future release
    }

    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self, model_key: str = "llama_405b"):
        from app.config import get_settings
        self.settings = get_settings()
        self._api_key = self.settings.OPENROUTER_API_KEY
        self.model_id = self.DEFAULT_MODELS.get(model_key, model_key)

    async def call(
        self,
        system_prompt: str,
        user_prompt: str,
        payload: Optional[dict[str, Any]] = None,
    ) -> ProviderResponse:
        start = time.monotonic()
        if not self._api_key:
            return ProviderResponse(
                model_name=self.model_id,
                primary_recommendation="",
                full_output={},
                confidence=0.0,
                error="OPENROUTER_API_KEY missing"
            )

        try:
            import httpx
            full_prompt = f"{system_prompt}\n\nPatient Context:\n{json.dumps(payload)}\n\nQuery:\n{user_prompt}"

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.OPENROUTER_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://afyahero.com",
                        "X-Title": "AfyaHero Clinical",
                    },
                    json={
                        "model": self.model_id,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": full_prompt},
                        ],
                        "temperature": 0.2, # Stable clinical output
                        "max_tokens": 2048,
                    },
                )

            if response.status_code != 200:
                return ProviderResponse(
                    model_name=self.model_id,
                    primary_recommendation="",
                    full_output={},
                    confidence=0.0,
                    error=f"OR Error {response.status_code}: {response.text}",
                    processing_ms=int((time.monotonic() - start) * 1000)
                )

            result = response.json()
            text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            parsed = self._parse_json(text)

            return ProviderResponse(
                model_name=self.model_id,
                primary_recommendation=parsed.get("urgency_level", ""),
                full_output=parsed,
                confidence=parsed.get("confidence", 0.9),
                processing_ms=int((time.monotonic() - start) * 1000)
            )

        except Exception as e:
            return ProviderResponse(
                model_name=self.model_id,
                primary_recommendation="",
                full_output={},
                confidence=0.0,
                error=str(e),
                processing_ms=int((time.monotonic() - start) * 1000)
            )

    @property
    def model_name(self) -> str:
        return self.model_id

    @property
    def supports_vision(self) -> bool:
        return "gpt" in self.model_id.lower() or "claude" in self.model_id.lower()

    async def health_check(self) -> bool:
        return True

    def _parse_json(self, text: str) -> dict:
        import re
        try:
            return json.loads(text)
        except:
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                try: return json.loads(match.group())
                except: pass
        return {"raw": text}
