from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession as SQLAlchemyAsyncSession
from supabase import create_client, Client
from functools import lru_cache
import redis.asyncio as redis
import logging
from typing import AsyncGenerator

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("afyahero.db")

# Database Configuration Constants
DATABASE_POOL_SIZE = 20
DATABASE_MAX_OVERFLOW = 10
DATABASE_POOL_TIMEOUT = 30
DATABASE_POOL_RECYCLE = 3600
DATABASE_POOL_PRE_PING = True

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
        logger.info("Supabase clients initialized")


async def init_async_engine() -> None:
    """Initialize SQLAlchemy async engine connecting to Supabase PostgreSQL with optimized connection pooling"""
    global _async_engine, _async_session_factory

    db_url = settings.DATABASE_URL

    if not db_url or "localhost" in db_url:
        # Dev mode - skip DB connection
        logger.warning("Database connection skipped in dev mode")
        return

    logger.info(f"Initializing database connection pool: size={DATABASE_POOL_SIZE}, max_overflow={DATABASE_MAX_OVERFLOW}")

    _async_engine = create_async_engine(
        db_url,
        echo=settings.DEBUG,
        pool_size=DATABASE_POOL_SIZE,
        max_overflow=DATABASE_MAX_OVERFLOW,
        pool_timeout=DATABASE_POOL_TIMEOUT,
        pool_recycle=DATABASE_POOL_RECYCLE,
        pool_pre_ping=DATABASE_POOL_PRE_PING,
    )
    
    _async_session_factory = sessionmaker(
        bind=_async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    
    logger.info("Database engine and connection pool initialized successfully")


async def init_redis() -> None:
    """Initialize Redis client (optional - Supabase Realtime can replace)"""
    global _redis_client
    if settings.REDIS_URL:
        _redis_client = redis.from_url(
            settings.REDIS_URL, 
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True
        )
        logger.info("Redis client initialized")


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


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Get SQLAlchemy async session (for DB queries) with context manager"""
    if _async_session_factory is None:
        raise RuntimeError("Database engine not initialized")
    
    async with _async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()


async def get_db_session() -> AsyncGenerator[SQLAlchemyAsyncSession, None]:
    """Alternative session generator with explicit type"""
    if _async_session_factory is None:
        raise RuntimeError("Database engine not initialized")
    
    session = _async_session_factory()
    try:
        yield session
        await session.commit()
    except Exception as e:
        await session.rollback()
        logger.error(f"Database transaction failed: {e}")
        raise
    finally:
        await session.close()


def get_redis() -> redis.Redis | None:
    """Get Redis client (optional)"""
    return _redis_client


async def close_connections() -> None:
    """Close all database and Redis connections gracefully"""
    global _async_engine, _redis_client
    
    logger.info("Closing database connections...")
    
    if _async_engine:
        await _async_engine.dispose()
        logger.info("Database engine disposed")
    
    if _redis_client:
        await _redis_client.close()
        logger.info("Redis client closed")
