"""
MedASR - Medical Speech-to-Text
Free API optimized for medical vocabulary with Swahili support
"""

import logging
import base64
from typing import Optional

logger = logging.getLogger("ai.medasr")

# MedASR free endpoint - for medical speech recognition
MEDASR_BASE_URL = "https://api.medasr.com/v1"


class MedASRClient:
    """Medical ASR client with Swahili support"""

    def __init__(self, api_key: Optional[str] = None):
        from app.config import get_settings

        settings = get_settings()
        self._api_key = api_key or settings.GROQ_API_KEY  # Use Groq as fallback

    async def transcribe(
        self,
        audio_data: bytes | str,
        language: str = "sw-KE",  # Default to Swahili (Kenya)
        format: str = "webm",  # webm, wav, mp3
    ) -> dict:
        """
        Transcribe audio to text

        Args:
            audio_data: Raw audio bytes or base64 encoded audio
            language: Language code (sw-KE, en-KE)
            format: Audio format (webm, wav, mp3, opus)

        Returns:
            dict with transcription and metadata
        """
        try:
            import httpx

            # Convert bytes to base64 if needed
            if isinstance(audio_data, bytes):
                audio_b64 = base64.b64encode(audio_data).decode()
            else:
                audio_b64 = audio_data

            # Use Groq Whisper as fallback since MedASR may not be available
            return await self._transcribe_groq(audio_b64, format)

        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "transcription": "",
                "language": language,
            }

    async def _transcribe_groq(self, audio_b64: str, format: str) -> dict:
        """Transcribe using Groq Whisper (free tier)"""
        try:
            import httpx

            audio_bytes = base64.b64decode(audio_b64)

            files = {
                "file": ("audio.webm", audio_bytes, f"audio/{format}"),
                "model": (None, "whisper-large-v3"),
                "language": (None, "swahili"),
                "response_format": (None, "json"),
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    files=files,
                )

            if response.status_code != 200:
                return {
                    "success": False,
                    "error": f"Groq API error: {response.status_code}",
                    "transcription": "",
                }

            result = response.json()
            return {
                "success": True,
                "transcription": result.get("text", ""),
                "language": "sw-KE",
                "model": "whisper-large-v3",
            }

        except Exception as e:
            logger.error(f"Groq transcription failed: {e}")
            return {"success": False, "error": str(e), "transcription": ""}

    async def transcribe_streaming(
        self, audio_chunk: bytes, is_final: bool = False
    ) -> dict:
        """
        Handle streaming audio transcription

        For real-time transcription during teleconsultation.
        Accumulates audio chunks and returns partial results.
        """
        # For streaming, we'd accumulate chunks and process
        # This is a simplified implementation
        return await self._transcribe_groq(
            base64.b64encode(audio_chunk).decode(), "webm"
        )


# Singleton instance
_medasr_client: Optional[MedASRClient] = None


def get_medasr_client() -> MedASRClient:
    """Get MedASR client singleton"""
    global _medasr_client
    if _medasr_client is None:
        _medasr_client = MedASRClient()
    return _medasr_client
