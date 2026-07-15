-- Hospital-scoped queue / service escalation requests (admin portal).

CREATE TABLE IF NOT EXISTS service_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  service_area TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_escalations_hospital_status_created
  ON service_escalations (hospital_id, status, created_at DESC);
