'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, CheckCircle2, AlertTriangle, FileText, Clock, Volume2, Copy, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';

interface TranscriptionResult {
  text: string;
  confidence: number;
  duration: number;
  structuredData?: {
    chiefComplaint?: string;
    historyOfPresentIllness?: string;
    physicalExam?: string;
    assessment?: string;
    plan?: string;
  };
}

interface VoiceDocumentationPanelProps {
  onTranscriptionComplete?: (result: TranscriptionResult) => void;
  onStructuredDataExtracted?: (data: TranscriptionResult['structuredData']) => void;
  className?: string;
}

export default function VoiceDocumentationPanel({
  onTranscriptionComplete,
  onStructuredDataExtracted,
  className
}: VoiceDocumentationPanelProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [structuredData, setStructuredData] = useState<TranscriptionResult['structuredData']>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      setError('Microphone access denied or not available');
      logger.error('Error accessing microphone', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Stop all audio tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('language', 'en-US');

      const response = await fetch('/api/ai/speech-to-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to transcribe audio');
      }

      const data = await response.json();
      setTranscription(data.text);
      
      // Extract structured data
      const structured = await extractStructuredData(data.text);
      setStructuredData(structured);
      
      onTranscriptionComplete?.({
        text: data.text,
        confidence: data.confidence || 0.95,
        duration: recordingTime,
        structuredData: structured,
      });
      
      onStructuredDataExtracted?.(structured);
      
    } catch (err) {
      // Fallback to browser speech recognition
      await fallbackSpeechRecognition();
    } finally {
      setIsProcessing(false);
    }
  };

  const fallbackSpeechRecognition = async () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscription(finalTranscript);
          extractStructuredData(finalTranscript).then(setStructuredData);
        }
      };

      recognition.onerror = (event: any) => {
        setError(`Speech recognition error: ${event.error}`);
      };

      recognition.onend = () => {
        setIsProcessing(false);
      };

      recognition.start();
    } else {
      setError('Speech recognition not supported in this browser');
      setIsProcessing(false);
    }
  };

  const extractStructuredData = async (text: string): Promise<TranscriptionResult['structuredData']> => {
    try {
      const response = await fetch('/api/ai/extract-structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.structuredData;
      }
    } catch (err) {
      // Fallback to rule-based extraction
    }

    // Rule-based extraction fallback
    return ruleBasedExtraction(text);
  };

  const ruleBasedExtraction = (text: string): TranscriptionResult['structuredData'] => {
    const lowerText = text.toLowerCase();
    
    const chiefComplaintMatch = text.match(/(?:chief complaint|complaint|reason for visit|presenting with)[:\s]+([^.\n]+)/i);
    const historyMatch = text.match(/(?:history|hx|patient reports|reports)[:\s]+([^.\n]+)/i);
    const examMatch = text.match(/(?:exam|examination|physical exam|on examination)[:\s]+([^.\n]+)/i);
    const assessmentMatch = text.match(/(?:assessment|diagnosis|working diagnosis)[:\s]+([^.\n]+)/i);
    const planMatch = text.match(/(?:plan|management|treatment|recommend)[:\s]+([^.\n]+)/i);

    return {
      chiefComplaint: chiefComplaintMatch?.[1]?.trim(),
      historyOfPresentIllness: historyMatch?.[1]?.trim(),
      physicalExam: examMatch?.[1]?.trim(),
      assessment: assessmentMatch?.[1]?.trim(),
      plan: planMatch?.[1]?.trim(),
    };
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcription);
  };

  const downloadTranscript = () => {
    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('rounded-card border border-content-border bg-content-bg p-5 shadow-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-card bg-purple-500/10 text-purple-600">
            <Volume2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">Voice Documentation</h3>
            <p className="text-xs text-slate">AI-powered clinical transcription & structured data extraction</p>
          </div>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-mono text-rose-600">{formatTime(recordingTime)}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={cn(
            'flex items-center gap-2 px-6 py-3 rounded-card font-semibold text-sm transition-all',
            isRecording 
              ? 'bg-rose-500 hover:bg-rose-600 text-white' 
              : 'bg-purple-500 hover:bg-purple-600 text-white',
            isProcessing && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isRecording ? (
            <>
              <MicOff className="h-4 w-4" />
              Stop Recording
            </>
          ) : isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Start Recording
            </>
          )}
        </button>

        {transcription && (
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-4 py-3 rounded-card font-semibold text-sm border border-content-border bg-content-surface hover:bg-content-surface/80 transition-all"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
            <button
              onClick={downloadTranscript}
              className="flex items-center gap-2 px-4 py-3 rounded-card font-semibold text-sm border border-content-border bg-content-surface hover:bg-content-surface/80 transition-all"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          </div>
        )}
      </div>

      {/* Transcription Display */}
      {transcription && (
        <div className="space-y-4">
          <div className="rounded-card border border-content-border bg-content-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-slate" />
              <span className="text-sm font-semibold">Transcription</span>
            </div>
            <p className="text-sm leading-relaxed text-ink whitespace-pre-wrap">{transcription}</p>
          </div>

          {/* Structured Data */}
          {structuredData && (
            <div className="rounded-card border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold">Structured Clinical Data</span>
              </div>
              <div className="space-y-2">
                {structuredData.chiefComplaint && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-1">Chief Complaint</p>
                    <p className="text-sm">{structuredData.chiefComplaint}</p>
                  </div>
                )}
                {structuredData.historyOfPresentIllness && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-1">History of Present Illness</p>
                    <p className="text-sm">{structuredData.historyOfPresentIllness}</p>
                  </div>
                )}
                {structuredData.physicalExam && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-1">Physical Examination</p>
                    <p className="text-sm">{structuredData.physicalExam}</p>
                  </div>
                )}
                {structuredData.assessment && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-1">Assessment</p>
                    <p className="text-sm">{structuredData.assessment}</p>
                  </div>
                )}
                {structuredData.plan && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-1">Plan</p>
                    <p className="text-sm">{structuredData.plan}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!transcription && !isRecording && !isProcessing && (
        <div className="rounded-card border border-dashed border-content-border bg-content-surface p-8 text-center">
          <Mic className="h-12 w-12 mx-auto text-slate mb-3" />
          <p className="text-sm text-slate">Click &ldquo;Start Recording&rdquo; to begin voice documentation</p>
          <p className="text-xs text-slate mt-1">AI will transcribe and extract structured clinical data</p>
        </div>
      )}
    </div>
  );
}
