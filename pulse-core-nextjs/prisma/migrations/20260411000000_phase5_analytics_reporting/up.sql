-- Phase 5: Analytics + Reporting + Final Tables
-- Migration: 20260411000000_phase5_analytics_reporting.sql

-- ──────────────────────────────────────────────────────────────
-- 1. ANALYTICS - Aggregated data for dashboards
-- ──────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_patients AS
SELECT 
    hospital_id,
    DATE(created_at) as day,
    COUNT(*) as new_patients,
    COUNT(DISTINCT CASE WHEN status != 'Stable' THEN id END) as critical
FROM patients
GROUP BY hospital_id, DATE(created_at);

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_encounters AS
SELECT 
    hospital_id,
    DATE(created_at) as day,
    COUNT(*) as total_encounters,
    COUNT(CASE WHEN status = 'in-progress' THEN 1 END) as active,
    COUNT(CASE WHEN status = 'finished' THEN 1 END) as completed
FROM encounters
GROUP BY hospital_id, DATE(created_at);

CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_revenue AS
SELECT 
    hospital_id,
    DATE_TRUNC('month', created_at) as month,
    SUM(amount) as total_revenue,
    SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as collected
FROM payment_transactions
GROUP BY hospital_id, DATE_TRUNC('month', created_at);

-- ──────────────────────────────────────────────────────────────
-- 2. REPORTING - Scheduled report configurations
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES hospitals(id),
    report_type TEXT NOT NULL,
    frequency TEXT NOT NULL,
    recipients TEXT[],
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES report_schedules(id),
    status TEXT NOT NULL,
    row_count INT,
    file_url TEXT,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Report types
INSERT INTO report_schedules (hospital_id, report_type, frequency, recipients, is_active) VALUES
((SELECT id FROM hospitals LIMIT 1), 'daily_patients', 'daily', ARRAY['admin@hospital.ke'], true),
((SELECT id FROM hospitals LIMIT 1), 'weekly_claims', 'weekly', ARRAY['finance@hospital.ke'], true),
((SELECT id FROM hospitals LIMIT 1), 'monthly_inventory', 'monthly', ARRAY['pharmacy@hospital.ke'], true);

-- ──────────────────────────────────────────────────────────────
-- 3. NOTIFICATIONS - Internal alerts
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT DEFAULT 'info',
    priority TEXT DEFAULT 'normal',
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- 4. BOOKMARKS - User saved items
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_bookmarks_unique ON bookmarks(user_id, resource_type, resource_id);

-- ──────────────────────────────────────────────────────────────
-- 5. PREFERENCES - User settings
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    theme TEXT DEFAULT 'light',
    dashboard_layout JSONB DEFAULT '{}',
    notification_prefs JSONB DEFAULT '{"email": true, "sms": false, "push": true}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 6. CACHE - Simple key-value for caching
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cache_store (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- 7. WEBHOOKS - External integrations
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES hospitals(id),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT[],
    secret TEXT,
    is_active BOOLEAN DEFAULT true,
    last_triggered TIMESTAMPTZ,
    failure_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_hospital ON webhooks(hospital_id, is_active);

-- ──────────────────────────────────────────────────────────────
-- 8. API RATE LIMITS - Per-user tracking
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    count INT DEFAULT 0,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- ──────────────────────────────────────────────────────────────
-- 9. SESSIONS - Active user sessions
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_user ON user_sessions(user_id, is_active);

-- ──────────────────────────────────────────────────────────────
-- 10. ENCOUNTER EXTENSIONS - Additional encounter data
-- ──────────────────────────────────────────────────────────────

ALTER TABLE encounters ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS history_of_present_illness JSONB;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS physical_examination JSONB;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS assessment TEXT;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS plan TEXT;

PRINT 'Phase 5 migration completed: Analytics + Reporting tables';