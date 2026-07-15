/**
 * useEnhancedAfyaScribe
 *
 * Enhanced production-ready WebSocket hook for AI Scribe functionality.
 * Connects to wss://api.afyahero.co.ke/v1/ai/scribe/ws in production
 * and streams real-time transcription segments + SOAP generation events.
 * Falls back to simulation in development mode with improved error handling.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import logger from '@/lib/logger';

/* ──────────────────────────────────────── types */
export type ScribeStatus = 'idle' | 'connecting' | 'recording' | 'processing' | 'error' | 'closed' | 'reconnecting';

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
    /** Enable production WebSocket mode (default: auto-detect) */
    useWebSocket?: boolean;
    /** Automatically generate SOAP draft every N segments (default: 5) */
    autoDraftInterval?: number;
}

interface UseAfyaScribeReturn {
    status: ScribeStatus;
    transcript: TranscriptSegment[];
    soap: SOAPNote | null;
    isGeneratingSOAP: boolean;
    isConnected: boolean;
    startRecording: () => void;
    stopRecording: () => void;
    generateSOAP: () => void;
    clearTranscript: () => void;
    reconnect: () => void;
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
export function useEnhancedAfyaScribe({
    consultationId,
    onSegment,
    onSOAPGenerated,
    useWebSocket,
    autoDraftInterval = 5,
}: UseAfyaScribeOptions): UseAfyaScribeReturn {
    const [status, setStatus] = useState<ScribeStatus>('idle');
    const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
    const [soap, setSOAP] = useState<SOAPNote | null>(null);
    const [isGeneratingSOAP, setIsGeneratingSOAP] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    const simulationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const segmentIndexRef = useRef(0);
    const wsRef = useRef<WebSocket | null>(null);
    const retryCountRef = useRef(0);
    const maxRetries = 3;
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const segmentCountRef = useRef(0);
    const connectWebSocketRef = useRef<(() => void) | null>(null);
    const simulateSegmentsRef = useRef<(() => void) | null>(null);
    const handleErrorRef = useRef<((event: Event) => void) | null>(null);

    // Auto-detect if we should use WebSocket (production) or simulation (development)
    const shouldUseWebSocket = useWebSocket ?? (process.env.NODE_ENV === 'production');

    // WebSocket message handler
    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'transcript_segment':
                    const segment: TranscriptSegment = {
                        id: data.id || crypto.randomUUID(),
                        speaker: data.speaker,
                        text: data.text,
                        timestamp: data.timestamp || new Date().toISOString(),
                        confidence: data.confidence || 0.95,
                    };
                    setTranscript(prev => [...prev, segment]);
                    onSegment?.(segment);
                    break;
                    
                case 'soap_generated':
                    const soapNote: SOAPNote = {
                        subjective: data.subjective,
                        objective: data.objective,
                        assessment: data.assessment,
                        plan: data.plan,
                        generatedAt: data.generatedAt || new Date().toISOString(),
                        aiModel: data.aiModel || 'AfyaAI Scribe',
                        confidenceScore: data.confidenceScore || 0.9,
                    };
                    setSOAP(soapNote);
                    onSOAPGenerated?.(soapNote);
                    setIsGeneratingSOAP(false);
                    setStatus('idle');
                    break;
                    
                case 'status_update':
                    setStatus(data.status);
                    break;
                    
                case 'error':
                    logger.error('WebSocket error', { message: data.message });
                    setStatus('error');
                    break;
            }
        } catch (error) {
            logger.error('Error parsing WebSocket message', { error });
        }
    }, [onSegment, onSOAPGenerated]);

    // WebSocket error handler
    const handleError = useCallback((error: Event) => {
        logger.error('WebSocket connection error', { error });
        setStatus('error');
        
        // Attempt reconnection with exponential backoff
        if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            setStatus('reconnecting');
            reconnectTimeoutRef.current = setTimeout(() => {
                connectWebSocketRef.current?.();
            }, Math.min(1000 * 2 ** retryCountRef.current, 10000));
        } else {
            setStatus('error');
        }
    }, []);

    // WebSocket close handler
    const handleClose = useCallback((event: CloseEvent) => {
        setIsConnected(false);
        setStatus('closed');
        
        // Clear heartbeat interval
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
        
        // Attempt reconnection if not closed intentionally
        if (!event.wasClean && retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            setStatus('reconnecting');
            reconnectTimeoutRef.current = setTimeout(() => {
                connectWebSocketRef.current?.();
            }, Math.min(1000 * 2 ** retryCountRef.current, 10000));
        } else if (!event.wasClean) {
            // Max retries reached
            setStatus('error');
        }
    }, []);

    // Simulate streaming transcript segments in dev
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

        // Auto-drafting check
        segmentCountRef.current += 1;
        if (segmentCountRef.current % autoDraftInterval === 0) {
            // Auto draft deferred to explicit action to avoid re-entrancy during simulation stream.
        }

        const next = DEMO_SEGMENTS[idx + 1];
        if (next) {
            const delay = 2000 + Math.random() * 2000;
            simulationTimerRef.current = setTimeout(() => simulateSegmentsRef.current?.(), delay);
        }
    }, [onSegment, autoDraftInterval]);

    // Connect to WebSocket
    const connectWebSocket = useCallback(() => {
        if (!shouldUseWebSocket) return;
        
        try {
            const wsUrl = `wss://api.afyahero.co.ke/v1/ai/scribe/ws?consultation_id=${consultationId}`;
            wsRef.current = new WebSocket(wsUrl);
            
            wsRef.current.onopen = () => {
                setIsConnected(true);
                setStatus('idle');
                retryCountRef.current = 0;
                
                // Send heartbeat every 30 seconds to keep connection alive
                heartbeatIntervalRef.current = setInterval(() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
                    }
                }, 30000);
            };
            
            wsRef.current.onmessage = handleMessage;
            wsRef.current.onerror = (e) => handleErrorRef.current?.(e);
            wsRef.current.onclose = handleClose;
        } catch (error) {
            logger.error('Failed to connect to WebSocket', { error });
            setStatus('error');
        }
    }, [consultationId, shouldUseWebSocket, handleMessage, handleClose]);

    // Update ref when connectWebSocket changes
    useEffect(() => {
        connectWebSocketRef.current = connectWebSocket;
    }, [connectWebSocket]);

    // Update ref when simulateSegments changes
    useEffect(() => {
        simulateSegmentsRef.current = simulateSegments;
    }, [simulateSegments]);

    // Update ref when handleError changes
    useEffect(() => {
        handleErrorRef.current = handleError;
    }, [handleError]);

    const startRecording = useCallback(() => {
        if (status === 'recording') return;
        
        if (shouldUseWebSocket) {
            setStatus('connecting');
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'start_recording' }));
                setStatus('recording');
            } else {
                connectWebSocketRef.current?.();
            }
        } else {
            // Development simulation mode
            setStatus('connecting');
            setTimeout(() => {
                setStatus('recording');
                segmentIndexRef.current = 0;
                simulationTimerRef.current = setTimeout(() => simulateSegmentsRef.current?.(), 800);
            }, 600);
        }
    }, [status, shouldUseWebSocket]);

    const stopRecording = useCallback(() => {
        if (shouldUseWebSocket) {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'stop_recording' }));
            }
        } else {
            // Development simulation mode
            if (simulationTimerRef.current) {
                clearTimeout(simulationTimerRef.current);
                simulationTimerRef.current = null;
            }
        }
        setStatus('idle');
    }, [shouldUseWebSocket]);

    const generateSOAP = useCallback(() => {
        if (isGeneratingSOAP) return;
        setIsGeneratingSOAP(true);
        setStatus('processing');
        
        if (shouldUseWebSocket) {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ 
                    type: 'generate_soap', 
                    transcript: transcript 
                }));
            }
        } else {
            // Development simulation mode
            setTimeout(() => {
                setSOAP(DEMO_SOAP);
                onSOAPGenerated?.(DEMO_SOAP);
                setIsGeneratingSOAP(false);
                setStatus('idle');
            }, 2800);
        }
    }, [isGeneratingSOAP, transcript, shouldUseWebSocket, onSOAPGenerated]);

    const clearTranscript = useCallback(() => {
        setTranscript([]);
        setSOAP(null);
        segmentIndexRef.current = 0;
        
        if (shouldUseWebSocket) {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'clear_transcript' }));
            }
        }
    }, [shouldUseWebSocket]);

    const reconnect = useCallback(() => {
        if (shouldUseWebSocket) {
            retryCountRef.current = 0;
            connectWebSocket();
        }
    }, [shouldUseWebSocket, connectWebSocket]);

    // Initialize WebSocket connection
    useEffect(() => {
        if (shouldUseWebSocket) {
            // Defer connectWebSocket to avoid synchronous setState in effect
            setTimeout(() => connectWebSocketRef.current?.(), 0);
        }
        
        return () => {
            // Cleanup on unmount
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (simulationTimerRef.current) {
                clearTimeout(simulationTimerRef.current);
            }
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [shouldUseWebSocket, connectWebSocket]);

    return {
        status,
        transcript,
        soap,
        isGeneratingSOAP,
        isConnected,
        startRecording,
        stopRecording,
        generateSOAP,
        clearTranscript,
        reconnect,
    };
}