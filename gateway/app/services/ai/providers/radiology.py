"""
Radiology Provider
Supports Aidoc ICH, Viz.ai LVO, VisiRad CXR, and Open Source Fallbacks (MedGemma).
"""

import time
import json
import logging
import base64
from typing import Any, Optional

from app.services.ai.providers.base import BaseAIProvider, ProviderResponse

logger = logging.getLogger("ai.radiology")

class RadiologyProvider(BaseAIProvider):
    """
    Diagnostic Imaging Provider with Vendor Routing.
    Routes to specialized APIs if available, cascades to MedGemma/Open Source.
    """

    VENDOR_MODELS = {
        "aidoc_ich": "aidoc/ich-detect",
        "viz_lvo": "vizai/lvo-detect",
        "visirad_cxr": "imidex/visirad-cxr",
        "medgemma": "google/medgemma-1.5",
        "llava_fallback": "liuhaotian/llava-v1.6-34b"
    }

    def __init__(self, mode: str = "general"):
        from app.config import get_settings
        self.settings = get_settings()
        self.mode = mode

    async def call(
        self,
        system_prompt: str,
        user_prompt: str,
        payload: Optional[dict[str, Any]] = None,
    ) -> ProviderResponse:
        start = time.monotonic()
        
        # 1. Identify Modality & Target Vendor
        modality = payload.get("modality", "unknown").lower() if payload else "unknown"
        image_data = payload.get("image_b64") if payload else None
        
        vendor_resp = None
        
        # 2. Priority Vendor Routing
        if modality == "ct_head" and "ich" in user_prompt.lower():
            vendor_resp = await self._call_vendor("aidoc_ich", payload)
        elif modality == "ct_angiogram" and "lvo" in user_prompt.lower():
            vendor_resp = await self._call_vendor("viz_lvo", payload)
        elif modality == "cxr":
            vendor_resp = await self._call_vendor("visirad_cxr", payload)

        # 3. Open Source Fallback
        if not vendor_resp or vendor_resp.error:
            logger.info("Routing to Open Source Radiology Fallback (MedGemma/LLaVA)")
            vendor_resp = await self._call_open_source(system_prompt, user_prompt, payload)

        return vendor_resp

    async def _call_vendor(self, vendor_key: str, payload: dict) -> Optional[ProviderResponse]:
        """Placeholder for actual vendor API integration"""
        # In a real implementation, we would call Aidoc/Viz.ai/IMIDEX endpoints here
        # For now, we simulate the routing logic
        logger.warning(f"Vendor API for {vendor_key} not configured. Falling back.")
        return None

    async def _call_open_source(self, sys: str, user: str, payload: dict) -> ProviderResponse:
        """Call MedGemma or LLaVA-Med via Vertex/OpenRouter"""
        from app.services.ai.providers.medgemma import MedGemmaProvider
        
        # If image is present, use vision-capable MedGemma
        medgemma = MedGemmaProvider()
        return await medgemma.call(sys, user, payload)

    @property
    def model_name(self) -> str:
        return "radiology-router-v1"

    @property
    def supports_vision(self) -> bool:
        return True

    async def health_check(self) -> bool:
        return True
