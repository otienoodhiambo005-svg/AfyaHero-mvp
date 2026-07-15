'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, User, Stethoscope, ClipboardCheck, CheckCircle,
  ChevronRight, ChevronLeft, Loader2,
  ShieldCheck, AlertCircle, Wifi, WifiOff, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

// ─── Kenya Counties ───────────────────────────────────────────────────────────
const COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa',
  'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi',
  'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos',
  'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a",
  'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
  'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia',
  'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
];

const FACILITY_TYPES = [
  { value: 'county_referral', label: 'County Referral Hospital', level: 'Level 5' },
  { value: 'sub_county', label: 'Sub-County Hospital', level: 'Level 4' },
  { value: 'health_centre', label: 'Health Centre', level: 'Level 3' },
  { value: 'dispensary', label: 'Dispensary / Clinic', level: 'Level 2' },
  { value: 'private_hospital', label: 'Private Hospital', level: 'Private' },
  { value: 'faith_based', label: 'Faith-Based Hospital', level: 'FBO' },
  { value: 'nursing_home', label: 'Nursing Home / Maternity', level: 'Private' },
  { value: 'specialist_clinic', label: 'Specialist Clinic', level: 'Private' },
];

const OWNERSHIP = [
  { value: 'public', label: 'Government / County' },
  { value: 'private', label: 'Private' },
  { value: 'faith_based', label: 'Faith-Based (FBO)' },
  { value: 'ngo', label: 'NGO / CBO' },
];

const SERVICES = [
  'Inpatient (General)', 'Outpatient (OPD)', 'Maternity (ANC/PNC/Delivery)',
  'Paediatrics', 'Emergency & Casualty', 'Surgery', 'Intensive Care (ICU)',
  'Laboratory', 'Pharmacy', 'Radiology / Imaging', 'Dental', 'Eye Clinic',
  'Mental Health', 'TB / Respiratory Clinic', 'HIV/AIDS (VCT/ART)',
  'Nutrition', 'Physiotherapy', 'Renal / Dialysis', 'Oncology',
];

const INSURANCE = [
  'SHIF / SHA', 'JUBILEE Health', 'AAR Insurance', 'CIC Insurance',
  'UAP Insurance', 'Resolution Insurance', 'Madison Insurance',
  'GA Insurance', 'Strategic Insurance', 'Self-Pay only',
];

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Facility Info', icon: Building2 },
  { id: 2, label: 'Admin Account', icon: User },
  { id: 3, label: 'Services', icon: Stethoscope },
  { id: 4, label: 'Review', icon: ClipboardCheck },
];

const ACCENT = '#10B981'; // emerald — neutral before facility type chosen

// ─── Offline support utilities ─────────────────────────────────────────────────────
const STORAGE_KEY = 'afyahero_facility_registration_draft';

function saveToLocalStorage(form: FacilityForm) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  } catch (e) {
    // Storage might be disabled or full
    logger.warn('Failed to save to localStorage', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

function loadFromLocalStorage(): FacilityForm | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function clearLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // Ignore errors
  }
}

function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<'online' | 'offline' | 'slow'>('online');

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      
      const conn = (navigator as any).connection ?? 
                   (navigator as any).mozConnection ?? 
                   (navigator as any).webkitConnection;
      
      if (conn) {
        const isSlow = conn.saveData === true || ['slow-2g', '2g'].includes(conn.effectiveType);
        setConnectionType(!navigator.onLine ? 'offline' : isSlow ? 'slow' : 'online');
      } else {
        setConnectionType(navigator.onLine ? 'online' : 'offline');
      }
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    
    if ((navigator as any).connection) {
      (navigator as any).connection.addEventListener('change', updateStatus);
    }

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      if ((navigator as any).connection) {
        (navigator as any).connection.removeEventListener('change', updateStatus);
      }
    };
  }, []);

  return { isOnline, connectionType };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FacilityForm {
  // Step 1
  facilityName: string;
  facilityType: string;
  ownership: string;
  county: string;
  subCounty: string;
  physicalAddress: string;
  phone: string;
  facilityEmail: string;
  mflCode: string; // Master Facility List code (Kenya)
  SHIFContracted: boolean;
  // Step 2
  adminName: string;
  adminTitle: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  adminConfirmPassword: string;
  // Step 3
  services: string[];
  insurances: string[];
  bedCount: string;
  operatingHours: string;
}

const INITIAL: FacilityForm = {
  facilityName: '', facilityType: '', ownership: '', county: '',
  subCounty: '', physicalAddress: '', phone: '', facilityEmail: '',
  mflCode: '', SHIFContracted: false,
  adminName: '', adminTitle: '', adminEmail: '', adminPhone: '',
  adminPassword: '', adminConfirmPassword: '',
  services: [], insurances: [], bedCount: '', operatingHours: '8:00 AM – 5:00 PM',
};

// ─── Helper components ────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold text-mist/50 uppercase tracking-[0.2em] font-mono mb-1.5">
      {children}
    </label>
  );
}

function InputField({
  value, onChange, placeholder, type = 'text', required = true,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <input
      type={type}
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-600 rounded-xl px-4 py-3 text-gray-100 text-sm outline-none placeholder:text-gray-400 focus:border-emerald-400 transition-all"
      style={{ backgroundColor: '#1e293b' }}
    />
  );
}

function SelectField({
  value, onChange, children, required = true,
}: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; required?: boolean;
}) {
  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-all appearance-none text-gray-100"
      style={{ backgroundColor: '#1e293b' }}
    >
      {children}
    </select>
  );
}

// ─── Connectivity-aware video (client-only) ───────────────────────────────────
function VideoBackgroundInline({ connectionType }: { connectionType: 'online' | 'offline' | 'slow' }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Skip video on slow or offline connections
    if (connectionType !== 'online') return;

    const video = videoRef.current;
    if (!video) return;

    const onCanPlay = () => setShow(true);
    video.addEventListener('canplay', onCanPlay);
    video.play().catch(() => { /* autoplay blocked — static fallback remains */ });

    return () => video.removeEventListener('canplay', onCanPlay);
  }, [connectionType]);

  // Don't render video at all if not online
  if (connectionType !== 'online') return null;

  return (
    <video
      ref={videoRef}
      className={cn(
        'absolute inset-0 h-full w-full object-cover motion-reduce:hidden transition-opacity duration-700',
        show ? 'opacity-100' : 'opacity-0',
      )}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster="/login-bg.png"
      aria-hidden="true"
    >
      <source src="/media/onboarding-bg.mp4" type="video/mp4" />
    </video>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RegisterFacilityPage() {
  const [_router] = useState(useRouter());
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FacilityForm>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submissionMeta, setSubmissionMeta] = useState<{ status?: string; submissionSource?: string } | null>(null);
  const [showDraftNotice, setShowDraftNotice] = useState(false);
  const { isOnline, connectionType } = useNetworkStatus();

  // Load saved draft from localStorage on mount
  useEffect(() => {
    const savedDraft = loadFromLocalStorage();
    if (savedDraft) {
      setForm(savedDraft);
      setShowDraftNotice(true);
    }
  }, []);

  // Auto-save form data to localStorage on changes
  useEffect(() => {
    if (!submitted) {
      saveToLocalStorage(form);
    }
  }, [form, submitted]);

  // Clear saved draft after successful submission
  useEffect(() => {
    if (submitted) {
      clearLocalStorage();
    }
  }, [submitted]);

  const update = (key: keyof FacilityForm) => (value: string | boolean | string[]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleMulti = (key: 'services' | 'insurances', value: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));

  // ─── Step validation ─────────────────────────────────────────────────────
  const canProceed = () => {
    if (step === 1) {
      return form.facilityName && form.facilityType && form.ownership &&
        form.county && form.phone && form.facilityEmail;
    }
    if (step === 2) {
      if (form.adminPassword !== form.adminConfirmPassword) return false;
      return form.adminName && form.adminEmail && form.adminPassword && form.adminPassword.length >= 8;
    }
    if (step === 3) {
      return form.services.length > 0;
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    
    // If offline, queue the submission for later
    if (!isOnline) {
      try {
        const queue = JSON.parse(localStorage.getItem('afyahero_submission_queue') || '[]');
        queue.push({
          id: Date.now(),
          form,
          timestamp: new Date().toISOString(),
          endpoint: '/api/register-facility'
        });
        localStorage.setItem('afyahero_submission_queue', JSON.stringify(queue));
        setSubmissionMeta({
          status: 'queued_offline',
          submissionSource: 'offline_queue'
        });
        setSubmitted(true);
      } catch (e) {
        setError('Failed to queue submission. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Process any queued submissions first
    const queue = JSON.parse(localStorage.getItem('afyahero_submission_queue') || '[]');
    if (queue.length > 0) {
      try {
        for (const item of queue) {
          try {
            await fetch(item.endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.form),
            });
          } catch (e) {
            logger.warn('Failed to submit queued item', { itemId: item.id });
          }
        }
        localStorage.removeItem('afyahero_submission_queue');
      } catch (e) {
        logger.warn('Failed to process submission queue', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    try {
      const res = await fetch('/api/register-facility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Registration failed. Please try again.');
      }
      const payload = await res.json().catch(() => ({}));
      setSubmissionMeta({
        status: payload.status as string | undefined,
        submissionSource: payload.submissionSource as string | undefined,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Submitted state ──────────────────────────────────────────────────────
  if (submitted) {
    const isQueued = submissionMeta?.status === 'queued_offline';
    
    return (
      <PageShell connectionType={connectionType}>
        <div className="text-center py-10 space-y-5">
          <div className={cn('w-16 h-16 rounded-full flex items-center justify-center border mx-auto',
            isQueued ? 'bg-[#FEF3C7] border-[#F59E0B]' : 'bg-emerald/15 border-emerald/30'
          )}>
            {isQueued ? <WifiOff className="w-8 h-8 text-[#713F12]" /> : <CheckCircle className="w-8 h-8 text-emerald" />}
          </div>
          <h2 className="text-2xl font-semibold text-white font-serif">
            {isQueued ? 'Application Queued' : 'Application Received'}
          </h2>
          <p className="text-mist/70 text-sm leading-relaxed max-w-sm mx-auto">
            <strong className="text-white">{form.facilityName}</strong>{' '}
            {isQueued 
              ? 'has been queued for submission. When you reconnect to the internet, your application will be automatically submitted.'
              : 'has been submitted for verification. AfyaHero system admins will review your request before activation within 1–2 business days.'
            }
          </p>
          <div className="bg-forest/30 border border-forest-light/15 rounded-2xl p-4 text-left space-y-2 text-xs text-mist/60 max-w-sm mx-auto">
            <p><span className="text-mist/40">Facility name:</span> <span className="text-white">{form.facilityName}</span></p>
            <p><span className="text-mist/40">County:</span> <span className="text-white">{form.county}</span></p>
            <p><span className="text-mist/40">Admin contact:</span> <span className="text-white">{form.adminEmail}</span></p>
            <p><span className="text-mist/40">Status:</span> <span className={cn(isQueued ? 'text-[#713F12]' : 'text-amber-300')}>{submissionMeta?.status ?? 'pending_approval'}</span></p>
            <p><span className="text-mist/40">Submitted via:</span> <span className="text-white">{submissionMeta?.submissionSource ?? 'public_application'}</span></p>
            <p><span className="text-mist/40">Reference:</span> <span className="font-mono text-emerald">AH-{Date.now().toString(36).toUpperCase().slice(-6)}</span></p>
          </div>
          {isQueued && (
            <p className="text-mist/40 text-xs">Your application will be submitted automatically when you reconnect. You can also manually submit again once you&apos;re back online.</p>
          )}
          {!isQueued && (
            <p className="text-mist/40 text-xs">You will receive a confirmation email at <strong className="text-mist/70">{form.adminEmail}</strong></p>
          )}
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald text-white text-xs font-bold uppercase tracking-wider hover:bg-emerald/90 transition-all">
            Back to Portal Selector
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell connectionType={connectionType}>
      {/* Draft restoration notice */}
      {showDraftNotice && (
        <div className="mb-6 rounded-xl bg-[#FEF3C7] border border-[#F59E0B] px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#713F12] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#713F12]">Draft restored from previous session</p>
            <p className="text-xs text-[#713F12]/80 mt-1">Your form data has been restored. You can continue where you left off.</p>
          </div>
          <button
            onClick={() => { setForm(INITIAL); setShowDraftNotice(false); clearLocalStorage(); }}
            className="text-xs text-[#713F12] hover:text-[#713F12]/80 underline"
          >
            Clear draft
          </button>
        </div>
      )}

      {/* Offline submission notice */}
      {!isOnline && (
        <div className="mb-6 rounded-xl bg-[#FEE2E2] border border-[#EF4444] px-4 py-3 flex items-start gap-3">
          <WifiOff className="w-5 h-5 text-[#7F1D1D] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#7F1D1D]">You are offline</p>
            <p className="text-xs text-[#7F1D1D]/80 mt-1">Your form will be saved locally. When you reconnect, you can submit your application.</p>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isDone = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-0 min-w-0">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all',
                    isDone ? 'bg-emerald border-emerald' :
                    isActive ? 'bg-emerald/15 border-emerald' :
                    'bg-white/5 border-white/10',
                  )}
                >
                  {isDone
                    ? <CheckCircle className="w-4 h-4 text-white" />
                    : <Icon className={cn('w-4 h-4', isActive ? 'text-emerald' : 'text-mist/30')} />}
                </div>
                <span className={cn('text-[10px] font-semibold whitespace-nowrap', isActive ? 'text-emerald' : isDone ? 'text-mist/60' : 'text-mist/30')}>
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn('h-px w-8 sm:w-16 mx-1 mb-5 shrink-0', step > s.id ? 'bg-emerald/50' : 'bg-white/10')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-5 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ── STEP 1: Facility Info ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white font-serif">Facility Information</h2>
            <p className="text-mist/50 text-xs mt-1">Basic details about your healthcare facility</p>
          </div>

          <div>
            <FieldLabel>Facility / Hospital Name *</FieldLabel>
            <InputField value={form.facilityName} onChange={update('facilityName')} placeholder="e.g. Kenyatta National Hospital" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Facility Type *</FieldLabel>
              <SelectField value={form.facilityType} onChange={update('facilityType')}>
                <option value="" disabled>Select type…</option>
                {FACILITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label} ({t.level})</option>
                ))}
              </SelectField>
            </div>
            <div>
              <FieldLabel>Ownership *</FieldLabel>
              <SelectField value={form.ownership} onChange={update('ownership')}>
                <option value="" disabled>Select ownership…</option>
                {OWNERSHIP.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SelectField>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>County *</FieldLabel>
              <SelectField value={form.county} onChange={update('county')}>
                <option value="" disabled>Select county…</option>
                {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectField>
            </div>
            <div>
              <FieldLabel>Sub-County / Town</FieldLabel>
              <InputField value={form.subCounty} onChange={update('subCounty')} placeholder="e.g. Westlands" required={false} />
            </div>
          </div>

          <div>
            <FieldLabel>Physical Address</FieldLabel>
            <InputField value={form.physicalAddress} onChange={update('physicalAddress')} placeholder="e.g. Hospital Road, off Ngong Ave" required={false} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Phone Number *</FieldLabel>
              <InputField value={form.phone} onChange={update('phone')} type="tel" placeholder="e.g. 0700 000 000" />
            </div>
            <div>
              <FieldLabel>Facility Email *</FieldLabel>
              <InputField value={form.facilityEmail} onChange={update('facilityEmail')} type="email" placeholder="info@hospital.co.ke" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>MFL Code (Kenya Master Facility List)</FieldLabel>
              <InputField value={form.mflCode} onChange={update('mflCode')} placeholder="e.g. 13351" required={false} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => update('SHIFContracted')(!form.SHIFContracted)}
                  className={cn(
                    'w-10 h-6 rounded-full transition-all relative border',
                    form.SHIFContracted ? 'bg-emerald border-emerald' : 'bg-white/10 border-white/15',
                  )}
                >
                  <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', form.SHIFContracted ? 'left-4' : 'left-0.5')} />
                </div>
                <span className="text-xs text-mist/70 group-hover:text-mist transition-colors">SHIF / SHA Contracted</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Admin Account ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white font-serif">Administrator Account</h2>
            <p className="text-mist/50 text-xs mt-1">This person will be the primary admin for <span className="text-white">{form.facilityName}</span></p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Full Name *</FieldLabel>
              <InputField value={form.adminName} onChange={update('adminName')} placeholder="e.g. Dr. Jane Muthoni" />
            </div>
            <div>
              <FieldLabel>Job Title</FieldLabel>
              <InputField value={form.adminTitle} onChange={update('adminTitle')} placeholder="e.g. Medical Superintendent" required={false} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Work Email *</FieldLabel>
              <InputField value={form.adminEmail} onChange={update('adminEmail')} type="email" placeholder="admin@hospital.co.ke" />
            </div>
            <div>
              <FieldLabel>Phone Number</FieldLabel>
              <InputField value={form.adminPhone} onChange={update('adminPhone')} type="tel" placeholder="e.g. 0722 000 000" required={false} />
            </div>
          </div>

          <div>
            <FieldLabel>Password * (minimum 8 characters)</FieldLabel>
            <InputField value={form.adminPassword} onChange={update('adminPassword')} type="password" placeholder="••••••••" />
          </div>

          <div>
            <FieldLabel>Confirm Password *</FieldLabel>
            <InputField value={form.adminConfirmPassword} onChange={update('adminConfirmPassword')} type="password" placeholder="••••••••" />
            {form.adminPassword && form.adminConfirmPassword && form.adminPassword !== form.adminConfirmPassword && (
              <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
              </p>
            )}
          </div>

          <div className="bg-forest/30 border border-forest-light/15 rounded-2xl p-4 text-xs text-mist/60 space-y-1.5">
            <p className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald shrink-0" /> <strong className="text-mist/80">Your account will be verified</strong> before access is granted.</p>
            <p className="pl-6">An AfyaHero onboarding specialist will contact you within 1–2 business days to complete KYC verification.</p>
          </div>
        </div>
      )}

      {/* ── STEP 3: Services & Wards ──────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white font-serif">Services & Capacity</h2>
            <p className="text-mist/50 text-xs mt-1">Select all services your facility offers</p>
          </div>

          {/* Services */}
          <div>
            <FieldLabel>Clinical Services * (select all that apply)</FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {SERVICES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleMulti('services', s)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs transition-all',
                    form.services.includes(s)
                      ? 'bg-emerald/15 border-emerald/40 text-emerald'
                      : 'bg-white/3 border-white/8 text-mist/60 hover:border-white/15 hover:text-mist/80',
                  )}
                >
                  <span className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all',
                    form.services.includes(s) ? 'bg-emerald border-emerald' : 'border-white/20')}>
                    {form.services.includes(s) && <CheckCircle className="w-3 h-3 text-white" />}
                  </span>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Insurance */}
          <div>
            <FieldLabel>Accepted Insurance / Payment</FieldLabel>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {INSURANCE.map((ins) => (
                <button
                  key={ins}
                  type="button"
                  onClick={() => toggleMulti('insurances', ins)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs transition-all',
                    form.insurances.includes(ins)
                      ? 'bg-emerald/15 border-emerald/40 text-emerald'
                      : 'bg-white/3 border-white/8 text-mist/60 hover:border-white/15 hover:text-mist/80',
                  )}
                >
                  <span className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all',
                    form.insurances.includes(ins) ? 'bg-emerald border-emerald' : 'border-white/20')}>
                    {form.insurances.includes(ins) && <CheckCircle className="w-3 h-3 text-white" />}
                  </span>
                  {ins}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Total Bed Count</FieldLabel>
              <InputField value={form.bedCount} onChange={update('bedCount')} type="number" placeholder="e.g. 80" required={false} />
            </div>
            <div>
              <FieldLabel>Operating Hours</FieldLabel>
              <InputField value={form.operatingHours} onChange={update('operatingHours')} placeholder="e.g. 8:00 AM – 5:00 PM" required={false} />
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: Review ────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white font-serif">Review & Submit</h2>
            <p className="text-mist/50 text-xs mt-1">Confirm your facility details before sending your application</p>
          </div>

          <ReviewSection title="Facility Details" onEdit={() => setStep(1)}>
            <ReviewRow label="Name" value={form.facilityName} />
            <ReviewRow label="Type" value={FACILITY_TYPES.find(t => t.value === form.facilityType)?.label ?? form.facilityType} />
            <ReviewRow label="Ownership" value={OWNERSHIP.find(o => o.value === form.ownership)?.label ?? form.ownership} />
            <ReviewRow label="County" value={form.county + (form.subCounty ? ` · ${form.subCounty}` : '')} />
            <ReviewRow label="Phone" value={form.phone} />
            <ReviewRow label="Email" value={form.facilityEmail} />
            {form.mflCode && <ReviewRow label="MFL Code" value={form.mflCode} />}
            <ReviewRow label="SHIF/SHA" value={form.SHIFContracted ? 'Contracted ✓' : 'Not contracted'} />
          </ReviewSection>

          <ReviewSection title="Administrator" onEdit={() => setStep(2)}>
            <ReviewRow label="Name" value={form.adminName} />
            {form.adminTitle && <ReviewRow label="Title" value={form.adminTitle} />}
            <ReviewRow label="Email" value={form.adminEmail} />
            {form.adminPhone && <ReviewRow label="Phone" value={form.adminPhone} />}
          </ReviewSection>

          <ReviewSection title="Services" onEdit={() => setStep(3)}>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {form.services.map((s) => (
                <span key={s} className="px-2 py-0.5 bg-emerald/10 border border-emerald/25 text-emerald text-[10px] rounded-full">{s}</span>
              ))}
            </div>
            {form.insurances.length > 0 && (
              <>
                <p className="text-[10px] text-mist/40 uppercase tracking-widest mt-3 mb-1">Insurance accepted</p>
                <div className="flex flex-wrap gap-1.5">
                  {form.insurances.map((i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/25 text-blue-300 text-[10px] rounded-full">{i}</span>
                  ))}
                </div>
              </>
            )}
            {form.bedCount && <ReviewRow label="Bed Count" value={form.bedCount} />}
            {form.operatingHours && <ReviewRow label="Hours" value={form.operatingHours} />}
          </ReviewSection>

          <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-300/80 space-y-1">
            <p className="font-semibold text-amber-300 flex items-center gap-2"><ShieldCheck className="w-4 h-4 shrink-0" /> Verification process</p>
            <p>AfyaHero will verify your MFL code against the Kenya Master Facility List. SHIF-contracted facilities will be cross-checked with the SHA portal before your account is activated.</p>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/8">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-mist/60 hover:text-mist hover:border-white/20 transition-all text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        ) : (
          <Link href="/" className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-mist/60 hover:text-mist hover:border-white/20 transition-all text-sm font-medium">
            <ChevronLeft className="w-4 h-4" /> Cancel
          </Link>
        )}

        {step < 4 ? (
          <button
            type="button"
            disabled={!canProceed()}
            onClick={() => { setError(null); setStep(step + 1); }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-30"
            style={{ background: ACCENT }}
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {loading ? 'Submitting…' : 'Submit Application'}
          </button>
        )}
      </div>
    </PageShell>
  );
}

// ─── Page shell (shared dark card layout) ─────────────────────────────────────
function PageShell({ children, connectionType = 'online' }: { children: React.ReactNode; connectionType?: 'online' | 'offline' | 'slow' }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans antialiased">
      {/* Layer 1: Static colour fallback — AfyaHero brand colors as base */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: connectionType === 'offline' ? '#0F4C75' : '#1B262C' }}
        aria-hidden="true"
      />
      {/* Layer 2: Image fallback — only loads if online */}
      {connectionType === 'online' && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: "url('/login-bg.png')" }}
          aria-hidden="true"
        />
      )}
      {/* Layer 3: Video — skipped on slow/save-data connections, fades in when ready */}
      <VideoBackgroundInline connectionType={connectionType} />
      {/* Layer 4: Light veil for text legibility */}
      <div className="absolute inset-0 bg-slate-950/30" />
      {/* Layer 5: Subtle brand gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(50,130,184,0.15),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_40%),linear-gradient(135deg,rgba(15,76,117,0.3),rgba(27,38,44,0.15))]" />

      <div className="w-full max-w-[580px] relative z-10">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2 text-mist/60 hover:text-mist text-xs font-medium transition-colors group w-fit">
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
            Portal Selector
          </Link>
          <div className="flex items-center gap-3">
            {/* Network Status Indicator */}
            <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
              connectionType === 'online' ? 'bg-[#D5EDF8] text-[#0F4C75]' :
              connectionType === 'offline' ? 'bg-[#FEE2E2] text-[#7F1D1D]' :
              'bg-[#FEF3C7] text-[#713F12]'
            )}>
              {connectionType === 'online' ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Online</span>
                </>
              ) : connectionType === 'offline' ? (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Slow</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-mist/40">
              <Building2 className="w-4 h-4 text-emerald" />
              <span>Facility Registration</span>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10 rounded-[36px] bg-[#0C1510] border border-emerald-500/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Review section helpers ───────────────────────────────────────────────────
function ReviewSection({
  title, onEdit, children,
}: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-forest/30 border border-forest-light/15 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-forest-light/10 bg-forest/20">
        <span className="text-xs font-bold text-mist/60 uppercase tracking-widest">{title}</span>
        <button type="button" onClick={onEdit} className="text-xs text-emerald hover:text-emerald/80 transition-colors font-medium">
          Edit
        </button>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[10px] text-mist/40 uppercase tracking-wider shrink-0 w-24">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}
