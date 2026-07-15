'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import logger from '@/lib/logger';
import {
    Video,
    Phone,
    MessageSquare,
    ExternalLink,
    Copy,
    CheckCircle2,
    Loader2,
    Sparkles,
    BrainCircuit,
    Mic,
    Clock,
    AlertTriangle,
    ShieldCheck,
    ChevronRight,
    UserCheck,
} from 'lucide-react';
import AIScribeAssistant from './AIScribeAssistant';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PatientDetailPanel, type PatientDetail } from '@/components/portal/PatientDetailPanel';

interface TeleconsultationProps {
    roomId: string;
    _isDoctor?: boolean;
    patientName?: string;
    patientContext?: string;
    onAnalysisSync?: (analysis: any) => void;
}

type CallMode = 'video' | 'voice' | 'text' | 'physical';
type ConnectionStatus = 'idle' | 'creating' | 'ready' | 'failed';

interface TranscriptEntry {
    id: string;
    text: string;
    timestamp: Date;
    confidence: number;
    provider: string;
}



export default function Teleconsultation({ roomId, _isDoctor, patientName, patientContext, onAnalysisSync }: TeleconsultationProps) {
    const [activeCallMode, setActiveCallMode] = useState<CallMode>('video');
    const [isCallActive, setIsCallActive] = useState(false);
    const [meetCode, setMeetCode] = useState<string | null>(null);
    const [meetUrl, setMeetUrl] = useState<string | null>(null);
    const [meetProvider, setMeetProvider] = useState<string>('');
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
    const [copied, setCopied] = useState(false);
    const [callStartedAt, setCallStartedAt] = useState<Date | null>(null);

    const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<any | null>(null);
    const [analysisProvider, setAnalysisProvider] = useState('');
    
    const [panelOpen, setPanelOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null);
    const lastDraftTranscriptLengthRef = useRef(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const elapsedMinutes = callStartedAt ? Math.floor((Date.now() - callStartedAt.getTime()) / 60000) : 0;

    const createMeeting = useCallback(async () => {
        setConnectionStatus('creating');
        try {
            const res = await fetch('/api/teleconsultation/meetings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientName: patientName ?? 'Patient',
                    appointmentId: roomId,
                    description: 'Teleconsultation session',
                }),
            });

            if (!res.ok) {
                setConnectionStatus('failed');
                return;
            }

            const data = await res.json();
            setMeetCode(data.meetingCode);
            setMeetUrl(data.meetUrl);
            setMeetProvider(data.provider || 'google-workspace');
            setConnectionStatus('ready');
            setIsCallActive(true);
            setCallStartedAt(new Date());
            logger.info('Consultation bridge established', { provider: data.provider, appointmentId: data.appointmentId });
        } catch {
            setConnectionStatus('failed');
        }
    }, [patientName, roomId]);

    const startCall = useCallback(async () => {
        if (activeCallMode === 'physical') {
            setConnectionStatus('ready');
            setIsCallActive(true);
            return;
        }
        await createMeeting();
    }, [createMeeting, activeCallMode]);

    const openMeetInNewTab = useCallback(() => {
        if (meetUrl) {
            window.open(meetUrl, '_blank');
        }
    }, [meetUrl]);

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
        });
    };

    const transcribeAudio = useCallback(async (audioBase64: string, encoding: string) => {
        try {
            const res = await fetch('/api/teleconsultation/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio: audioBase64, encoding: encoding === 'WEBM_OPUS' ? 'webm_opus' : 'pcm16' }),
            });
            const data = await res.json();
            if (data.transcript) {
                setLiveTranscript(prev => prev + ' ' + data.transcript);
                setTranscripts(prev => [...prev, {
                    id: `tr-${Date.now()}`,
                    text: data.transcript,
                    timestamp: new Date(),
                    confidence: data.confidence ?? 0,
                    provider: data.provider,
                }]);
            }
        } catch { /* ignore transcription errors during call */ }
    }, []);

    const startBrowserSpeechRecognition = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new (SpeechRecognition)();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) final += t;
                else interim += t;
            }
            setLiveTranscript(prev => prev + ' ' + interim);
            if (final) {
                setTranscripts(prev => [...prev, {
                    id: `tr-${Date.now()}`,
                    text: final,
                    timestamp: new Date(),
                    confidence: event.results[event.results.length - 1][0].confidence,
                    provider: 'browser-speech',
                }]);
            }
        };

        recognition.start();
        setIsTranscribing(true);
    }, []);

    const startAudioCapture = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;

            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];

                if (blob.size > 1000) {
                    const base64 = await blobToBase64(blob);
                    void transcribeAudio(base64, 'WEBM_OPUS');
                }

                if (isCallActive && mediaRecorderRef.current?.state === 'inactive') {
                    // Check if the stream is still active before restarting
                    if (audioStreamRef.current && audioStreamRef.current.active) {
                        try {
                            mediaRecorderRef.current.start(5000);
                        } catch {
                            // If restart fails, restart the entire audio capture process
                            void startAudioCapture();
                        }
                    } else {
                        // Stream is inactive, restart the entire audio capture process
                        void startAudioCapture();
                    }
                }
            };

            recorder.start(5000);
            setIsTranscribing(true);
        } catch {
            startBrowserSpeechRecognition();
        }
    }, [isCallActive, startBrowserSpeechRecognition, transcribeAudio]);

    const stopAudioCapture = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(t => t.stop());
        }
        setIsTranscribing(false);
    }, []);

    const handleAnalyze = useCallback(async () => {
        const fullTranscript = transcripts.map(t => t.text).join(' ') + ' ' + liveTranscript;
        if (!fullTranscript.trim()) return;

        setIsAnalyzing(true);
        // Don't clear local analysis if we're just updating the draft
        // setAnalysis(null);

        try {
            const res = await fetch('/api/teleconsultation/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: fullTranscript.trim(),
                    patientContext: patientContext ?? '',
                }),
            });
            const data = await res.json();
            if (data.analysis) {
                setAnalysis(data.analysis);
                setAnalysisProvider(data.provider);
                
                // If there's a SOAP draft, bubble it up to the parent immediately
                if (data.analysis.soapDraft && onAnalysisSync) {
                    onAnalysisSync(data.analysis);
                }
            }
        } catch { /* ignore */ } finally {
            setIsAnalyzing(false);
            lastDraftTranscriptLengthRef.current = fullTranscript.length;
        }
    }, [transcripts, liveTranscript, patientContext, onAnalysisSync]);

    // Auto-analysis logic: trigger search for clinical insights every 500 characters of new speech
    useEffect(() => {
        const currentLength = transcripts.reduce((acc, t) => acc + t.text.length, 0) + liveTranscript.length;
        const diff = currentLength - lastDraftTranscriptLengthRef.current;
        
        if (diff > 500 && !isAnalyzing && isCallActive) {
            handleAnalyze();
        }
    }, [transcripts, liveTranscript, isAnalyzing, isCallActive, handleAnalyze]);
    const handleEndCall = useCallback(async () => {
        setIsCallActive(false);
        stopAudioCapture();
        
        // Generate final post-call summary
        const fullTranscript = transcripts.map(t => t.text).join('\n') + '\n' + liveTranscript;
        if (fullTranscript.trim().length > 50) {
            try {
                setIsAnalyzing(true);
                const res = await fetch('/api/teleconsultation/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transcript: fullTranscript,
                        patientContext: patientContext ?? '',
                    }),
                });
                const data = await res.json();
                if (data.analysis) {
                    setAnalysis(data.analysis);
                    setAnalysisProvider(data.provider || 'vertex-ai');
                    // Sync with parent component
                    if (onAnalysisSync) {
                        onAnalysisSync(data.analysis);
                    }
                }
            } catch (err) {
                logger.error('Failed to generate post-call summary', { error: err instanceof Error ? err.message : String(err) });
            } finally {
                setIsAnalyzing(false);
            }
        }
        
        setLiveTranscript('');
    }, [stopAudioCapture, transcripts, liveTranscript, patientContext, onAnalysisSync]);

    const handleViewPatientDetails = useCallback(() => {
        const detailed: PatientDetail = {
            id: roomId,
            name: patientName ?? 'Patient',
            patient_id: roomId,
            age: 0,
            gender: '',
            phone: '',
            national_id: '',
            blood_type: '',
            insurance: '',
            SHIF_no: '',
            emergency_contact: '',
            emergency_phone: '',
            allergies: [],
            medications: [],
            recent_records: [],
            conditions: [],
            vitals: { bp: '', pulse: 0, spo2: 0, temp: '', rr: 0, weight: '' },
        };
        setSelectedPatient(detailed);
        setPanelOpen(true);
    }, [roomId, patientName]);

    useEffect(() => {
        if (isCallActive && connectionStatus === 'ready') {
            setCallStartedAt(new Date());
            if (activeCallMode !== 'text') {
                void startAudioCapture();
            }
        }
        return () => {
            if (!isCallActive) stopAudioCapture();
        };
    }, [isCallActive, connectionStatus, activeCallMode, startAudioCapture, stopAudioCapture]);

    const copyMeetLink = useCallback(() => {
        if (meetUrl) {
            void navigator.clipboard.writeText(meetUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        }
    }, [meetUrl]);

    if (!isCallActive) {
        return (
            <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative h-full flex flex-col justify-center items-center bg-content-surface p-8 overflow-hidden rounded-[2.5rem] border border-content-border shadow-2xl"
            >
                {/* Background Aesthetics */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/30 blur-[120px] rounded-full" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-100/30 blur-[120px] rounded-full" />
                </div>

                <div className="relative z-10 flex flex-col items-center max-w-xl text-center">
                    <motion.div 
                        whileHover={{ scale: 1.05, rotate: 5 }}
                        className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/20"
                    >
                        <Video className="w-12 h-12 text-white" />
                    </motion.div>
                    
                    <h1 className="text-4xl font-serif italic text-ink mb-4 tracking-tight uppercase">Consultation Studio</h1>
                    <p className="text-slate-600 text-lg mb-12 font-medium leading-relaxed">
                        Secure, AI-assisted clinical encounters. Powered by MedGemma for automated SOAP and real-time insight surfacing.
                    </p>

                    <div className="flex gap-4 mb-12">
                        <ModeButton active={activeCallMode === 'video'} onClick={() => setActiveCallMode('video')} label="Video" icon={Video} />
                        <ModeButton active={activeCallMode === 'voice'} onClick={() => setActiveCallMode('voice')} label="Voice" icon={Phone} />
                        <ModeButton active={activeCallMode === 'text'} onClick={() => setActiveCallMode('text')} label="Text" icon={MessageSquare} />
                        <ModeButton active={activeCallMode === 'physical'} onClick={() => setActiveCallMode('physical')} label="Physical" icon={UserCheck} />
                    </div>

                    <AnimatePresence mode="wait">
                        {connectionStatus === 'creating' ? (
                            <motion.button 
                                key="creating"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                disabled 
                                className="px-12 py-5 bg-content-bg border border-content-border rounded-full flex items-center gap-3 shadow-lg"
                            >
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                <span className="text-slate-600 font-bold uppercase tracking-widest text-xs">Connecting...</span>
                            </motion.button>
                        ) : (
                            <motion.button
                                key="idle"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={startCall}
                                className={cn(
                                    "px-12 py-5 rounded-full flex items-center gap-3 shadow-2xl transition-all group",
                                    activeCallMode === 'physical' 
                                        ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 shadow-emerald-500/30" 
                                        : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-500 shadow-blue-500/30"
                                )}
                            >
                                {activeCallMode === 'physical' ? (
                                    <UserCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                ) : (
                                    <Video className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                )}
                                <span className="font-black uppercase tracking-[0.2em] text-xs text-white">
                                    {activeCallMode === 'physical' ? 'Start Physical Encounter' : 'Initialize Virtual Encounter'}
                                </span>
                                <ChevronRight className="w-4 h-4 opacity-50 text-white" />
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {connectionStatus === 'failed' && (
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }}
                            className="mt-6 flex items-center gap-2 text-rose-600 text-xs font-bold uppercase tracking-wider"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            Connection failed. Retry?
                        </motion.div>
                    )}
                </div>

                {/* Secure Badge */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-card bg-content-bg border border-content-border shadow-xl backdrop-blur-xl">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Secure Connection Active</span>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="relative h-full flex bg-slate-100 overflow-hidden rounded-[2.5rem] border border-content-border shadow-inner">
            {/* Primary Encounter Pane */}
            <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-content-bg border border-content-border rounded-card flex items-center justify-center shadow-lg">
                            <Video className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <button 
                                onClick={handleViewPatientDetails}
                                className="text-xl font-serif italic text-ink hover:text-blue-500 transition-colors text-left"
                            >
                                {patientName ?? 'Standard Consultation'}
                            </button>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn("w-2 h-2 rounded-full animate-pulse", activeCallMode === 'physical' ? 'bg-blue-500' : 'bg-emerald-500')} />
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none">
                                    {activeCallMode === 'physical' ? 'In-Person Session Active' : `${activeCallMode} Link Established`}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-content-bg rounded-card border border-content-border shadow-card">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-mono text-ink tracking-widest leading-none font-bold">{elapsedMinutes}m Standard Session</span>
                    </div>
                </div>

                {/* The "Virtual Room" Frame */}
                <div className="flex-1 relative bg-content-bg rounded-[2.5rem] border border-content-border overflow-hidden group shadow-2xl">
                    {activeCallMode === 'text' ? (
                        /* Text/SMS Messaging Interface */
                        <div className="absolute inset-0 flex flex-col bg-content-surface">
                            {/* Chat Header */}
                            <div className="bg-content-bg border-b border-content-border px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                        <MessageSquare className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-ink">SMS Consultation</h3>
                                        <p className="text-xs text-slate-500">{patientName ?? 'Patient'}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleEndCall}
                                    className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
                                >
                                    End Chat
                                </button>
                            </div>

                            {/* Chat Messages Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <div className="flex justify-start">
                                    <div className="bg-content-bg border border-content-border rounded-card rounded-tl-sm px-4 py-3 max-w-md shadow-card">
                                        <p className="text-sm text-slate-700">Hello, I&apos;m ready for our consultation. How can I help you today?</p>
                                        <span className="text-xs text-slate-400 mt-1 block">10:30 AM</span>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <div className="bg-blue-500 rounded-card rounded-tr-sm px-4 py-3 max-w-md shadow-card">
                                        <p className="text-sm text-white">I&apos;ve been having headaches for the past week.</p>
                                        <span className="text-xs text-blue-100 mt-1 block">10:31 AM</span>
                                    </div>
                                </div>
                                <div className="flex justify-start">
                                    <div className="bg-content-bg border border-content-border rounded-card rounded-tl-sm px-4 py-3 max-w-md shadow-card">
                                        <p className="text-sm text-slate-700">I understand. Can you describe the pain? Is it constant or does it come and go?</p>
                                        <span className="text-xs text-slate-400 mt-1 block">10:32 AM</span>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <div className="bg-blue-500 rounded-card rounded-tr-sm px-4 py-3 max-w-md shadow-card">
                                        <p className="text-sm text-white">It&apos;s mostly in the morning, around my temples. Sometimes it feels like a tight band.</p>
                                        <span className="text-xs text-blue-100 mt-1 block">10:33 AM</span>
                                    </div>
                                </div>
                            </div>

                            {/* Message Input Area */}
                            <div className="bg-content-bg border-t border-content-border p-4">
                                <div className="flex gap-3">
                                    <input 
                                        type="text" 
                                        placeholder="Type your message..." 
                                        className="flex-1 px-4 py-3 bg-content-surface border border-content-border rounded-card text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
                                    />
                                    <button className="px-6 py-3 bg-blue-500 text-white rounded-card hover:bg-blue-600 transition-all text-xs font-bold uppercase tracking-wider">
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Video/Voice/Physical Interface */
                        <>
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-cyan-50 pointer-events-none" />
                            
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center space-y-8">
                                <div className="relative">
                                    <motion.div 
                                        animate={{ scale: [1, 1.05, 1] }}
                                        transition={{ repeat: Infinity, duration: 4 }}
                                        className={cn(
                                            "w-32 h-32 rounded-full flex items-center justify-center border",
                                            activeCallMode === 'physical' ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"
                                        )}
                                    >
                                        {activeCallMode === 'physical' ? (
                                            <Mic className="w-12 h-12 text-emerald-500" />
                                        ) : (
                                            <Video className="w-12 h-12 text-blue-500" />
                                        )}
                                    </motion.div>
                                    <div className="absolute -top-2 -right-2 px-3 py-1 bg-emerald-500 rounded-full text-[10px] font-black text-white uppercase tracking-tighter">Live</div>
                                </div>

                                <div className="max-w-sm">
                                    <h3 className="text-2xl font-serif italic text-ink mb-3">
                                        {activeCallMode === 'physical' ? 'Ambient Listening Active' : 'Video Call Ready'}
                                    </h3>
                                    <p className="text-sm text-slate-600 leading-relaxed font-semibold uppercase tracking-tight opacity-70">
                                        {activeCallMode === 'physical' 
                                            ? 'AfyaScribe is capturing and analyzing the consultation in real-time. Keep the device near.' 
                                            : 'Your secure connection is active. Click below to launch the clinical video stream.'}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4 w-full max-w-xs">
                                    {activeCallMode !== 'physical' ? (
                                        <>
                                            <motion.button 
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={openMeetInNewTab}
                                                className="w-full py-4 bg-blue-500 text-white rounded-card font-bold text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-600 transition-all"
                                            >
                                                Launch Video Stream
                                            </motion.button>
                                            
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={copyMeetLink}
                                                    className="flex-1 py-3 bg-content-bg border border-content-border text-slate-600 rounded-card text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-blue-300 transition-all font-mono shadow-card"
                                                >
                                                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-blue-500" />}
                                                    {copied ? 'Link Copied' : 'Invite Patient'}
                                                </button>
                                                <button 
                                                    onClick={handleEndCall}
                                                    className="px-6 py-3 bg-rose-50 border border-rose-200 text-rose-500 rounded-card hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                                                >
                                                    <Phone className="w-4 h-4 rotate-[135deg]" />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={handleEndCall}
                                            className="w-full py-4 bg-rose-500 text-white rounded-card font-bold text-xs uppercase tracking-[0.2em] shadow-xl shadow-rose-500/20 hover:bg-rose-600 transition-all"
                                        >
                                            End Physical Encounter
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Live Transcript Overlay */}
                            <AnimatePresence>
                                {liveTranscript && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 40 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 40 }}
                                        className="absolute bottom-6 left-6 right-6 p-6 bg-content-bg/90 border border-content-border backdrop-blur-2xl rounded-card shadow-xl"
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] leading-none">Ambient Clinical Scribe Active</span>
                                        </div>
                                        <p className="text-sm text-ink leading-relaxed italic font-serif font-bold line-clamp-2 uppercase">
                                            &ldquo;...{liveTranscript.slice(-140)}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    )}
                </div>
            </div>

            {/* AI Clinical Sidebar (Integrated) */}
            <div className="w-[440px] bg-content-bg border-l border-content-border flex flex-col p-8 space-y-8 overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 blur-3xl -mr-16 -mt-16" />
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                            <Sparkles className="w-4 h-4 text-blue-500" />
                        </div>
                        <h4 className="text-[11px] font-black text-ink uppercase tracking-[0.2em] leading-none">Clinical Insight Engine</h4>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <AIScribeAssistant 
                        isEmbedded={true}
                        transcript={transcripts.map(t => t.text).join('\n') + '\n' + liveTranscript}
                        onAnalyze={handleAnalyze}
                    />
                </div>
            </div>

            <PatientDetailPanel 
                patient={selectedPatient}
                open={panelOpen}
                onClose={() => setPanelOpen(false)}
            />
        </div>
    );
}

function ModeButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: any }) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "group flex flex-col items-center gap-3 p-4 rounded-3xl transition-all duration-300 min-w-[100px]",
                active 
                    ? "bg-blue-50 border-blue-200 shadow-xl" 
                    : "bg-transparent border-transparent opacity-40 hover:opacity-60"
            )}
        >
            <div className={cn(
                "w-12 h-12 rounded-card flex items-center justify-center transition-all duration-500 shadow-card",
                active ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-content-bg text-slate-400 border border-content-border group-hover:border-blue-300"
            )}>
                <Icon className={cn("w-6 h-6", active ? "text-white" : "text-slate-400")} />
            </div>
            <span className={cn("text-[10px] font-black uppercase tracking-[0.3em] leading-none transition-colors", active ? "text-ink" : "text-slate-400")}>
                {label}
            </span>
        </button>
    );
}


