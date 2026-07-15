'use client';

import { useState, useEffect } from 'react';
import { 
    X, 
    ShieldCheck, 
    UserCheck,
    Loader2, 
    CheckCircle2, 
    AlertCircle,
    Fingerprint,
    UserPlus
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Modal, ModalContent, ModalOverlay, ModalPortal, ModalTitle, ModalDescription, ModalClose } from '@/components/ui/modal';

interface IDCheckModalProps {
    open: boolean;
    onClose: () => void;
    onMatch?: (patient: any) => void;
    onRegisterNew?: () => void;
    onResolution?: (event: {
        status: 'verified' | 'possible_matches' | 'not_found' | 'error';
        patient?: any;
        candidates?: any[];
        errorMessage?: string;
    }) => void;
    onMergeResult?: (event: {
        status: 'success' | 'error';
        targetPatient?: any;
        sourcePatient?: any;
        reason?: string;
        errorMessage?: string;
    }) => void;
}

export default function IDCheckModal({ open, onClose, onMatch, onRegisterNew, onResolution, onMergeResult }: IDCheckModalProps) {
    const [step, setStep] = useState<'idle' | 'loading' | 'verified' | 'possible_matches' | 'not_found' | 'error'>('idle');
    const [lookupFields, setLookupFields] = useState({
        fullName: '',
        idNumber: '',
        dateOfBirth: '',
        phoneNumber: '',
    });
    const [matchedPatient, setMatchedPatient] = useState<any>(null);
    const [possibleMatches, setPossibleMatches] = useState<any[]>([]);
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
    const [mergeReason, setMergeReason] = useState('');
    const [mergeConfirmationText, setMergeConfirmationText] = useState('');
    const [mergeSubmitting, setMergeSubmitting] = useState(false);
    const [mergeFeedback, setMergeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [matchScore, setMatchScore] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState('');

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            setStep('idle');
            setLookupFields({
                fullName: '',
                idNumber: '',
                dateOfBirth: '',
                phoneNumber: '',
            });
            setMatchedPatient(null);
            setPossibleMatches([]);
            setSelectedMatchId(null);
            setMergeSourceId(null);
            setMergeReason('');
            setMergeConfirmationText('');
            setMergeSubmitting(false);
            setMergeFeedback(null);
            setMatchScore(null);
            setErrorMessage('');
        }
    }, [open]);

    const normalizeConfidence = (value: unknown): number => {
        const raw = typeof value === 'number' ? value : Number(value ?? 0);
        if (!Number.isFinite(raw) || raw <= 0) return 0;
        // API confidence is 0-1; legacy values may already be percentages.
        return raw <= 1 ? raw * 100 : raw;
    };

    const normalizePatient = (candidate: any) => ({
        id: String(candidate?.id ?? candidate?.patient_id ?? candidate?.patientId ?? candidate?.uuid ?? ''),
        name: candidate?.name ?? candidate?.full_name ?? candidate?.patient_name ?? 'Unknown Patient',
        dob: candidate?.dob ?? candidate?.date_of_birth ?? candidate?.birth_date ?? 'N/A',
        idNumber: candidate?.idNumber ?? candidate?.nationalId ?? candidate?.id_number ?? candidate?.national_id ?? 'N/A',
        insurance: candidate?.insurance ?? candidate?.insurance_status ?? candidate?.insuranceStatus ?? 'Not specified',
        lastVisit: candidate?.lastVisit ?? candidate?.last_visit ?? candidate?.updated_at ?? candidate?.created_at ?? 'N/A',
        matchScore: normalizeConfidence(
            candidate?.matchScore ?? candidate?.match_score ?? candidate?.confidence ?? candidate?.score ?? 0
        ),
    });

    const readErrorMessage = (payload: any) => {
        if (!payload || typeof payload !== 'object') return '';
        const value = payload.error ?? payload.message ?? payload.detail;
        return typeof value === 'string' ? value : '';
    };

    const resolvePatient = async () => {
        const hasLookupInput = Object.values(lookupFields).some((value) => value.trim().length > 0);
        if (!hasLookupInput) {
            const message = 'Enter at least one patient detail to run verification.';
            setErrorMessage(message);
            setStep('error');
            onResolution?.({ status: 'error', errorMessage: message });
            return;
        }

        setStep('loading');
        setErrorMessage('');
        setMatchedPatient(null);
        setPossibleMatches([]);
        setSelectedMatchId(null);
        setMergeSourceId(null);
        setMergeReason('');
        setMergeConfirmationText('');
        setMergeFeedback(null);
        setMatchScore(null);

        try {
            const response = await fetch('/api/v1/patients/resolve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: lookupFields.fullName.trim() || undefined,
                    nationalId: lookupFields.idNumber.trim() || undefined,
                    dob: lookupFields.dateOfBirth || undefined,
                    phone: lookupFields.phoneNumber.trim() || undefined,
                }),
            });

            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                const message = readErrorMessage(payload) || 'Unable to verify identity right now. Please try again or continue with manual registration.';
                setErrorMessage(message);
                setStep('error');
                onResolution?.({ status: 'error', errorMessage: message });
                return;
            }

            const status = typeof payload?.status === 'string' ? payload.status.toLowerCase() : '';
            const verifiedPatientRaw = payload?.primaryMatch ?? payload?.patient ?? payload?.match ?? payload?.resolved_patient;
            const possibleMatchesRaw = payload?.candidates ?? payload?.possible_matches ?? payload?.matches;

            if (status === 'verified' || status === 'match_found' || payload?.verified === true || (verifiedPatientRaw && !Array.isArray(possibleMatchesRaw))) {
                const patient = normalizePatient(verifiedPatientRaw ?? payload);
                setMatchedPatient(patient);
                setMatchScore(patient.matchScore || null);
                setStep('verified');
                onResolution?.({ status: 'verified', patient, candidates: [patient] });
                return;
            }

            if (status === 'possible_matches' || status === 'possible_match' || Array.isArray(possibleMatchesRaw)) {
                const normalizedCandidates = (Array.isArray(possibleMatchesRaw) ? possibleMatchesRaw : [])
                    .map((candidate) => normalizePatient(candidate))
                    .filter((candidate) => candidate.id || candidate.name !== 'Unknown Patient');

                if (normalizedCandidates.length > 0) {
                    const initialCanonical = normalizedCandidates[0]?.id || null;
                    const initialSource =
                        normalizedCandidates.find((candidate) => candidate.id && candidate.id !== initialCanonical)?.id || null;
                    setPossibleMatches(normalizedCandidates);
                    setSelectedMatchId(initialCanonical);
                    setMergeSourceId(initialSource);
                    setStep('possible_matches');
                    onResolution?.({ status: 'possible_matches', candidates: normalizedCandidates, patient: normalizedCandidates[0] });
                    return;
                }
            }

            setStep('not_found');
            onResolution?.({ status: 'not_found', candidates: [] });
        } catch {
            const message = 'Unable to verify identity right now. Check connection and try again.';
            setErrorMessage(message);
            setStep('error');
            onResolution?.({ status: 'error', errorMessage: message });
        }
    };

    const selectedCandidate = possibleMatches.find((candidate) => candidate.id === selectedMatchId) ?? null;

    const selectCandidate = (candidate: any) => {
        setSelectedMatchId(candidate.id || null);
        setMatchedPatient(candidate);
        setMatchScore(candidate.matchScore || null);
        if (candidate.id && mergeSourceId === candidate.id) {
            const fallbackSource = possibleMatches.find(
                (possibleCandidate) => possibleCandidate.id && possibleCandidate.id !== candidate.id
            );
            setMergeSourceId(fallbackSource?.id ?? null);
        }
    };

    const selectedSourceCandidate = possibleMatches.find((candidate) => candidate.id === mergeSourceId) ?? null;
    const mergeReady =
        Boolean(selectedCandidate?.id) &&
        Boolean(selectedSourceCandidate?.id) &&
        selectedCandidate?.id !== selectedSourceCandidate?.id &&
        mergeConfirmationText.trim().toUpperCase() === 'MERGE';

    const submitMergeRequest = async () => {
        if (!selectedCandidate?.id || !selectedSourceCandidate?.id || selectedCandidate.id === selectedSourceCandidate.id) {
            setMergeFeedback({
                type: 'error',
                message: 'Choose a canonical patient and a different duplicate record to merge.',
            });
            return;
        }

        if (mergeConfirmationText.trim().toUpperCase() !== 'MERGE') {
            setMergeFeedback({
                type: 'error',
                message: 'Type MERGE to confirm this action.',
            });
            return;
        }

        setMergeSubmitting(true);
        setMergeFeedback(null);

        try {
            const response = await fetch(`/api/v1/patients/${encodeURIComponent(selectedCandidate.id)}/merge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sourcePatientId: selectedSourceCandidate.id,
                    reason: mergeReason.trim() || undefined,
                }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                const message = readErrorMessage(payload) || 'Merge request failed. Please try again.';
                setMergeFeedback({ type: 'error', message });
                onMergeResult?.({
                    status: 'error',
                    targetPatient: selectedCandidate,
                    sourcePatient: selectedSourceCandidate,
                    reason: mergeReason.trim() || undefined,
                    errorMessage: message,
                });
                return;
            }

            const successMessage = 'Merge request submitted successfully.';
            setMergeFeedback({ type: 'success', message: successMessage });
            onMergeResult?.({
                status: 'success',
                targetPatient: selectedCandidate,
                sourcePatient: selectedSourceCandidate,
                reason: mergeReason.trim() || undefined,
            });
        } catch {
            const message = 'Merge request failed. Check connection and retry.';
            setMergeFeedback({ type: 'error', message });
            onMergeResult?.({
                status: 'error',
                targetPatient: selectedCandidate,
                sourcePatient: selectedSourceCandidate,
                reason: mergeReason.trim() || undefined,
                errorMessage: message,
            });
        } finally {
            setMergeSubmitting(false);
        }
    };

    return (
        <Modal
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <ModalPortal>
                <ModalOverlay className="bg-[#080F0C]/90 backdrop-blur-xl z-[200]" closeOnClick />
                <ModalContent
                    className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-slate-950 border border-white/10 rounded-[40px] shadow-2xl z-[201] overflow-hidden flex flex-col"
                    closeOnEscape
                    initialFocusSelector="input, select, textarea, button"
                >
                        {/* Header */}
                        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-content-bg/[0.02]">
                            <div>
                                <ModalTitle className="text-2xl font-serif italic text-white flex items-center gap-3">
                                    <ShieldCheck className="w-7 h-7 text-[#2563EB]" />
                                    Biometric Identity Verification
                                </ModalTitle>
                                <ModalDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">
                                    Face-Match • AFYA-BIOMED v2.4
                                </ModalDescription>
                            </div>
                            <ModalClose
                                aria-label="Close identity verification"
                                className="p-3 hover:bg-content-bg/5 rounded-card transition-all border border-transparent hover:border-white/10 text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </ModalClose>
                        </div>

                        {/* Body */}
                        <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
                            {step === 'idle' && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="w-full max-w-lg mx-auto space-y-8"
                                >
                                    <div className="text-center space-y-3">
                                        <h3 className="text-xl font-bold text-white uppercase tracking-tight">Verify Existing Patient</h3>
                                        <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                                            Enter any available identifiers to resolve the patient profile from the registry.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <input
                                            value={lookupFields.fullName}
                                            onChange={(event) =>
                                                setLookupFields((previous) => ({ ...previous, fullName: event.target.value }))
                                            }
                                            placeholder="Patient full name"
                                            className="px-4 py-3 rounded-card bg-content-bg/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB]"
                                        />
                                        <input
                                            value={lookupFields.idNumber}
                                            onChange={(event) =>
                                                setLookupFields((previous) => ({ ...previous, idNumber: event.target.value }))
                                            }
                                            placeholder="National ID / Patient ID"
                                            className="px-4 py-3 rounded-card bg-content-bg/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB]"
                                        />
                                        <input
                                            type="date"
                                            value={lookupFields.dateOfBirth}
                                            onChange={(event) =>
                                                setLookupFields((previous) => ({ ...previous, dateOfBirth: event.target.value }))
                                            }
                                            className="px-4 py-3 rounded-card bg-content-bg/5 border border-white/10 text-white focus:outline-none focus:border-[#2563EB]"
                                        />
                                        <input
                                            value={lookupFields.phoneNumber}
                                            onChange={(event) =>
                                                setLookupFields((previous) => ({ ...previous, phoneNumber: event.target.value }))
                                            }
                                            placeholder="Phone number"
                                            className="px-4 py-3 rounded-card bg-content-bg/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB]"
                                        />
                                    </div>

                                    <button 
                                        onClick={resolvePatient}
                                        className="px-12 py-4 bg-[#2563EB] hover:bg-[#3b82f6] text-white rounded-full flex items-center gap-3 transition-all font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 active:scale-95"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                        Resolve Patient
                                    </button>
                                </motion.div>
                            )}

                            {step === 'loading' && (
                                <div className="text-center space-y-6">
                                    <div className="relative">
                                        <Loader2 className="w-20 h-20 text-[#2563EB] animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Bot className="w-8 h-8 text-white animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-white uppercase tracking-wider">Verifying Patient Identity</h3>
                                        <p className="text-slate-400 text-xs font-mono">Resolving patient details against registry records...</p>
                                    </div>
                                </div>
                            )}

                            {step === 'verified' && matchedPatient && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="w-full space-y-8"
                                >
                                    <div className="flex items-center gap-6 p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20">
                                        <div className="w-24 h-24 rounded-full border-4 border-emerald-500 p-1 flex items-center justify-center bg-emerald-500/5">
                                            <UserCheck className="w-10 h-10 text-emerald-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-2xl font-bold text-white">{matchedPatient.name}</h4>
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            </div>
                                            {typeof matchScore === 'number' && matchScore > 0 && (
                                                <p className="text-emerald-500 font-black text-[10px] uppercase tracking-[0.2em]">
                                                    {matchScore.toFixed(1)}% Identity Confidence
                                                </p>
                                            )}
                                            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
                                                <span className="flex items-center gap-1.5"><Fingerprint className="w-3 h-3" /> {matchedPatient.idNumber}</span>
                                                <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-emerald-500" /> {matchedPatient.insurance}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            onClick={() => {
                                                onMatch?.(matchedPatient);
                                                onClose();
                                            }}
                                            className="px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-ink rounded-card flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-xs"
                                        >
                                            <UserCheck className="w-4 h-4" />
                                            Confirm Identity
                                        </button>
                                        <button 
                                            onClick={() => setStep('idle')}
                                            className="px-6 py-4 bg-content-bg/5 hover:bg-content-bg/10 text-white rounded-card flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-xs border border-white/5"
                                        >
                                            Verify Different Patient
                                        </button>
                                    </div>

                                    <div className="rounded-card border border-amber-400/20 bg-amber-500/10 p-4 space-y-3">
                                        <p className="text-[10px] uppercase tracking-widest font-black text-amber-300">
                                            Duplicate Resolution (Optional)
                                        </p>
                                        <p className="text-xs text-slate-300">
                                            Choose a canonical patient record and a duplicate source record, then confirm before submitting.
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <label className="space-y-1">
                                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                    Canonical Patient (Target)
                                                </span>
                                                <select
                                                    value={selectedMatchId ?? ''}
                                                    onChange={(event) => {
                                                        const nextTargetId = event.target.value || null;
                                                        setSelectedMatchId(nextTargetId);
                                                        const nextTarget = possibleMatches.find((candidate) => candidate.id === nextTargetId) ?? null;
                                                        if (nextTarget) {
                                                            setMatchedPatient(nextTarget);
                                                            setMatchScore(nextTarget.matchScore || null);
                                                        }
                                                        if (nextTargetId && mergeSourceId === nextTargetId) {
                                                            const fallbackSource = possibleMatches.find(
                                                                (candidate) => candidate.id && candidate.id !== nextTargetId
                                                            );
                                                            setMergeSourceId(fallbackSource?.id ?? null);
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 rounded-card bg-content-bg/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#2563EB]"
                                                >
                                                    <option value="" className="text-ink">Select canonical patient</option>
                                                    {possibleMatches.map((candidate) => (
                                                        <option
                                                            key={`target-${candidate.id || candidate.name}`}
                                                            value={candidate.id || ''}
                                                            className="text-ink"
                                                        >
                                                            {candidate.name} ({candidate.idNumber})
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="space-y-1">
                                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                    Duplicate Source
                                                </span>
                                                <select
                                                    value={mergeSourceId ?? ''}
                                                    onChange={(event) => setMergeSourceId(event.target.value || null)}
                                                    className="w-full px-3 py-2 rounded-card bg-content-bg/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#2563EB]"
                                                >
                                                    <option value="" className="text-ink">Select duplicate source</option>
                                                    {possibleMatches
                                                        .filter((candidate) => candidate.id && candidate.id !== selectedMatchId)
                                                        .map((candidate) => (
                                                            <option
                                                                key={`source-${candidate.id || candidate.name}`}
                                                                value={candidate.id || ''}
                                                                className="text-ink"
                                                            >
                                                                {candidate.name} ({candidate.idNumber})
                                                            </option>
                                                        ))}
                                                </select>
                                            </label>
                                        </div>
                                        <label className="space-y-1 block">
                                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                Reason (Optional)
                                            </span>
                                            <input
                                                value={mergeReason}
                                                onChange={(event) => setMergeReason(event.target.value)}
                                                placeholder="e.g. Duplicate registration from spelling variation"
                                                className="w-full px-3 py-2 rounded-card bg-content-bg/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB]"
                                            />
                                        </label>
                                        <label className="space-y-1 block">
                                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                Confirmation
                                            </span>
                                            <input
                                                value={mergeConfirmationText}
                                                onChange={(event) => setMergeConfirmationText(event.target.value)}
                                                placeholder="Type MERGE to confirm"
                                                className="w-full px-3 py-2 rounded-card bg-content-bg/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB]"
                                            />
                                        </label>
                                        {mergeFeedback && (
                                            <p
                                                className={`text-xs font-semibold ${
                                                    mergeFeedback.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
                                                }`}
                                            >
                                                {mergeFeedback.message}
                                            </p>
                                        )}
                                        <button
                                            onClick={submitMergeRequest}
                                            disabled={!mergeReady || mergeSubmitting}
                                            className="w-full px-5 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-ink rounded-card flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-xs"
                                        >
                                            {mergeSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                            {mergeSubmitting ? 'Submitting Merge' : 'Request Duplicate Merge'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 'possible_matches' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="w-full space-y-6"
                                >
                                    <div className="space-y-2 text-center">
                                        <h3 className="text-xl font-bold text-white uppercase tracking-tight">Possible Patient Matches</h3>
                                        <p className="text-slate-400 text-sm max-w-md mx-auto">
                                            Select the correct profile to complete identity verification.
                                        </p>
                                    </div>

                                    <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
                                        {possibleMatches.map((candidate) => {
                                            const selected = selectedMatchId === candidate.id;
                                            return (
                                                <button
                                                    key={candidate.id || `${candidate.name}-${candidate.idNumber}`}
                                                    onClick={() => selectCandidate(candidate)}
                                                    className={`w-full text-left p-4 rounded-card border transition-colors ${selected ? 'border-[#2563EB] bg-[#2563EB]/10' : 'border-white/10 bg-content-bg/5 hover:bg-content-bg/10'}`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{candidate.name}</p>
                                                            <p className="text-[11px] uppercase tracking-wider text-slate-400 mt-1">
                                                                ID: {candidate.idNumber} • DOB: {candidate.dob}
                                                            </p>
                                                        </div>
                                                        {candidate.matchScore > 0 && (
                                                            <span className="text-xs font-black text-[#93C5FD]">
                                                                {candidate.matchScore.toFixed(1)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button
                                            onClick={() => {
                                                if (selectedCandidate) {
                                                    onMatch?.(selectedCandidate);
                                                    onClose();
                                                }
                                            }}
                                            disabled={!selectedCandidate}
                                            className="px-6 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-ink rounded-card flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-xs"
                                        >
                                            <UserCheck className="w-4 h-4" />
                                            Confirm Selected Match
                                        </button>
                                        <button
                                            onClick={() => setStep('idle')}
                                            className="px-6 py-4 bg-content-bg/5 hover:bg-content-bg/10 text-white rounded-card flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-xs border border-white/5"
                                        >
                                            Search Again
                                        </button>
                                    </div>

                                    <div className="rounded-card border border-amber-400/20 bg-amber-500/10 p-4 space-y-3">
                                        <p className="text-[10px] uppercase tracking-widest font-black text-amber-300">
                                            Duplicate Resolution (Optional)
                                        </p>
                                        <p className="text-xs text-slate-300">
                                            Choose a canonical patient record and a duplicate source record, then confirm before submitting.
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <label className="space-y-1">
                                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                    Canonical Patient (Target)
                                                </span>
                                                <select
                                                    value={selectedMatchId ?? ''}
                                                    onChange={(event) => {
                                                        const nextTargetId = event.target.value || null;
                                                        setSelectedMatchId(nextTargetId);
                                                        const nextTarget = possibleMatches.find((candidate) => candidate.id === nextTargetId) ?? null;
                                                        if (nextTarget) {
                                                            setMatchedPatient(nextTarget);
                                                            setMatchScore(nextTarget.matchScore || null);
                                                        }
                                                        if (nextTargetId && mergeSourceId === nextTargetId) {
                                                            const fallbackSource = possibleMatches.find(
                                                                (candidate) => candidate.id && candidate.id !== nextTargetId
                                                            );
                                                            setMergeSourceId(fallbackSource?.id ?? null);
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 rounded-card bg-content-bg/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#2563EB]"
                                                >
                                                    <option value="" className="text-ink">Select canonical patient</option>
                                                    {possibleMatches.map((candidate) => (
                                                        <option
                                                            key={`target-possible-${candidate.id || candidate.name}`}
                                                            value={candidate.id || ''}
                                                            className="text-ink"
                                                        >
                                                            {candidate.name} ({candidate.idNumber})
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="space-y-1">
                                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                    Duplicate Source
                                                </span>
                                                <select
                                                    value={mergeSourceId ?? ''}
                                                    onChange={(event) => setMergeSourceId(event.target.value || null)}
                                                    className="w-full px-3 py-2 rounded-card bg-content-bg/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#2563EB]"
                                                >
                                                    <option value="" className="text-ink">Select duplicate source</option>
                                                    {possibleMatches
                                                        .filter((candidate) => candidate.id && candidate.id !== selectedMatchId)
                                                        .map((candidate) => (
                                                            <option
                                                                key={`source-possible-${candidate.id || candidate.name}`}
                                                                value={candidate.id || ''}
                                                                className="text-ink"
                                                            >
                                                                {candidate.name} ({candidate.idNumber})
                                                            </option>
                                                        ))}
                                                </select>
                                            </label>
                                        </div>
                                        <label className="space-y-1 block">
                                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                Reason (Optional)
                                            </span>
                                            <input
                                                value={mergeReason}
                                                onChange={(event) => setMergeReason(event.target.value)}
                                                placeholder="e.g. Duplicate registration from spelling variation"
                                                className="w-full px-3 py-2 rounded-card bg-content-bg/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB]"
                                            />
                                        </label>
                                        <label className="space-y-1 block">
                                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                Confirmation
                                            </span>
                                            <input
                                                value={mergeConfirmationText}
                                                onChange={(event) => setMergeConfirmationText(event.target.value)}
                                                placeholder="Type MERGE to confirm"
                                                className="w-full px-3 py-2 rounded-card bg-content-bg/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#2563EB]"
                                            />
                                        </label>
                                        {mergeFeedback && (
                                            <p
                                                className={`text-xs font-semibold ${
                                                    mergeFeedback.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
                                                }`}
                                            >
                                                {mergeFeedback.message}
                                            </p>
                                        )}
                                        <button
                                            onClick={submitMergeRequest}
                                            disabled={!mergeReady || mergeSubmitting}
                                            className="w-full px-5 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-ink rounded-card flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-xs"
                                        >
                                            {mergeSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                            {mergeSubmitting ? 'Submitting Merge' : 'Request Duplicate Merge'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 'not_found' && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center space-y-8"
                                >
                                    <div className="w-24 h-24 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
                                        <AlertCircle className="w-12 h-12 text-rose-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-white uppercase tracking-tight">No Patient Match Found</h3>
                                        <p className="text-slate-400 text-sm max-w-xs mx-auto">
                                            No existing patient profile matched the submitted details. Proceed with new patient registration.
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                                        <button 
                                            onClick={onRegisterNew}
                                            className="px-12 py-4 bg-content-bg text-ink rounded-full flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-xs shadow-xl active:scale-95"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                            Manual Registration
                                        </button>
                                        <button 
                                            onClick={() => setStep('idle')}
                                            className="px-8 py-3 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-white transition-colors"
                                        >
                                            Try Another Lookup
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 'error' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center space-y-8"
                                >
                                    <div className="w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
                                        <AlertCircle className="w-12 h-12 text-amber-400" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-white uppercase tracking-tight">Verification Unavailable</h3>
                                        <p className="text-slate-400 text-sm max-w-sm mx-auto">
                                            {errorMessage || 'Unable to verify identity right now. Please try again shortly.'}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                                        <button
                                            onClick={() => setStep('idle')}
                                            className="px-12 py-4 bg-[#2563EB] hover:bg-[#3b82f6] text-white rounded-full flex items-center justify-center gap-3 transition-all font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 active:scale-95"
                                        >
                                            Retry Verification
                                        </button>
                                        <button
                                            onClick={onRegisterNew}
                                            className="px-8 py-3 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-white transition-colors"
                                        >
                                            Continue with Manual Registration
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Footer Legal */}
                        <div className="px-8 py-6 border-t border-white/5 bg-content-bg/[0.01]">
                            <p className="text-[9px] text-slate-500 text-center leading-relaxed font-medium">
                                This system matches against the National Integrated Identity Management System (NIIMS) and AfyaHero Internal Registry. All biometric data is encrypted end-to-end and stored in compliance with the Data Protection Act (Kenya).
                            </p>
                        </div>
                </ModalContent>
            </ModalPortal>
        </Modal>
    );
}

// Sub-component for Bot icon if not available in lucide
function Bot({ className, style }: { className?: string, style?: any }) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
            style={style}
        >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
        </svg>
    );
}
