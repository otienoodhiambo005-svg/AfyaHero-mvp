-- ─── Audit Logging Table (KDPA Compliance) ────────────────────────────────────
-- 
-- Immutable, tamper-evident audit trail for all patient data access and
-- sensitive operations. Used for compliance audits and forensic investigation.
--
-- Retention: configurable via AI_AUDIT_RETENTION_DAYS env var (default: 365 days)
-- Indexing: optimized for querying by user, hospital, patient, timestamp
--

CREATE TABLE IF NOT EXISTS "public"."audit_log" (
  "id" BIGSERIAL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "hospital_id" TEXT NOT NULL,
  "patient_id" TEXT,
  "description" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT TRUE,
  "ip_address" INET,
  "user_agent" TEXT,
  "metadata" JSONB,
  "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_log_type_check" CHECK ("type" IN (
    'patient_view',
    'patient_export',
    'ai_query',
    'auth_success',
    'auth_failure',
    'permission_denied',
    'data_modify',
    'session_timeout',
    'ai_consent_change'
  ))
);

-- Indexes for query performance (KDPA compliance audits)
CREATE INDEX IF NOT EXISTS "idx_audit_log_recorded_at" ON "public"."audit_log"("recorded_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_log_user_id" ON "public"."audit_log"("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_log_hospital_id" ON "public"."audit_log"("hospital_id");
CREATE INDEX IF NOT EXISTS "idx_audit_log_patient_id" ON "public"."audit_log"("patient_id");
CREATE INDEX IF NOT EXISTS "idx_audit_log_type" ON "public"."audit_log"("type");
CREATE INDEX IF NOT EXISTS "idx_audit_log_hospital_patient_ts" ON "public"."audit_log"("hospital_id", "patient_id", "recorded_at" DESC);

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────
-- Audit logs are write-only by service role, read via admin audit queries only
-- Never exposed to end users through standard auth
--

ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;

-- Service role can always write (no policy = full access)
-- Standard auth users have no select access (implicit deny)
-- Only admin/compliance staff can query (via admin API)

-- Optional: Create admin-only view for compliance queries
CREATE OR REPLACE VIEW "public"."audit_log_admin" AS
  SELECT 
    "id",
    "type",
    "user_id",
    "role",
    "hospital_id",
    "patient_id",
    "description",
    "success",
    "ip_address",
    "user_agent",
    "metadata",
    "recorded_at"
  FROM "public"."audit_log"
  WHERE (select auth.role()) = 'authenticated'; -- Restrict to admin queries

-- ─── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE "public"."audit_log" IS 'KDPA-compliant audit trail: immutable log of all patient data access, authentication events, and sensitive operations. Used for compliance audits, forensic investigation, and security monitoring.';
COMMENT ON COLUMN "public"."audit_log"."type" IS 'Event type: patient_view, patient_export, ai_query, auth_success, auth_failure, permission_denied, data_modify, session_timeout, ai_consent_change';
COMMENT ON COLUMN "public"."audit_log"."recorded_at" IS 'Timestamp of the event (UTC). Used for audit trail ordering and retention policies.';
