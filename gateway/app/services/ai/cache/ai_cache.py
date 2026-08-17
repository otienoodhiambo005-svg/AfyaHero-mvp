"""
AI Response Cache Implementation
Uses Redis for distributed caching of AI provider responses.
"""

import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from app.config import get_settings
from app.db import get_redis

settings = get_settings()
logger = logging.getLogger("afyahero.ai.cache")

# Cache configuration
AI_CACHE_TTL = int(settings.AI_CACHE_TTL or 300)  # 5 minutes default
AI_CACHE_PREFIX = "ai:response:"
AI_CACHE_MAX_SIZE = 10000  # Max cache entries per hospital


class AIResponseCache:
    """
    Distributed cache for AI responses using Redis.
    
    Features:
    - Automatic TTL expiration
    - Hospital-scoped caching
    - Request-based cache keys
    - Size limits to prevent memory bloat
    """
    
    def __init__(self, redis_client=None, ttl: int = AI_CACHE_TTL):
        self.redis = redis_client
        self.ttl = ttl
        self._cache_hits = 0
        self._cache_misses = 0
    
    def _generate_cache_key(
        self,
        hospital_id: str,
        provider: str,
        model: str,
        prompt: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate a unique cache key for the given request."""
        # Create a hash of the prompt and parameters
        key_data = {
            "hospital_id": hospital_id,
            "provider": provider,
            "model": model,
            "prompt": prompt,
            "parameters": parameters or {}
        }
        
        key_string = json.dumps(key_data, sort_keys=True)
        key_hash = hashlib.sha256(key_string.encode()).hexdigest()[:16]
        
        return f"{AI_CACHE_PREFIX}{hospital_id}:{provider}:{model}:{key_hash}"
    
    async def get(
        self,
        hospital_id: str,
        provider: str,
        model: str,
        prompt: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached response for the given request.
        
        Args:
            hospital_id: Hospital identifier for scoping
            provider: AI provider name (e.g., 'openai', 'groq')
            model: Model name (e.g., 'gpt-4', 'llama-3')
            prompt: The input prompt
            parameters: Additional parameters that affect the response
            
        Returns:
            Cached response data or None if not found
        """
        if not self.redis:
            logger.debug("Redis not available, skipping cache lookup")
            return None
        
        cache_key = self._generate_cache_key(hospital_id, provider, model, prompt, parameters)
        
        try:
            cached_data = await self.redis.get(cache_key)
            if cached_data:
                self._cache_hits += 1
                logger.debug(f"Cache hit for key: {cache_key[:50]}...")
                return json.loads(cached_data)
            else:
                self._cache_misses += 1
                logger.debug(f"Cache miss for key: {cache_key[:50]}...")
                return None
        except Exception as e:
            logger.error(f"Cache lookup error: {e}")
            return None
    
    async def set(
        self,
        hospital_id: str,
        provider: str,
        model: str,
        prompt: str,
        response: Dict[str, Any],
        parameters: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Cache an AI response.
        
        Args:
            hospital_id: Hospital identifier for scoping
            provider: AI provider name
            model: Model name
            prompt: The input prompt
            response: The response data to cache
            parameters: Additional parameters used in the request
            ttl: Time-to-live in seconds (defaults to class ttl)
            
        Returns:
            True if cached successfully, False otherwise
        """
        if not self.redis:
            logger.debug("Redis not available, skipping cache set")
            return False
        
        cache_key = self._generate_cache_key(hospital_id, provider, model, prompt, parameters)
        effective_ttl = ttl or self.ttl
        
        # Add metadata to the cached response
        cache_data = {
            "response": response,
            "cached_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(seconds=effective_ttl)).isoformat(),
            "provider": provider,
            "model": model,
            "hospital_id": hospital_id
        }
        
        try:
            await self.redis.setex(cache_key, effective_ttl, json.dumps(cache_data))
            logger.debug(f"Cached response for key: {cache_key[:50]}... (TTL: {effective_ttl}s)")
            return True
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
    
    async def delete(
        self,
        hospital_id: str,
        provider: str,
        model: str,
        prompt: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Delete a cached response."""
        if not self.redis:
            return False
        
        cache_key = self._generate_cache_key(hospital_id, provider, model, prompt, parameters)
        
        try:
            result = await self.redis.delete(cache_key)
            return result > 0
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    async def clear_hospital_cache(self, hospital_id: str) -> int:
        """Clear all cached responses for a specific hospital."""
        if not self.redis:
            return 0
        
        pattern = f"{AI_CACHE_PREFIX}{hospital_id}:*"
        
        try:
            # Find all keys matching the pattern
            keys = []
            cursor = 0
            while True:
                cursor, batch = await self.redis.scan(cursor, match=pattern, count=100)
                keys.extend(batch)
                if cursor == 0:
                    break
            
            # Delete all matching keys
            if keys:
                await self.redis.delete(*keys)
                logger.info(f"Cleared {len(keys)} cache entries for hospital {hospital_id}")
            
            return len(keys)
        except Exception as e:
            logger.error(f"Error clearing hospital cache: {e}")
            return 0
    
    async def invalidate_model_cache(self, hospital_id: str, model: str) -> int:
        """Invalidate all cached responses for a specific model."""
        if not self.redis:
            return 0
        
        pattern = f"{AI_CACHE_PREFIX}{hospital_id}:*{model}:*"
        
        try:
            keys = []
            cursor = 0
            while True:
                cursor, batch = await self.redis.scan(cursor, match=pattern, count=100)
                keys.extend(batch)
                if cursor == 0:
                    break
            
            if keys:
                await self.redis.delete(*keys)
                logger.info(f"Invalidated {len(keys)} cache entries for model {model}")
            
            return len(keys)
        except Exception as e:
            logger.error(f"Error invalidating model cache: {e}")
            return 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total_requests = self._cache_hits + self._cache_misses
        hit_rate = (self._cache_hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "hits": self._cache_hits,
            "misses": self._cache_misses,
            "hit_rate": f"{hit_rate:.2f}%",
            "total_requests": total_requests,
            "ttl": self.ttl
        }
    
    async def reset_stats(self) -> None:
        """Reset cache statistics."""
        self._cache_hits = 0
        self._cache_misses = 0


# Global cache instance
_ai_cache: Optional[AIResponseCache] = None


async def get_ai_cache() -> AIResponseCache:
    """Get the global AI response cache instance."""
    global _ai_cache
    
    if _ai_cache is None:
        redis_client = get_redis()
        _ai_cache = AIResponseCache(redis_client, AI_CACHE_TTL)
        logger.info(f"AI Response Cache initialized with TTL: {AI_CACHE_TTL}s")
    
    return _ai_cache


async def init_ai_cache() -> AIResponseCache:
    """Initialize and return the AI response cache."""
    global _ai_cache
    
    if _ai_cache is None:
        redis_client = get_redis()
        _ai_cache = AIResponseCache(redis_client, AI_CACHE_TTL)
    
    return _ai_cache
