'use client';

import { useState } from 'react';
import {
  Building2, CheckCircle, XCircle, Clock, Eye, Search,
  MapPin, Phone, Mail, Filter, Download, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Status = 'pending' | 'approved' | 'rejected' | 'under_review';

interface FacilityApplication {
  id: string;
  facilityName: string;
  facilityType: string;
  county: string;
  subCounty?: string;
  ownership: string;
  phone: string;
  facilityEmail: string;
  mflCode?: string;
  SHIFContracted: boolean;
  adminName: string;
  adminEmail: string;
  services: string[];
  bedCount?: number;
  status: Status;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

const SAMPLE_APPLICATIONS: FacilityApplication[] = [
  {
    id: 'FAC-001',
    facilityName: 'Nakuru County Referral Hospital',
    facilityType: 'County Referral Hospital (Level 5)',
    county: 'Nakuru',
    subCounty: 'Nakuru East',
    ownership: 'Government / County',
    phone: '0512 211 348',
    facilityEmail: 'info@nakurucounty.go.ke',
    mflCode: '14950',
    SHIFContracted: true,
    adminName: 'Dr. Peter Kimani',
    adminEmail: 'pkimani@nakurucounty.go.ke',
    services: ['Inpatient (General)', 'Outpatient (OPD)', 'Emergency & Casualty', 'Surgery', 'ICU', 'Laboratory', 'Pharmacy', 'Maternity (ANC/PNC/Delivery)'],
    bedCount: 320,
    status: 'pending',
    submittedAt: '2026-04-03T08:22:00Z',
  },
  {
    id: 'FAC-002',
    facilityName: 'Aga Khan Hospital Kisumu',
    facilityType: 'Private Hospital (Private)',
    county: 'Kisumu',
    subCounty: 'Kisumu Central',
    ownership: 'Private',
    phone: '0593 001 001',
    facilityEmail: 'kisumu@agakhan.org',
    mflCode: '14421',
    SHIFContracted: true,
    adminName: 'Dr. Amina Said',
    adminEmail: 'asaid@agakhan.org',
    services: ['Inpatient (General)', 'Outpatient (OPD)', 'Surgery', 'Maternity (ANC/PNC/Delivery)', 'Laboratory', 'Radiology / Imaging', 'Pharmacy'],
    bedCount: 140,
    status: 'under_review',
    submittedAt: '2026-04-02T14:10:00Z',
    reviewedBy: 'AfyaHero Ops Team',
    notes: 'MFL code verified. Awaiting SHIF/SHA portal cross-check.',
  },
  {
    id: 'FAC-003',
    facilityName: 'Mombasa Cross Road Clinic',
    facilityType: 'Dispensary / Clinic (Level 2)',
    county: 'Mombasa',
    subCounty: 'Mvita',
    ownership: 'Private',
    phone: '0741 288 102',
    facilityEmail: 'crossroadclinic@gmail.com',
    mflCode: '',
    SHIFContracted: false,
    adminName: 'Nurse Faith Juma',
    adminEmail: 'faithj@crossroadclinic.co.ke',
    services: ['Outpatient (OPD)', 'Laboratory', 'Pharmacy'],
    bedCount: 10,
    status: 'pending',
    submittedAt: '2026-04-03T09:45:00Z',
  },
  {
    id: 'FAC-004',
    facilityName: 'Tumain Mission Hospital',
    facilityType: 'Faith-Based Hospital (FBO)',
    county: 'Kiambu',
    subCounty: 'Kikuyu',
    ownership: 'Faith-Based (FBO)',
    phone: '0720 344 987',
    facilityEmail: 'admin@tumainhospital.org',
    mflCode: '13812',
    SHIFContracted: true,
    adminName: 'Rev. Dr. Daniel Njoroge',
    adminEmail: 'dnjoroge@tumainhospital.org',
    services: ['Inpatient (General)', 'Outpatient (OPD)', 'Maternity (ANC/PNC/Delivery)', 'Paediatrics', 'Laboratory', 'Pharmacy'],
    bedCount: 85,
    status: 'approved',
    submittedAt: '2026-03-28T11:00:00Z',
    reviewedBy: 'AfyaHero Ops Team',
    reviewedAt: '2026-03-30T09:00:00Z',
  },
  {
    id: 'FAC-005',
    facilityName: 'Garissa Regional Dispensary',
    facilityType: 'Dispensary / Clinic (Level 2)',
    county: 'Garissa',
    ownership: 'Government / County',
    phone: '0466 422 001',
    facilityEmail: 'garissadispensary@health.go.ke',
    mflCode: '15443',
    SHIFContracted: false,
    adminName: 'Hassan Omar',
    adminEmail: 'homar@health.go.ke',
    services: ['Outpatient (OPD)', 'Pharmacy'],
    status: 'rejected',
    submittedAt: '2026-03-25T07:30:00Z',
    reviewedBy: 'AfyaHero Ops Team',
    reviewedAt: '2026-03-26T14:00:00Z',
    notes: 'Duplicate submission — facility already registered under MFL code 15443 in a separate account. Contact support@afyahero.com to merge.',
  },
];

const STATUS_CONFIG: Record<Status, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:      { label: 'Pending',      cls: 'bg-warning/5 text-warning border-warning/20',    icon: <Clock className="w-3 h-3" /> },
  under_review: { label: 'Under Review', cls: 'bg-primary/5 text-primary border-primary/20',       icon: <Eye className="w-3 h-3" /> },
  approved:     { label: 'Approved',     cls: 'bg-success/5 text-success border-success/20', icon: <CheckCircle className="w-3 h-3" /> },
  rejected:     { label: 'Rejected',     cls: 'bg-danger/5 text-danger border-danger/20',           icon: <XCircle className="w-3 h-3" /> },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function FacilityApplicationsPage() {
  const [applications, setApplications] = useState<FacilityApplication[]>(SAMPLE_APPLICATIONS);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [selected, setSelected] = useState<FacilityApplication | null>(null);
  const [notes, setNotes] = useState('');

  const filtered = applications.filter((a) => {
    const matchSearch = !search ||
      a.facilityName.toLowerCase().includes(search.toLowerCase()) ||
      a.county.toLowerCase().includes(search.toLowerCase()) ||
      a.adminName.toLowerCase().includes(search.toLowerCase()) ||
      (a.mflCode && a.mflCode.includes(search));
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    under_review: applications.filter(a => a.status === 'under_review').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const updateStatus = (id: string, status: Status) => {
    setApplications((apps) =>
      apps.map((a) =>
        a.id === id
          ? { ...a, status, reviewedBy: 'Admin User', reviewedAt: new Date().toISOString(), notes: notes || a.notes }
          : a,
      ),
    );
    setSelected((s) => s ? { ...s, status, reviewedBy: 'Admin User', reviewedAt: new Date().toISOString(), notes: notes || s.notes } : null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Facility Applications
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Submit facility requests and track AfyaHero system admin approvals</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/auth/register-facility"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-card bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <Building2 className="w-4 h-4" /> Submit New Facility
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-content-border rounded-card hover:bg-content-surface text-slate-600 transition-colors" title="Export CSV">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: 'Pending Review', value: counts.pending, colorClass: 'text-warning', sub: 'awaiting action' },
          { label: 'Under Review', value: counts.under_review, colorClass: 'text-primary', sub: 'in progress' },
          { label: 'Approved', value: counts.approved, colorClass: 'text-success', sub: 'active facilities' },
          { label: 'Rejected', value: counts.rejected, colorClass: 'text-danger', sub: 'not approved' },
        ] as const).map((k) => (
          <div key={k.label} className="bg-content-bg border border-content-border rounded-card p-4 shadow-card space-y-1">
            <p className="text-xs text-slate-500 font-medium">{k.label}</p>
            <p className="text-2xl font-bold text-ink">{k.value}</p>
            <p className={cn('text-xs', k.colorClass)}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, county, MFL code, admin…"
            aria-label="Search facility applications by facility, county, MFL code, or administrator"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-content-border rounded-card outline-none focus:border-primary bg-content-bg"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          {(['all', 'pending', 'under_review', 'approved', 'rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all',
                filterStatus === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-content-bg text-slate-600 border-content-border hover:border-content-border',
              )}
            >
              {s === 'all' ? `All (${counts.all})` : s === 'under_review' ? `Under Review (${counts.under_review})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s]})`}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('grid gap-6', selected ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1')}>
        {/* Applications table */}
        <div className={cn('bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card', selected ? 'lg:col-span-2' : 'col-span-1')}>
          <div className="px-5 py-4 border-b border-content-border bg-content-surface/80">
            <p className="text-sm font-semibold text-ink">{filtered.length} application{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <li className="px-5 py-10 text-center text-slate-400 text-sm">No applications match your filter.</li>
            )}
            {filtered.map((app) => {
              const sc = STATUS_CONFIG[app.status];
              return (
                <li
                  key={app.id}
                  onClick={() => { setSelected(app); setNotes(app.notes ?? ''); }}
                  className={cn(
                    'px-5 py-4 hover:bg-content-surface cursor-pointer transition-colors',
                    selected?.id === app.id ? 'bg-primary/5 border-l-2 border-l-primary' : '',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{app.facilityName}</p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {app.county}{app.subCounty ? ` · ${app.subCounty}` : ''}
                      </p>
                    </div>
                    <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0', sc.cls)}>
                      {sc.icon}{sc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span className="font-mono">{app.id}</span>
                    <span>·</span>
                    <span>{formatDate(app.submittedAt)}</span>
                    {app.SHIFContracted && (
                      <span className="flex items-center gap-0.5 text-success font-medium">
                        <Shield className="w-3 h-3" /> SHIF
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="lg:col-span-3 bg-content-bg border border-content-border rounded-card shadow-card overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-content-border bg-content-surface/80 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-ink">{selected.facilityName}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selected.facilityType}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border', STATUS_CONFIG[selected.status].cls)}>
                  {STATUS_CONFIG[selected.status].icon} {STATUS_CONFIG[selected.status].label}
                </span>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors text-xs">✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Facility Details */}
              <Section title="Facility Details">
                <Row label="MFL Code" value={selected.mflCode || '—'} mono />
                <Row label="Ownership" value={selected.ownership} />
                <Row label="County" value={selected.county + (selected.subCounty ? ` · ${selected.subCounty}` : '')} />
                <Row label="SHIF/SHA" value={selected.SHIFContracted ? '✓ Contracted' : 'Not contracted'} valueClass={selected.SHIFContracted ? 'text-success' : undefined} />
                {selected.bedCount && <Row label="Bed Count" value={`${selected.bedCount} beds`} />}
                <div className="flex items-center gap-2 pt-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-700">{selected.phone}</span>
                  <Mail className="w-3.5 h-3.5 text-slate-400 ml-3" />
                  <span className="text-sm text-slate-700">{selected.facilityEmail}</span>
                </div>
              </Section>

              {/* Admin Contact */}
              <Section title="Administrator Contact">
                <Row label="Name" value={selected.adminName} />
                <Row label="Email" value={selected.adminEmail} />
              </Section>

              {/* Services */}
              <Section title="Clinical Services">
                <div className="flex flex-wrap gap-1.5">
                  {selected.services.map((s) => (
                    <span key={s} className="px-2 py-0.5 bg-primary/5 border border-primary/20 text-primary text-xs rounded-full">{s}</span>
                  ))}
                </div>
              </Section>

              {/* Timeline */}
              <Section title="Timeline">
                <Row label="Submitted" value={formatDate(selected.submittedAt)} />
                {selected.reviewedAt && <Row label="Reviewed" value={formatDate(selected.reviewedAt)} />}
                {selected.reviewedBy && <Row label="Reviewed by" value={selected.reviewedBy} />}
              </Section>

              {/* Reviewer notes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reviewer Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes about this application…"
                  className="w-full text-sm border border-content-border rounded-card px-3 py-2.5 resize-none outline-none focus:border-primary text-slate-700"
                />
              </div>
            </div>

            {/* Action buttons */}
            {(selected.status === 'pending' || selected.status === 'under_review') && (
              <div className="px-6 py-4 border-t border-content-border bg-content-surface/80 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => updateStatus(selected.id, 'under_review')}
                  disabled={selected.status === 'under_review'}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-card border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-40"
                >
                  <Eye className="w-4 h-4" /> Mark Under Review
                </button>
                <button
                  onClick={() => updateStatus(selected.id, 'approved')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-card bg-success text-white hover:bg-success/90 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" /> Approve Facility
                </button>
                <button
                  onClick={() => updateStatus(selected.id, 'rejected')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-card border border-danger/20 text-danger bg-danger/5 hover:bg-danger/10 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            )}
            {selected.status === 'approved' && (
              <div className="px-6 py-4 border-t border-content-border bg-success/5 text-sm text-success font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> This facility has been approved and is active on AfyaHero.
              </div>
            )}
            {selected.status === 'rejected' && (
              <div className="px-6 py-4 border-t border-content-border bg-danger/5 text-sm text-danger font-medium flex items-center gap-2">
                <XCircle className="w-4 h-4" /> This application was rejected. {selected.notes && <span className="text-danger font-normal">— {selected.notes}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pb-1 border-b border-content-border/50">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs text-slate-400 w-24 shrink-0">{label}</span>
      <span className={cn('text-sm', mono ? 'font-mono text-slate-600' : 'text-slate-800', valueClass)}>
        {value}
      </span>
    </div>
  );
}
