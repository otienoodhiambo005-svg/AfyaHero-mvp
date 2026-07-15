'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Eye, Printer, X, Trash2, DollarSign, Phone, CreditCard, FileText, Send, CheckCircle, Loader2, Clock, ShieldCheck
} from 'lucide-react';
import SHIFClaimsPanel from '@/components/portal/billing/SHIFClaimsPanel';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

type InvoiceStatus = 'Paid' | 'Pending' | 'Partial';

interface InvoiceRow {
  id: string;
  patient: string;
  date: string;
  services: string;
  amount: number;
  paid: number;
  status: InvoiceStatus;
}

interface LineItem {
  id: number;
  description: string;
  qty: number;
  unitPrice: number;
}


const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Paid: 'bg-success/5 text-success border border-success/20',
  Pending: 'bg-warning/5 text-warning border border-warning/20',
  Partial: 'bg-warning/5 text-warning border border-warning/20',
};

const EMPTY_LINE_ITEMS: LineItem[] = [
  { id: 1, description: '', qty: 1, unitPrice: 0 },
];

function fmt(n: number): string {
  return `KES ${n.toLocaleString('en-KE')}`;
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reception/billing', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load invoices (${res.status})`);
      const data = await res.json();
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
    } catch (err) {
      logger.error('Failed to load invoices', { error: err });
      setError(err instanceof Error ? err.message : 'Could not load invoices.');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadInvoices(); }, [loadInvoices]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>(EMPTY_LINE_ITEMS);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  
  // M-Pesa specific state
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaPromptStatus, setMpesaPromptStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  
  // Card specific state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  
  // Insurance specific state
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [showClaimsPanel, setShowClaimsPanel] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = lineItems.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);

  function addLine() {
    setLineItems((prev) => [...prev, { id: Date.now(), description: '', qty: 1, unitPrice: 0 }]);
  }

  function removeLine(id: number) {
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateLine(id: number, field: keyof Omit<LineItem, 'id'>, value: string) {
    setLineItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, [field]: field === 'description' ? value : Number(value) }
          : i,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch('/api/billing/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          patient: patientSearch,
          lineItems: lineItems.filter((item) => item.description.trim().length > 0),
          paymentMethod,
          paymentAmount: Number(paymentAmount || 0),
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? 'Failed to create invoice.');
      }

      const invoice = payload.invoice as InvoiceRow;
      setInvoices((prev) => [invoice, ...prev]);
      setShowInvoiceForm(false);
      setLineItems(EMPTY_LINE_ITEMS);
      setPatientSearch('');
      setPaymentAmount('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create invoice.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Billing & Payments</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage invoices and collections</p>
        </div>
        <button
          onClick={() => setShowInvoiceForm((v) => !v)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-card font-semibold text-sm text-white bg-primary transition-opacity hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Today', value: 'KES 84,200', valueClass: 'text-primary' },
          { label: 'Cash', value: 'KES 32,400', valueClass: 'text-success' },
          { label: 'M-Pesa', value: 'KES 41,800', valueClass: 'text-info' },
          { label: 'Insurance', value: 'KES 10,000', valueClass: 'text-info' },
        ].map((s) => (
          <div
            key={s.label}
            role={s.label === 'Insurance' ? 'button' : undefined}
            tabIndex={s.label === 'Insurance' ? 0 : undefined}
            className={cn(
              "bg-content-bg border border-content-border rounded-card p-4 shadow-card transition-all hover:bg-content-surface relative group",
              s.label === 'Insurance' && "border-info/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35"
            )}
            onClick={() => s.label === 'Insurance' && setShowClaimsPanel(true)}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && s.label === 'Insurance') { e.preventDefault(); setShowClaimsPanel(true); } }}
          >
            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">{s.label}</p>
            <p className={cn('text-xl font-bold', s.valueClass)}>{s.value}</p>
            {s.label === 'Insurance' && (
              <div className="absolute top-2 right-2 p-1 bg-info/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <ShieldCheck className="w-3 h-3 text-info" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New Invoice Form */}
      {showInvoiceForm && (
        <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
          <div className="px-6 py-4 border-b border-content-border flex items-center justify-between">
            <h2 className="text-ink font-semibold">New Invoice</h2>
            <button
              onClick={() => setShowInvoiceForm(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {submitError && (
              <div className="rounded-card border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                {submitError}
              </div>
            )}
            {/* Patient search */}
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Patient *</label>
              <input
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search patient by name or token..."
                required
                className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Line Items</label>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-content-border text-slate-600 hover:text-ink hover:bg-slate-100 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Row
                </button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 px-1">
                  <span className="col-span-6">Description</span>
                  <span className="col-span-2">Qty</span>
                  <span className="col-span-2">Unit Price</span>
                  <span className="col-span-1">Total</span>
                  <span className="col-span-1" />
                </div>
                {lineItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      value={item.description}
                      onChange={(e) => updateLine(item.id, 'description', e.target.value)}
                      placeholder="Service description"
                      className="col-span-6 bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => updateLine(item.id, 'qty', e.target.value)}
                      className="col-span-2 bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) => updateLine(item.id, 'unitPrice', e.target.value)}
                      className="col-span-2 bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <span className="col-span-1 text-sm text-slate-600">
                      {(item.qty * item.unitPrice).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(item.id)}
                      className="col-span-1 p-1.5 rounded-lg hover:bg-danger/10 text-slate-500 hover:text-danger transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-end pt-2 border-t border-content-border">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-lg font-bold text-primary">{fmt(total)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <label className="text-xs text-slate-500">Payment Method</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { id: 'Cash', icon: <DollarSign className="w-4 h-4" />, activeClass: 'bg-primary', active: false },
                  { id: 'M-Pesa', icon: <Phone className="w-4 h-4" />, activeClass: 'bg-success', active: false },
                  { id: 'Card/Visa', icon: <CreditCard className="w-4 h-4" />, activeClass: 'bg-info', active: false },
                  { id: 'Insurance', icon: <FileText className="w-4 h-4" />, activeClass: 'bg-info', active: false },
                ].map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    disabled={!method.active}
                    onClick={() => setPaymentMethod(method.id)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-card border-2 transition-all text-sm font-medium relative',
                      paymentMethod === method.id
                        ? 'border-transparent text-white shadow-md'
                        : 'border-content-border text-slate-700 hover:border-content-border',
                      paymentMethod === method.id && method.activeClass,
                      !method.active && 'opacity-50 grayscale cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {method.icon}
                      {method.id}
                    </div>
                    {!method.active && (
                      <span className="text-[9px] font-bold uppercase tracking-tighter text-danger bg-danger/5 px-1.5 rounded-md border border-danger/20 absolute -top-2 -right-1">
                        Inactive
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Paid */}
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Amount Paid (KES)</label>
              <input
                type="number"
                min={0}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {/* M-Pesa Payment Section - DEACTIVATED */}
            {paymentMethod === 'M-Pesa' && false && (
              <div className="border border-success/20 bg-success/5 rounded-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-success flex items-center gap-2">
                    <Phone className="w-4 h-4" /> M-Pesa Payment
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Patient Phone Number</label>
                    <input
                      type="tel"
                      value={mpesaPhone}
                      onChange={(e) => setMpesaPhone(e.target.value)}
                      placeholder="2547XXXXXXXX"
                      className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/30 focus:border-success"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setMpesaPromptStatus('sending');
                        setTimeout(() => setMpesaPromptStatus('sent'), 2000);
                      }}
                      disabled={!mpesaPhone || mpesaPromptStatus === 'sending'}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-card font-medium text-white bg-success transition-opacity disabled:opacity-50"
                    >
                      {mpesaPromptStatus === 'sending' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : mpesaPromptStatus === 'sent' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {mpesaPromptStatus === 'sending' ? 'Sending Prompt...' : 
                       mpesaPromptStatus === 'sent' ? 'Prompt Sent ✓' : 'Send M-Pesa Prompt'}
                    </button>
                  </div>
                </div>

                {mpesaPromptStatus === 'sent' && (
                  <div className="flex items-center gap-2 p-3 bg-content-bg rounded-lg border border-success/20">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <p className="text-sm text-success">
                      M-Pesa STK push sent to {mpesaPhone}. Patient will receive a payment prompt on their phone.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Card/Visa Payment Section - DEACTIVATED */}
            {paymentMethod === 'Card/Visa' && false && (
              <div className="border border-info/20 bg-info/5 rounded-card p-4 space-y-4">
                <h3 className="font-semibold text-info flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Card / Visa Payment
                </h3>
                
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Expiry Date</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">CVV</label>
                    <input
                      type="password"
                      value={cardCVV}
                      onChange={(e) => setCardCVV(e.target.value)}
                      placeholder="123"
                      maxLength={4}
                      className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Insurance Claims Section - DEACTIVATED */}
            {paymentMethod === 'Insurance' && false && (
              <div className="border border-info/20 bg-info/5 rounded-card p-4 space-y-4">
                <h3 className="font-semibold text-info flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Insurance Claim Management
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Insurance Provider</label>
                    <select
                      value={insuranceProvider}
                      onChange={(e) => setInsuranceProvider(e.target.value)}
                      className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info"
                    >
                      <option value="">Select Provider</option>
                      <option value="SHIF">SHIF</option>
                      <option value="Jubilee">Jubilee Insurance</option>
                      <option value="AAR">AAR Insurance</option>
                      <option value="Britam">Britam</option>
                      <option value="Resolution">Resolution Health</option>
                      <option value="Madison">Madison Insurance</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Policy Number</label>
                    <input
                      type="text"
                      value={policyNumber}
                      onChange={(e) => setPolicyNumber(e.target.value)}
                      placeholder="Policy / Member Number"
                      className="w-full bg-content-bg border border-content-border rounded-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-content-bg rounded-lg border border-info/20">
                  <Clock className="w-5 h-5 text-info" />
                  <p className="text-sm text-info">
                    Claim will be automatically submitted to {insuranceProvider || 'selected provider'} after invoice creation.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-card font-semibold text-sm text-white bg-primary transition-opacity hover:opacity-90"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                {submitting ? 'Creating...' : 'Create Invoice'}
              </button>
              <button
                type="button"
                onClick={() => setShowInvoiceForm(false)}
                className="px-6 py-2.5 rounded-card font-semibold text-sm text-slate-700 border border-content-border hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invoice Table */}
      <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-content-border flex items-center justify-between">
          <h2 className="text-ink font-semibold">Today&apos;s Invoices</h2>
          <span className="text-slate-500 text-sm">{invoices.length} invoices</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface/80">
                {['Invoice #', 'Patient', 'Date', 'Services', 'Amount', 'Paid', 'Balance', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-slate-500 text-xs font-medium uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const balance = inv.amount - inv.paid;
                return (
                  <tr key={inv.id} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{inv.id}</td>
                    <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{inv.patient}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{inv.date}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.services}</td>
                    <td className="px-4 py-3 text-ink whitespace-nowrap">{fmt(inv.amount)}</td>
                    <td className="px-4 py-3 text-success whitespace-nowrap">{fmt(inv.paid)}</td>
                    <td className={cn('px-4 py-3 whitespace-nowrap', balance > 0 ? 'text-warning' : 'text-slate-500')}>
                      {fmt(balance)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[inv.status])}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* SHIF Claims Panel */}
      {showClaimsPanel && (
        <SHIFClaimsPanel 
          patientName="Brian Omondi" 
          totalAmount={4800}
          onClose={() => setShowClaimsPanel(false)}
        />
      )}
    </div>
  );
}
