'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, User, Stethoscope, CheckCircle2, 
  ArrowRight, ArrowLeft, Loader2, Info,
  ShieldCheck, MapPin, Mail, Phone, Clock
} from 'lucide-react';
import PageLayout from '@/components/ui/PageLayout';
import { ActionDispatcher } from '@/components/ui/ActionDispatcher';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────
const FACILITY_TYPES = [
  { value: 'private_hospital', label: 'Private Hospital', icon: Building2 },
  { value: 'health_centre',    label: 'Health Centre', icon: Activity },
  { value: 'specialist_clinic',label: 'Specialist Clinic', icon: Stethoscope },
  { value: 'diagnostic_lab',   label: 'Diagnostic Lab', icon: FlaskConical },
];

const COUNTIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 
  'Uasin Gishu', 'Kajiado', 'Machakos', 'Nyeri'
];

// ─── Components ───────────────────────────────────────────────────────────────

export default function RegisterFacilityPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    facilityName: '',
    facilityType: 'private_hospital',
    county: 'Nairobi',
    facilityEmail: '',
    phone: '',
    mflCode: '',
    physicalAddress: '',
    adminName: '',
    adminEmail: '',
    adminTitle: 'Hospital Administrator',
    services: [] as string[],
    bedCount: '',
    operatingHours: '24/7'
  });

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/facilities/internal-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to register facility');
      }

      nextStep(); // Move to Success step
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout 
      title="Rapid Onboarding" 
      subtitle="Direct facility registration for pre-vetted institutional nodes"
    >
      <div className="max-w-4xl mx-auto">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-12 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-800 -translate-y-1/2 z-0" />
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i}
              className={cn(
                "relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500",
                step === i ? "bg-primary text-white ring-4 ring-primary/20 scale-110" : 
                step > i ? "bg-success text-white" : "bg-gray-900 text-gray-500 border border-gray-800"
              )}
            >
              {step > i ? <CheckCircle2 className="w-5 h-5" /> : i}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <div className="bg-gray-950 border border-gray-800 rounded-3xl p-8 shadow-2xl">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Building2 className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold">Institutional Node</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Facility Name</label>
                  <input 
                    type="text" 
                    value={formData.facilityName}
                    onChange={e => setFormData({...formData, facilityName: e.target.value})}
                    placeholder="e.g. Afya Bora Medical Center"
                    className="w-full border border-content-border rounded-card p-3 text-sm text-ink focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Facility Type</label>
                  <select 
                    value={formData.facilityType}
                    onChange={e => setFormData({...formData, facilityType: e.target.value})}
                    className="w-full border border-content-border rounded-card p-3 text-sm text-ink focus:ring-1 focus:ring-primary outline-none appearance-none bg-content-bg"
                  >
                    {FACILITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">County</label>
                  <select 
                    value={formData.county}
                    onChange={e => setFormData({...formData, county: e.target.value})}
                    className="w-full border border-content-border rounded-card p-3 text-sm text-ink focus:ring-1 focus:ring-primary outline-none bg-content-bg"
                  >
                    {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Registration / MFL Code</label>
                  <input 
                    type="text" 
                    value={formData.mflCode}
                    onChange={e => setFormData({...formData, mflCode: e.target.value})}
                    placeholder="e.g. 123456"
                    className="w-full border border-content-border rounded-card p-3 text-sm text-ink focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Official Email</label>
                  <input 
                    type="email" 
                    value={formData.facilityEmail}
                    onChange={e => setFormData({...formData, facilityEmail: e.target.value})}
                    placeholder="contact@hospital.co.ke"
                    className="w-full border border-content-border rounded-card p-3 text-sm text-ink focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Phone Number</label>
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="+254..."
                    className="w-full border border-content-border rounded-card p-3 text-sm text-ink focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={nextStep}
                  disabled={!formData.facilityName || !formData.facilityEmail}
                  className="group flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-card font-bold transition-all disabled:opacity-50"
                >
                  Administrator Details
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                  <User className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold">Administrative Lead</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Admin Full Name</label>
                  <input 
                    type="text" 
                    value={formData.adminName}
                    onChange={e => setFormData({...formData, adminName: e.target.value})}
                    className="w-full border border-content-border rounded-card p-3 text-sm text-ink focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Work Email Address</label>
                  <input 
                    type="email" 
                    value={formData.adminEmail}
                    onChange={e => setFormData({...formData, adminEmail: e.target.value})}
                    className="w-full border border-content-border rounded-card p-3 text-sm text-ink focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Position / Title</label>
                  <input 
                    type="text" 
                    value={formData.adminTitle}
                    onChange={e => setFormData({...formData, adminTitle: e.target.value})}
                    className="w-full border border-content-border rounded-card p-3 text-sm text-ink focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="bg-warning/5 border border-warning/20 rounded-card p-4 flex gap-3">
                <Info className="w-5 h-5 text-warning shrink-0" />
                <p className="text-xs text-warning/70 leading-relaxed">
                  The administrator will receive a secure Supabase invitation to set their password. 
                  They will be the primary authority for this hospital node.
                </p>
              </div>

              <div className="flex justify-between pt-4">
                <button onClick={prevStep} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-all">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button 
                  onClick={nextStep}
                  disabled={!formData.adminName || !formData.adminEmail}
                  className="group flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-card font-bold transition-all disabled:opacity-50"
                >
                  Final Verification
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-success/10 rounded-lg text-success">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold">Verification</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 p-4 rounded-card border border-gray-800">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Hospital</p>
                  <p className="text-sm font-semibold">{formData.facilityName}</p>
                  <p className="text-xs text-gray-500 mt-1">{formData.county} · {formData.facilityType}</p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-card border border-gray-800">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Lead Admin</p>
                  <p className="text-sm font-semibold">{formData.adminName}</p>
                  <p className="text-xs text-gray-500 mt-1">{formData.adminEmail}</p>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-danger/10 border border-danger/20 rounded-card text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button onClick={prevStep} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-all">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <ActionDispatcher 
                  label="Complete Registration"
                  onAction={handleSubmit}
                  className="px-8 py-3 rounded-card font-bold shadow-lg shadow-emerald-600/20"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-12 space-y-6 animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-success/20">
                <CheckCircle2 className="w-10 h-10 text-success" />
              </div>
              <h2 className="text-3xl font-serif">Facility Registered</h2>
              <p className="text-mist max-w-sm mx-auto">
                {formData.facilityName} has been successfully added to the East Africa node network. 
                An activation link has been sent to <strong>{formData.adminEmail}</strong>.
              </p>
              <div className="pt-8">
                <button 
                  onClick={() => router.push('/portal/superadmin/facilities')}
                  className="px-8 py-3 bg-content-bg text-ink rounded-card font-bold hover:bg-gray-100 transition-all"
                >
                  Return to Registry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

// Icons for the types
function Activity({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
  );
}

function FlaskConical({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v4"/><path d="m12 2 3.5 7h-7L12 2Z"/><path d="M14 2h.01"/><path d="M12 9v13"/><path d="M5 22h14"/><path d="M15 15h.01"/><path d="M11 11h.01"/></svg>
  );
}
