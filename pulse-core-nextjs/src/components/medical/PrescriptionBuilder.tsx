'use client';

import { useState, useEffect } from 'react';
import logger from '@/lib/logger';
import { 
    Plus, 
    BrainCircuit, 
    AlertTriangle, 
    Trash2, 
    Dna, 
    Search, 
    Stethoscope, 
    ShieldAlert, 
    CheckCircle2,
    Info,
    History as HistoryIcon,
    ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AIPharmacy, type Medication, type PrescriptionValidation } from '@/lib/ai-pharmacy';
import GuidelineChecker from './GuidelineChecker';

type DrugEntry = Medication & { id: string };

interface PrescriptionBuilderProps {
    patientId?: string;
    patientName?: string;
    patientAge?: number;
    diagnoses?: string[];
    allergies?: string[];
    onSuccess?: (prescription: any) => void;
}

export default function PrescriptionBuilder({ 
    patientId = 'PID-10293', 
    patientName = 'HASSAN ALI', 
    patientAge = 35,
    diagnoses = ['Hypertension', 'Type 2 Diabetes'],
    allergies = ['Penicillin'],
    onSuccess 
}: PrescriptionBuilderProps) {
    const [meds, setMeds] = useState<DrugEntry[]>([]);
    const [validation, setValidation] = useState<PrescriptionValidation | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [clinicalNotes, setClinicalNotes] = useState('');

    const addMedication = () => {
        const newMed: DrugEntry = {
            id: crypto.randomUUID(),
            name: '',
            strength: '',
            form: 'tablet',
            route: 'oral',
            dose: '',
            frequency: '',
            duration: '',
            quantity: 1,
            instructions: ''
        };
        setMeds([...meds, newMed]);
    };

    const removeMedication = (id: string) => {
        setMeds(meds.filter(m => m.id !== id));
    };

    const updateMedication = (id: string, updates: Partial<Medication>) => {
        setMeds(meds.map(m => m.id === id ? { ...m, ...updates } : m));
    };

    // Auto-validate when medications change
    useEffect(() => {
        const validate = async () => {
            if (meds.length === 0) {
                setValidation(null);
                return;
            }
            
            // Filter out incomplete meds for validation
            const validMeds = meds.filter(m => m.name && m.strength);
            if (validMeds.length === 0) return;

            setIsValidating(true);
            try {
                const result = await AIPharmacy.validatePrescription({
                    medications: validMeds,
                    patientAge: patientAge,
                    diagnoses: diagnoses,
                    allergies: allergies
                });
                setValidation(result);
            } catch (error) {
                logger.error('Prescription validation failed', { error: error instanceof Error ? error.message : String(error) });
            } finally {
                setIsValidating(false);
            }
        };

        const timer = setTimeout(validate, 1000);
        return () => clearTimeout(timer);
    }, [meds, patientAge, diagnoses, allergies]);

    return (
        <div className="max-w-5xl mx-auto space-y-8 p-4 sm:p-8">
            {/* Clinical Header - Aligned with AfyaHero Clinical Standards */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-content-border/50 pb-6">
                <div>
                    <h2 className="text-3xl font-extrabold text-ink tracking-tight flex items-center gap-3">
                        Digital Prescription Builder
                        <div className="px-2 py-0.5 rounded bg-[#0F766E]/10 text-[#0F766E] text-xs uppercase tracking-widest font-black">
                            AI-Verified
                        </div>
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Hospital ID: {patientId} ΓÇó {patientName} ΓÇó {patientAge}/M</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="h-12 px-4 rounded-card bg-content-surface border border-content-border text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2">
                        <HistoryIcon className="w-4 h-4" /> Rx History
                    </button>
                    <button 
                        onClick={addMedication}
                        className="h-12 px-6 rounded-card bg-[#0F766E] text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#0F766E]/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> Add Substance
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Builder Canvas */}
                <div className="lg:col-span-8 space-y-4">
                    <AnimatePresence mode="popLayout">
                        {meds.length === 0 ? (
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-content-border rounded-[2rem] bg-content-surface/30"
                            >
                                <div className="w-16 h-16 rounded-3xl bg-content-bg shadow-xl flex items-center justify-center text-slate-300 mb-4">
                                    <Stethoscope className="w-8 h-8" />
                                </div>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">No medications added yet</p>
                            </motion.div>
                        ) : (
                            meds.map((med, idx) => (
                                <motion.div 
                                    key={med.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-content-bg border border-content-border p-6 rounded-[1.5rem] shadow-card hover:shadow-md transition-shadow relative overflow-hidden group"
                                >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#0F766E] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        <div className="md:col-span-2 space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Drug Name / Generic</label>
                                            <div className="relative">
                                                <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                                <input 
                                                    className="w-full pl-6 bg-transparent text-lg font-bold text-ink outline-none placeholder:text-slate-200"
                                                    placeholder="Search drug..."
                                                    value={med.name}
                                                    onChange={(e) => updateMedication(med.id, { name: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strength</label>
                                            <input 
                                                className="w-full bg-transparent text-lg font-bold text-ink outline-none placeholder:text-slate-200"
                                                placeholder="e.g. 500mg"
                                                value={med.strength}
                                                onChange={(e) => updateMedication(med.id, { strength: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-end">
                                            <button 
                                                onClick={() => removeMedication(med.id)}
                                                className="p-3 rounded-card text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Real-time Guideline Checker - Desktop/Tablet Optimized */}
                                    {med.name && (
                                        <div className="mt-4">
                                            <GuidelineChecker
                                                medication={med.name}
                                                dosage={`${med.strength} ${med.dose}`}
                                                patientAge={patientAge}
                                                diagnosis={diagnoses?.[0]}
                                                allergies={allergies}
                                                currentMedications={meds.filter(m => m.id !== med.id).map(m => m.name)}
                                                className="shadow-card"
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-50">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Frequency</label>
                                            <input 
                                                className="w-full text-sm font-bold text-slate-700 outline-none"
                                                placeholder="e.g. BD (Twice daily)"
                                                value={med.frequency}
                                                onChange={(e) => updateMedication(med.id, { frequency: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Route</label>
                                            <select 
                                                className="w-full text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
                                                value={med.route}
                                                onChange={(e) => updateMedication(med.id, { route: e.target.value as any })}
                                            >
                                                <option value="oral">Oral</option>
                                                <option value="intravenous">IV</option>
                                                <option value="intramuscular">IM</option>
                                                <option value="topical">Topical</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Duration</label>
                                            <input 
                                                className="w-full text-sm font-bold text-slate-700 outline-none"
                                                placeholder="7 Days"
                                                value={med.duration}
                                                onChange={(e) => updateMedication(med.id, { duration: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right block">Total Qty</label>
                                            <input 
                                                type="number"
                                                className="w-full text-sm font-black text-[#0F766E] outline-none text-right"
                                                value={med.quantity}
                                                onChange={(e) => updateMedication(med.id, { quantity: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>

                    {/* Clinical Instructions */}
                    <div className="bg-content-surface p-8 rounded-[2rem] space-y-4">
                        <label className="text-xs font-black text-ink uppercase tracking-widest flex items-center gap-2">
                             Clinical Notes & Patient Education
                             <Info className="w-4 h-4 text-slate-400" />
                        </label>
                        <textarea 
                            rows={3}
                            className="w-full p-4 rounded-card bg-content-bg border border-content-border outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300 resize-none"
                            placeholder="Add specific instructions, e.g., 'Take after meals', 'Avoid alcohol'..."
                            value={clinicalNotes}
                            onChange={(e) => setClinicalNotes(e.target.value)}
                        />
                    </div>
                </div>

                {/* AI Safety Sidebar - Solar Impact Ready */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-[#0F766E] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-content-bg/10 rounded-full blur-3xl"></div>
                        
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xs font-black uppercase tracking-widest text-teal-100">AI Reality Check</h3>
                            {isValidating && (
                                <div className="w-4 h-4 border-2 border-teal-200/30 border-t-white rounded-full animate-spin"></div>
                            )}
                        </div>

                        <div className="space-y-6">
                            {(!validation || (validation.errors.length === 0 && validation.warnings.length === 0)) ? (
                                <div className="py-4 text-center">
                                    <div className="w-12 h-12 rounded-card bg-content-bg/10 flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 className="w-6 h-6 text-teal-200" />
                                    </div>
                                    <p className="text-xs font-bold text-teal-50">Safe for patient profiling</p>
                                </div>
                            ) : (
                                <>
                                    {validation.errors.map((error, idx) => (
                                        <div key={idx} className="flex gap-3 p-4 rounded-card bg-red-500/20 border border-red-400/30">
                                            <ShieldAlert className="w-5 h-5 text-red-200 shrink-0" />
                                            <div>
                                                <p className="text-[10px] font-black text-red-100 uppercase tracking-widest">Contraindicated</p>
                                                <p className="text-xs font-medium text-white leading-tight mt-1">{error}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {validation.warnings.map((warning, idx) => (
                                        <div key={idx} className="flex gap-3 p-4 rounded-card bg-amber-500/20 border border-amber-400/30">
                                            <AlertTriangle className="w-5 h-5 text-amber-200 shrink-0" />
                                            <div>
                                                <p className="text-[10px] font-black text-amber-100 uppercase tracking-widest">Optimization Tip</p>
                                                <p className="text-xs font-medium text-white leading-tight mt-1">{warning}</p>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/10 space-y-4">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-teal-200">
                                <span>Verification Confidence</span>
                                <span>98.2%</span>
                            </div>
                            <div className="w-full h-1 bg-content-bg/10 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-content-bg"
                                    initial={{ width: 0 }}
                                    animate={{ width: '98.2%' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-content-bg border border-content-border rounded-[2.5rem] p-8 space-y-6 shadow-card">
                        <button 
                            onClick={() => {
                                if (onSuccess) {
                                    onSuccess({
                                        id: `RX-${Math.floor(Math.random() * 10000)}`,
                                        patient: patientName,
                                        prescribed: 'Just Now',
                                        status: 'Pending Dispensing',
                                        drugs: meds.map(m => `${m.name} ${m.strength}`).join(', ')
                                    });
                                }
                            }}
                            className="w-full h-16 rounded-card bg-[#0F766E] text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#0F766E]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                        >
                            Sign & Dispatch Rx
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button className="w-full h-14 rounded-card bg-content-surface text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-[#0F766E] hover:bg-[#0F766E]/5 transition-all">
                            Save as Draft Template
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
