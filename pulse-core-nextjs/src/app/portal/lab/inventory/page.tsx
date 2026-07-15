'use client';

import { useState } from 'react';
import { BrainCircuit, Plus, AlertTriangle, Package, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type ItemStatus = 'Adequate' | 'Low' | 'Critical' | 'Expiring Soon' | 'Out of Stock';

interface InventoryItem {
  item: string;
  category: string;
  currentStock: number;
  unit: string;
  reorderLevel: number;
  expiryDate: string;
  lotNo: string;
  status: ItemStatus;
}

const inventory: InventoryItem[] = [
  { item: 'Haematology Reagent Pack (Mindray)',   category: 'Haematology',    currentStock: 14,   unit: 'tests',    reorderLevel: 50,   expiryDate: '2026-04-30', lotNo: 'HR-2847',  status: 'Critical' },
  { item: 'Malaria RDT Kits (SD Bioline)',        category: 'Immunology',     currentStock: 120,  unit: 'tests',    reorderLevel: 200,  expiryDate: '2025-01-22', lotNo: 'MRDT-112', status: 'Expiring Soon' },
  { item: 'Blood Culture Bottles (aerobic)',      category: 'Microbiology',   currentStock: 48,   unit: 'bottles',  reorderLevel: 24,   expiryDate: '2025-09-15', lotNo: 'BC-5523',  status: 'Adequate' },
  { item: 'HbA1c Cartridges (Afinion)',           category: 'Chemistry',      currentStock: 6,    unit: 'cartridges', reorderLevel: 20,  expiryDate: '2025-06-30', lotNo: 'A1C-339',  status: 'Critical' },
  { item: 'EDTA Tubes (4mL)',                     category: 'Consumables',    currentStock: 350,  unit: 'tubes',    reorderLevel: 500,  expiryDate: '2026-12-31', lotNo: 'EDT-8821', status: 'Low' },
  { item: 'Urine Dipstick Strips (Combur 10)',    category: 'Chemistry',      currentStock: 200,  unit: 'strips',   reorderLevel: 300,  expiryDate: '2025-03-15', lotNo: 'UD-4411',  status: 'Low' },
  { item: 'AFB Sputum Stain (Ziehl–Neelsen)',     category: 'Microbiology',   currentStock: 80,   unit: 'mL',       reorderLevel: 100,  expiryDate: '2025-08-20', lotNo: 'ZN-2201',  status: 'Adequate' },
  { item: 'Widal Test Kit',                       category: 'Immunology',     currentStock: 30,   unit: 'tests',    reorderLevel: 50,   expiryDate: '2025-02-28', lotNo: 'WD-0091',  status: 'Expiring Soon' },
  { item: 'Serum Separator Tubes (SST)',          category: 'Consumables',    currentStock: 420,  unit: 'tubes',    reorderLevel: 300,  expiryDate: '2026-10-31', lotNo: 'SST-7734', status: 'Adequate' },
  { item: 'Dengue NS1 Antigen RDT',               category: 'Immunology',     currentStock: 0,    unit: 'tests',    reorderLevel: 50,   expiryDate: '—',          lotNo: '—',         status: 'Out of Stock' },
  { item: 'Electrolyte Reagent (ISE)',            category: 'Chemistry',      currentStock: 22,   unit: 'tests',    reorderLevel: 40,   expiryDate: '2025-05-01', lotNo: 'ISE-1192', status: 'Low' },
  { item: 'Glucose Oxidase Reagent',              category: 'Chemistry',      currentStock: 0,    unit: 'tests',    reorderLevel: 60,   expiryDate: '—',          lotNo: '—',         status: 'Out of Stock' },
];

const expiringItems = inventory.filter((i) => i.status === 'Expiring Soon');

const statusStyles: Record<ItemStatus, string> = {
  'Adequate':     'bg-success/5 text-success border border-success/20',
  'Low':          'bg-warning/5 text-warning border border-warning/20',
  'Critical':     'bg-danger/5 text-danger border border-danger/20',
  'Expiring Soon':'bg-warning/5 text-warning border border-warning/20',
  'Out of Stock': 'bg-slate-100 text-slate-600 border border-content-border',
};

const statusDot: Record<ItemStatus, string> = {
  'Adequate':     'bg-success',
  'Low':          'bg-warning',
  'Critical':     'bg-danger',
  'Expiring Soon':'bg-warning',
  'Out of Stock': 'bg-slate-500',
};

export default function LabInventoryPage(): React.ReactElement {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const kpis: Array<{ label: string; value: string | number; color: string; icon: React.ReactNode }> = [
    { label: 'Total Items',    value: 156, color: 'text-violet-600', icon: <Package className="w-5 h-5" /> },
    { label: 'Low Stock',      value: 8,   color: 'text-warning',  icon: <AlertTriangle className="w-5 h-5" /> },
    { label: 'Expiring Soon',  value: 5,   color: 'text-warning', icon: <Clock className="w-5 h-5" /> },
    { label: 'Out of Stock',   value: 2,   color: 'text-danger',    icon: <AlertTriangle className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Reagent &amp; Consumables Inventory</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors w-fit"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* AI Alert */}
      <div className="rounded-card border border-violet-200 bg-violet-50 p-4 flex gap-3">
        <BrainCircuit className="w-5 h-5 text-violet-500 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-600 leading-relaxed">
          <span className="text-violet-600 font-semibold">AI Stock Alert: </span>
          Stock-out risk in 48h: <span className="text-danger font-medium">Haematology reagents (14 tests remaining)</span>.{' '}
          <span className="text-warning font-medium">Malaria RDT kits expiring in 7 days</span> — 120 units. Expedited order recommended.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-card bg-content-bg border border-content-border p-4 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">{k.label}</span>
              <span className={k.color}>{k.icon}</span>
            </div>
            <p className={cn('text-2xl font-bold', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Inventory Table */}
      <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-content-border bg-content-surface">
          <h2 className="text-sm font-semibold text-ink">Inventory</h2>
          <button className="text-xs text-violet-600 hover:text-violet-700 px-3 py-1.5 rounded-lg border border-violet-200 hover:border-violet-300 transition-colors">
            Generate Order for Low Stock
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-content-border bg-content-surface">
                {['Item', 'Category', 'Stock', 'Reorder Level', 'Expiry', 'Lot #', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventory.map((item, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-content-border/50 hover:bg-content-surface transition-colors',
                    (item.status === 'Critical' || item.status === 'Out of Stock') && 'bg-danger/5'
                  )}
                >
                  <td className="px-4 py-3 font-medium text-ink max-w-[200px]">{item.item}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{item.category}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn('font-bold text-sm',
                      item.currentStock === 0 ? 'text-slate-500' :
                      item.currentStock <= item.reorderLevel * 0.3 ? 'text-danger' :
                      item.currentStock <= item.reorderLevel ? 'text-warning' : 'text-ink'
                    )}>
                      {item.currentStock} {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{item.reorderLevel} {item.unit}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{item.expiryDate}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{item.lotNo}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 w-fit', statusStyles[item.status])}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', statusDot[item.status])} />
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button className="text-xs text-violet-600 hover:text-violet-700">Reorder</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expiring Soon Section */}
      <div className="rounded-card bg-content-bg border border-content-border p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-warning" /> Expiring Within 30 Days
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {expiringItems.map((item, i) => (
            <div key={i} className="rounded-lg border border-warning/20 bg-warning/5 p-4">
              <p className="text-sm font-medium text-ink mb-1">{item.item}</p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Lot: {item.lotNo}</span>
                <span className="text-warning font-medium">Expires: {item.expiryDate}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{item.currentStock} {item.unit} in stock</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status Legend */}
      <div className="rounded-card bg-content-bg border border-content-border p-4 shadow-card">
        <p className="text-xs font-medium text-slate-500 mb-3">Status Legend</p>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(statusStyles) as ItemStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full', statusDot[s])} />
              <span className="text-xs text-slate-500">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div role="dialog" aria-modal="true" aria-label="Add inventory item" className="w-full max-w-md rounded-card bg-content-bg border border-content-border p-6 shadow-xl">
            <h2 className="text-base font-bold text-ink mb-5">Add Inventory Item</h2>
            <div className="space-y-3">
              {[
                { label: 'Item Name', placeholder: 'e.g. Haematology Reagent Pack...' },
                { label: 'Category', placeholder: 'e.g. Haematology' },
                { label: 'Current Stock', placeholder: 'e.g. 50' },
                { label: 'Lot Number', placeholder: 'e.g. HR-2848' },
                { label: 'Expiry Date', placeholder: 'YYYY-MM-DD' },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
                  <input
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-content-bg border border-content-border text-ink placeholder:text-slate-400 text-sm focus:outline-none focus:border-violet-400"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 rounded-lg border border-content-border text-slate-600 text-sm hover:bg-content-surface">Cancel</button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium">Add Item</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
