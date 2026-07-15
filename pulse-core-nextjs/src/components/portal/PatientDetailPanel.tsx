'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X, User, Phone, Activity, FileText,
    Heart, Pill, AlertCircle,
    Shield, Droplets, Thermometer, Wind,
    BrainCircuit, Eye, FlaskConical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDiagnosticAI } from '@/hooks/useDiagnosticAI';
import { DiagnosticViewer } from './DiagnosticViewer';
import DischargePlanningPanel from '@/components/medical/DischargePlanningPanel';

/* ────────────────────────────────────────────────── types */
interface PatientVitals {
    bp: string;
    pulse: number;
    spo2: number;
    temp: string;
    rr: number;
    weight: string;
}

interface PatientRecord {
    id: string;
    date: string;
    type: string;
    doctor: string;
    summary: string;
}

interface PatientAllergy {
    substance: string;
    severity: 'mild' | 'moderate' | 'severe';
}

interface PatientMedication {
    name: string;
    dosage: string;
    frequency: string;
    active: boolean;
}

export interface PatientDetail {
    id: string;
    name: string;
    patient_id: string;
    age: number;
    gender: string;
    phone: string;
    national_id: string;
    blood_type: string;
    insurance?: string;
    SHIF_no?: string;
    emergency_contact: string;
    emergency_phone: string;
    vitals: PatientVitals;
    allergies: PatientAllergy[];
    medications: PatientMedication[];
    recent_records: PatientRecord[];
    conditions: string[];
}

interface PatientDetailPanelProps {
    patient: PatientDetail | null;
    open: boolean;
    onClose: () => void;
    onTriageDeepDive?: (symptoms: string) => void;
}

/* ────────────────────────────────────────────────── component */
export function PatientDetailPanel({ patient, open, onClose, onTriageDeepDive }: PatientDetailPanelProps) {
    const { 
        isAnalyzing, 
        radiologyResult, 
        pathologyResult, 
        analyzeRadiology, 
        analyzePathology,
        reset: resetDiagnostics
    } = useDiagnosticAI();

    const panelRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'medications' | 'discharge'>('overview');
    const [diagViewOpen, setDiagViewOpen] = useState(false);
    const [diagType, setDiagType] = useState<'radiology' | 'pathology'>('radiology');

    // close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { 
            if (e.key === 'Escape') {
                onClose();
                setDiagViewOpen(false);
            }
        };
        if (open) document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    const handleDiagnosticTrigger = async (type: 'radiology' | 'pathology', summary: string) => {
        setDiagType(type);
        setDiagViewOpen(true);
        
        if (type === 'radiology') {
            await analyzeRadiology({ modality: 'CXR', clinical_notes: summary });
        } else {
            await analyzePathology({ specimen_id: 'SPEC-99', description: summary });
        }
    };

    if (!patient) return null;

    const severityColor: Record<string, string> = {
        mild: 'bg-emerald/10 text-emerald border-emerald/30',
        moderate: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
        severe: 'bg-red-500/10 text-red-500 border-red-500/30',
    };

    const tabs = [
        { key: 'overview' as const, label: 'Overview' },
        { key: 'history' as const, label: 'History' },
        { key: 'medications' as const, label: 'Medications' },
        { key: 'discharge' as const, label: 'Discharge Planning' },
    ];

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    'fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 transition-opacity duration-300',
                    open ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                ref={panelRef}
                className={cn(
                    'fixed right-0 top-0 h-full w-[520px] max-w-[90vw] bg-content-bg z-50 shadow-2xl transition-transform duration-300 ease-out flex flex-col',
                    open ? 'translate-x-0' : 'translate-x-full'
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-content-border bg-content-surface/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-portal-primary to-[#2A6E9E] rounded-card flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-portal-primary/20 border border-portal-primary/30">
                            {patient.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-ink">{patient.name}</h2>
                            <p className="text-xs text-slate font-mono">{patient.patient_id} · {patient.age}y · {patient.gender}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close patient details" className="p-2 text-slate hover:text-ink hover:bg-content-surface rounded-card transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-content-border px-6">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'px-4 py-3 text-sm font-semibold border-b-2 transition-all',
                                activeTab === tab.key
                                    ? 'border-portal-primary text-portal-primary'
                                    : 'border-transparent text-slate hover:text-ink'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {activeTab === 'overview' && (
                        <>
                            {/* Contact Info */}
                            <Section title="Contact Information">
                                <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={patient.phone} />
                                <InfoRow icon={<Shield className="w-4 h-4" />} label="National ID" value={patient.national_id} />
                                <InfoRow icon={<Droplets className="w-4 h-4" />} label="Blood Type" value={patient.blood_type} />
                                {patient.insurance && <InfoRow icon={<FileText className="w-4 h-4" />} label="Insurance" value={`${patient.insurance} — ${patient.SHIF_no}`} />}
                                <InfoRow icon={<User className="w-4 h-4" />} label="Emergency" value={`${patient.emergency_contact} (${patient.emergency_phone})`} />
                            </Section>

                            {/* Vitals */}
                            <Section title="Current Vitals">
                                <div className="grid grid-cols-3 gap-3">
                                    <VitalCard label="Blood Pressure" value={patient.vitals.bp} icon={<Heart className="w-4 h-4" />} />
                                    <VitalCard label="Pulse" value={`${patient.vitals.pulse} bpm`} icon={<Activity className="w-4 h-4" />} />
                                    <VitalCard label="SpO₂" value={`${patient.vitals.spo2}%`} icon={<Wind className="w-4 h-4" />} danger={patient.vitals.spo2 < 95} />
                                    <VitalCard label="Temp" value={patient.vitals.temp} icon={<Thermometer className="w-4 h-4" />} />
                                    <VitalCard label="Resp Rate" value={`${patient.vitals.rr}/min`} icon={<Wind className="w-4 h-4" />} />
                                    <VitalCard label="Weight" value={patient.vitals.weight} icon={<User className="w-4 h-4" />} />
                                </div>
                            </Section>

                            {/* Allergies */}
                            <Section title="Allergies">
                                {patient.allergies.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {patient.allergies.map(a => (
                                            <span
                                                key={a.substance}
                                                className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border', severityColor[a.severity])}
                                            >
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                {a.substance} ({a.severity})
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-mist">No known allergies</p>
                                )}
                            </Section>

                            {/* Conditions */}
                            <Section title="Active Conditions">
                                <div className="flex flex-wrap gap-2">
                                    {patient.conditions.map(c => (
                                        <span key={c} className="px-3 py-1.5 bg-portal-primary/10 text-portal-primary rounded-full text-[11px] font-semibold border border-portal-primary/20">
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </Section>
                        </>
                    )}

                    {activeTab === 'history' && (
                        <Section title="Recent Records">
                            <div className="space-y-3">
                                {patient.recent_records.map(record => (
                                    <div key={record.id} className="p-4 bg-content-surface rounded-card border border-content-border hover:border-portal-primary/30 transition-all">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-portal-primary font-semibold">{record.type}</span>
                                            <span className="text-[11px] text-mist font-mono">{record.date}</span>
                                        </div>
                                        <p className="text-sm text-charcoal">{record.summary}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <p className="text-[11px] text-slate">{record.doctor}</p>
                                            {record.type === 'AI Triage' && (
                                                <button 
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onTriageDeepDive) onTriageDeepDive(record.summary);
                                                    }}
                                                >
                                                    <BrainCircuit className="w-3 h-3" /> Clinical Dive
                                                </button>
                                            )}
                                            {record.type.includes('Lab') && (
                                                <button 
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-portal-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-400 transition-all shadow-lg"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDiagnosticTrigger('pathology', record.summary);
                                                    }}
                                                >
                                                    <FlaskConical className="w-3 h-3" /> Analyze Specimen
                                                </button>
                                            )}
                                            {record.type.includes('Radiology') && (
                                                <button 
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-portal-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-400 transition-all shadow-lg"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDiagnosticTrigger('radiology', record.summary);
                                                    }}
                                                >
                                                    <Eye className="w-3 h-3" /> View Insight
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {activeTab === 'medications' && (
                        <Section title="Medications">
                            <div className="space-y-3">
                                {patient.medications.map(med => (
                                    <div key={med.name} className={cn('p-4 rounded-card border transition-all', med.active ? 'bg-content-bg border-content-border' : 'bg-content-surface/60 border-content-border/50 opacity-60')}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Pill className={cn('w-4 h-4', med.active ? 'text-portal-primary' : 'text-mist')} />
                                                <span className="text-sm font-semibold text-ink">{med.name}</span>
                                            </div>
                                            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', med.active ? 'bg-emerald/10 text-emerald' : 'bg-content-surface text-mist')}>
                                                {med.active ? 'Active' : 'Completed'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate mt-1">{med.dosage} · {med.frequency}</p>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {activeTab === 'discharge' && (
                        <DischargePlanningPanel
                            patientId={patient.id}
                            diagnosis={patient.conditions[0]}
                        />
                    )}
                </div>
            </div>

            <DiagnosticViewer 
                open={diagViewOpen}
                onClose={() => {
                    setDiagViewOpen(false);
                    resetDiagnostics();
                }}
                type={diagType}
                result={diagType === 'radiology' ? radiologyResult : pathologyResult}
                isAnalyzing={isAnalyzing}
                patientName={patient.name}
            />
        </>
    );
}

/* ────────────────────────────────────────────────── sub‑components */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate mb-3">{title}</h3>
            {children}
        </div>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 py-2 border-b border-content-border/50 last:border-0">
            <span className="text-mist">{icon}</span>
            <span className="text-xs text-slate w-24 flex-shrink-0">{label}</span>
            <span className="text-sm text-ink font-medium">{value}</span>
        </div>
    );
}

function VitalCard({ label, value, icon, danger }: { label: string; value: string; icon: React.ReactNode; danger?: boolean }) {
    return (
        <div className={cn('p-3 rounded-card border text-center', danger ? 'bg-red-50 border-red-200' : 'bg-content-surface border-content-border')}>
            <div className={cn('mx-auto mb-1', danger ? 'text-red-500' : 'text-portal-primary')}>{icon}</div>
            <p className={cn('text-lg font-bold font-mono', danger ? 'text-red-600' : 'text-ink')}>{value}</p>
            <p className="text-[10px] text-slate uppercase tracking-wider">{label}</p>
        </div>
    );
}
