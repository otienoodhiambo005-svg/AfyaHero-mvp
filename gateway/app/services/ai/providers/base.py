from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class ProviderResponse:
    model_name: str
    primary_recommendation: str
    full_output: dict[str, Any]
    confidence: float
    error: Optional[str] = None
    processing_ms: int = 0


class BaseAIProvider(ABC):
    """
    Abstract base class for all AI providers.
    All AI providers must implement this interface.
    Clinical logic never depends on specific provider implementations.
    """

    @abstractmethod
    async def call(
        self,
        system_prompt: str,
        user_prompt: str,
        payload: Optional[dict[str, Any]] = None
    ) -> ProviderResponse:
        """
        Call the AI provider with given prompts.
        Must never raise exceptions - return error in ProviderResponse instead.
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider is available and responding"""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return canonical model identifier"""
        pass

    @property
    @abstractmethod
    def supports_vision(self) -> bool:
        """Return True if model supports image analysis"""
        pass