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

    # ── App ──────────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"  # development | staging | production
    SECRET_KEY: str = ""
    DEBUG: bool = False
    CORS_ALLOWED_ORIGINS: str = ""

    # ── Supabase (REQUIRED) ────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # ── Database (Supabase connection pool) ───────────────────────────────
    DATABASE_URL: str = ""
    DATABASE_URL_SYNC: str = ""

    # ── Redis (Optional - Supabase Realtime can replace) ────────────────────────
    # Set REDIS_URL to enable, otherwise uses in-memory fallback
    REDIS_URL: str | None = None

    # ── AI ────────────────────────────────────────────────────────────────
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

    # ── Africa's Talking ──────────────────────────────────────────────────
    AT_USERNAME: str | None = None
    AT_API_KEY: str | None = None
    AT_SENDER_ID: str = "AfyaHero"

    # ── M-Pesa Daraja ─────────────────────────────────────────────────────
    MPESA_CONSUMER_KEY: str | None = None
    MPESA_CONSUMER_SECRET: str | None = None
    MPESA_SHORTCODE: str | None = None
    MPESA_PASSKEY: str | None = None
    MPESA_CALLBACK_URL: str | None = None
    MPESA_B2C_INITIATOR: str | None = None
    MPESA_B2C_SECURITY_CREDENTIAL: str | None = None

    # ── SHA ────────────────────────────────────────────────────────────────
    SHA_BASE_URL: str | None = None
    SHA_CLIENT_ID: str | None = None
    SHA_CLIENT_SECRET: str | None = None
    SHA_FACILITY_CODE: str | None = None

    # ── Push Notifications ────────────────────────────────────────────────
    FCM_SERVER_KEY: str | None = None

    # ── Auth ─────────────────────────────────────────────────────────────
    JWT_ACCESS_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"
    OTP_EXPIRE_MINUTES: int = 10
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 30

    # ── Encryption ────────────────────────────────────────────────────────
    PII_ENCRYPTION_KEY: str | None = None

    # ── Deployment ────────────────────────────────────────────────────────
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
