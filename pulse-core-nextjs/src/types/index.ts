// ─── Portal Roles & Configs ──────────────────────────────────────────────────

export type PortalRole = 'reception' | 'medical' | 'lab' | 'pharmacy' | 'admin' | 'super_admin';

export interface PortalConfig {
  role: PortalRole;
  label: string;
  subtitle: string;
  description: string;
  accentColor: string; // hex
  loginPath: string;
  portalPath: string;
  demoEmail: string;
  /** Demo password — set via DEMO_PASSWORD env var at runtime, never hardcoded */
  demoPassword?: string;
  demoName: string;
  demoTitle: string;
  demoCredentials?: {
    label: string;
    email: string;
    name: string;
    title: string;
  }[];
}

export const PORTALS: Record<PortalRole, PortalConfig> = {
  reception: {
    role: 'reception',
    label: 'Operations',
    subtitle: 'Front Desk & Billing Operations',
    description: 'Patient registration, queue management, biometric ID-check, bed assignment, billing collection, and financial ledger auditing.',
    accentColor: '#2E86AB',
    loginPath: '/auth/reception/login',
    portalPath: '/portal/reception',
    demoEmail: 'demo@reception.afyahero.com',
    demoName: 'Mary Njeri',
    demoTitle: 'Operations Manager',
    demoCredentials: [
      {
        label: 'Reception Demo',
        email: 'demo@reception.afyahero.com',
        name: 'Mary Njeri',
        title: 'Senior Receptionist',
      },
      {
        label: 'Billing Demo',
        email: 'demo@billing.afyahero.com',
        name: 'John Kamau',
        title: 'Senior Billing Officer',
      },
    ],
  },
  medical: {
    role: 'medical',
    label: 'Medical',
    subtitle: 'Clinical & Patient Care',
    description: 'Clinical workflows, documentation & AI decision support',
    accentColor: '#3B8B6E',
    loginPath: '/auth/medical/login',
    portalPath: '/portal/medical',
    demoEmail: 'demo@medical.afyahero.com',
    demoName: 'Dr. Amina Osei',
    demoTitle: 'Senior Medical Officer',
  },
  lab: {
    role: 'lab',
    label: 'Laboratory',
    subtitle: 'LIS & Sample Workflow',
    description: 'Sample workflow, results verification & LIS integration',
    accentColor: '#7B61C1',
    loginPath: '/auth/lab/login',
    portalPath: '/portal/lab',
    demoEmail: 'demo@lab.afyahero.com',
    demoName: 'Kevin Mwangi',
    demoTitle: 'Senior Lab Technician',
  },
  pharmacy: {
    role: 'pharmacy',
    label: 'Pharmacy',
    subtitle: 'Dispensing & Formulary',
    description: 'Dispensing, inventory management & formulary control',
    accentColor: '#D4763C',
    loginPath: '/auth/pharmacy/login',
    portalPath: '/portal/pharmacy',
    demoEmail: 'demo@pharmacy.afyahero.com',
    demoName: 'Grace Otieno',
    demoTitle: 'Clinical Pharmacist',
  },
  admin: {
    role: 'admin',
    label: 'Admin',
    subtitle: 'Hospital Operations',
    description: 'Facility oversight, analytics & resource management',
    accentColor: '#3282B8',
    loginPath: '/auth/admin/login',
    portalPath: '/portal/admin',
    demoEmail: 'demo@admin.afyahero.com',
    demoName: 'Dr. Samuel Kiprotich',
    demoTitle: 'Hospital Administrator',
  },
  super_admin: {
    role: 'super_admin',
    label: 'Super Admin',
    subtitle: 'System Administration',
    description: 'Cross-facility oversight, platform configuration & super admin functions',
    accentColor: '#6C3483',
    loginPath: '/auth/superadmin/login',
    portalPath: '/portal/superadmin',
    demoEmail: 'demo@superadmin.afyahero.com',
    demoName: 'System Administrator',
    demoTitle: 'Super Administrator',
  },
};

// ─── Session ──────────────────────────────────────────────────────────────────

export interface UserSession {
  id: string;
  email: string;
  role: PortalRole;
  /** Sub-role within a portal, e.g. 'doctor' | 'nurse' under 'medical' */
  subrole?: string;
  name: string;
  title: string;
  hospitalId: string;
  hospitalName: string;
  demo?: boolean;
  approved?: boolean;
  /** Unix timestamp (ms) of session creation — used to calculate inactivity */
  issuedAt: number;
  /** Unix timestamp (ms) of last user activity — updated on every API request */
  lastActivityAt: number;
  /** Whether user has consented to external AI usage with patient data */
  aiConsentGiven?: boolean;
  /** Initials for display (e.g. "AO" for "Amina Osei") */
  initials?: string;
}

// ─── Patients & Queue ────────────────────────────────────────────────────────

export type Priority = 'normal' | 'urgent' | 'critical';
export type PatientStatus = 'waiting' | 'in-consult' | 'done' | 'admitted' | 'referred';

export interface Patient {
  id: string;
  pid: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  phone: string;
  SHIFNo?: string;
  nationalId?: string;
  status: PatientStatus;
  priority: Priority;
  checkinTime: string;
  complaint: string;
  assignedDoctor?: string;
  ward?: string;
  bloodGroup?: string;
  allergies?: string[];
  vitals?: Vitals;
}

export interface QueueItem {
  id: string;
  tokenNumber: number;
  patientName: string;
  patientId: string;
  pid: string;
  age: number;
  gender: 'M' | 'F';
  priority: Priority;
  complaint: string;
  waitMinutes: number;
  serviceType: 'OPD' | 'Lab' | 'Pharmacy' | 'Theatre' | 'Triage';
  status: PatientStatus;
  checkinTime: string;
  assignedTo?: string;
}

export interface Vitals {
  bp: string;
  pulse: number;
  temp: number;
  spo2: number;
  rr: number;
  weight?: number;
  height?: number;
  bmi?: number;
  recordedAt: string;
  recordedBy: string;
}

// ─── Lab ─────────────────────────────────────────────────────────────────────

export type LabStatus = 'ordered' | 'sample-collected' | 'processing' | 'completed' | 'verified' | 'rejected';
export type LabPriority = 'routine' | 'STAT' | 'urgent';

export interface LabRequest {
  id: string;
  labId: string;
  patientName: string;
  patientId: string;
  pid: string;
  testName: string;
  panel?: string;
  sampleType: string;
  priority: LabPriority;
  orderedBy: string;
  orderedAt: string;
  collectedAt?: string;
  completedAt?: string;
  status: LabStatus;
  results?: LabResult[];
  notes?: string;
  abnormal?: boolean;
  critical?: boolean;
}

export interface LabResult {
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag?: 'H' | 'L' | 'HH' | 'LL' | 'A';
}

// ─── Pharmacy ────────────────────────────────────────────────────────────────

export type RxStatus = 'pending' | 'dispensing' | 'dispensed' | 'partial' | 'cancelled' | 'on-hold';

export interface Prescription {
  id: string;
  rxNumber: string;
  patientName: string;
  patientId: string;
  pid: string;
  prescribedBy: string;
  prescribedAt: string;
  status: RxStatus;
  items: PrescriptionItem[];
  notes?: string;
  insurance?: string;
  priority?: 'normal' | 'urgent';
}

export interface PrescriptionItem {
  id: string;
  drug: string;
  genericName?: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  quantity: number;
  dispensed?: number;
  notes?: string;
  substitution?: boolean;
}

export interface StockItem {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  maxStock: number;
  expiryDate: string;
  lotNumber: string;
  supplier: string;
  unitCost: number;
  status: 'adequate' | 'low' | 'critical' | 'out-of-stock' | 'expiring-soon';
  location?: string;
}

// ─── Beds & Wards ────────────────────────────────────────────────────────────

export interface Bed {
  id: string;
  bedNumber: string;
  wardId: string;
  wardName: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved' | 'cleaning';
  patient?: string;
  patientId?: string;
  admittedDate?: string;
  expectedDischarge?: string;
  diagnosisGroup?: string;
  assignedDoctor?: string;
}

export interface Ward {
  id: string;
  name: string;
  type: 'General' | 'ICU' | 'HDU' | 'Maternity' | 'Paediatric' | 'Surgical' | 'Medical' | 'Emergency';
  totalBeds: number;
  occupied: number;
  available: number;
  beds?: Bed[];
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export type ApprovalStatus = 'active' | 'pending' | 'suspended' | 'rejected';

export interface StaffMember {
  id: string;
  name: string;
  role: PortalRole;
  department: string;
  status: ApprovalStatus;
  email: string;
  phone?: string;
  staffId?: string;
  joinDate: string;
  shift?: 'morning' | 'afternoon' | 'night';
  title?: string;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  invoiceNo: string;
  patientName: string;
  patientId: string;
  date: string;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  insuranceCovered?: number;
  amountDue: number;
  amountPaid: number;
  status: 'draft' | 'pending' | 'partial' | 'paid' | 'waived' | 'insurance-pending';
  paymentMethod?: 'cash' | 'mpesa' | 'insurance' | 'SHIF' | 'card';
}

export interface InvoiceItem {
  description: string;
  category: 'consultation' | 'lab' | 'pharmacy' | 'procedure' | 'ward' | 'other';
  quantity: number;
  unitPrice: number;
  total: number;
}

// ─── Medical Handover ─────────────────────────────────────────────────────────

export type HandoverStatus = 'Pending' | 'Acknowledged' | 'Completed' | 'Cancelled';

export interface HandoverRecord {
  id: string;
  patientId: string;
  patientName: string;
  senderId: string;
  senderName: string;
  receiverId?: string;
  receiverName?: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  status: HandoverStatus;
  createdAt: string;
  acknowledgedAt?: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: number;
  group?: string;
}

// ── AI / Provider / DAWA re-exports ──────────────────────────────────────────

export type { AIAuditEntry, AIAnalysisType, DAWAPersona } from '@/lib/ai-audit';
export type { ProviderName, NormalizedProviderResponse, CascadeOptions } from '@/lib/ai-providers';
