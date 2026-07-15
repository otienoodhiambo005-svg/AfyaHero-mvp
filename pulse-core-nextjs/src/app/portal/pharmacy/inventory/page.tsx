'use client';

import { useMemo, useState } from 'react';
import { BrainCircuit, Plus, AlertTriangle, Package, Clock, X, Search, Beaker, Zap, FileBarChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import FormulaMatchModal from '@/components/portal/FormulaMatchModal';
import { InventoryAnalysis } from '@/components/portal/pharmacy/InventoryAnalysis';
import { AutoReorderPanel } from '@/components/portal/pharmacy/AutoReorderPanel';
import { motion } from 'framer-motion';

type StockStatus = 'Adequate' | 'Low' | 'Critical' | 'Expiring Soon' | 'Out of Stock';

interface DrugStock {
  name: string;
  generic: string;
  category: string;
  packSize: string;
  currentStock: number;
  unit: string;
  reorderLevel: number;
  expiry: string;
  lotNo: string;
  unitCost: number;
  status: StockStatus;
}

const drugs: DrugStock[] = [
  { name: 'Glucophage',          generic: 'Metformin 500mg',       category: 'Antidiabetic',      packSize: '100 tabs', currentStock: 12,  unit: 'packs', reorderLevel: 30, expiry: '2026-08-31', lotNo: 'MF-4421', unitCost: 320,  status: 'Critical' },
  { name: 'Amoxil Syrup',        generic: 'Amoxicillin 250mg/5mL', category: 'Antibiotic',         packSize: '100mL btl', currentStock: 48,  unit: 'btls',  reorderLevel: 80, expiry: '2025-02-08', lotNo: 'AMX-221', unitCost: 185,  status: 'Expiring Soon' },
  { name: 'Coartem',             generic: 'Artemether/Lumefantrine', category: 'Antimalarial',       packSize: '24 tabs',  currentStock: 180, unit: 'packs', reorderLevel: 100, expiry: '2026-06-30', lotNo: 'CO-8812', unitCost: 750,  status: 'Adequate' },
  { name: 'Norvasc',             generic: 'Amlodipine 5mg',        category: 'Antihypertensive',   packSize: '30 tabs',  currentStock: 22,  unit: 'packs', reorderLevel: 40, expiry: '2026-12-31', lotNo: 'AML-339', unitCost: 450,  status: 'Low' },
  { name: 'Brufen',              generic: 'Ibuprofen 400mg',       category: 'Analgesic/NSAID',    packSize: '100 tabs', currentStock: 95,  unit: 'packs', reorderLevel: 50, expiry: '2026-10-15', lotNo: 'IBU-118', unitCost: 280,  status: 'Adequate' },
  { name: 'ORS Sachet',          generic: 'Oral Rehydration Salts', category: 'Rehydration',       packSize: '1 sachet', currentStock: 0,   unit: 'pcs',   reorderLevel: 200, expiry: '—',          lotNo: '—',       unitCost: 30,   status: 'Out of Stock' },
  { name: 'Augmentin 625mg',     generic: 'Amox + Clavulanate',    category: 'Antibiotic',         packSize: '14 tabs',  currentStock: 34,  unit: 'packs', reorderLevel: 25, expiry: '2025-03-20', lotNo: 'AUG-774', unitCost: 1200, status: 'Expiring Soon' },
  { name: 'Actrapid HM',         generic: 'Insulin Regular 100 IU', category: 'Antidiabetic',       packSize: '10mL vial', currentStock: 8,   unit: 'vials', reorderLevel: 15, expiry: '2025-07-01', lotNo: 'INS-290', unitCost: 2800, status: 'Low' },
  { name: 'Folic Acid 5mg',      generic: 'Folic Acid',            category: 'Haematinics',        packSize: '100 tabs', currentStock: 60,  unit: 'packs', reorderLevel: 40, expiry: '2026-09-30', lotNo: 'FA-5521', unitCost: 120,  status: 'Adequate' },
  { name: 'Ciproflox 500mg',     generic: 'Ciprofloxacin 500mg',   category: 'Antibiotic',         packSize: '10 tabs',  currentStock: 0,   unit: 'packs', reorderLevel: 30, expiry: '—',          lotNo: '—',       unitCost: 450,  status: 'Out of Stock' },
  { name: 'Atorvastatin 40mg',   generic: 'Atorvastatin',          category: 'Cardiovascular',     packSize: '30 tabs',  currentStock: 18,  unit: 'packs', reorderLevel: 20, expiry: '2026-11-30', lotNo: 'ATV-662', unitCost: 380,  status: 'Low' },
  { name: 'Panadol Tabs',        generic: 'Paracetamol 500mg',     category: 'Analgesic',          packSize: '100 tabs', currentStock: 220, unit: 'packs', reorderLevel: 100, expiry: '2026-12-31', lotNo: 'PCT-801', unitCost: 95,   status: 'Adequate' },
];

const expiringItems = drugs.filter((d) => d.status === 'Expiring Soon');

const statusStyles: Record<StockStatus, string> = {
  'Adequate':     'bg-emerald-100 text-emerald-600 border border-emerald-200',
  'Low':          'bg-amber-100 text-amber-600 border border-amber-200',
  'Critical':     'bg-red-100 text-red-600 border border-red-200',
  'Expiring Soon':'bg-orange-100 text-orange-600 border border-orange-200',
  'Out of Stock': 'bg-slate-100 text-slate-600 border border-content-border',
};

export default function PharmacyInventoryPage(): React.ReactElement {
  const [showReceiptForm, setShowReceiptForm] = useState<boolean>(false);
  const [isFormulaMatchOpen, setIsFormulaMatchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDrugs = useMemo(() => {
    if (!searchQuery) return drugs;
    const query = searchQuery.toLowerCase();
    return drugs.filter((d) =>
      d.name.toLowerCase().includes(query) ||
      d.generic.toLowerCase().includes(query) ||
      d.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="space-y-6 rounded-3xl border border-content-border bg-content-surface p-4 shadow-card md:p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(5,150,105,0.16),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card">
        <div className="absolute -right-8 top-0 h-36 w-36 rounded-full bg-portal-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-portal-primary/25 bg-portal-primary-light/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-portal-primary">
              <Package className="h-3.5 w-3.5" />
              Inventory control
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-5xl">Drug inventory</h1>
            <span className="mt-2 block text-sm text-slate">{filteredDrugs.length} of {drugs.length} items · stock, expiry, and reorder readiness</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drugs..."
              aria-label="Search drugs by name, generic name, or category"
              className="h-10 w-64 rounded-card border border-content-border bg-content-bg pl-9 pr-3 text-sm text-charcoal outline-none transition focus:border-portal-primary/35 focus:ring-2 focus:ring-portal-primary/15"
            />
          </div>
          <button
            onClick={() => setIsFormulaMatchOpen(true)}
            className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
          >
            <Beaker className="w-4 h-4" /> Compound
          </button>
          <button
            onClick={() => setShowReceiptForm(true)}
            className="flex items-center gap-2 rounded-full border border-content-border bg-content-bg px-4 py-2 text-sm font-medium text-charcoal transition hover:border-portal-primary/25 hover:bg-content-surface"
          >
            <Plus className="w-4 h-4" /> Record Receipt
          </button>
          <button className="flex items-center gap-2 rounded-full bg-portal-primary px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-portal-primary-hover">
            <Package className="w-4 h-4" /> Generate Order
          </button>
          </div>
        </div>
      </div>

      {/* AI Intelligence Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 xl:grid-cols-4 gap-6"
      >
        <div className="xl:col-span-3">
          <InventoryAnalysis />
        </div>
        <div className="xl:col-span-1">
          <AutoReorderPanel />
        </div>
      </motion.div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total SKUs',       value: '234', color: 'text-cyan-400',    icon: <Package className="w-5 h-5" /> },
          { label: 'Low Stock',        value: '12',  color: 'text-amber-400',   icon: <AlertTriangle className="w-5 h-5" /> },
          { label: 'Expiring <30 days', value: '8',   color: 'text-orange-400',  icon: <Clock className="w-5 h-5" /> },
          { label: 'Out of Stock',     value: '3',   color: 'text-red-400',     icon: <AlertTriangle className="w-5 h-5" /> },
        ].map((k) => (
          <div key={k.label} className="rounded-[1.5rem] border border-content-border bg-content-bg/90 p-4 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate">{k.label}</span>
              <span className={k.color}>{k.icon}</span>
            </div>
            <p className={cn('text-2xl font-bold', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Inventory Table */}
      <div className="overflow-hidden rounded-card border border-content-border bg-content-bg shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface">
                {['Drug Name', 'Generic', 'Category', 'Pack Size', 'Stock', 'Reorder Level', 'Expiry', 'Lot #', 'Unit Cost', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDrugs.length > 0 ? (
                filteredDrugs.map((d, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-content-border/70 transition-colors hover:bg-content-surface/70',
                    (d.status === 'Critical' || d.status === 'Out of Stock') && 'bg-severity-high-bg/70'
                  )}
                >
                  <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{d.name}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap max-w-[140px] truncate">{d.generic}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{d.category}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{d.packSize}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn('font-bold',
                      d.currentStock === 0 ? 'text-slate-500' :
                      d.currentStock <= d.reorderLevel * 0.3 ? 'text-red-600' :
                      d.currentStock <= d.reorderLevel ? 'text-amber-600' : 'text-ink'
                    )}>
                      {d.currentStock} {d.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{d.reorderLevel}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{d.expiry}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{d.lotNo}</td>
                  <td className="px-4 py-3 text-ink whitespace-nowrap">KES {d.unitCost}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', statusStyles[d.status])}>{d.status}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <button className="text-xs text-cyan-600 hover:text-cyan-700">Reorder</button>
                      {(d.name.includes('Metformin') || d.generic.includes('Amoxicillin')) && (
                        <button 
                          onClick={() => setIsFormulaMatchOpen(true)}
                          className="text-xs text-emerald font-bold hover:text-emerald/80 flex items-center gap-1"
                        >
                          <Beaker className="w-3 h-3" /> Compound
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
              ) : (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    No drugs match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expiring Soon Section */}
      <div className="rounded-card border border-content-border bg-content-bg p-5 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
          <Clock className="w-4 h-4 text-orange-500" /> Expiring Within 30 Days
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {expiringItems.map((d, i) => (
            <div key={i} className="rounded-card border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.generic} — Lot: {d.lotNo}</p>
                  <p className="text-xs text-slate-500 mt-1">{d.currentStock} {d.unit} in stock</p>
                </div>
                <span className="text-xs text-orange-600 font-medium whitespace-nowrap">{d.expiry}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stock Receipt Form Modal */}
      {showReceiptForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-card border border-content-border bg-content-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-content-border bg-content-surface px-5 py-4">
              <h2 className="text-base font-bold text-ink">Record Stock Receipt</h2>
              <button onClick={() => setShowReceiptForm(false)} className="text-slate-500 hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: 'Drug Name', placeholder: 'Search drug...' },
                { label: 'Lot Number', placeholder: 'e.g. MF-4422' },
                { label: 'Expiry Date', placeholder: 'YYYY-MM-DD' },
                { label: 'Quantity Received', placeholder: 'e.g. 100 packs' },
                { label: 'Supplier', placeholder: 'e.g. Mission for Essential Medicines' },
                { label: 'Invoice Number', placeholder: 'e.g. INV-20250115-001' },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-xs text-slate">{f.label}</label>
                  <input
                    placeholder={f.placeholder}
                    className="w-full rounded-card border border-content-border bg-content-bg px-3 py-2 text-sm text-charcoal placeholder:text-slate focus:border-portal-primary/35 focus:outline-none"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowReceiptForm(false)} className="flex-1 rounded-card border border-content-border py-2 text-sm font-medium text-charcoal hover:bg-content-surface">Cancel</button>
                <button onClick={() => setShowReceiptForm(false)} className="flex-1 rounded-card bg-portal-primary py-2 text-sm font-semibold text-white hover:bg-portal-primary-hover">Record Receipt</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FormulaMatchModal 
        open={isFormulaMatchOpen} 
        onClose={() => setIsFormulaMatchOpen(false)} 
      />
    </div>
  );
}
