'use client';

import { useState } from 'react';
import { Search, Users, BedDouble, AlertTriangle, Filter } from 'lucide-react';

const ACCENT = '#3282B8';

interface Patient {
  id: string;
  name: string;
  ward: string;
  admitDate: string;
  status: string;
  doctor: string;
  insurance: string;
}

const PATIENTS: Patient[] = [
  { id: 'PID-10021', name: 'Hassan Ali',        ward: 'ICU',      admitDate: '2025-07-08', status: 'Critical', doctor: 'Dr. Amina Wanjiru',  insurance: 'SHIF' },
  { id: 'PID-10022', name: 'Fatuma Wanjiru',    ward: 'Maternity', admitDate: '2025-07-09', status: 'Admitted', doctor: 'Dr. Grace Muthoni',  insurance: 'AAR' },
  { id: 'PID-10023', name: 'Peter Kamau',       ward: 'General',  admitDate: '2025-07-07', status: 'Stable',   doctor: 'Dr. James Odhiambo', insurance: 'Cash' },
  { id: 'PID-10024', name: 'Amina Keita',       ward: 'Surgical', admitDate: '2025-07-09', status: 'Post-Op',  doctor: 'Dr. Samuel Njoroge', insurance: 'SHIF' },
  { id: 'PID-10025', name: 'Daniel Muthoni',    ward: 'General',  admitDate: '2025-07-08', status: 'Stable',   doctor: 'Dr. Amina Wanjiru',  insurance: 'Jubilee' },
  { id: 'PID-10026', name: 'Grace Achieng',     ward: 'Paediatric', admitDate:'2025-07-09', status: 'Admitted', doctor: 'Dr. Ruth Ndungu',    insurance: 'SHIF' },
  { id: 'PID-10027', name: 'Joseph Odhiambo',   ward: 'ICU',      admitDate: '2025-07-09', status: 'Critical', doctor: 'Dr. James Odhiambo', insurance: 'Cash' },
  { id: 'PID-10028', name: 'Lucy Wambui',       ward: 'Maternity', admitDate: '2025-07-09', status: 'Admitted', doctor: 'Dr. Grace Muthoni',  insurance: 'SHIF' },
  { id: 'PID-10029', name: 'Mohammed Otieno',   ward: 'General',  admitDate: '2025-07-06', status: 'Discharge', doctor: 'Dr. Samuel Njoroge', insurance: 'APA' },
  { id: 'PID-10030', name: 'Jane Njeri',        ward: 'Surgical', admitDate: '2025-07-08', status: 'Post-Op',  doctor: 'Dr. Amina Wanjiru',  insurance: 'SHIF' },
];

const STATUS_STYLE: Record<string, string> = {
  Critical:  'bg-red-50 text-red-700',
  'Post-Op': 'bg-purple-50 text-purple-700',
  Admitted:  'bg-blue-50 text-blue-700',
  Stable:    'bg-green-50 text-green-700',
  Discharge: 'bg-slate-100 text-slate-600',
};

export default function AdminPatientsPage() {
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('All');

  const wards = ['All', ...Array.from(new Set(PATIENTS.map((p) => p.ward))).sort()];
  const filtered = PATIENTS.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search);
    const matchWard = wardFilter === 'All' || p.ward === wardFilter;
    return matchSearch && matchWard;
  });

  const critCount = PATIENTS.filter((p) => p.status === 'Critical').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Hospital Patients</h1>
        <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          {critCount} Critical
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total In-Patient',  value: PATIENTS.length, icon: <Users className="w-4 h-4" /> },
          { label: 'ICU',               value: PATIENTS.filter(p=>p.ward === 'ICU').length, icon: <BedDouble className="w-4 h-4" /> },
          { label: 'Critical',          value: critCount, icon: <AlertTriangle className="w-4 h-4" /> },
          { label: 'Pending Discharge', value: PATIENTS.filter(p=>p.status === 'Discharge').length, icon: <Users className="w-4 h-4" /> },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-content-border bg-content-bg p-3 shadow-card flex items-center gap-3">
            <span style={{ color: ACCENT }}>{k.icon}</span>
            <div>
              <p className="text-xs text-slate-500">{k.label}</p>
              <p className="font-bold text-ink text-lg">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient name or ID"
            aria-label="Search patients by name or patient ID"
            className="w-full pl-9 pr-3 py-2 rounded-card border border-content-border text-sm outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as string]: ACCENT + '40' } as React.CSSProperties}
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="rounded-card border border-content-border px-3 py-2 text-sm text-slate-700 outline-none"
          >
            {wards.map((w) => <option key={w}>{w}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-card border border-content-border bg-content-bg shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-content-border">
              <th className="py-3 px-4">Patient ID</th>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Ward</th>
              <th className="py-3 px-4">Admit Date</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Doctor</th>
              <th className="py-3 px-4">Insurance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{p.id}</td>
                <td className="py-2.5 px-4 font-medium text-ink">{p.name}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.ward}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.admitDate}</td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status] ?? 'bg-slate-100 text-slate-700'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-slate-600">{p.doctor}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.insurance}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">No patients match filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}