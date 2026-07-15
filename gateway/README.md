# AfyaHero Hospital OS Backend

Production grade hospital management system backend built for African healthcare.

## Architecture Principles

1. **Dual Layer Tenant Isolation** - RLS at database level + middleware at application level
2. **Immutable Clinical Records** - No updates after signing, only new versions
3. **All Patient Access Logged** - KDPA Article 28 compliant audit logging
4. **Swappable AI Providers** - No clinical logic coupled to specific model APIs
5. **Architectural Offline Support** - Safety critical logic always runs locally

## Tech Stack

- FastAPI 0.100+
- Supabase + PostgreSQL
- SQLAlchemy Async ORM
- Redis (celery broker + caching)
- Celery Background Workers

## Quick Start

```bash
cd gateway
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Project Structure

```
app/
├── main.py                 FastAPI app factory
├── config.py               Environment validation
├── db.py                   Database connections
├── dependencies.py         Route dependencies
│
├── core/
│   ├── auth/               Authentication system
│   ├── tenancy/            Multi-tenant isolation
│   ├── rbac/               Role based access control
│   ├── audit/              Audit logging system
│   └── encryption/         PII field level encryption
│
├── api/v1/
│   ├── router.py           API v1 root router
│   ├── patients.py         Patient management
│   └── triage.py           Vitals + AI triage
│
├── services/
│   ├── ai/                 AI orchestration layer
│   └── payments/           SHA + insurance claims
│
└── workers/                Celery background tasks
```

## License

Proprietary - AfyaHero Health