/**
 * useAfyaScribe
 *
 * Stub for the AI Scribe WebSocket lifecycle.
 * In production this connects to wss://api.afyahero.com/v1/ai/scribe/ws
 * and streams real-time transcription segments + SOAP generation events.
 *
 * The stub simulates streaming transcription for development/demo purposes.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ──────────────────────────────────────── types */
export type ScribeStatus = 'idle' | 'connecting' | 'recording' | 'processing' | 'error' | 'closed';

export interface TranscriptSegment {
    id: string;
    speaker: 'doctor' | 'patient';
    text: string;
    timestamp: string;
    confidence: number;
}

export interface SOAPNote {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    generatedAt: string;
    aiModel: string;
    confidenceScore: number;
}

interface UseAfyaScribeOptions {
    consultationId: string;
    /** Called when a new transcript segment arrives */
    onSegment?: (segment: TranscriptSegment) => void;
    /** Called when SOAP generation completes */
    onSOAPGenerated?: (soap: SOAPNote) => void;
}

interface UseAfyaScribeReturn {
    status: ScribeStatus;
    transcript: TranscriptSegment[];
    soap: SOAPNote | null;
    isGeneratingSOAP: boolean;
    startRecording: () => void;
    stopRecording: () => void;
    generateSOAP: () => void;
    clearTranscript: () => void;
}

/* ──────────────────────────────────────── demo transcript segments (dev mode) */
const DEMO_SEGMENTS: Omit<TranscriptSegment, 'id' | 'timestamp'>[] = [
    { speaker: 'doctor', text: 'Good morning. How are you feeling today?', confidence: 0.99 },
    { speaker: 'patient', text: 'Not too good doctor. My chest has been tight and I have been coughing.', confidence: 0.97 },
    { speaker: 'doctor', text: 'How long has this been going on?', confidence: 0.99 },
    { speaker: 'patient', text: 'About three days now. It started after I got wet in the rain.', confidence: 0.95 },
    { speaker: 'doctor', text: 'Any fever or chills? Difficulty breathing at rest?', confidence: 0.98 },
    { speaker: 'patient', text: 'Some fever, yes. Breathing is okay when resting but bad when I walk.', confidence: 0.94 },
    { speaker: 'doctor', text: 'Okay. Let me listen to your chest. Please take a deep breath for me.', confidence: 0.99 },
];

const DEMO_SOAP: SOAPNote = {
    subjective: 'Patient presents with 3-day history of productive cough, chest tightness, and low-grade fever following cold weather exposure. Dyspnoea on exertion, relieved at rest.',
    objective: 'T 37.9°C, HR 88 bpm, SpO₂ 96% RA. Chest: decreased air entry bilateral bases, bilateral crackles. No wheeze.',
    assessment: 'Community-acquired pneumonia (CAP) — mild severity. CURB-65 score: 1.',
    plan: '1. Amoxicillin-Clavulanate 1g BD × 7 days\n2. Paracetamol 1g TDS PRN fever\n3. Chest X-ray to confirm\n4. Repeat SpO₂ in 24 h\n5. Return if SpO₂ <94% or worsening.',
    generatedAt: new Date().toISOString(),
    aiModel: 'AfyaAI Scribe (Claude claude-opus-4-20250805 + Whisper)',
    confidenceScore: 0.88,
};

/* ──────────────────────────────────────── hook */
export function useAfyaScribe({
    consultationId: _consultationId,
    onSegment,
    onSOAPGenerated,
}: UseAfyaScribeOptions): UseAfyaScribeReturn {
    const [status, setStatus] = useState<ScribeStatus>('idle');
    const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
    const [soap, setSOAP] = useState<SOAPNote | null>(null);
    const [isGeneratingSOAP, setIsGeneratingSOAP] = useState(false);

    const simulationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const segmentIndexRef = useRef(0);
    const simulateSegmentsRef = useRef<(() => void) | null>(null);

    /* Simulate streaming transcript segments in dev */
    const simulateSegments = useCallback(() => {
        const idx = segmentIndexRef.current;
        if (idx >= DEMO_SEGMENTS.length) return;

        const raw = DEMO_SEGMENTS[idx];
        const seg: TranscriptSegment = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            ...raw,
        };
        segmentIndexRef.current = idx + 1;

        setTranscript((prev) => [...prev, seg]);
        onSegment?.(seg);

        const next = DEMO_SEGMENTS[idx + 1];
        if (next) {
            const delay = 2000 + Math.random() * 2000;
            simulationTimerRef.current = setTimeout(() => simulateSegmentsRef.current?.(), delay);
        }
    }, [onSegment]);

    // Update ref when simulateSegments changes
    useEffect(() => {
        simulateSegmentsRef.current = simulateSegments;
    }, [simulateSegments]);

    const startRecording = useCallback(() => {
        if (status === 'recording') return;
        setStatus('connecting');
        /* In production: open WebSocket to wss://api.afyahero.co.ke/v1/ai/scribe/ws */
        setTimeout(() => {
            setStatus('recording');
            segmentIndexRef.current = 0;
            simulationTimerRef.current = setTimeout(() => simulateSegmentsRef.current?.(), 800);
        }, 600);
    }, [status]);

    const stopRecording = useCallback(() => {
        if (simulationTimerRef.current) {
            clearTimeout(simulationTimerRef.current);
            simulationTimerRef.current = null;
        }
        setStatus('idle');
    }, []);

    const generateSOAP = useCallback(() => {
        if (isGeneratingSOAP) return;
        setIsGeneratingSOAP(true);
        setStatus('processing');
        /* In production: POST /v1/ai/soap/generate with transcript context */
        setTimeout(() => {
            setSOAP(DEMO_SOAP);
            onSOAPGenerated?.(DEMO_SOAP);
            setIsGeneratingSOAP(false);
            setStatus('idle');
        }, 2800);
    }, [isGeneratingSOAP, onSOAPGenerated]);

    const clearTranscript = useCallback(() => {
        setTranscript([]);
        setSOAP(null);
        segmentIndexRef.current = 0;
    }, []);

    /* cleanup on unmount */
    useEffect(() => {
        return () => {
            if (simulationTimerRef.current) clearTimeout(simulationTimerRef.current);
        };
    }, []);

    return {
        status,
        transcript,
        soap,
        isGeneratingSOAP,
        startRecording,
        stopRecording,
        generateSOAP,
        clearTranscript,
    };
}
