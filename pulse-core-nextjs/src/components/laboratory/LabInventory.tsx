'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Beaker,
    Search,
    Plus,
    Trash2,
    Edit2,
    AlertTriangle,
    Thermometer,
    Layers,
    ShoppingBag,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function LabInventory() {
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadInventory = async () => {
            const { data, error } = await supabase
                .from('lab_inventory')
                .select('*')
                .order('name', { ascending: true });

            if (!error && data) {
                setInventory(data);
            }
            setLoading(false);
        };

        loadInventory();
    }, []);

    const filteredInventory = useMemo(() => inventory.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [inventory, searchTerm]);

    const criticalItems = useMemo(() => inventory.filter(item => item.status === 'Critical').length, [inventory]);
    const lowStockItems = useMemo(() => inventory.filter(item => item.status === 'Low Stock').length, [inventory]);

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full font-outfit">
            <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 font-outfit">Lab Inventory & Supplies</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Reagents, samples, and biological consumables</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search reagents..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all font-outfit"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10">
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1 px-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                        <Loader2 className="w-10 h-10 animate-spin mb-4" />
                        <p className="text-sm font-medium">Auditing chemical stores...</p>
                    </div>
                ) : filteredInventory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                            <Beaker className="w-8 h-8 text-slate-300" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900">Inventory Empty</h4>
                        <p className="text-xs text-slate-500 max-w-[200px] mt-1">No items registered in the laboratory inventory system.</p>
                    </div>
                ) : (
                    <table className="w-full text-left font-outfit border-separate border-spacing-y-4">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                <th className="pb-2 pl-4">Reagent / Item</th>
                                <th className="pb-2">Stock Level</th>
                                <th className="pb-2">Condition</th>
                                <th className="pb-2">Safety Status</th>
                                <th className="pb-2 pr-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="space-y-4">
                            {filteredInventory.map((item) => (
                                <tr key={item.id} className="group hover:bg-slate-50 transition-all">
                                    <td className="bg-white border-y border-l border-slate-100 rounded-l-2xl py-5 pl-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                                <Beaker className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{item.name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.id.slice(0, 8)}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="bg-white border-y border-slate-100 py-5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-bold text-slate-700">{item.stock_quantity} {item.unit}</span>
                                            <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        'h-full transition-all duration-1000',
                                                        item.status === 'Optimal' ? 'bg-emerald-500' :
                                                            item.status === 'Low Stock' ? 'bg-amber-500' : 'bg-rose-500'
                                                    )}
                                                    style={{ width: `${Math.min((item.stock_quantity / item.min_stock_level) * 50, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="bg-white border-y border-slate-100 py-5">
                                        <div className="flex items-center gap-2 text-slate-600 font-medium text-xs">
                                            <Thermometer className="w-4 h-4 text-slate-300" />
                                            {item.storage_temp || 'Ambient'}
                                        </div>
                                    </td>
                                    <td className="bg-white border-y border-slate-100 py-5">
                                        <span className={cn(
                                            'px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5',
                                            item.status === 'Optimal' ? 'bg-emerald-50 text-emerald-600' :
                                                item.status === 'Low Stock' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                        )}>
                                            {item.status === 'Optimal' ? <Layers className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="bg-white border-y border-r border-slate-100 rounded-r-2xl py-5 pr-5 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{criticalItems} Critical Shortages</span>
                    </div>
                    <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{lowStockItems} Refills Needed</span>
                    </div>
                </div>
                <button className="bg-emerald-500 text-white font-bold py-3 px-8 rounded-2xl flex items-center gap-3 shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 active:scale-95 transition-all text-xs uppercase tracking-widest">
                    <ShoppingBag className="w-4 h-4" />
                    Bulk Restock
                </button>
            </div>
        </div>
    );
}
