'use client';

import { useState, useCallback, useEffect } from 'react';
import {
    Pill, Plus, Trash2, AlertTriangle, CheckCircle2,
    Search, Save, Info, ShieldAlert, ChevronDown, Zap, Loader2,
    Wifi, WifiOff, Clock
} from 'lucide-react';
import { useInteractionAI } from '@/hooks/useInteractionAI';
import { cn } from '@/lib/utils';

/* ── types ─────────────────────────────────────────── */
interface PrescriptionItem {
    id: string;
    drug: string;
    dosage: string;
    route: string;
    frequency: string;
    duration: string;
    instructions: string;
    interactionWarning?: string;
}

interface PrescriptionBuilderProps {
    patientName?: string;
    patientAllergies?: string[];
    onSave?: (items: PrescriptionItem[]) => void;
    className?: string;
}

/* ── mock drug database ────────────────────────────── */
const DRUG_SUGGESTIONS = [
    'Amoxicillin 500mg Capsules',
    'Paracetamol 500mg Tablets',
    'Metformin 500mg Tablets',
    'Ibuprofen 400mg Tablets',
    'Omeprazole 20mg Capsules',
    'Azithromycin 250mg Tablets',
    'Ciprofloxacin 500mg Tablets',
    'Amlodipine 5mg Tablets',
    'Losartan 50mg Tablets',
    'Salbutamol 100mcg Inhaler',
];

const ROUTES = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled', 'Rectal', 'Sublingual'];
const FREQUENCIES = ['OD (Once daily)', 'BD (Twice daily)', 'TDS (Three times daily)', 'QID (Four times daily)', 'PRN (As needed)', 'STAT (Immediately)', 'Nocte (At night)'];
const DURATIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '3 months', 'Continuous'];

/* ── component ─────────────────────────────────────── */
export function PrescriptionBuilder({ patientName, patientAllergies = [], onSave, className = '' }: PrescriptionBuilderProps) {
    const [items, setItems] = useState<PrescriptionItem[]>([]);
    const [drugSearch, setDrugSearch] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [queuedPrescriptions, setQueuedPrescriptions] = useState<number>(0);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const { 
        isChecking, 
        interactions, 
        checkInteractions, 
        reset: resetInteractions 
    } = useInteractionAI();

    // Network status detection
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        setIsOnline(navigator.onLine);
        
        const loadQueueCount = () => {
            try {
                const queue = JSON.parse(localStorage.getItem('prescription_queue') || '[]');
                setQueuedPrescriptions(queue.length);
            } catch {
                setQueuedPrescriptions(0);
            }
        };
        loadQueueCount();
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Sync queued prescriptions when connection is restored
    useEffect(() => {
        if (isOnline && queuedPrescriptions > 0 && !isSyncing) {
            syncQueuedPrescriptions();
        }
    }, [isOnline, queuedPrescriptions, isSyncing]);

    const syncQueuedPrescriptions = async () => {
        setIsSyncing(true);
        try {
            const queue = JSON.parse(localStorage.getItem('prescription_queue') || '[]');
            const syncedQueue: any[] = [];
            
            for (const item of queue) {
                try {
                    // Simulate API call - in real implementation, call actual prescription API
                    await new Promise(r => setTimeout(r, 500));
                    // Successfully synced, don't add back to queue
                    continue;
                } catch {
                    syncedQueue.push(item);
                }
            }
            
            localStorage.setItem('prescription_queue', JSON.stringify(syncedQueue));
            setQueuedPrescriptions(syncedQueue.length);
        } catch {
            // Error syncing, keep queue as is
        } finally {
            setIsSyncing(false);
        }
    };

    /* ── sync interaction check ── */
    useEffect(() => {
        if (items.length >= 2) {
            checkInteractions(items.map((i: PrescriptionItem) => i.drug));
        } else if (items.length < 2 && interactions.length > 0) {
            resetInteractions();
        }
    }, [items, checkInteractions, resetInteractions, interactions.length]);

    /* ── add drug from search ── */
    const addDrug = useCallback((drug: string) => {
        const newItem: PrescriptionItem = {
            id: `rx-${Date.now()}`,
            drug,
            dosage: '',
            route: 'Oral',
            frequency: 'TDS (Three times daily)',
            duration: '7 days',
            instructions: '',
        };
        setItems(prev => [...prev, newItem]);
        setDrugSearch('');
    }, []);

    /* ── update item field ── */
    const updateItem = useCallback((id: string, field: keyof PrescriptionItem, value: string) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    }, []);

    /* ── remove item ── */
    const removeItem = useCallback((id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    }, []);

    /* ── allergy check ── */
    const allergyMatch = (drug: string) =>
        patientAllergies.some(a => drug.toLowerCase().includes(a.toLowerCase()));

    const handleSave = useCallback(async () => {
        setSaving(true);
        
        // If offline, queue the prescription
        if (!isOnline) {
            try {
                const queue = JSON.parse(localStorage.getItem('prescription_queue') || '[]');
                queue.push({
                    items,
                    patientName,
                    timestamp: new Date().toISOString(),
                });
                localStorage.setItem('prescription_queue', JSON.stringify(queue));
                setQueuedPrescriptions(queue.length);
                
                onSave?.(items);
                setSaving(false);
                
                alert('Prescription queued for sync when connection is restored.');
                return;
            } catch (queueError) {
                setSaving(false);
                alert('Failed to queue prescription. Please try again.');
                return;
            }
        }

        // Online: save directly
        await new Promise(r => setTimeout(r, 800));
        onSave?.(items);
        setSaving(false);
    }, [items, onSave, isOnline, patientName]);

    /* ── filtered drug suggestions ── */
    const filteredDrugs = drugSearch.length >= 2
        ? DRUG_SUGGESTIONS.filter(d =>
            d.toLowerCase().includes(drugSearch.toLowerCase()) &&
            !items.some(i => i.drug === d)
        )
        : [];

    return (
        <div className={`bg-[#0C1A14] border border-forest/30 rounded-card overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-forest/30">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <h3 className="text-white font-bold text-base flex items-center gap-2">
                            <Pill className="w-5 h-5 text-emerald" />
                            Prescription Builder
                        </h3>
                        <p className="text-[11px] text-sage mt-0.5">
                            {patientName && <span>{patientName} · </span>}
                            {items.length} medication{items.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Network Status Indicator */}
                        <div className="flex items-center gap-2">
                            {isOnline ? (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                    <Wifi className="w-3 h-3 text-emerald-500" />
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase">Online</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                                    <WifiOff className="w-3 h-3 text-amber-500" />
                                    <span className="text-[10px] font-bold text-amber-500 uppercase">Offline</span>
                                </div>
                            )}
                            {queuedPrescriptions > 0 && (
                                <div className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-full border",
                                    isSyncing ? "bg-[#3282B8]/10 border-[#3282B8]/20 animate-pulse" : "bg-amber-500/10 border-amber-500/20"
                                )}>
                                    <Clock className={cn("w-3 h-3", isSyncing ? "text-[#3282B8]" : "text-amber-500")} />
                                    <span className={cn("text-[10px] font-bold uppercase", isSyncing ? "text-[#3282B8]" : "text-amber-500")}>
                                        {isSyncing ? 'Syncing...' : `${queuedPrescriptions} Queued`}
                                    </span>
                                </div>
                            )}
                        </div>
                        {interactions.length > 0 && (
                            <div className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-tighter transition-all animate-in fade-in slide-in-from-right-2",
                                interactions.some((i: any) => i.severity === 'high') 
                                    ? "bg-red-500/20 border-red-500/30 text-red-500" 
                                    : "bg-amber-500/20 border-amber-500/30 text-amber-500"
                            )}>
                                <Zap className={cn("w-3.5 h-3.5", interactions.some((i: any) => i.severity === 'high') && "fill-red-500")} />
                                {interactions.length} AI Interaction{interactions.length > 1 ? 's' : ''}
                            </div>
                        )}
                        {isChecking && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-portal-primary/10 border border-portal-primary/20 text-portal-primary text-[10px] font-black uppercase tracking-widest animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Analyzing...
                            </div>
                        )}
                    </div>
                </div>

                {/* Known allergies */}
                {patientAllergies.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 p-2.5 rounded-card bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <p className="text-[11px] text-red-300">
                            <strong>Known allergies:</strong> {patientAllergies.join(', ')}
                        </p>
                    </div>
                )}
            </div>

            {/* Drug search */}
            <div className="px-5 py-3 border-b border-forest/20 relative">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mist" />
                    <input
                        value={drugSearch}
                        onChange={e => setDrugSearch(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                        placeholder="Search drug name to add..."
                        className="w-full bg-forest/20 border border-forest/20 rounded-card py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-mist/50 focus:ring-2 focus:ring-emerald/20 focus:border-emerald/40 outline-none transition-all font-sans"
                    />
                </div>

                {/* Autocomplete dropdown */}
                {searchFocused && filteredDrugs.length > 0 && (
                    <div className="absolute left-5 right-5 top-full mt-1 bg-[#0F2219] border border-forest/40 rounded-card shadow-xl z-20 max-h-48 overflow-y-auto">
                        {filteredDrugs.map(drug => {
                            const isAllergy = allergyMatch(drug);
                            return (
                                <button
                                    key={drug}
                                    onClick={() => addDrug(drug)}
                                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                                        isAllergy
                                            ? 'text-red-300 bg-red-500/5 hover:bg-red-500/10'
                                            : 'text-white hover:bg-forest/30'
                                    }`}
                                >
                                    <Pill className={`w-4 h-4 ${isAllergy ? 'text-red-400' : 'text-sage'}`} />
                                    <span className="flex-1">{drug}</span>
                                    {isAllergy && (
                                        <span className="text-[10px] text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full font-bold">
                                            ALLERGY
                                        </span>
                                    )}
                                    <Plus className="w-3.5 h-3.5 text-sage" />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Prescription items */}
            <div className="divide-y divide-forest/15">
                {items.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                        <Pill className="w-10 h-10 text-mist/20 mx-auto mb-2" />
                        <p className="text-sm text-mist">No medications added yet</p>
                        <p className="text-[11px] text-sage mt-1">Search above to add medications</p>
                    </div>
                ) : (
                    items.map((item, index) => {
                        const isAllergyDrug = allergyMatch(item.drug);

                        return (
                            <div key={item.id} className={`px-5 py-4 ${isAllergyDrug ? 'bg-red-500/5' : ''}`}>
                                {/* Drug name + remove */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-sage bg-forest/40 rounded-md w-5 h-5 flex items-center justify-center font-mono">
                                            {index + 1}
                                        </span>
                                        <span className="text-sm font-bold text-white">{item.drug}</span>
                                        {isAllergyDrug && (
                                            <span className="text-[10px] text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" /> ALLERGY RISK
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => removeItem(item.id)}
                                        className="p-1.5 text-mist hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* AI Interaction Warning */}
                                {interactions.filter((i: any) => 
                                    item.drug.toLowerCase().includes(i.drug_a.toLowerCase()) || 
                                    item.drug.toLowerCase().includes(i.drug_b.toLowerCase())
                                ).map((interaction: any, idx: number) => (
                                    <div key={idx} className={cn(
                                        "mb-4 p-4 rounded-card border flex items-start gap-4 transition-all animate-in zoom-in-95",
                                        interaction.severity === 'high'
                                            ? "bg-red-500/10 border-red-500/20 shadow-lg shadow-red-500/5 text-red-100"
                                            : "bg-amber-500/10 border-amber-500/20 text-amber-100"
                                    )}>
                                        <div className={cn(
                                            "p-2 rounded-card shrink-0 mt-0.5",
                                            interaction.severity === 'high' ? "bg-red-500/20" : "bg-amber-500/20"
                                        )}>
                                            <Zap className={cn("w-5 h-5", interaction.severity === 'high' ? "text-red-500 fill-red-500" : "text-amber-500")} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="text-xs font-black uppercase tracking-widest">
                                                    AfyaInsight™ Check
                                                </h4>
                                                <span className="text-[10px] font-mono opacity-50">Conf: {Math.round(interaction.confidence * 100)}%</span>
                                            </div>
                                            <p className="text-sm font-medium leading-relaxed mb-2">{interaction.summary}</p>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                                                    interaction.severity === 'high' ? "bg-red-500 text-white" : "bg-amber-500 text-black"
                                                )}>
                                                    Priority: {interaction.severity}
                                                </span>
                                                <span className="text-[10px] text-slate/60 font-medium">Source: African Clinical Guidelines</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Fields grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Route */}
                                    <div>
                                        <label className="text-[10px] text-sage font-bold uppercase tracking-wider mb-1 block">Route</label>
                                        <div className="relative">
                                            <select
                                                value={item.route}
                                                onChange={e => updateItem(item.id, 'route', e.target.value)}
                                                className="w-full bg-forest/20 border border-forest/20 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-emerald/30 appearance-none cursor-pointer"
                                            >
                                                {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-mist pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Frequency */}
                                    <div>
                                        <label className="text-[10px] text-sage font-bold uppercase tracking-wider mb-1 block">Frequency</label>
                                        <div className="relative">
                                            <select
                                                value={item.frequency}
                                                onChange={e => updateItem(item.id, 'frequency', e.target.value)}
                                                className="w-full bg-forest/20 border border-forest/20 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-emerald/30 appearance-none cursor-pointer"
                                            >
                                                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-mist pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Duration */}
                                    <div>
                                        <label className="text-[10px] text-sage font-bold uppercase tracking-wider mb-1 block">Duration</label>
                                        <div className="relative">
                                            <select
                                                value={item.duration}
                                                onChange={e => updateItem(item.id, 'duration', e.target.value)}
                                                className="w-full bg-forest/20 border border-forest/20 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-emerald/30 appearance-none cursor-pointer"
                                            >
                                                {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-mist pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Special instructions */}
                                    <div>
                                        <label className="text-[10px] text-sage font-bold uppercase tracking-wider mb-1 block">Instructions</label>
                                        <input
                                            value={item.instructions}
                                            onChange={e => updateItem(item.id, 'instructions', e.target.value)}
                                            placeholder="e.g. After meals"
                                            className="w-full bg-forest/20 border border-forest/20 rounded-lg px-3 py-2 text-xs text-white placeholder:text-mist/40 outline-none focus:ring-1 focus:ring-emerald/30"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-forest/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-sage">
                    <Info className="w-3.5 h-3.5" />
                    <span>Drug interactions checked automatically</span>
                </div>
                <div className="flex items-center gap-2">
                    {items.length >= 2 && interactions.length === 0 && !isChecking && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald font-bold bg-emerald/5 px-3 py-1 rounded-full border border-emerald/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> No AI interactions detected
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || items.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald text-ink text-sm font-bold hover:bg-emerald/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Prescription'}
                    </button>
                </div>
            </div>
        </div>
    );
}
