-- Lab quality incidents (hospital-scoped) for lab portal workflows.

CREATE TABLE IF NOT EXISTS lab_quality_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  display_id TEXT NOT NULL,
  issue TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, display_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_quality_incidents_hospital_opened
  ON lab_quality_incidents (hospital_id, opened_at DESC);
