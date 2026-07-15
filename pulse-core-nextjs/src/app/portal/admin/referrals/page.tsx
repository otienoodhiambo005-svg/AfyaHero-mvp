'use client';

import { useState, useEffect } from 'react';
import { 
    ArrowLeft, 
    Building2, 
    Clock, 
    MoreHorizontal, 
    AlertTriangle, 
    User, 
    MapPin, 
    FileText, 
    CheckCircle2,
    Truck,
    X,
    Maximize2,
    Phone,
    Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';
import ReferralMatchingPanel from '@/components/medical/ReferralMatchingPanel';

interface Referral {
    id: string;
    patientName: string;
    sourceHospital: string;
    destinationHospital: string;
    status: string;
    priority: number;
    expectedArrival: string;
}

export default function ReferralManagementPage() {
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchReferrals() {
            try {
                const res = await fetch('/api/admin/referrals');
                const data = await res.json();
                setReferrals(data);
            } catch (err) {
                logger.error('Failed to load referrals', { error: err });
            } finally {
                setLoading(false);
            }
        }
        fetchReferrals();
    }, []);

    const selectedReferral = referrals.find(r => r.id === selectedId);

    return (
        <div className="space-y-6 pb-16">
            {/* Premium Header Strip */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border border-content-border bg-content-bg p-6 md:p-8 rounded-3xl overflow-hidden relative shadow-card">
                <div className="absolute top-0 right-0 w-64 h-64 bg-portal-primary/10 blur-[100px] rounded-full -mr-20 -mt-20" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="px-3 py-1 rounded-full bg-content-surface border border-content-border text-[10px] font-bold uppercase tracking-[0.18em] text-portal-primary">
                            Network Operations
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-semibold text-ink mb-2">Referral Management</h1>
                    <p className="text-slate text-sm font-medium tracking-wide">Inter-facility coordination and capacity monitoring</p>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-card bg-portal-primary text-white text-sm font-semibold uppercase tracking-wide hover:bg-portal-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-portal-primary/40">
                        <Plus className="w-4 h-4" />
                        Initiate Referral
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-card bg-content-surface border border-content-border text-charcoal text-sm font-semibold uppercase tracking-wide hover:bg-content-canvas transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-portal-primary/30">
                        <FileText className="w-4 h-4" />
                        Facility Directory
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Active Transfers', value: '12', icon: Truck, trend: '+2' },
                    { label: 'Pending Intake', value: '04', icon: Clock, trend: 'Optimal' },
                    { label: 'Partner Beds', value: '284', icon: Building2, trend: '82% Peak' },
                    { label: 'Avg. Transfer', value: '38m', icon: MapPin, trend: '-4m' },
                ].map((kpi, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-content-bg border border-content-border p-5 rounded-card shadow-card transition-shadow motion-safe:hover:shadow-card-hover group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-content-surface rounded-card transition-colors group-hover:bg-portal-primary/10">
                                <kpi.icon className="w-6 h-6 text-primary" />
                            </div>
                            <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full">{kpi.trend}</span>
                        </div>
                        <p className="text-slate text-[10px] font-bold uppercase tracking-[0.16em] mb-1">{kpi.label}</p>
                        <p className="text-3xl font-semibold text-ink">{kpi.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* AI-Powered Referral Matching - Desktop/Tablet Optimized */}
            <ReferralMatchingPanel 
                diagnosis="Acute Myocardial Infarction"
                requiredSpecialization="Cardiology"
                urgency="emergency"
                patientLocation="Nairobi"
                insurance="SHIF"
            />

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Referrals List Table */}
                <div className="lg:col-span-2 bg-content-bg border border-content-border rounded-3xl shadow-card overflow-hidden min-h-[560px]">
                    <div className="p-6 border-b border-content-border flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-3">
                            Incoming Transfers
                            <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">LIVE</span>
                        </h2>
                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-content-surface rounded-card transition-colors">
                                <MoreHorizontal className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-content-border bg-content-surface">
                                    {['Patient', 'From', 'Status', 'ETA', 'Priority', ''].map(h => (
                                        <th key={h} className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={6} className="px-8 py-6 h-16 bg-content-surface/20" />
                                        </tr>
                                    ))
                                ) : (
                                    referrals.map((ref) => (
                                <tr
                                            key={ref.id} 
                                            onClick={() => setSelectedId(ref.id)}
                                            className={cn(
                                                'group hover:bg-content-surface transition-colors cursor-pointer',
                                                selectedId === ref.id ? 'bg-portal-primary/10' : ''
                                            )}
                                        >
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                                        <User className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                    <span className="font-bold text-ink">{ref.patientName}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-slate-500 font-medium">{ref.sourceHospital}</td>
                                            <td className="px-8 py-5">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                    ref.status === 'Received' ? "bg-success/5 text-success" :
                                                    ref.status === 'In Transit' ? "bg-primary/5 text-primary" : "bg-warning/5 text-warning"
                                                )}>
                                                    {ref.status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-slate-500 font-mono text-xs">
                                                {new Date(ref.expectedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-1">
                                                    {Array(5).fill(0).map((_, i) => (
                                                        <div key={i} className={cn(
                                                            "w-1 h-3 rounded-full",
                                                            i < ref.priority ? (ref.priority >= 4 ? "bg-danger" : "bg-primary") : "bg-slate-100"
                                                        )} />
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 flex justify-end">
                                                <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-content-bg rounded-lg transition-all border border-transparent hover:border-content-border">
                                                    <Maximize2 className="w-4 h-4 text-slate-400" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tactical Stats Sidebar */}
                <div className="space-y-4">
                    <div className="bg-content-bg border border-content-border rounded-3xl p-6 text-charcoal relative overflow-hidden shadow-card">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl" />
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-ink">
                             <MapPin className="w-5 h-5 text-primary" />
                             Network Hub Status
                        </h3>
                        <div className="space-y-6">
                            {[
                                { facility: 'Kenyatta National', capacity: '92%', status: 'Surge' },
                                { facility: 'The Nairobi Hospital', capacity: '78%', status: 'Flow' },
                                { facility: 'Aga Khan University', capacity: '86%', status: 'Limited' },
                                { facility: 'M.P. Shah Hospital', capacity: '64%', status: 'Stable' },
                            ].map((fac, i) => (
                                <div key={i} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0">
                                    <div>
                                        <p className="text-xs font-bold text-ink mb-0.5">{fac.facility}</p>
                                        <p className="text-[10px] text-slate uppercase tracking-widest font-bold">{fac.status}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-mono font-bold text-primary">{fac.capacity}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-content-bg border border-content-border rounded-3xl p-6 shadow-card">
                        <h3 className="text-lg font-black tracking-tight mb-6 uppercase italic text-ink flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-warning" />
                            Active Bottlenecks
                        </h3>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6">
                            Ambulance turnaround time at **Source Node A** is exceeding target by 15 mins. Capacity at **Destination Node C** is nearing critical threshold.
                        </p>
                        <button className="w-full py-3.5 rounded-card bg-content-surface border border-content-border text-charcoal text-[11px] font-semibold uppercase tracking-wide hover:bg-content-canvas transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-portal-primary/30">
                            Analyze Logistics Flow
                        </button>
                    </div>
                </div>
            </div>

            {/* Slide-in Detail Panel */}
            <AnimatePresence>
                {selectedId && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedId(null)}
                            className="fixed inset-0 bg-slate-900/60 z-[200]" 
                        />
                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 w-full max-w-[520px] h-full bg-content-bg shadow-2xl z-[201] flex flex-col border-l border-content-border"
                        >
                            {/* Panel Header */}
                            <div className="p-8 bg-content-surface text-charcoal relative flex items-center justify-between border-b border-content-border">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald/10 blur-[100px] rounded-full" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                            selectedReferral?.status === 'Received' ? "bg-success text-white" : "bg-primary text-white"
                                        )}>
                                            {selectedReferral?.status}
                                        </span>
                                        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">REF-{selectedReferral?.id.slice(0, 8)}</span>
                                    </div>
                                    <h2 className="text-3xl font-semibold text-ink">{selectedReferral?.patientName}</h2>
                                </div>
                                <button 
                                    onClick={() => setSelectedId(null)}
                                    className="p-3 bg-content-bg hover:bg-content-canvas rounded-card transition-colors relative z-10 border border-content-border"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 space-y-10">
                                {/* Transfer Summary */}
                                <section className="space-y-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Transfer Summary</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-6 bg-content-surface rounded-3xl border border-content-border/50">
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Source</p>
                                            <p className="font-bold text-ink">{selectedReferral?.sourceHospital}</p>
                                        </div>
                                        <div className="p-6 bg-content-surface rounded-3xl border border-content-border/50">
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Destination</p>
                                            <p className="font-bold text-ink">{selectedReferral?.destinationHospital}</p>
                                        </div>
                                    </div>
                                </section>

                                {/* Coordination Logistics */}
                                <section className="space-y-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Logistics</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-6 rounded-3xl border border-content-border/50">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-primary/5 rounded-card">
                                                    <Truck className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">Ambulance Unit K3-A</p>
                                                    <p className="text-[10px] font-black uppercase text-slate-400">Advanced Life Support</p>
                                                </div>
                                            </div>
                                            <button className="p-3 hover:bg-content-surface rounded-card transition-colors">
                                                <Phone className="w-5 h-5 text-slate-400" />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-6 rounded-3xl border border-content-border/50">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-warning/5 rounded-card">
                                                    <Clock className="w-5 h-5 text-warning" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">ETA: 14:45 PM</p>
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Optimal Flow</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-warning">IN TRANSIT</span>
                                        </div>
                                    </div>
                                </section>

                                {/* Clinician Notes */}
                                <section className="space-y-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Clinical Background</h3>
                                    <div className="p-6 bg-ink text-white rounded-3xl relative overflow-hidden">
                                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald/5 blur-2xl" />
                                        <p className="text-sm leading-relaxed text-white/80 font-medium italic">
                                            Patient stable but requires high-dose oxygen. Referral initiated due to ICU capacity surge at source facility. Expected handover duration: 15 mins.
                                        </p>
                                    </div>
                                </section>
                            </div>

                            <div className="p-8 border-t border-content-border bg-content-bg space-y-3">
                                <button className="w-full py-3.5 rounded-card bg-portal-primary text-white text-sm font-semibold uppercase tracking-wide hover:bg-portal-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-portal-primary/40">
                                    Confirm Intake & Assign Bed
                                </button>
                                <button className="w-full py-3.5 rounded-card bg-content-surface border border-content-border text-charcoal text-sm font-semibold uppercase tracking-wide hover:bg-content-canvas transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-portal-primary/30">
                                    Contact Source Facility
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
