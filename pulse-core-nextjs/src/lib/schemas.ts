/**
 * Zod validation schemas for all core AfyaHero data models.
 * Use these for API input validation and form validation.
 */
import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────

export const PortalRoleSchema = z.enum(['reception', 'medical', 'lab', 'pharmacy', 'admin']);
export const PrioritySchema = z.enum(['normal', 'urgent', 'critical']);
export const PatientStatusSchema = z.enum(['waiting', 'in-consult', 'done', 'admitted', 'referred']);
export const GenderSchema = z.enum(['M', 'F']);
export const LabPrioritySchema = z.enum(['routine', 'urgent', 'STAT']);
export const LabStatusSchema = z.enum(['ordered', 'sample-collected', 'processing', 'completed', 'verified', 'rejected']);
export const RxStatusSchema = z.enum(['pending', 'dispensing', 'dispensed', 'partial', 'cancelled', 'on-hold']);
export const ApprovalStatusSchema = z.enum(['active', 'pending', 'suspended', 'rejected']);
export const PaymentMethodSchema = z.enum(['cash', 'mpesa', 'insurance', 'SHIF', 'card']);
export const InvoiceStatusSchema = z.enum(['draft', 'pending', 'partial', 'paid', 'waived', 'insurance-pending']);
export const ServiceTypeSchema = z.enum(['OPD', 'Lab', 'Pharmacy', 'Theatre', 'Triage']);
export const ShiftTypeSchema = z.enum(['morning', 'afternoon', 'night']);
export const VisitTypeSchema = z.enum(['OPD', 'Emergency', 'Scheduled', 'Follow-up', 'Lab Only', 'Pharmacy Only']);

// ── Vitals ─────────────────────────────────────────────────────────────

export const VitalsSchema = z.object({
  patient_id: z.string().uuid().optional(),
  encounter_id: z.string().uuid().optional(),
  sbp: z.number().int().min(40).max(300),
  dbp: z.number().int().min(20).max(200),
  heart_rate: z.number().int().min(20).max(250).describe('pulse'),
  temperature: z.number().min(30).max(45).describe('temp'),
  spo2: z.number().int().min(50).max(100),
  respiratory_rate: z.number().int().min(5).max(60).describe('rr'),
  weight: z.number().min(0.5).max(300).optional(),
  height: z.number().min(20).max(250).optional(),
  bmi: z.number().min(5).max(80).optional(),
  recorded_at: z.string().datetime().optional(),
  recorded_by: z.string().min(1).optional(),
});

// ── Patient ────────────────────────────────────────────────────────────

export const PatientCreateSchema = z.object({
  name: z.string().min(2).max(120),
  gender: GenderSchema,
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  phone: z.string().min(10).max(15).optional(),
  national_id: z.string().max(20).optional(),
  shif_number: z.string().max(30).optional(),
  insurance_provider: z.string().max(50).optional(),
  insurance_id: z.string().max(30).optional(),
  blood_group: z.string().max(5).optional(),
  allergies: z.array(z.string().max(50)).max(20).optional(),
  county: z.string().max(100).optional(),
  religion: z.string().max(50).optional(),
  consent_given: z.boolean().default(false),
});

export const PatientUpdateSchema = PatientCreateSchema.partial();

// ── Lab Request ────────────────────────────────────────────────────────

export const LabRequestCreateSchema = z.object({
  patient_id: z.string().uuid(),
  test_name: z.string().min(2).max(200),
  panel: z.string().max(100).optional(),
  sample_type: z.string().min(2).max(50),
  priority: LabPrioritySchema.default('routine'),
  notes: z.string().max(500).optional(),
});

export const LabResultSchema = z.object({
  parameter: z.string().min(1).max(100),
  value: z.string().min(1).max(50),
  unit: z.string().max(20),
  referenceRange: z.string().max(50),
  flag: z.enum(['H', 'L', 'HH', 'LL', 'A']).optional(),
});

export const LabResultsUpdateSchema = z.object({
  results: z.array(LabResultSchema).min(1).max(50),
  abnormal: z.boolean().optional(),
  critical: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

// ── Prescription ───────────────────────────────────────────────────────

export const PrescriptionItemSchema = z.object({
  drug: z.string().min(2).max(200),
  genericName: z.string().max(200).optional(),
  dose: z.string().min(1).max(50),
  frequency: z.string().min(1).max(50),
  duration: z.string().min(1).max(50),
  route: z.string().min(1).max(30),
  quantity: z.number().int().min(1).max(9999),
  notes: z.string().max(200).optional(),
});

export const PrescriptionCreateSchema = z.object({
  patient_id: z.string().uuid(),
  items: z.array(PrescriptionItemSchema).min(1).max(20),
  notes: z.string().max(500).optional(),
  insurance: z.string().max(50).optional(),
  priority: z.enum(['normal', 'urgent']).default('normal'),
});

// ── Check-in ───────────────────────────────────────────────────────────

export const CheckinCreateSchema = z.object({
  patient_name: z.string().min(2).max(120),
  phone: z.string().max(15).optional(),
  id_number: z.string().max(20).optional(),
  insurance_provider: z.string().max(50).optional(),
  insurance_id: z.string().max(30).optional(),
  visit_reason: z.string().max(300).optional(),
  visit_type: VisitTypeSchema.default('OPD'),
  payment_method: PaymentMethodSchema.default('cash'),
  service_type: ServiceTypeSchema.default('OPD'),
  priority: PrioritySchema.default('normal'),
  chief_complaint: z.string().max(500).optional(),
});

// ── Consultation / SOAP ────────────────────────────────────────────────

export const SOAPSchema = z.object({
  subjective: z.string().max(2000).optional(),
  objective: z.string().max(2000).optional(),
  assessment: z.string().max(2000).optional(),
  plan: z.string().max(2000).optional(),
});

export const ConsultationCreateSchema = z.object({
  patient_id: z.string().uuid(),
  practitioner_id: z.string().uuid().optional(),
  diagnosis: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  status: z.string().max(20).default("Completed"),
  soap_notes: SOAPSchema.optional(),
  prescription_id: z.string().uuid().optional(),
});

// ── Handover ───────────────────────────────────────────────────────────

export const HandoverCreateSchema = z.object({
  shift_type: ShiftTypeSchema,
  critical_patients: z.array(z.object({
    name: z.string().max(120),
    bed: z.string().max(20),
    note: z.string().max(300),
  })).max(20).optional(),
  pending_actions: z.array(z.object({
    task: z.string().max(300),
    priority: PrioritySchema.optional(),
  })).max(30).optional(),
  medications_due: z.array(z.object({
    patient: z.string().max(120),
    medication: z.string().max(200),
    time: z.string().max(10),
  })).max(30).optional(),
  general_notes: z.string().max(3000).optional(),
});

// ── Invoice ────────────────────────────────────────────────────────────

export const InvoiceItemSchema = z.object({
  description: z.string().min(1).max(200),
  category: z.enum(['consultation', 'lab', 'pharmacy', 'procedure', 'ward', 'other']),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().min(0).max(999999),
});

export const InvoiceCreateSchema = z.object({
  patient_id: z.string().uuid(),
  items: z.array(InvoiceItemSchema).min(1).max(50),
  discount: z.number().min(0).optional(),
  payment_method: PaymentMethodSchema.optional(),
  insurance_covered: z.number().min(0).optional(),
});

// ── Staff Profile ──────────────────────────────────────────────────────

export const StaffRegistrationSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(120),
  email: z.string().email('Invalid email address').max(120),
  staffId: z.string().min(4, 'Staff ID is required').max(20),
  hospitalCode: z.string().min(4, 'Hospital code is required').max(20).optional(),
  role: PortalRoleSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  title: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  phone: z.string().max(15).optional(),
  invitationToken: z.string().optional(),
});

// ── Auth ───────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required'),
  password: z.string().min(1, 'Password is required'),
  portal: z.enum(['admin', 'medical', 'reception', 'lab', 'pharmacy', 'super_admin']),
});

export const DemoLoginSchema = z.object({
  email: z.string().trim().email().max(200).transform((v) => v.toLowerCase()).optional(),
  password: z.string().min(1, 'Password is required'),
  staffId: z.string().optional(),
  portal: z.string().optional(),
  _supabase_token: z.string().min(10).max(4096).optional(),
  _profile: z.record(z.string(), z.unknown()).optional(),
}).strict();

// ── AI Analysis ────────────────────────────────────────────────────────

export const AIAnalysisSchema = z.object({
  type: z.enum([
    'diagnostic', 'inventory', 'lab', 'analytics',
    'teleconsultation', 'drug_interaction', 'icd10',
    'radiology', 'pathology',
  ]),
  query: z.string().min(5).max(10000),
  patient_id: z.string().uuid().optional(),
  encounter_id: z.string().uuid().optional(),
  modality: z.string().max(30).optional(),
  body_region: z.string().max(50).optional(),
  stain_type: z.string().max(50).optional(),
  clinical_history: z.string().max(2000).optional(),
});

// ── Type exports (infer types from schemas) ────────────────────────────

export type VitalsInput = z.infer<typeof VitalsSchema>;
export type PatientCreateInput = z.infer<typeof PatientCreateSchema>;
export type LabRequestCreateInput = z.infer<typeof LabRequestCreateSchema>;
export type PrescriptionCreateInput = z.infer<typeof PrescriptionCreateSchema>;
export type CheckinCreateInput = z.infer<typeof CheckinCreateSchema>;
export type ConsultationCreateInput = z.infer<typeof ConsultationCreateSchema>;
export type HandoverCreateInput = z.infer<typeof HandoverCreateSchema>;
export type InvoiceCreateInput = z.infer<typeof InvoiceCreateSchema>;
export type StaffRegistrationInput = z.infer<typeof StaffRegistrationSchema>;
export type AIAnalysisInput = z.infer<typeof AIAnalysisSchema>;
export type DemoLoginInput = z.infer<typeof DemoLoginSchema>;
