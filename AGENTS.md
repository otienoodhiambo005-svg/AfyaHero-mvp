# AfyaHero — Agent Quick Reference

AI-native OS for African hospitals (designed for 100k+ facility scale).
Tech Stack: Next.js 14, Prisma ORM, PostgreSQL (Google Cloud SQL), Supabase Auth, Redis (Upstash), FastAPI Gateway (Python), Playwright.

## Monorepo Structure & Commands
- **Root `package.json`** delegates to `pulse-core-nextjs/` (main app) and `superadmin/` (admin portal).
- **Dev Server:** `npm run dev` starts on port **3003** (NOT 3000).
- **Strict Builds:** ESLint errors WILL fail production build (`ignoreDuringBuilds: false`).
- **Command Sequence:** `npm run typecheck` → `npm run lint` → `npm run test` (Playwright E2E).
- **Playwright:** Tests auto-start dev server on port 3003. Config in `pulse-core-nextjs/playwright.config.ts`.
- **Schema Apply:** `npm run db:apply-schema-compat` (PowerShell script).

## Database (Prisma ORM)
- **Import:** `import { prisma } from '@/lib/database'` — lazy-loaded, stubs for build when client not generated.
- **Generate client:** `npx prisma generate` (run from `pulse-core-nextjs/`).
- **29 models** in `prisma/schema.prisma` — PostgreSQL on Google Cloud SQL.
- **Multi-tenancy:** `getTenantPrismaClient(hospitalId)` auto-injects `hospitalId` into all queries. Use for tenant-scoped operations.
- **Key models:** `Hospital`, `Profile` (staff), `Patient`, `Appointment`, `ClinicalVital`, `Prescription`, `LabRequest`, `AuditLog`, `SecurityIncident`, `TeleconsultAppointment`, `HealthNewsFeedSource`, `ShifClaim`, `PaymentTransaction`.
- **Profile roles:** `'reception'`, `'medical'`, `'lab'`, `'pharmacy'`, `'admin'`.
- **NhifClaim → ShifClaim** (renamed for SHIF rebrand). `nhifNumber` → `shifNumber` in Patient.

## AI Provider Cascade
- **Open-source models:** HuggingFace → Groq → Vertex (if first two fail).
- **Full cascade by type** (in `src/lib/ai-providers.ts`):
  - diagnostic → HF → Groq → Gemini → OpenAI → Claude
  - analytics (DAWA) → HF → Groq → Gemini → Claude
  - drug_interaction → HF → Groq → Gemini → Claude
  - icd10 → HF → Groq → Gemini
  - inventory → HF → Groq → Gemini
  - teleconsultation → HF → Groq → Gemini → Claude
  - radiology/pathology → Gemini (vision) → HF (text) → Claude
- **Vertex AI:** Uses `VERTEX_AI_STUDIO_API_KEY` via `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
- **Provider timeout:** 15s per provider.
- **Never use `any`** in AI-related code — strict typing required.

## Teleconsultation (Google Meet + Vertex AI)
- **Meeting creation:** `/api/teleconsultation/meetings` — creates Google Meet via Calendar API with conferenceData. Falls back to manual code generation if Google Workspace not configured.
- **Transcription:** `/api/teleconsultation/transcribe` — Vertex AI Speech-to-Text. Accepts WebM/Opus or PCM16 audio. Falls back to browser Speech Recognition.
- **Clinical analysis:** `/api/teleconsultation/analyze` — Vertex AI Gemini for SOAP notes, differential diagnosis, drug interactions, ICD-10 suggestions.
- **Frontend:** `src/components/medical/Teleconsultation.tsx` — captures audio via MediaRecorder, streams to transcription, displays live transcript + AI sidebar.
- **MedASR + Whisper** for medical speech recognition. **MedGemma** for SOAP note generation.
- **Daily.co removed** — replaced with Google Meet (opens in new tab, meeting code displayed in-app).

## API Routes
- **FHIR:** `/api/fhir/[resource]` — migrated to Prisma. Supports Patient, Observation, Practitioner, Organization. OAuth 2.0 Bearer tokens.
- **Admin:** `/api/admin/*` — migrated to Prisma (users, audit-logs, security-events, health-feeds, system-health).
- **Teleconsultation appointments & waitroom:** `/api/medical/teleconsultation/appointments` and `waitroom` — Prisma via `getTenantPrismaClient(hospitalId)` (`src/lib/data/teleconsult.ts`); in-memory demo fallback only when `DATABASE_URL` is unset and not in strict production mode.
- **Medical handover:** `/api/medical/handover` — Prisma `HandoverNote` via `src/lib/data/handover.ts`; admin ward totals aggregate `HospitalBed` in `src/lib/data/admin.ts`.
- **AI routes:** `src/app/api/ai/*` with logic in `src/lib/ai-*`.
- **Rate limiting:** Upstash Redis via `enforceApiRateLimit()` in `@/lib/api-security`.

## Gateway (Python FastAPI)
- Located in `gateway/`. Run via `poetry run uvicorn main:app --reload --port 8000`.
- Dependencies in `gateway/pyproject.toml` (Python 3.11+).
- Must be deployed via Kubernetes HPA for production scale.

## Security Constraints
- **Payment packages DISABLED:** `flutterwave-node`, `paystack`, `stripe` removed due to vulnerabilities. DO NOT re-add.
- **No `console.log`** in production code (violates `no-console`). Use `logger` from `@/lib/logger`.
- **Always use `const`** over `let` if unassigned (`prefer-const`).
- **Always use absolute paths** when modifying files.
- **CSP:** Production blocks `'unsafe-inline'` and `'unsafe-eval'` for scripts. Dev allows both.

## Environment Variables
- **Required:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SESSION_SECRET`
- **AI (optional):** `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `VERTEX_AI_STUDIO_API_KEY`, `HF_API_KEY`, `GROQ_API_KEY`
- **Google Meet (optional):** `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`
- **Redis (optional):** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **Supabase service role (optional, for legacy routes):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Validate at startup via `validateEnv()` from `@/lib/env`.

## Scaling Architecture
- **Multi-tenant:** Logically sharded PostgreSQL (partitioned by `hospital_id`). Transition from single Supabase instance in progress.
- **Mesh Network:** `src/lib/mesh-network.ts` for intra-hospital low-connectivity syncing.
- **Inter-hospital:** Requires dedicated Edge Message Brokers (regional Kafka/RabbitMQ).
- **Caching:** Multi-tiered rate limiting via Upstash Redis. Edge CDNs for static assets.
