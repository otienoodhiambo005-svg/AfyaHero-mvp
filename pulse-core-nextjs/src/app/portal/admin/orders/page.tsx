'use client';

import { useState } from 'react';
import { Search, FlaskConical, Pill, Image as ImageIcon, Stethoscope, Filter } from 'lucide-react';

const ACCENT = '#3282B8';

interface Order {
  ref: string;
  patient: string;
  type: 'Lab' | 'Imaging' | 'Pharmacy' | 'Consult';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  dept: string;
  requestedBy: string;
  time: string;
}

const ORDERS: Order[] = [
  { ref: 'ORD-5511', patient: 'Hassan Ali',      type: 'Lab',      status: 'Pending',    dept: 'Medical → Lab',      requestedBy: 'Dr. Amina',  time: '09:14' },
  { ref: 'ORD-5512', patient: 'Grace Abuya',     type: 'Imaging',  status: 'In Progress', dept: 'Medical → Radiology', requestedBy: 'Dr. Njoroge', time: '09:32' },
  { ref: 'ORD-5513', patient: 'Wanjiru Njeri',   type: 'Pharmacy', status: 'Completed',  dept: 'Medical → Pharmacy', requestedBy: 'Dr. Amina',  time: '08:55' },
  { ref: 'ORD-5514', patient: 'Daniel Muthoni',  type: 'Lab',      status: 'Pending',    dept: 'Medical → Lab',      requestedBy: 'Dr. Waweru', time: '09:51' },
  { ref: 'ORD-5515', patient: 'Fatuma Ochieng',  type: 'Consult',  status: 'Pending',    dept: 'Medical → Cardiology', requestedBy: 'Dr. Amina', time: '10:02' },
  { ref: 'ORD-5516', patient: 'Joseph Odhiambo', type: 'Pharmacy', status: 'In Progress', dept: 'Medical → Pharmacy', requestedBy: 'Dr. Grace',  time: '10:15' },
  { ref: 'ORD-5517', patient: 'Amina Keita',     type: 'Lab',      status: 'Completed',  dept: 'Medical → Lab',      requestedBy: 'Dr. Njoroge', time: '08:30' },
  { ref: 'ORD-5518', patient: 'Peter Kamau',     type: 'Imaging',  status: 'Cancelled',  dept: 'Medical → Radiology', requestedBy: 'Dr. Waweru', time: '08:45' },
];

const TYPE_ICON: Record<string, React.ReactNode> = {
  Lab:      <FlaskConical className="w-4 h-4" />,
  Imaging:  <ImageIcon className="w-4 h-4" />,
  Pharmacy: <Pill className="w-4 h-4" />,
  Consult:  <Stethoscope className="w-4 h-4" />,
};

const STATUS_STYLE: Record<string, string> = {
  Pending:     'bg-amber-50 text-amber-700',
  'In Progress':'bg-blue-50 text-blue-700',
  Completed:   'bg-green-50 text-green-700',
  Cancelled:   'bg-slate-100 text-slate-500',
};

export default function AdminOrdersPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const types = ['All', 'Lab', 'Imaging', 'Pharmacy', 'Consult'];
  const statuses = ['All', 'Pending', 'In Progress', 'Completed', 'Cancelled'];

  const filtered = ORDERS.filter((o) => {
    const matchSearch = o.patient.toLowerCase().includes(search.toLowerCase()) || o.ref.includes(search);
    const matchType   = typeFilter   === 'All' || o.type   === typeFilter;
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const pending = ORDERS.filter((o) => o.status === 'Pending').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Cross-Department Orders</h1>
        <span className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1">
          {pending} Pending
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {types.slice(1).map((t) => {
          const count = ORDERS.filter((o) => o.type === t).length;
          return (
            <div key={t} className="rounded-card border border-content-border bg-content-bg p-3 shadow-card flex items-center gap-2">
              <span style={{ color: ACCENT }}>{TYPE_ICON[t]}</span>
              <div><p className="text-xs text-slate-500">{t}</p><p className="font-bold text-ink">{count}</p></div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient or order ref" aria-label="Search orders by patient name or order reference"
            className="w-full pl-9 pr-3 py-2 rounded-card border border-content-border text-sm outline-none" />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-card border border-content-border px-3 py-2 text-sm text-slate-700 outline-none">
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-card border border-content-border px-3 py-2 text-sm text-slate-700 outline-none">
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="rounded-card border border-content-border bg-content-bg shadow-card divide-y divide-slate-100">
        {filtered.map((o) => (
          <div key={o.ref} className="flex items-center justify-between p-4 hover:bg-content-surface transition-colors">
            <div className="flex items-center gap-3">
              <span style={{ color: ACCENT }}>{TYPE_ICON[o.type]}</span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink">{o.ref}</p>
                  <span className="text-xs font-mono text-slate-400">{o.time}</span>
                </div>
                <p className="text-sm text-slate-500">{o.patient} • {o.dept} • {o.requestedBy}</p>
              </div>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status]}`}>{o.status}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-8 text-slate-400">No orders match filters.</p>
        )}
      </div>
    </div>
  );
}