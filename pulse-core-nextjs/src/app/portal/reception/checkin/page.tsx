'use client';

import { useState } from 'react';
import {
  Search, UserPlus, Eye, CheckCircle, X, ChevronDown, Fingerprint, ShieldCheck,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const IDCheckModal = dynamic(() => import('@/components/portal/IDCheckModal'), { ssr: false });

const ACCENT = '#F59E0B';

interface CheckInRow {
  token: string;
  patient: string;
  shif: string;
  SHIF?: string; // Backwards compatibility
  phone: string;
  priority: 'Normal' | 'Urgent' | 'Critical';
  time: string;
  status: 'Checked In' | 'Waiting' | 'In Consultation';
}

const RECENT: CheckInRow[] = [
  { token: 'A001', patient: 'Wanjiku Kamau', shif: '0045893712', SHIF: '0045893712', phone: '0722 345 678', priority: 'Normal', time: '07:42 AM', status: 'Checked In' },
  { token: 'A002', patient: 'Brian Omondi', shif: 'N/A', SHIF: 'N/A', phone: '0733 987 001', priority: 'Urgent', time: '07:55 AM', status: 'In Consultation' },
  { token: 'A003', patient: 'Fatuma Hassan', shif: '0067123456', SHIF: '0067123456', phone: '0711 223 344', priority: 'Normal', time: '08:10 AM', status: 'Waiting' },
  { token: 'A004', patient: 'James Kipchoge', shif: '0012345678', SHIF: '0012345678', phone: '0700 556 778', priority: 'Critical', time: '08:22 AM', status: 'In Consultation' },
  { token: 'A005', patient: 'Achieng Otieno', shif: '0089001234', SHIF: '0089001234', phone: '0799 334 556', priority: 'Normal', time: '08:35 AM', status: 'Waiting' },
  { token: 'A006', patient: 'Mohamed Abdi', shif: '0034567890', SHIF: '0034567890', phone: '0712 667 889', priority: 'Urgent', time: '08:47 AM', status: 'Checked In' },
];

const PRIORITY_STYLES: Record<string, string> = {
  Normal: 'bg-emerald-100 text-emerald-600',
  Urgent: 'bg-yellow-100 text-yellow-600',
  Critical: 'bg-red-100 text-red-600',
};

const STATUS_STYLES: Record<string, string> = {
  Waiting: 'bg-slate-100 text-slate-600',
  'In Consultation': 'bg-blue-100 text-blue-600',
  'Checked In': 'bg-emerald-100 text-emerald-600',
};

interface FormData {
  fullName: string;
  dob: string;
  gender: string;
  phone: string;
  nationalId: string;
  shif: string;
  SHIF: string; // Backwards compatibility
  complaint: string;
  priority: string;
  serviceType: string;
  insuranceProvider: string;
  memberNumber: string;
}

const EMPTY_FORM: FormData = {
  fullName: '', dob: '', gender: '', phone: '', nationalId: '', shif: '', SHIF: '',
  complaint: '', priority: 'Normal', serviceType: 'OPD',
  insuranceProvider: '', memberNumber: '',
};

export default function CheckInPage() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [recentRows, setRecentRows] = useState<CheckInRow[]>(RECENT);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [idCheckOpen, setIdCheckOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const filtered = recentRows.filter(
    (r) =>
      r.patient.toLowerCase().includes(search.toLowerCase()) ||
      r.shif.includes(search) ||
      (r.SHIF && r.SHIF.includes(search)) ||
      r.phone.replace(/\s/g, '').includes(search.replace(/\s/g, '')),
  );

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage(null);
    try {
      const response = await fetch('/api/reception/checkins', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          fullName: form.fullName,
          dob: form.dob,
          gender: form.gender,
          phone: form.phone,
          nationalId: form.nationalId,
          shif: form.shif,
          complaint: form.complaint,
          priority: form.priority,
          serviceType: form.serviceType,
          insuranceProvider: form.insuranceProvider,
          memberNumber: form.memberNumber,
        }),
      });
      if (!response.ok) {
        throw new Error(`Check-in failed (${response.status})`);
      }
      const created = await response.json() as CheckInRow;
      setRecentRows((prev) => [created, ...prev]);
      setSubmitMessage(`Check-in completed for ${created.patient}.`);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch {
      setSubmitMessage('Unable to complete check-in right now. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink">Patient Check-In</h1>
          <p className="text-slate-500 text-sm mt-0.5">Register and check in patients for today&apos;s visits</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-card font-semibold text-sm text-ink transition-opacity hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          <UserPlus className="w-4 h-4" />
          New Patient
        </button>
      </div>

      {/* New Check-In Form (toggleable) */}
      {showForm && (
        <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
          <div className="px-6 py-4 border-b border-content-border flex items-center justify-between bg-content-surface/80">
            <h2 className="text-ink font-semibold">New Check-In</h2>
            <button
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-ink transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Personal Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label htmlFor="checkin-full-name" className="text-xs text-slate-500">Full Name *</label>
                  <input
                    id="checkin-full-name"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Wanjiku Kamau"
                    className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:border-[color:var(--accent)]"
                    style={{ '--accent': ACCENT } as React.CSSProperties}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="checkin-dob" className="text-xs text-slate-500">Date of Birth *</label>
                  <input
                    id="checkin-dob"
                    type="date"
                    name="dob"
                    value={form.dob}
                    onChange={handleChange}
                    required
                    className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink focus:outline-none focus:border-[color:var(--accent)]"
                    style={{ '--accent': ACCENT } as React.CSSProperties}
                  />
                </div>
                <div className="space-y-1">
                    <label htmlFor="checkin-id-verification" className="text-xs text-slate-500">Identity Verification</label>
                    <button 
                        id="checkin-id-verification"
                        type="button"
                        onClick={() => setIdCheckOpen(true)}
                        className="w-full h-[38px] flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 border border-content-border rounded-card text-xs text-slate-600 font-bold hover:bg-slate-200 transition-all group relative overflow-hidden"
                    >
                        <Fingerprint className="w-4 h-4 text-blue-500" />
                        Biometric Verify
                    </button>
                </div>
                <div className="space-y-1">
                  <label htmlFor="checkin-gender" className="text-xs text-slate-500">Gender *</label>
                  <div className="relative">
                    <select
                      id="checkin-gender"
                      name="gender"
                      value={form.gender}
                      onChange={handleChange}
                      required
                      className="w-full appearance-none bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink focus:outline-none"
                    >
                      <option value="">Select gender</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="checkin-phone" className="text-xs text-slate-500">Phone Number *</label>
                  <input
                    id="checkin-phone"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    required
                    placeholder="07XX XXX XXX"
                    className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="checkin-national-id" className="text-xs text-slate-500">National ID</label>
                  <input
                    id="checkin-national-id"
                    name="nationalId"
                    value={form.nationalId}
                    onChange={handleChange}
                    placeholder="e.g. 34567890"
                    className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="checkin-shif-number" className="text-xs text-slate-500">SHIF Number</label>
                  <input
                    id="checkin-shif-number"
                    name="shif"
                    value={form.shif}
                    onChange={handleChange}
                    placeholder="e.g. 0045893712"
                    className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none"
                  />
                  <input
                    type="hidden"
                    name="SHIF"
                    value={form.shif}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Visit Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Visit Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 space-y-1">
                  <label className="text-xs text-slate-500">Triage Priority *</label>
                  <div className="relative">
                    <select
                      name="priority"
                      value={form.priority}
                      onChange={handleChange}
                      className="w-full appearance-none bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink focus:outline-none"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Critical">Critical</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Service Type *</label>
                  <div className="relative">
                    <select
                      name="serviceType"
                      value={form.serviceType}
                      onChange={handleChange}
                      className="w-full appearance-none bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink focus:outline-none"
                    >
                      <option value="OPD">OPD</option>
                      <option value="Lab">Lab</option>
                      <option value="Pharmacy">Pharmacy</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1 md:col-span-1">
                  {/* spacer */}
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs text-slate-500">Chief Complaint *</label>
                  <textarea
                    name="complaint"
                    value={form.complaint}
                    onChange={handleChange}
                    required
                    rows={2}
                    placeholder="Describe the patient's presenting complaint..."
                    className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Insurance */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Insurance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Insurance Provider</label>
                  <div className="relative">
                    <select
                      name="insuranceProvider"
                      value={form.insuranceProvider}
                      onChange={handleChange}
                      className="w-full appearance-none bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink focus:outline-none"
                    >
                      <option value="">None / Cash</option>
                      <option value="SHIF">SHIF</option>
                      <option value="SHIF">SHIF (Legacy)</option>
                      <option value="Jubilee">Jubilee Insurance</option>
                      <option value="AAR">AAR Healthcare</option>
                      <option value="Britam">Britam</option>
                      <option value="CIC">CIC Insurance</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Member Number</label>
                  <input
                    name="memberNumber"
                    value={form.memberNumber}
                    onChange={handleChange}
                    placeholder="Insurance member number"
                    className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-card font-semibold text-sm text-ink transition-opacity hover:opacity-90"
                style={{ backgroundColor: ACCENT }}
              >
                <CheckCircle className="w-4 h-4" />
                {isSubmitting ? 'Saving...' : 'Complete Check-In'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 rounded-card font-semibold text-sm text-slate-600 border border-content-border hover:bg-content-surface transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar */}
      {submitMessage && (
        <div className="rounded-card border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {submitMessage}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, National ID, or SHIF number..."
          aria-label="Search recent patient check-ins"
          className="w-full bg-content-bg border border-content-border rounded-card pl-12 pr-4 py-3 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:border-[color:var(--accent)] transition-colors"
          style={{ '--accent': ACCENT } as React.CSSProperties}
        />
      </div>

      {/* Recent Check-ins Table */}
      <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-content-border flex items-center justify-between bg-content-surface/80">
          <h2 className="text-ink font-semibold">Recent Check-ins — Today</h2>
          <span className="text-slate-500 text-sm">{filtered.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Token', 'Patient', 'SHIF', 'Phone', 'Priority', 'Time', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-slate-500 text-xs font-medium uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.token} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: ACCENT }}>{row.token}</td>
                  <td className="px-4 py-3 text-ink font-medium">{row.patient}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{row.shif}</td>
                  <td className="px-4 py-3 text-slate-500">{row.phone}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_STYLES[row.priority])}>
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.time}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[row.status])}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35" aria-label={`View check-in ${row.token}`}>
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <IDCheckModal 
        open={idCheckOpen} 
        onClose={() => setIdCheckOpen(false)}
        onMatch={(patient) => {
            setForm({
                ...EMPTY_FORM,
                fullName: patient.name,
                nationalId: patient.idNumber,
                shif: patient.idNumber, // Mocking SHIF as ID for demo
                SHIF: patient.idNumber,
            });
            setShowForm(true);
        }}
        onRegisterNew={() => {
            setIdCheckOpen(false);
            setForm(EMPTY_FORM);
            setShowForm(true);
        }}
      />
    </div>
  );
}
