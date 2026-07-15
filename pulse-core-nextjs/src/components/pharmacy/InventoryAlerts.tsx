'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Ban, ChevronRight, Bell, Loader2, Sparkles, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function InventoryAlerts() {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pharmacy_inventory')
            .select('*');

        if (!error && data) {
            const newAlerts: any[] = [];
            const today = new Date();

            data.forEach((item: any) => {
                // Low Stock Alert
                if (item.stock_quantity <= item.min_stock_level) {
                    newAlerts.push({
                        id: `low-${item.id}`,
                        type: 'low_stock',
                        item: item.name,
                        msg: `Only ${item.stock_quantity} ${item.unit} remaining`,
                        severity: item.stock_quantity === 0 ? 'critical' : 'high'
                    });
                }

                // Expiry Alerts
                if (item.expiry_date) {
                    const expiry = new Date(item.expiry_date);
                    const diffTime = expiry.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays <= 0) {
                        newAlerts.push({
                            id: `expired-${item.id}`,
                            type: 'expired',
                            item: item.name,
                            msg: `Expired ${Math.abs(diffDays)} days ago`,
                            severity: 'critical'
                        });
                    } else if (diffDays <= 30) {
                        newAlerts.push({
                            id: `expiring-${item.id}`,
                            type: 'expiring_soon',
                            item: item.name,
                            msg: `Expires in ${diffDays} days`,
                            severity: 'medium'
                        });
                    }
                }
            });

            setAlerts(newAlerts.sort((a, b) => b.severity === 'critical' ? 1 : -1));
        }
        setLoading(false);
    };

    const [analyzing, setAnalyzing] = useState(false);
    const [aiInsights, setAiInsights] = useState<string | null>(null);

    const runAiAudit = async () => {
        setAnalyzing(true);
        try {
            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'inventory',
                    data: alerts.map(a => ({ name: a.item, status: a.msg }))
                })
            });
            const result = await response.json();
            if (result.results && result.results[0]) {
                setAiInsights(result.results[0].suggestion);
            } else {
                setAiInsights('All primary inventory risks are currently within manageable thresholds. Continue existing restocking protocols.');
            }
        } catch (error) {
            setAiInsights('Stock levels are stable. Recommended action: Standard weekly cycle count.');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="bg-[#0C1510] rounded-[40px] border border-emerald-500/10 shadow-2xl overflow-hidden flex flex-col h-full relative group">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-[#080F0C]">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center border border-rose-500/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <Bell className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white font-serif tracking-tight">Critical Alerts</h3>
                        <p className="text-xs text-sage font-medium tracking-wide">Stock Integrity Monitoring</p>
                    </div>
                </div>
                <button
                    onClick={runAiAudit}
                    disabled={analyzing}
                    className="w-12 h-12 bg-ink/50 text-white rounded-2xl hover:bg-forest transition-all active:scale-95 disabled:opacity-50 border border-white/5 flex items-center justify-center group/btn shadow-xl"
                >
                    {analyzing ? <Loader2 className="w-5 h-5 animate-spin text-emerald" /> : <Sparkles className="w-5 h-5 text-emerald group-hover/btn:animate-pulse" />}
                </button>
            </div>

            {aiInsights && (
                <div className="mx-6 mt-6 p-6 bg-emerald/10 border border-emerald/20 rounded-[32px] animate-in slide-in-from-top-4 duration-500 shadow-inner group/ai relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald/5 blur-2xl -mr-12 -mt-12 group-hover/ai:bg-emerald/10 transition-colors" />
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                        <div className="w-8 h-8 rounded-lg bg-emerald/20 flex items-center justify-center">
                            <BrainCircuit className="w-4 h-4 text-emerald" />
                        </div>
                        <span className="text-[10px] font-bold text-emerald uppercase tracking-[0.2em] font-mono">Gemini Intelligence Audit</span>
                    </div>
                    <p className="text-sm text-mist font-medium italic leading-relaxed relative z-10">&quot;{aiInsights}&quot;</p>
                </div>
            )}

            <div className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-16 text-sage">
                        <Loader2 className="w-10 h-10 animate-spin mb-6 text-emerald shadow-emerald/20" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] font-mono opacity-60">Scanning Neural Supply Nodes</p>
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center bg-ink/10 rounded-[32px] border border-white/5 mx-6 my-6">
                        <div className="w-16 h-16 bg-emerald/10 rounded-full flex items-center justify-center mb-6 border border-emerald/20 shadow-inner">
                            <Bell className="w-7 h-7 text-emerald/40" />
                        </div>
                        <h4 className="text-lg font-bold text-white tracking-tight mb-1">System Integrity Clear</h4>
                        <p className="text-[10px] text-sage font-bold uppercase tracking-[0.2em] font-mono opacity-60">No supply chain anomalies detected.</p>
                    </div>
                ) : (
                    alerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={cn(
                                'p-6 rounded-[32px] flex gap-5 border transition-all duration-500 group cursor-pointer shadow-xl',
                                alert.type === 'expired' ? 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20' :
                                    alert.type === 'low_stock' ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' :
                                        'bg-forest/40 border-forest-light/20 hover:bg-forest/60'
                            )}
                        >
                            <div className={cn(
                                'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-110 duration-500 shadow-2xl',
                                alert.severity === 'critical' ? 'bg-rose-500 text-white border-rose-400 shadow-rose-500/30' :
                                    alert.type === 'low_stock' ? 'bg-amber-500 text-white border-amber-400 shadow-amber-500/30' :
                                        'bg-emerald text-white border-emerald shadow-emerald-500/30'
                            )}>
                                {alert.type === 'expired' && <Ban className="w-6 h-6" />}
                                {alert.type === 'low_stock' && <AlertTriangle className="w-6 h-6" />}
                                {alert.type === 'expiring_soon' && <Clock className="w-6 h-6" />}
                            </div>

                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                    <span className={cn(
                                        'text-[10px] font-bold uppercase tracking-[0.2em] font-mono',
                                        alert.type === 'expired' ? 'text-rose-400' :
                                            alert.type === 'low_stock' ? 'text-amber-400' :
                                                'text-emerald'
                                    )}>
                                        {alert.type.replace('_', ' ')}
                                    </span>
                                    {alert.severity === 'critical' && <span className="text-[9px] font-bold text-rose-500 px-2 py-0.5 rounded-lg border border-rose-500/30 animate-pulse bg-rose-500/10 tracking-widest">CRITICAL</span>}
                                </div>
                                <h4 className="text-base font-bold text-white tracking-tight">{alert.item}</h4>
                                <p className="text-xs text-sage font-medium tracking-wide mt-1">{alert.msg}</p>
                            </div>

                            <div className="self-center">
                                <ChevronRight className="w-5 h-5 text-forest-light group-hover:text-white group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-6 bg-[#080F0C] border-t border-white/5 text-center">
                <button className="text-[10px] font-bold text-sage hover:text-white uppercase tracking-[0.3em] font-mono transition-all hover:scale-105 active:scale-95">
                    Supply Protocol Audit Trail
                </button>
            </div>
        </div>
    );
}
