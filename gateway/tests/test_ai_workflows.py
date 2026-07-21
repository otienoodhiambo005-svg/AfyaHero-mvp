"""
Integration tests for AI workflows
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import asyncio

from app.main import app
from app.services.ai.orchestrator import AIOrchestrator, AIRequest, AITask
from app.services.ai.cache import AIResponseCache


client = TestClient(app)


@pytest.fixture
def mock_ai_providers():
    """Mock AI providers for testing."""
    with patch('app.services.ai.orchestrator.AfyaMedicOrchestrator') as mock_medic:
        mock_instance = MagicMock()
        mock_instance.process = AsyncMock()
        mock_medic.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_cache():
    """Mock AI cache for testing."""
    with patch('app.services.ai.orchestrator.get_ai_cache') as mock_cache:
        mock_cache_instance = MagicMock(spec=AIResponseCache)
        mock_cache_instance.get = AsyncMock(return_value=None)
        mock_cache_instance.set = AsyncMock(return_value=True)
        mock_cache.return_value = mock_cache_instance
        yield mock_cache_instance


@pytest.mark.asyncio
async def test_triage_workflow(mock_ai_providers, mock_cache):
    """Test triage workflow execution."""
    # Setup mock response
    mock_ai_providers.process.return_value = {
        "task": AITask.TRIAGE,
        "output": {"urgency_level": 2, "recommendation": "See doctor"},
        "confidence": 0.95,
        "models_used": ["llama_405b"],
        "consensus_reached": True,
        "dissenting_models": [],
        "requires_clinician_review": False,
        "offline_queued": False,
        "processing_ms": 100,
        "cached": False
    }
    
    # Create orchestrator
    orchestrator = AIOrchestrator()
    
    # Create request
    request = AIRequest(
        task=AITask.TRIAGE,
        hospital_id="test-hospital",
        user_id="test-user",
        payload={"symptoms": ["fever", "cough"], "age": 35}
    )
    
    # Execute workflow
    result = await orchestrator.process(request)
    
    # Verify result
    assert result.task == AITask.TRIAGE
    assert result.confidence >= 0.0
    assert isinstance(result.models_used, list)
    assert isinstance(result.processing_ms, int)


@pytest.mark.asyncio
async def test_diagnosis_workflow(mock_ai_providers, mock_cache):
    """Test diagnosis workflow execution."""
    # Setup mock response
    mock_ai_providers.process.return_value = {
        "task": AITask.DIFFERENTIAL,
        "output": {"diagnosis": ["Malaria", "Typhoid"], "confidence": [0.8, 0.7]},
        "confidence": 0.9,
        "models_used": ["llama_405b", "qwen_32b"],
        "consensus_reached": True,
        "dissenting_models": [],
        "requires_clinician_review": False,
        "offline_queued": False,
        "processing_ms": 150,
        "cached": False
    }
    
    # Create orchestrator
    orchestrator = AIOrchestrator()
    
    # Create request
    request = AIRequest(
        task=AITask.DIFFERENTIAL,
        hospital_id="test-hospital",
        user_id="test-user",
        payload={"symptoms": ["fever", "headache", "chills"], "age": 25}
    )
    
    # Execute workflow
    result = await orchestrator.process(request)
    
    # Verify result
    assert result.task == AITask.DIFFERENTIAL
    assert len(result.models_used) >= 1
    assert result.consensus_reached is True


@pytest.mark.asyncio
async def test_ai_cache_integration():
    """Test AI response caching."""
    from app.services.ai.cache import AIResponseCache, get_ai_cache
    
    # Create cache instance
    cache = AIResponseCache(redis_client=None, ttl=300)
    
    # Test cache set and get
    test_data = {"test": "data"}
    
    # Mock redis
    with patch.object(cache, 'redis', None):
        # Without Redis, cache should return None
        result = await cache.get("hospital", "provider", "model", "prompt", {})
        assert result is None


@pytest.mark.asyncio
async def test_circuit_breaker_integration():
    """Test circuit breaker functionality."""
    from app.services.ai.cache.circuit_breaker import AICircuitBreaker, CircuitBreakerOpenError
    
    # Create circuit breaker
    breaker = AICircuitBreaker("test-provider")
    
    # Test initial state
    assert breaker.state.value == "closed"
    
    # Test successful call
    async def successful_func():
        return "success"
    
    result = await breaker.call(successful_func)
    assert result == "success"
    
    # Test failure handling
    async def failing_func():
        raise Exception("Test error")
    
    # Call multiple times to trigger circuit breaker
    for _ in range(3):
        try:
            await breaker.call(failing_func)
        except Exception:
            pass
    
    # Circuit should be open now
    assert breaker.state.value == "open"
    
    # Next call should fail with CircuitBreakerOpenError
    with pytest.raises(CircuitBreakerOpenError):
        await breaker.call(successful_func)


@pytest.mark.asyncio
async def test_health_endpoints():
    """Test health check endpoints."""
    # Test basic health check
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    
    # Test AI health check
    response = client.get("/health/ai")
    assert response.status_code == 200
    assert "providers" in response.json()


@pytest.mark.asyncio
async def test_metrics_endpoint():
    """Test metrics endpoint."""
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "Content-Type" in response.headers
    assert "text/plain" in response.headers["Content-Type"]


@pytest.mark.asyncio
async def test_request_id_middleware():
    """Test request ID middleware."""
    # Make a request
    response = client.get("/health")
    
    # Check for request ID in response headers
    assert "X-Request-ID" in response.headers
    assert len(response.headers["X-Request-ID"]) > 0


@pytest.mark.asyncio
async def test_error_handling():
    """Test global error handling."""
    # Trigger an error by accessing a non-existent endpoint
    response = client.get("/nonexistent")
    
    # Should return 404
    assert response.status_code == 404
    
    # Should have error response
    assert "error" in response.json() or "detail" in response.json()
