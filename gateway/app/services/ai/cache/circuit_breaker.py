"""
Circuit Breaker for AI Providers
Prevents cascading failures when AI providers are down or slow.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, Optional, TypeVar

logger = logging.getLogger("afyahero.ai.circuit_breaker")

T = TypeVar('T')


class CircuitState(Enum):
    """States of the circuit breaker."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, requests are blocked
    HALF_OPEN = "half_open"  # Testing if provider has recovered


@dataclass
class CircuitBreakerConfig:
    """Configuration for the circuit breaker."""
    fail_max: int = 3              # Max failures before opening
    reset_timeout: int = 60       # Seconds before retrying
    half_open_max_calls: int = 1  # Max calls allowed in half-open state
    slow_call_threshold: float = 2.0  # Seconds to consider a call slow
    slow_call_rate: float = 0.5   # Rate of slow calls to trigger opening
    
    # Exceptions that should not count as failures
    excluded_exceptions: tuple = ()
    
    # Exceptions that should always trigger opening
    critical_exceptions: tuple = ()


@dataclass
class CircuitStats:
    """Statistics for the circuit breaker."""
    failures: int = 0
    successes: int = 0
    slow_calls: int = 0
    total_calls: int = 0
    last_failure_time: Optional[float] = None
    last_success_time: Optional[float] = None
    state_changes: Dict[str, int] = field(default_factory=dict)


class AICircuitBreaker:
    """
    Circuit breaker for AI providers.
    
    Features:
    - Tracks failures and opens circuit when threshold is reached
    - Automatically retries after reset timeout (half-open state)
    - Tracks slow calls and can open circuit based on response time
    - Provides metrics and statistics
    """
    
    def __init__(
        self,
        name: str,
        config: Optional[CircuitBreakerConfig] = None
    ):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.state = CircuitState.CLOSED
        self.stats = CircuitStats()
        self._lock = asyncio.Lock()
        self._half_open_calls = 0
        self._last_state_change = time.time()
    
    def _should_exclude_exception(self, exception: Exception) -> bool:
        """Check if exception should be excluded from failure count."""
        return isinstance(exception, self.config.excluded_exceptions)
    
    def _is_critical_exception(self, exception: Exception) -> bool:
        """Check if exception is critical and should immediately open circuit."""
        return isinstance(exception, self.config.critical_exceptions)
    
    def _should_open_for_slow_calls(self) -> bool:
        """Check if circuit should open due to slow calls."""
        if self.stats.total_calls == 0:
            return False
        
        slow_rate = self.stats.slow_calls / self.stats.total_calls
        return slow_rate >= self.config.slow_call_rate
    
    def _can_retry(self) -> bool:
        """Check if enough time has passed to retry."""
        return (time.time() - self._last_state_change) >= self.config.reset_timeout
    
    async def call(
        self,
        func: Callable[..., Coroutine[Any, Any, T]],
        *args,
        **kwargs
    ) -> T:
        """
        Execute a function with circuit breaker protection.
        
        Args:
            func: The async function to call
            *args: Positional arguments for the function
            **kwargs: Keyword arguments for the function
            
        Returns:
            The result of the function
            
        Raises:
            CircuitBreakerOpenError: If circuit is open
            CircuitBreakerTimeoutError: If call times out
            Exception: Any exception from the function
        """
        async with self._lock:
            # Check if circuit is open
            if self.state == CircuitState.OPEN:
                if not self._can_retry():
                    self.stats.state_changes[self.state.value] = \
                        self.stats.state_changes.get(self.state.value, 0) + 1
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker '{self.name}' is open. "
                        f"Retry after {self.config.reset_timeout} seconds."
                    )
                
                # Transition to half-open state
                self.state = CircuitState.HALF_OPEN
                self._last_state_change = time.time()
                self._half_open_calls = 0
                self.stats.state_changes[self.state.value] = \
                    self.stats.state_changes.get(self.state.value, 0) + 1
        
        # Execute the function
        start_time = time.time()
        
        try:
            result = await func(*args, **kwargs)
            
            # Check if call was slow
            elapsed = time.time() - start_time
            is_slow = elapsed >= self.config.slow_call_threshold
            
            async with self._lock:
                self.stats.successes += 1
                self.stats.total_calls += 1
                self.stats.last_success_time = time.time()
                
                if is_slow:
                    self.stats.slow_calls += 1
                    logger.warning(
                        f"Circuit '{self.name}': Slow call detected "
                        f"({elapsed:.2f}s >= {self.config.slow_call_threshold}s)"
                    )
                
                # Handle state transitions
                if self.state == CircuitState.HALF_OPEN:
                    self._half_open_calls += 1
                    
                    # If we've made enough calls in half-open state, transition to closed
                    if self._half_open_calls >= self.config.half_open_max_calls:
                        self.state = CircuitState.CLOSED
                        self._last_state_change = time.time()
                        self.stats.state_changes[self.state.value] = \
                            self.stats.state_changes.get(self.state.value, 0) + 1
                        logger.info(f"Circuit '{self.name}': Transitioned to CLOSED")
                
                # Check if we should open due to slow calls
                if self.state == CircuitState.CLOSED and self._should_open_for_slow_calls():
                    self.state = CircuitState.OPEN
                    self._last_state_change = time.time()
                    self.stats.state_changes[self.state.value] = \
                        self.stats.state_changes.get(self.state.value, 0) + 1
                    logger.warning(
                        f"Circuit '{self.name}': Opened due to slow calls "
                        f"({self.stats.slow_calls}/{self.stats.total_calls})"
                    )
            
            return result
            
        except Exception as e:
            async with self._lock:
                self.stats.failures += 1
                self.stats.total_calls += 1
                self.stats.last_failure_time = time.time()
                
                # Check if we should exclude this exception
                if self._should_exclude_exception(e):
                    logger.debug(f"Circuit '{self.name}': Excluded exception: {type(e).__name__}")
                    raise
                
                # Check if this is a critical exception
                if self._is_critical_exception(e):
                    self.state = CircuitState.OPEN
                    self._last_state_change = time.time()
                    self.stats.state_changes[self.state.value] = \
                        self.stats.state_changes.get(self.state.value, 0) + 1
                    logger.error(f"Circuit '{self.name}': Opened due to critical exception: {type(e).__name__}")
                    raise
                
                # Check if we should open the circuit
                if self.state == CircuitState.CLOSED and \
                   self.stats.failures >= self.config.fail_max:
                    self.state = CircuitState.OPEN
                    self._last_state_change = time.time()
                    self.stats.state_changes[self.state.value] = \
                        self.stats.state_changes.get(self.state.value, 0) + 1
                    logger.error(
                        f"Circuit '{self.name}': Opened after {self.stats.failures} failures. "
                        f"Retry after {self.config.reset_timeout} seconds."
                    )
                
                # In half-open state, any failure opens the circuit again
                if self.state == CircuitState.HALF_OPEN:
                    self.state = CircuitState.OPEN
                    self._last_state_change = time.time()
                    self.stats.state_changes[self.state.value] = \
                        self.stats.state_changes.get(self.state.value, 0) + 1
                    logger.error(
                        f"Circuit '{self.name}': Half-open call failed, reopened circuit"
                    )
            
            raise
    
    def reset(self) -> None:
        """Manually reset the circuit breaker to closed state."""
        with self._lock:
            self.state = CircuitState.CLOSED
            self._last_state_change = time.time()
            self._half_open_calls = 0
            self.stats = CircuitStats()
            logger.info(f"Circuit '{self.name}': Manually reset to CLOSED")
    
    def force_open(self) -> None:
        """Manually force the circuit breaker to open state."""
        with self._lock:
            self.state = CircuitState.OPEN
            self._last_state_change = time.time()
            logger.info(f"Circuit '{self.name}': Manually forced to OPEN")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get circuit breaker statistics."""
        return {
            "name": self.name,
            "state": self.state.value,
            "stats": {
                "failures": self.stats.failures,
                "successes": self.stats.successes,
                "slow_calls": self.stats.slow_calls,
                "total_calls": self.stats.total_calls,
                "failure_rate": (self.stats.failures / self.stats.total_calls * 100) \
                    if self.stats.total_calls > 0 else 0,
                "slow_call_rate": (self.stats.slow_calls / self.stats.total_calls * 100) \
                    if self.stats.total_calls > 0 else 0,
            },
            "config": {
                "fail_max": self.config.fail_max,
                "reset_timeout": self.config.reset_timeout,
                "half_open_max_calls": self.config.half_open_max_calls,
                "slow_call_threshold": self.config.slow_call_threshold,
                "slow_call_rate": self.config.slow_call_rate,
            },
            "state_changes": self.stats.state_changes,
            "time_in_current_state": time.time() - self._last_state_change
        }


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open and requests are blocked."""
    pass


class CircuitBreakerTimeoutError(Exception):
    """Raised when a call times out."""
    pass


# Global circuit breaker instances for AI providers
_ai_breakers: Dict[str, AICircuitBreaker] = {}


def get_circuit_breaker(provider_name: str, config: Optional[CircuitBreakerConfig] = None) -> AICircuitBreaker:
    """Get or create a circuit breaker for an AI provider."""
    if provider_name not in _ai_breakers:
        _ai_breakers[provider_name] = AICircuitBreaker(provider_name, config)
        logger.info(f"Created circuit breaker for provider: {provider_name}")
    
    return _ai_breakers[provider_name]


# Default circuit breaker for AI providers
# Configured with provider-specific settings
AI_PROVIDER_CONFIGS = {
    "openai": CircuitBreakerConfig(
        fail_max=3,
        reset_timeout=60,
        half_open_max_calls=2,
        slow_call_threshold=5.0,
        slow_call_rate=0.3
    ),
    "groq": CircuitBreakerConfig(
        fail_max=5,
        reset_timeout=30,
        half_open_max_calls=1,
        slow_call_threshold=10.0,
        slow_call_rate=0.5
    ),
    "anthropic": CircuitBreakerConfig(
        fail_max=3,
        reset_timeout=60,
        half_open_max_calls=2,
        slow_call_threshold=5.0,
        slow_call_rate=0.3
    ),
    "gemini": CircuitBreakerConfig(
        fail_max=4,
        reset_timeout=45,
        half_open_max_calls=2,
        slow_call_threshold=8.0,
        slow_call_rate=0.4
    ),
    "llama": CircuitBreakerConfig(
        fail_max=5,
        reset_timeout=30,
        half_open_max_calls=1,
        slow_call_threshold=15.0,
        slow_call_rate=0.6
    ),
    "default": CircuitBreakerConfig(
        fail_max=3,
        reset_timeout=60,
        half_open_max_calls=1,
        slow_call_threshold=10.0,
        slow_call_rate=0.5
    )
}


def ai_breaker(provider_name: str) -> AICircuitBreaker:
    """Get the circuit breaker for a specific AI provider."""
    config = AI_PROVIDER_CONFIGS.get(provider_name, AI_PROVIDER_CONFIGS["default"])
    return get_circuit_breaker(provider_name, config)


async def reset_all_breakers() -> None:
    """Reset all circuit breakers."""
    for breaker in _ai_breakers.values():
        breaker.reset()
    logger.info(f"Reset {len(_ai_breakers)} circuit breakers")


async def get_all_breaker_stats() -> Dict[str, Dict[str, Any]]:
    """Get statistics for all circuit breakers."""
    return {name: breaker.get_stats() for name, breaker in _ai_breakers.items()}
