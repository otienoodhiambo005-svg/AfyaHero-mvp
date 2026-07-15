-- Reception department routing orders (hospital-scoped).

CREATE TABLE IF NOT EXISTS reception_routing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  order_ref TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  patient_ref TEXT NOT NULL,
  destination TEXT NOT NULL,
  reason TEXT NOT NULL,
  urgency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  acknowledged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, order_ref)
);

CREATE INDEX IF NOT EXISTS idx_reception_routing_orders_hospital_status
  ON reception_routing_orders (hospital_id, status);
