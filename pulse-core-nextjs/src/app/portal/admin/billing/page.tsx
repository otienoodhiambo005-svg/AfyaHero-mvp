'use client';

import { cn } from '@/lib/utils';
import InsuranceOptimizationPanel from '@/components/billing/InsuranceOptimizationPanel';

type BillStatus = 'Pending' | 'Submitted' | 'Paid' | 'Rejected';

interface BillingRow {
  id: string;
  patient: string;
  payer: string;
  amount: number;
  status: BillStatus;
  updatedAt: string;
}

const rows: BillingRow[] = [
  { id: 'INV-3321', patient: 'Hassan Ali', payer: 'SHIF', amount: 12400, status: 'Submitted', updatedAt: '10:20' },
  { id: 'INV-3322', patient: 'Achieng Otieno', payer: 'Cash', amount: 3200, status: 'Paid', updatedAt: '09:58' },
  { id: 'INV-3323', patient: 'Samuel Kibet', payer: 'Jubilee', amount: 48600, status: 'Pending', updatedAt: '09:42' },
  { id: 'INV-3324', patient: 'Mary Waweru', payer: 'AAR', amount: 15500, status: 'Rejected', updatedAt: '09:15' },
  { id: 'INV-3325', patient: 'Peter Njoroge', payer: 'SHIF', amount: 7600, status: 'Submitted', updatedAt: '08:50' },
];

const statusStyle: Record<BillStatus, string> = {
  Pending: 'bg-slate-100 text-slate-700 border border-content-border',
  Submitted: 'bg-blue-100 text-blue-700 border border-blue-200',
  Paid: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  Rejected: 'bg-rose-100 text-rose-700 border border-rose-200',
};

const currency = (value: number) => `KES ${value.toLocaleString('en-KE')}`;

export default function Page() {
  const totals = {
    pending: rows.filter((r) => r.status === 'Pending').length,
    submitted: rows.filter((r) => r.status === 'Submitted').length,
    paid: rows.filter((r) => r.status === 'Paid').reduce((a, b) => a + b.amount, 0),
    rejected: rows.filter((r) => r.status === 'Rejected').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Billing Operations</h1>
        <p className="text-sm text-slate-600">Claims submission, collections, and payer exception management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-content-border bg-content-bg p-3"><p className="text-xs text-slate-500">Pending Claims</p><p className="text-xl font-bold text-ink">{totals.pending}</p></div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-xs text-blue-700">Submitted</p><p className="text-xl font-bold text-blue-700">{totals.submitted}</p></div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Collected Today</p><p className="text-xl font-bold text-emerald-700">{currency(totals.paid)}</p></div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3"><p className="text-xs text-rose-700">Rejected</p><p className="text-xl font-bold text-rose-700">{totals.rejected}</p></div>
      </div>

      {/* AI-Powered Insurance Optimization - Desktop/Tablet Optimized */}
      <InsuranceOptimizationPanel diagnosis="Hypertension" procedures={['ECG', 'Blood work']} />

      <div className="rounded-card border border-content-border bg-content-bg p-4 shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-content-border">
              <th className="py-2">Invoice</th><th className="py-2">Patient</th><th className="py-2">Payer</th><th className="py-2">Amount</th><th className="py-2">Status</th><th className="py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-content-border/50">
                <td className="py-2 font-mono text-xs text-blue-700">{r.id}</td>
                <td className="py-2 text-ink font-medium">{r.patient}</td>
                <td className="py-2 text-slate-700">{r.payer}</td>
                <td className="py-2 text-slate-700">{currency(r.amount)}</td>
                <td className="py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full', statusStyle[r.status])}>{r.status}</span></td>
                <td className="py-2 text-slate-600">{r.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}