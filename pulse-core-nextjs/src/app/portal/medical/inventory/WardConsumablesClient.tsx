'use client';

import { useState } from 'react';
import { Search, AlertTriangle, PackageX, RefreshCw, ClipboardCheck, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Category = 'IV Consumables' | 'PPE' | 'Wound Care' | 'Medication Supplies' | 'Diagnostic' | 'Linen & Bedding';

interface InventoryItem {
  id: string;
  item: string;
  category: Category;
  stock: number;
  min: number;
  unit: string;
  ward: string;
  lastUpdated: string;
}

const ITEMS: InventoryItem[] = [
  { id: '1', item: 'IV Sets (standard)',       category: 'IV Consumables',     stock: 120, min: 80,  unit: 'pcs',   ward: 'All Wards',   lastUpdated: 'Today 07:00' },
  { id: '2', item: 'Syringes 5ml',             category: 'IV Consumables',     stock: 340, min: 200, unit: 'pcs',   ward: 'All Wards',   lastUpdated: 'Today 07:00' },
  { id: '3', item: 'Gloves (sterile M)',        category: 'PPE',                stock: 78,  min: 150, unit: 'pairs', ward: 'Surgical',    lastUpdated: 'Today 08:30' },
  { id: '4', item: 'Gauze Swabs 10×10',        category: 'Wound Care',         stock: 200, min: 100, unit: 'pcs',   ward: 'Medical',     lastUpdated: 'Yesterday'   },
  { id: '5', item: 'Surgical Tape 2.5cm',      category: 'Wound Care',         stock: 45,  min: 60,  unit: 'rolls', ward: 'Medical',     lastUpdated: 'Yesterday'   },
  { id: '6', item: 'Cannulae 20G',             category: 'IV Consumables',     stock: 88,  min: 50,  unit: 'pcs',   ward: 'ICU',         lastUpdated: 'Today 07:00' },
  { id: '7', item: 'N95 Masks',                category: 'PPE',                stock: 12,  min: 40,  unit: 'pcs',   ward: 'Isolation',   lastUpdated: 'Today 06:00' },
  { id: '8', item: 'Urine Dipsticks',          category: 'Diagnostic',         stock: 60,  min: 30,  unit: 'strips', ward: 'Lab Annex',   lastUpdated: 'Today 08:00' },
  { id: '9', item: 'Draw Sheets',              category: 'Linen & Bedding',    stock: 30,  min: 40,  unit: 'pcs',   ward: 'Maternity',   lastUpdated: 'Yesterday'   },
  { id: '10', item: 'Mackintosh Sheets',       category: 'Linen & Bedding',    stock: 18,  min: 20,  unit: 'pcs',   ward: 'Maternity',   lastUpdated: 'Yesterday'   },
  { id: '11', item: 'Nasogastric Tubes 14Fr',  category: 'Medication Supplies', stock: 14,  min: 10,  unit: 'pcs',   ward: 'ICU',         lastUpdated: 'Today 07:30' },
  { id: '12', item: 'Malaria RDT Kits',        category: 'Diagnostic',         stock: 55,  min: 30,  unit: 'kits',  ward: 'OPD',         lastUpdated: 'Today 09:00' },
];

interface RestockRequest {
  id: string;
  item: string;
  qty: number;
  ward: string;
  priority: 'Urgent' | 'Routine';
  ts: string;
}

const PENDING_REQUESTS: RestockRequest[] = [
  { id: 'RR-001', item: 'Gloves (sterile M)', qty: 200, ward: 'Surgical', priority: 'Urgent',  ts: 'Today 08:35' },
  { id: 'RR-002', item: 'N95 Masks',          qty: 50,  ward: 'Isolation', priority: 'Urgent',  ts: 'Today 06:10' },
  { id: 'RR-003', item: 'Draw Sheets',        qty: 20,  ward: 'Maternity', priority: 'Routine', ts: 'Yesterday'   },
];

function stockStatus(stock: number, min: number) {
  const ratio = stock / min;
  if (ratio <= 0.5)  return { label: 'Critical', style: 'bg-danger/5 text-danger border-danger/20', barClass: 'bg-danger', textClass: 'text-danger' };
  if (ratio <= 0.85) return { label: 'Low',      style: 'bg-warning/5 text-warning border-warning/20', barClass: 'bg-warning', textClass: 'text-warning' };
  return               { label: 'OK',       style: 'bg-success/5 text-success border-success/20', barClass: 'bg-success', textClass: 'text-success' };
}

export default function WardConsumablesClient({ isNurse }: { isNurse: boolean | null }) {
  const portalActionClass = isNurse ? 'bg-primary' : 'bg-success';
  const portalTextClass = isNurse ? 'text-primary' : 'text-success';
  const portalBorderClass = isNurse ? 'border-primary' : 'border-success';
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'stock' | 'requests'>('stock');
  const [requests, setRequests] = useState<RestockRequest[]>(PENDING_REQUESTS);
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newWard, setNewWard] = useState('Medical');
  const [newPriority, setNewPriority] = useState<'Urgent' | 'Routine'>('Routine');

  const critical = ITEMS.filter(i => i.stock / i.min <= 0.5).length;
  const low      = ITEMS.filter(i => { const r = i.stock / i.min; return r > 0.5 && r <= 0.85; }).length;

  const filtered = ITEMS.filter((i) =>
    !search || i.item.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase())
  );

  function submitRequest() {
    if (!newItem.trim() || !newQty) return;
    const req: RestockRequest = {
      id: `RR-${String(requests.length + 4).padStart(3, '0')}`,
      item: newItem.trim(),
      qty: Number(newQty),
      ward: newWard,
      priority: newPriority,
      ts: 'Just now',
    };
    setRequests(prev => [req, ...prev]);
    setShowForm(false);
    setNewItem('');
    setNewQty('');
  }

  function requestAll() {
    const lowItems = ITEMS.filter(i => i.stock / i.min <= 0.85);
    const newReqs: RestockRequest[] = lowItems.map((item, idx) => ({
      id: `RR-${String(requests.length + idx + 4).padStart(3, '0')}`,
      item: item.item,
      qty: item.min - item.stock,
      ward: item.ward,
      priority: item.stock / item.min <= 0.5 ? 'Urgent' : 'Routine',
      ts: 'Just now',
    }));
    setRequests(prev => [...newReqs, ...prev]);
    setActiveTab('requests');
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {isNurse ? 'Ward Consumables' : 'Inventory Management'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isNurse
              ? 'Monitor ward stock levels, raise restock requests, and log consumable usage'
              : 'Full inventory overview across all departments and wards'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {critical > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {critical} critically low
            </span>
          )}
          {isNurse && (
            <button
              onClick={() => { setShowForm(true); setActiveTab('requests'); }}
              className={cn('flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white', portalActionClass)}
            >
              <PlusCircle className="w-4 h-4" /> Request Restock
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Items',      value: ITEMS.length,                                        colorClass: 'text-slate-500' },
          { label: 'Critical Stock',   value: critical,                                            colorClass: 'text-danger' },
          { label: 'Low Stock',        value: low,                                                 colorClass: 'text-warning' },
          { label: 'OK',               value: ITEMS.filter(i => i.stock >= i.min).length,          colorClass: 'text-success' },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-content-border bg-content-bg p-3 shadow-card">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={cn('text-2xl font-bold mt-1', k.colorClass)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Critical alert */}
      {critical > 0 && (
        <div className="flex items-start gap-3 rounded-card border border-danger/20 bg-danger/5 p-3 text-danger">
          <PackageX className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">
            <span className="font-bold">Critical:</span>{' '}
            {ITEMS.filter(i => i.stock / i.min <= 0.5).map(i => i.item).join(', ')} — below 50% of minimum.
            {isNurse ? ' Raise a restock request immediately.' : ' Coordinate procurement urgently.'}
          </p>
        </div>
      )}

      {/* Tabs (nurse gets Restock Requests tab) */}
      {isNurse && (
        <div className="flex gap-1 border-b border-content-border">
          {(['stock', 'requests'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? cn(portalBorderClass, portalTextClass)
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              {tab === 'stock' ? 'Stock Levels' : `Restock Requests ${requests.length > 0 ? `(${requests.length})` : ''}`}
            </button>
          ))}
        </div>
      )}

      {/* Stock Levels Table */}
      {activeTab === 'stock' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item or category…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-content-border rounded-card bg-content-bg focus:outline-none"
            />
          </div>

          <div className="rounded-card border border-content-border bg-content-bg shadow-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 bg-content-surface border-b border-content-border/50">
                  {['Item', 'Category', 'Ward', 'Stock', 'Minimum', 'Level', 'Last Updated'].map((h) => (
                    <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const s = stockStatus(item.stock, item.min);
                  const barPct = Math.min((item.stock / item.min) * 100, 100);
                  return (
                    <tr key={item.id} className="border-b border-content-border/50 hover:bg-content-surface">
                      <td className="px-4 py-2.5 font-medium text-ink whitespace-nowrap">{item.item}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">{item.category}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">{item.ward}</td>
                      <td className={cn('px-4 py-2.5 font-mono font-semibold whitespace-nowrap', s.textClass)}>
                        {item.stock} <span className="text-xs text-slate-400 font-normal">{item.unit}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{item.min} {item.unit}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={cn('h-full rounded-full', s.barClass)} style={{ width: `${barPct}%` }} />
                          </div>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${s.style}`}>{s.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">{item.lastUpdated}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={requestAll}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-card border border-content-border bg-content-bg hover:bg-content-surface transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', portalTextClass)} />
            {isNurse ? 'Request Restock for All Low Items' : 'Flag All Low Items for Procurement'}
          </button>
        </>
      )}

      {/* Restock Requests Tab (nurse only) */}
      {activeTab === 'requests' && isNurse && (
        <div className="space-y-4">
          {/* New Request Form */}
          {showForm && (
            <div className="rounded-card border border-primary/20 bg-primary/5 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-ink">New Restock Request</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 font-medium block mb-1">Item Name</label>
                  <input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="e.g. IV Sets (standard)"
                    className="w-full px-3 py-1.5 text-sm border border-content-border rounded-lg bg-content-bg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-medium block mb-1">Quantity Needed</label>
                  <input
                    type="number"
                    min="1"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full px-3 py-1.5 text-sm border border-content-border rounded-lg bg-content-bg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-medium block mb-1">Ward</label>
                  <select
                    value={newWard}
                    onChange={(e) => setNewWard(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-content-border rounded-lg bg-content-bg focus:outline-none"
                  >
                    {['Medical', 'ICU', 'Maternity', 'Paediatrics', 'Surgical', 'Isolation', 'OPD'].map(w => (
                      <option key={w}>{w}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-medium block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as 'Urgent' | 'Routine')}
                    className="w-full px-3 py-1.5 text-sm border border-content-border rounded-lg bg-content-bg focus:outline-none"
                  >
                    <option>Routine</option>
                    <option>Urgent</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={submitRequest}
                  className={cn('text-sm font-medium px-4 py-1.5 rounded-lg text-white', portalActionClass)}
                >
                  Submit Request
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-sm font-medium px-4 py-1.5 rounded-lg border border-content-border bg-content-bg text-slate-600 hover:bg-content-surface"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className={cn('flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white', portalActionClass)}
            >
              <PlusCircle className="w-4 h-4" /> New Request
            </button>
          )}

          {/* Requests list */}
          <div className="rounded-card border border-content-border bg-content-bg shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-content-border/50 bg-content-surface/80 flex items-center gap-2">
              <ClipboardCheck className={cn('w-4 h-4', portalTextClass)} />
              <span className="text-sm font-semibold text-ink">Pending Restock Requests</span>
            </div>
            {requests.length === 0 ? (
              <p className="text-sm text-slate-400 px-5 py-8 text-center">No pending requests</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-content-border/50">
                    <th className="px-4 py-2">Ref</th>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2">Ward</th>
                    <th className="px-4 py-2">Priority</th>
                    <th className="px-4 py-2">Raised</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-b border-content-border/50 hover:bg-content-surface">
                      <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{r.id}</td>
                      <td className="px-4 py-2.5 font-medium text-ink">{r.item}</td>
                      <td className="px-4 py-2.5 text-slate-700">{r.qty}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{r.ward}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full border',
                          r.priority === 'Urgent'
                            ? 'bg-danger/5 text-danger border-danger/20'
                            : 'bg-slate-100 text-slate-600 border-content-border'
                        )}>
                          {r.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{r.ts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
