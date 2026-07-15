# AfyaHero Deployment Runbook

## Platform Complete: 35+ Modules

---

## What's Been Built

### Database Migrations (5 phases)
```
prisma/migrations/
├── 20260411000000_phase1_pharmacy_i18n/up.sql   - Formulary, Stock, i18n
├── 20260411000000_phase2_lis_comm/up.sql        - Lab tests, USSD, Comm
├── 20260411000000_phase3_clinical_ai/up.sql    - Disease priors, Guidelines, Scribe
├── 20260411000000_phase4_patient_channels/up.sql - CHW, Onboarding, WhatsApp
└── 20260411000000_phase5_analytics_reporting/up.sql - Analytics, Reports, Webhooks
```

### Gateway API Endpoints (25 modules)

| Module | Endpoint | Description |
|--------|----------|-------------|
| **Clinical** | | |
| Patients | `/api/v1/patients` | Patient CRUD |
| Triage | `/api/v1/triage` | Vitals, triage |
| Pharmacy | `/api/v1/pharmacy` | Prescriptions |
| SHIF | `/api/v1/shif` | Claims |
| **Pharmacy** | | |
| Formulary | `/api/v1/formulary` | Drug list CRUD |
| Stock | `/api/v1/stock` | FEFO dispense |
| Inventory AI | `/api/v1/inventory-ai` | Forecasts |
| **Operations** | | |
| Referrals | `/api/v1/referrals` | ServiceRequest workflow |
| Beds | `/api/v1/beds` | Admit/discharge |
| Claims | `/api/v1/claims` | Dashboard KPIs |
| **Communication** | | |
| WhatsApp/USSD | `/api/v1/communication` | Bot, notifications |
| **Lab** | | |
| LIS | `/api/v1/lis` | Order, collect, verify |
| **AI** | | |
| Clinical AI | `/api/v1/clinical-ai` | DAWA, disease priors, RAG |
| **Devices** | | |
| Integration | `/api/v1/devices` | BLE, lab analyzers |
| **Teleconsult** | | |
| Video | `/api/v1/teleconsult` | Rooms, appointments |
| **CHW** | | |
| Operations | `/api/v1/chw` | Kit, referrals |
| **Data** | | |
| FHIR | `/fhir/{resource}` | FHIR R4 resources |
| Audit | `/api/v1/audit` | Audit logs |
| **Payments** | | |
| M-Pesa | `/api/v1/payments` | STK push |
| **Support** | | |
| i18n | `/api/v1/i18n` | Translations |
| Dashboard | `/api/v1/dashboard` | KPIs |

### Frontend Pages
- `/portal/medical/referrals` - Referral inbox/out
- `/portal/admin/claims` - Claims dashboard
- `/portal/reception/beds` - Bed grid
- `/portal/settings/language` - Language
- `/portal/lab/orders` - LIS orders

---

## Deployment Steps

### 1. Database Setup
```bash
# Run all SQL migrations in order
psql $DATABASE_URL -f prisma/migrations/20260411000000_phase1_pharmacy_i18n/up.sql
psql $DATABASE_URL -f prisma/migrations/20260411000000_phase2_lis_comm/up.sql
psql $DATABASE_URL -f prisma/migrations/20260411000000_phase3_clinical_ai/up.sql
psql $DATABASE_URL -f prisma/migrations/20260411000000_phase4_patient_channels/up.sql
psql $DATABASE_URL -f prisma/migrations/20260411000000_phase5_analytics_reporting/up.sql

# Generate Prisma client
cd pulse-core-nextjs && npx prisma generate
```

### 2. Start Gateway
```bash
cd gateway
poetry install
poetry run uvicorn app.main:app --reload --port 8000
```

### 3. Start Frontend
```bash
npm run dev
# Runs on port 3003
```

### 4. Configure Environment
Required env vars:
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=  # For AI text generation
```

---

## API Endpoints

| Module | Endpoint | Description |
|--------|---------|------------|
| Formulary | `GET/POST /api/v1/formulary` | List/Create drugs |
| Stock | `GET /api/v1/stock` | List lots |
| Stock | `POST /api/v1/stock/receive` | Receive stock |
| Stock | `POST /api/v1/stock/dispense` | Dispense (FEFO) |
| Referrals | `GET /api/v1/referrals/inbox` | Incoming referrals |
| Referrals | `POST /api/v1/referrals` | Create referral |
| Beds | `GET /api/v1/beds` | List beds |
| Beds | `POST /api/v1/beds/admit` | Admit patient |
| Claims | `GET /api/v1/claims/stats` | Dashboard KPIs |
| i18n | `GET /api/v1/i18n` | Translations |

---

## Testing

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Playwright tests
npm run test
```

---

## Next Steps for Production

1. **Configure SHA Portal** - Add SHA credentials to env
2. **Configure M-Pesa** - Add Daraja API keys
3. **Set up WhatsApp Business** - Meta for patient notifications
4. **Deploy to cloud** - See AGENTS.md for deployment options

---

## Support

- Check health: `GET /health` (gateway)
- Check AI: `GET /health/ai` (gateway)
- Frontend: `http://localhost:3003`