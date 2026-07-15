'use client';

import { useState } from 'react';
import { 
    Fingerprint, 
    ShieldCheck, 
    History, 
    Search, 
    MoreHorizontal,
    CheckCircle2,
    XCircle,
    Clock,
    ArrowRight,
    AlertTriangle,
    UserPlus
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const IDCheckModal = dynamic(() => import('@/components/portal/IDCheckModal'), { ssr: false });

interface IDLog {
    id: string;
    patientName: string;
    nationalId: string;
    method: 'Resolve API';
    timestamp: string;
    status: 'Verified' | 'Possible Matches' | 'No Match' | 'Merge Requested' | 'Error';
    confidence?: number;
    notes?: string;
}

type ResolveState = {
    status: 'verified' | 'possible_matches' | 'not_found' | 'error';
    patient?: {
        id?: string;
        name?: string;
        idNumber?: string;
        matchScore?: number;
    };
    candidates?: Array<{ id?: string; name?: string; idNumber?: string; matchScore?: number }>;
    errorMessage?: string;
};

function nowLabel(): string {
    return new Date().toLocaleTimeString('en-KE', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function IDCheckPage() {
    const router = useRouter();
    const [idCheckOpen, setIdCheckOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [recentLogs, setRecentLogs] = useState<IDLog[]>([]);
    const [latestResolution, setLatestResolution] = useState<ResolveState | null>(null);
    const [matchedPatient, setMatchedPatient] = useState<ResolveState['patient'] | null>(null);
    const [mergeFeedback, setMergeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const pushLog = (entry: Omit<IDLog, 'id' | 'timestamp' | 'method'>) => {
        setRecentLogs((previous) => [
            {
                id: crypto.randomUUID(),
                timestamp: nowLabel(),
                method: 'Resolve API',
                ...entry,
            },
            ...previous,
        ]);
    };

    const filteredLogs = recentLogs.filter((log) =>
        `${log.patientName} ${log.nationalId}`.toLowerCase().includes(search.toLowerCase())
    );

    const goToCheckin = () => {
        const patientId = matchedPatient?.id;
        if (patientId) {
            router.push(`/portal/reception/checkin?patientId=${encodeURIComponent(patientId)}`);
            return;
        }
        router.push('/portal/reception/checkin');
    };

    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="rounded-card border border-content-border bg-content-surface p-6 md:p-8 relative overflow-hidden shadow-card">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] -mr-32 -mt-32" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-card bg-primary/15 flex items-center justify-center border border-primary/30">
                                <Fingerprint className="w-6 h-6 text-primary" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-semibold text-ink leading-none">Biometric ID Proofing</h1>
                        </div>
                        <p className="text-slate text-sm max-w-xl leading-relaxed">
                            Verify patient identities using AfyaHero’s proprietary face-match engine connected to the national registry. 
                            Maintain high security standards and prevent identity duplication.
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                        <button 
                            onClick={() => setIdCheckOpen(true)}
                            className="px-6 py-3.5 bg-primary hover:bg-primary/90 text-white rounded-card flex items-center justify-center gap-3 transition-colors font-semibold uppercase tracking-wide text-xs shadow-card group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                        >
                            <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            Start New Verification
                            <ArrowRight className="w-4 h-4 opacity-50" />
                        </button>
                        <button
                            onClick={goToCheckin}
                            disabled={!matchedPatient}
                            className="px-6 py-3.5 bg-success hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed text-ink rounded-card flex items-center justify-center gap-2 transition-colors font-semibold uppercase tracking-wide text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/35"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Use Matched Patient
                        </button>
                        <button
                            onClick={() => router.push('/portal/reception/checkin')}
                            className="px-6 py-3.5 bg-content-bg hover:bg-content-canvas text-charcoal rounded-card flex items-center justify-center gap-2 transition-colors font-semibold uppercase tracking-wide text-xs border border-content-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35"
                        >
                            <UserPlus className="w-4 h-4" />
                            Register New Patient
                        </button>
                    </div>
                </div>
            </div>

            {/* Latest Resolve State */}
            <div className="bg-content-bg border border-content-border rounded-card p-6 shadow-card">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Latest Resolve State</p>
                        <h2 className="text-lg font-bold text-ink mt-1">Identity Resolution Summary</h2>
                    </div>
                    {!latestResolution ? (
                        <span className="text-xs text-slate-500">No verification run in this session yet.</span>
                    ) : (
                        <div className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-card text-xs font-semibold uppercase tracking-wide',
                            latestResolution.status === 'verified' && 'bg-success/5 text-success',
                            latestResolution.status === 'possible_matches' && 'bg-primary/5 text-primary',
                            latestResolution.status === 'not_found' && 'bg-danger/5 text-danger',
                            latestResolution.status === 'error' && 'bg-warning/5 text-warning'
                        )}>
                            {latestResolution.status === 'verified' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {latestResolution.status === 'not_found' && <XCircle className="w-3.5 h-3.5" />}
                            {latestResolution.status === 'error' && <AlertTriangle className="w-3.5 h-3.5" />}
                            {latestResolution.status === 'possible_matches' && <MoreHorizontal className="w-3.5 h-3.5" />}
                            {latestResolution.status.replace('_', ' ')}
                        </div>
                    )}
                </div>
                {latestResolution && (
                    <p className="mt-3 text-sm text-slate-600">
                        {latestResolution.status === 'verified' && `Verified patient: ${latestResolution.patient?.name ?? 'Unknown Patient'}.`}
                        {latestResolution.status === 'possible_matches' && `Possible matches returned: ${latestResolution.candidates?.length ?? 0}.`}
                        {latestResolution.status === 'not_found' && 'No matching patient found. Continue with new patient registration.'}
                        {latestResolution.status === 'error' && (latestResolution.errorMessage ?? 'Unable to resolve patient identity at this time.')}
                    </p>
                )}
                {mergeFeedback && (
                    <div
                        className={cn(
                            'mt-4 px-4 py-3 rounded-card text-sm font-semibold border',
                            mergeFeedback.type === 'success'
                                ? 'bg-success/5 border-success/20 text-success'
                                : 'bg-danger/5 border-danger/20 text-danger'
                        )}
                    >
                        {mergeFeedback.message}
                    </div>
                )}
            </div>

            {/* Logs Section */}
            <div className="bg-content-bg border border-content-border rounded-card overflow-hidden shadow-card">
                <div className="p-8 border-b border-content-border flex flex-col md:flex-row md:items-center justify-between gap-6 bg-content-surface/50">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-slate-500" />
                            <h2 className="text-xl font-bold text-ink tracking-tight">Verification Audit Logs</h2>
                        </div>
                        <p className="text-slate-500 text-xs">Today&apos;s identification activity across all reception points</p>
                    </div>
                    
                    <div className="relative">
                        <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search logs by patient name..."
                            aria-label="Search verification logs"
                            className="bg-content-bg border border-content-border rounded-card pl-10 pr-4 py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:border-primary transition-colors w-full md:w-64"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-content-surface px-8">
                                {['Time', 'Patient Identity', 'Method', 'Status', 'Confidence', 'Actions'].map((h) => (
                                    <th key={h} className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-content-border/50">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-8 py-8 text-center text-slate-500">
                                        No resolve activity yet. Start a verification to populate audit logs.
                                    </td>
                                </tr>
                            )}
                            {filteredLogs.map((log) => (
                                <tr key={log.id} className="group hover:bg-content-surface transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                                            <Clock className="w-3.5 h-3.5 opacity-50" />
                                            {log.timestamp}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-ink">{log.patientName}</span>
                                            <span className="text-[10px] text-slate-400 font-mono tracking-tight uppercase">ID: {log.nationalId}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-content-border">
                                            {log.method}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className={cn(
                                            "flex items-center gap-2 font-black uppercase tracking-widest text-[10px]",
                                            log.status === 'Verified' ? 'text-success' : 
                                            log.status === 'No Match' ? 'text-danger' : 
                                            log.status === 'Possible Matches' ? 'text-primary' :
                                            log.status === 'Merge Requested' ? 'text-violet-500' : 'text-warning'
                                        )}>
                                            {log.status === 'Verified' ? <CheckCircle2 className="w-3 h-3" /> : 
                                             log.status === 'No Match' ? <XCircle className="w-3 h-3" /> : 
                                             log.status === 'Possible Matches' ? <MoreHorizontal className="w-3 h-3" /> :
                                             log.status === 'Merge Requested' ? <ArrowRight className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                            {log.status}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-xs font-mono font-bold text-slate-600">
                                            {typeof log.confidence === 'number' && log.confidence > 0 ? `${log.confidence.toFixed(1)}%` : '--'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <IDCheckModal 
                open={idCheckOpen} 
                onClose={() => setIdCheckOpen(false)} 
                onMatch={(patient) => {
                    setMatchedPatient(patient);
                    setIdCheckOpen(false);
                    pushLog({
                        patientName: patient?.name ?? 'Unknown Patient',
                        nationalId: patient?.idNumber ?? 'N/A',
                        status: 'Verified',
                        confidence: typeof patient?.matchScore === 'number' ? patient.matchScore : undefined,
                        notes: 'Patient confirmed by reception user.',
                    });
                }}
                onRegisterNew={() => {
                    setIdCheckOpen(false);
                    router.push('/portal/reception/checkin');
                }}
                onResolution={(event) => {
                    setLatestResolution(event);
                    if (event.status === 'possible_matches') {
                        pushLog({
                            patientName: event.patient?.name ?? 'Potential patient',
                            nationalId: event.patient?.idNumber ?? 'N/A',
                            status: 'Possible Matches',
                            confidence: event.patient?.matchScore,
                            notes: `${event.candidates?.length ?? 0} candidates returned.`,
                        });
                        return;
                    }
                    if (event.status === 'not_found') {
                        pushLog({
                            patientName: 'Unknown Patient',
                            nationalId: 'N/A',
                            status: 'No Match',
                            notes: 'No patient record matched submitted identifiers.',
                        });
                        return;
                    }
                    if (event.status === 'error') {
                        pushLog({
                            patientName: 'Resolve Attempt',
                            nationalId: 'N/A',
                            status: 'Error',
                            notes: event.errorMessage,
                        });
                    }
                }}
                onMergeResult={(event) => {
                    if (event.status === 'success') {
                        const targetName = event.targetPatient?.name ?? 'Canonical Patient';
                        const sourceName = event.sourcePatient?.name ?? 'Duplicate Source';
                        const note = event.reason?.trim()
                            ? `Merge request submitted: ${sourceName} -> ${targetName}. Reason: ${event.reason.trim()}`
                            : `Merge request submitted: ${sourceName} -> ${targetName}.`;
                        setMergeFeedback({
                            type: 'success',
                            message: `Merge request submitted for ${sourceName} into ${targetName}.`,
                        });
                        pushLog({
                            patientName: targetName,
                            nationalId: event.targetPatient?.idNumber ?? 'N/A',
                            status: 'Merge Requested',
                            confidence:
                                typeof event.targetPatient?.matchScore === 'number'
                                    ? event.targetPatient.matchScore
                                    : undefined,
                            notes: note,
                        });
                        return;
                    }

                    const targetName = event.targetPatient?.name ?? 'Canonical Patient';
                    const sourceName = event.sourcePatient?.name ?? 'Duplicate Source';
                    setMergeFeedback({
                        type: 'error',
                        message:
                            event.errorMessage ??
                            `Merge request failed for ${sourceName} into ${targetName}.`,
                    });
                    pushLog({
                        patientName: targetName,
                        nationalId: event.targetPatient?.idNumber ?? 'N/A',
                        status: 'Error',
                        confidence:
                            typeof event.targetPatient?.matchScore === 'number'
                                ? event.targetPatient.matchScore
                                : undefined,
                        notes:
                            event.errorMessage ??
                            `Merge request failed for ${sourceName} -> ${targetName}.`,
                    });
                }}
            />
        </div>
    );
}
