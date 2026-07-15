'use client';

import { useState } from 'react';
import { DollarSign, CheckCircle2, Clock, AlertCircle, Download, TrendingUp } from 'lucide-react';

const ACCENT = '#2E86AB';

type BatchStatus = 'Balanced' | 'Pending' | 'Under Review' | 'Rejected';

interface Batch {
  id: string;
  method: string;
  amount: number;
  expected: number;
  transactions: number;
  status: BatchStatus;
  time: string;
}

const BATCHES: Batch[] = [
  { id: 'MPESA-AM-01', method: 'M-Pesa (Paybill)', amount: 148200, expected: 148200, transactions: 34, status: 'Balanced',    time: '08:30' },
  { id: 'CASH-AM-01',  method: 'Cash',              amount: 42500,  expected: 42500,  transactions: 12, status: 'Balanced',    time: '08:30' },
  { id: 'SHIF-AM-01',  method: 'SHIF Claims',       amount: 91000,  expected: 95000,  transactions: 18, status: 'Under Review', time: '09:00' },
  { id: 'VISA-AM-01',  method: 'Card (Visa/MC)',    amount: 28600,  expected: 28600,  transactions: 8,  status: 'Balanced',    time: '09:15' },
  { id: 'INS-AM-01',   method: 'Private Insurance', amount: 0,      expected: 62000,  transactions: 0,  status: 'Pending',     time: '—' },
];

const STATUS_STYLE: Record<BatchStatus, string> = {
  Balanced:     'bg-green-50 text-green-700',
  Pending:      'bg-amber-50 text-amber-700',
  'Under Review':'bg-blue-50 text-blue-700',
  Rejected:     'bg-red-50 text-red-700',
};

const STATUS_ICON: Record<BatchStatus, React.ReactNode> = {
  Balanced:     <CheckCircle2 className="w-3.5 h-3.5" />,
  Pending:      <Clock className="w-3.5 h-3.5" />,
  'Under Review':<AlertCircle className="w-3.5 h-3.5" />,
  Rejected:     <AlertCircle className="w-3.5 h-3.5" />,
};

function fmt(n: number) {
  return n === 0 ? '—' : `KES ${n.toLocaleString()}`;
}

export default function ReceptionFinancePage() {
  const [activeTab, setActiveTab] = useState<'morning' | 'full'>('morning');

  const totalCollected = BATCHES.reduce((s, b) => s + b.amount, 0);
  const totalExpected  = BATCHES.reduce((s, b) => s + b.expected, 0);
  const variance       = totalExpected - totalCollected;
  const balanced       = BATCHES.filter((b) => b.status === 'Balanced').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Finance Reconciliation</h1>
        <div className="flex gap-2">
          {(['morning', 'full'] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={activeTab === t ? { background: ACCENT, color: '#fff', borderColor: ACCENT } : { background: '#fff', color: '#64748b', borderColor: '#e2e8f0' }}>
              {t === 'morning' ? 'Morning Shift' : 'Full Day'}
            </button>
          ))}
          <button className="px-3 py-1.5 rounded-lg text-sm font-medium border border-content-border bg-content-bg text-slate-600 flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Collected',   value: fmt(totalCollected), icon: <DollarSign className="w-4 h-4" />,  color: '#16a34a' },
          { label: 'Expected',    value: fmt(totalExpected),  icon: <TrendingUp className="w-4 h-4" />,  color: ACCENT },
          { label: 'Variance',    value: variance === 0 ? 'Nil' : `KES ${variance.toLocaleString()}`, icon: <AlertCircle className="w-4 h-4" />, color: variance === 0 ? '#16a34a' : '#d97706' },
          { label: 'Balanced',    value: `${balanced}/${BATCHES.length} batches`, icon: <CheckCircle2 className="w-4 h-4" />, color: '#16a34a' },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-content-border bg-content-bg p-4 shadow-card">
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: k.color }}>{k.icon}</span>
              <p className="text-xs text-slate-500">{k.label}</p>
            </div>
            <p className="text-lg font-bold text-ink">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-card border border-content-border bg-content-bg shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-content-border">
              <th className="py-3 px-4">Batch ID</th>
              <th className="py-3 px-4">Payment Method</th>
              <th className="py-3 px-4">Transactions</th>
              <th className="py-3 px-4">Collected</th>
              <th className="py-3 px-4">Expected</th>
              <th className="py-3 px-4">Variance</th>
              <th className="py-3 px-4">Time</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {BATCHES.map((b) => {
              const diff = b.expected - b.amount;
              return (
                <tr key={b.id} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{b.id}</td>
                  <td className="py-2.5 px-4 text-ink">{b.method}</td>
                  <td className="py-2.5 px-4 text-slate-600">{b.transactions}</td>
                  <td className="py-2.5 px-4 font-medium text-ink">{fmt(b.amount)}</td>
                  <td className="py-2.5 px-4 text-slate-600">{fmt(b.expected)}</td>
                  <td className={`py-2.5 px-4 font-medium ${diff === 0 ? 'text-green-600' : diff > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {diff === 0 ? 'Nil' : `KES ${Math.abs(diff).toLocaleString()}`}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500">{b.time}</td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[b.status]}`}>
                      {STATUS_ICON[b.status]}{b.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}