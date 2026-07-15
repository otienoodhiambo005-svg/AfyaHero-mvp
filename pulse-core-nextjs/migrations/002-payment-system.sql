-- ==================================================
-- AFYAHERO PAYMENT SYSTEM DATABASE SCHEMA
-- Dual payment system: Admin Subscriptions + Reception Tracking
-- ==================================================

-- Payment Methods lookup table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  is_online BOOLEAN DEFAULT false,
  context VARCHAR(50) NOT NULL, -- admin_subscription, reception_payment, all
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  monthly_amount DECIMAL(12,2) NOT NULL,
  yearly_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hospital Subscriptions
CREATE TABLE IF NOT EXISTS hospital_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  billing_cycle VARCHAR(20) NOT NULL, -- monthly / yearly
  status VARCHAR(20) DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);

-- ==================================================
-- ADMIN SUBSCRIPTION PAYMENTS (ONLINE PROCESSING)
-- ==================================================
CREATE TABLE IF NOT EXISTS admin_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  subscription_id UUID REFERENCES hospital_subscriptions(id),
  reference VARCHAR(100) NOT NULL UNIQUE,
  transaction_id VARCHAR(255),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  payment_provider VARCHAR(50) NOT NULL, -- paystack, flutterwave, stripe
  status VARCHAR(20) DEFAULT 'pending',
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  gateway_response JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);

-- ==================================================
-- RECEPTION PATIENT PAYMENTS (LOCAL TRACKING ONLY)
-- ==================================================
CREATE TABLE IF NOT EXISTS reception_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  visit_id UUID NOT NULL,
  reference VARCHAR(100) NOT NULL UNIQUE,
  receipt_number VARCHAR(100) NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  payment_method VARCHAR(50) NOT NULL, -- cash, mpesa, bank, card_terminal, insurance
  payment_category VARCHAR(50) NOT NULL, -- consultation, lab, pharmacy, admission
  payer_name VARCHAR(255),
  payer_phone VARCHAR(50),
  reference_number VARCHAR(255), -- M-Pesa code, bank slip, etc
  received_by UUID NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'success',
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMP WITH TIME ZONE,
  reconciled_by UUID,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (received_by) REFERENCES users(id)
);

-- ==================================================
-- INSURANCE CLAIMS PAYMENTS (SHA PROCESSING)
-- ==================================================
CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  visit_id UUID NOT NULL,
  claim_reference VARCHAR(100) NOT NULL UNIQUE,
  insurance_provider VARCHAR(255) NOT NULL,
  policy_number VARCHAR(255) NOT NULL,
  claim_amount DECIMAL(12,2) NOT NULL,
  approved_amount DECIMAL(12,2),
  patient_responsibility DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending_validation',
  ai_validation_score NUMERIC(5,2),
  ai_validation_notes TEXT,
  claim_submitted_at TIMESTAMP WITH TIME ZONE,
  claim_settled_at TIMESTAMP WITH TIME ZONE,
  submitted_by UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Payment Audit Log
CREATE TABLE IF NOT EXISTS payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  payment_type VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  user_id UUID NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sub_payments_hospital ON admin_subscription_payments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_reference ON admin_subscription_payments(reference);
CREATE INDEX IF NOT EXISTS idx_reception_payments_hospital ON reception_payments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_reception_payments_patient ON reception_payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_hospital ON insurance_claims(hospital_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_payment ON payment_audit_log(payment_id);

-- Insert default payment methods
INSERT INTO payment_methods (name, display_name, is_online, context, is_active) VALUES
  ('cash', 'Cash', false, 'reception_payment', true),
  ('mpesa', 'M-Pesa', false, 'reception_payment', true),
  ('bank_transfer', 'Bank Transfer', false, 'reception_payment', true),
  ('card_terminal', 'Card Terminal', false, 'reception_payment', true),
  ('insurance', 'Insurance', false, 'reception_payment', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, monthly_amount, yearly_amount, currency, features) VALUES
  ('Basic', 'Basic hospital subscription with core features', 15000, 160000, 'NGN', '["patient_management", "appointments", "basic_reports"]'),
  ('Professional', 'Professional plan with advanced features', 35000, 375000, 'NGN', '["all_basic_features", "laboratory_management", "pharmacy_management", "advanced_reports", "api_access"]'),
  ('Enterprise', 'Enterprise hospital solution', 75000, 800000, 'NGN', '["all_professional_features", "inpatient_management", "theater_management", "insurance_claims", "priority_support", "custom_integrations"]')
ON CONFLICT DO NOTHING;