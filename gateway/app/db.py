from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from supabase import create_client, Client
from functools import lru_cache
import redis.asyncio as redis

from app.config import get_settings

settings = get_settings()

# Supabase clients (for Auth, Storage, Realtime)
_admin_client: Client | None = None
_anon_client: Client | None = None

# SQLAlchemy async engine (connects to Supabase PostgreSQL)
_async_engine = None
_async_session_factory = None

# Redis client (optional - Supabase Realtime can replace)
_redis_client = None


async def init_supabase() -> None:
    """Initialize Supabase clients for Auth, Storage, Realtime"""
    global _admin_client, _anon_client
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        _admin_client = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
        )
        _anon_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


async def init_async_engine() -> None:
    """Initialize SQLAlchemy async engine connecting to Supabase PostgreSQL"""
    global _async_engine, _async_session_factory

    db_url = settings.DATABASE_URL

    if not db_url or "localhost" in db_url:
        # Dev mode - skip DB connection
        return

    _async_engine = create_async_engine(
        db_url,
        echo=settings.DEBUG,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )
    _async_session_factory = sessionmaker(
        bind=_async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def init_redis() -> None:
    """Initialize Redis client (optional - Supabase Realtime can replace)"""
    global _redis_client
    if settings.REDIS_URL:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


def get_admin_client() -> Client:
    """Get Supabase admin client (service role)"""
    if _admin_client is None:
        raise RuntimeError("Supabase not initialized")
    return _admin_client


def get_anon_client() -> Client:
    """Get Supabase anon client"""
    if _anon_client is None:
        raise RuntimeError("Supabase not initialized")
    return _anon_client


async def get_async_session() -> AsyncSession:
    """Get SQLAlchemy async session (for DB queries)"""
    if _async_session_factory is None:
        raise RuntimeError("Database engine not initialized")
    async with _async_session_factory() as session:
        yield session


def get_redis() -> redis.Redis | None:
    """Get Redis client (optional)"""
    return _redis_client
