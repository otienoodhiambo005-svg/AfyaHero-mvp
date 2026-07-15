-- =============================================
-- Hospital Admin Two Factor Authentication Tables
-- For secure authentication of administrative users
-- PostgreSQL Compatible Migration
-- =============================================

-- Create admin_two_factor table if not exists
CREATE TABLE IF NOT EXISTS  (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    secret TEXT,
    backup_codes TEXT DEFAULT '[]',
    enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_verified_at TIMESTAMPTZ,
    last_failed_attempt TIMESTAMPTZ,
    failed_attempt_count INT DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE admin_two_factor ENABLE ROW LEVEL SECURITY;

-- Admin users can only view their own 2FA configuration
CREATE POLICY IF NOT EXISTS admin_2fa_own ON admin_two_factor
    FOR ALL
    USING (user_id = auth_uid())
    WITH CHECK (user_id = auth_uid());

-- Admin role required to use 2FA
ALTER TABLE admin_two_factor ADD CONSTRAINT IF NOT EXISTS check_admin_role CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin')
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_two_factor_user_id ON admin_two_factor(user_id);

-- Trigger function to update timestamp
CREATE OR REPLACE FUNCTION update_admin_2fa_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_admin_2fa_update
BEFORE UPDATE ON admin_two_factor
FOR EACH ROW
EXECUTE FUNCTION update_admin_2fa_timestamp();
