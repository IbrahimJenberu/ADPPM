from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, Optional, TypeVar
import time
T = TypeVar("T")

class CacheKey(str, Enum):
    """Cache key prefixes."""
    PERMISSIONS = "permissions:"
    USER = "user:"
    MFA_SETUP = "mfa_setup:"
    MFA_PENDING = "mfa_pending:"
    OAUTH_CODE = "oauth_code:"
    DEVICE_CODE = "device_code:"
    USER_CODE = "user_code:"

class Cache:
    """Simple in-memory cache with TTL support."""
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        
    async def get(self, key: str) -> Optional[Any]:
        """Get a value from the cache."""
        if key not in self._cache:
            return None
            
        entry = self._cache[key]
        
        # Check if expired
        if "expires_at" in entry and time.time() > entry["expires_at"]:
            del self._cache[key]
            return None
        
        return entry["value"]
        
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set a value in the cache with optional TTL in seconds."""
        entry = {"value": value}
        
        if ttl is not None:
            entry["expires_at"] = time.time() + ttl
        
        self._cache[key] = entry
        
    async def delete(self, key: str) -> bool:
        """Delete a value from the cache."""
        if key in self._cache:
            del self._cache[key]
            return True
        return False
        
    async def exists(self, key: str) -> bool:
        """Check if a key exists in the cache."""
        if key not in self._cache:
            return False
            
        entry = self._cache[key]
        
        # Check if expired
        if "expires_at" in entry and time.time() > entry["expires_at"]:
            del self._cache[key]
            return False
            
        return True

# Create global cache instance
cache = Cache()

def cached(key_prefix: str, ttl: Optional[int] = None):
    """
    Decorator to cache function results.
    
    Args:
        key_prefix: Prefix for cache keys
        ttl: Time-to-live in seconds
        
    Returns:
        Decorated function
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            key_parts = [key_prefix]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)
            
            # Check cache
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value
                
            # Call function
            result = await func(*args, **kwargs)
            
            # Cache result
            await cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator