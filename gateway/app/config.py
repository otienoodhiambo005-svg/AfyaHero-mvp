from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, model_validator
from functools import lru_cache

"""
AfyaHero Backend Configuration - Supabase-First Architecture

All infrastructure uses Supabase:
- Database: Supabase PostgreSQL (via connection pool)
- Auth: Supabase Auth (users table synced with profiles)
- Storage: Supabase Storage for documents
- Realtime: Supabase Realtime for live updates
- Edge Functions: Supabase Edge Functions for critical paths

Required env vars:
- SUPABASE_URL (from Supabase dashboard)
- SUPABASE_ANON_KEY (from Supabase settings > API)
- SUPABASE_SERVICE_ROLE_KEY (from Supabase settings > API)
- SECRET_KEY (min 32 chars for JWT signing)
"""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # [4m App [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    ENVIRONMENT: str = "development"  # development | staging | production
    SECRET_KEY: str = ""
    DEBUG: bool = False
    CORS_ALLOWED_ORIGINS: str = ""

    # [4m Supabase (REQUIRED) [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # [4m Database (Supabase connection pool) [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    DATABASE_URL: str = ""
    DATABASE_URL_SYNC: str = ""

    # [4m Redis (Optional - Supabase Realtime can replace) [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    # Set REDIS_URL to enable, otherwise uses in-memory fallback
    REDIS_URL: str | None = None

    # [4m AI Cache Configuration [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    AI_CACHE_TTL: int = 300  # 5 minutes default
    AI_CACHE_ENABLED: bool = True
    AI_CACHE_MAX_SIZE: int = 10000  # Max cache entries per hospital

    # [4m AI Circuit Breaker Configuration [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    AI_CIRCUIT_BREAKER_ENABLED: bool = True
    AI_CIRCUIT_BREAKER_FAIL_MAX: int = 3
    AI_CIRCUIT_BREAKER_RESET_TIMEOUT: int = 60  # seconds

    # [4m AI [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    VERTEX_AI_PROJECT: str | None = None
    VERTEX_AI_LOCATION: str = "us-central1"
    GCP_PROJECT_ID: str | None = None
    GOOGLE_APPLICATION_CREDENTIALS: str | None = None
    GEMINI_API_KEY: str | None = None
    GROQ_API_KEY: str | None = None
    TOGETHER_AI_KEY: str | None = None
    DEEPSEEK_API_KEY: str | None = None
    # Priority: Free tier - OpenRouter with free credits
    OPENROUTER_API_KEY: str | None = None

    # [4m Africa's Talking [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    AT_USERNAME: str | None = None
    AT_API_KEY: str | None = None
    AT_SENDER_ID: str = "AfyaHero"

    # [4m M-Pesa Daraja [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    MPESA_CONSUMER_KEY: str | None = None
    MPESA_CONSUMER_SECRET: str | None = None
    MPESA_SHORTCODE: str | None = None
    MPESA_PASSKEY: str | None = None
    MPESA_CALLBACK_URL: str | None = None
    MPESA_B2C_INITIATOR: str | None = None
    MPESA_B2C_SECURITY_CREDENTIAL: str | None = None

    # [4m SHA [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    SHA_BASE_URL: str | None = None
    SHA_CLIENT_ID: str | None = None
    SHA_CLIENT_SECRET: str | None = None
    SHA_FACILITY_CODE: str | None = None

    # [4m Push Notifications [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    FCM_SERVER_KEY: str | None = None

    # [4m Auth [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    JWT_ACCESS_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"
    OTP_EXPIRE_MINUTES: int = 10
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 30

    # [4m Encryption [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    PII_ENCRYPTION_KEY: str | None = None

    # [4m Deployment [0m [4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m[4m[0m
    DEPLOYMENT_MODE: str = "saas"  # saas | onpremise
    HOSPITAL_ID_OVERRIDE: str | None = None

    @model_validator(mode="after")
    def enforce_production_security(self):
        if self.ENVIRONMENT != "production":
            return self

        required_in_production = [
            "SECRET_KEY",
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "DATABASE_URL",
            "DATABASE_URL_SYNC",
            "PII_ENCRYPTION_KEY",
        ]
        missing = [key for key in required_in_production if not getattr(self, key)]
        if missing:
            raise ValueError(
                f"Missing required production environment variables: {', '.join(missing)}"
            )

        for key in ["SECRET_KEY", "PII_ENCRYPTION_KEY", "SUPABASE_SERVICE_ROLE_KEY"]:
            val = getattr(self, key)
            if val and len(val) < 32:
                raise ValueError(f"{key} must be at least 32 characters in production")

        if self.SECRET_KEY.startswith("dev-"):
            raise ValueError("SECRET_KEY cannot use development prefix in production")

        return self


@lru_cache()
def get_settings() -> Settings:
    return Settings()
