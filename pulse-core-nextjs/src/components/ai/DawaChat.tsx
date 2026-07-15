'use client';

/**
 * DawaChat — shared DAWA AI chat interface.
 *
 * Used across all 5 DAWA portal pages. Handles:
 *   - Query submission to POST /api/ai/dawa
 *   - Conversation history (client-side only, session-scoped)
 *   - Disclaimer banner (D1 decision — dismissible, sessionStorage-persisted)
 *   - Provider badge on each AI response
 *   - Optional patient context pin
 *   - Voice input support
 *   - File attachment support
 *
 * Props:
 *   portal      — which portal this instance is in ('medical' | 'pharmacy' | 'lab' | 'admin' | 'reception')
 *   personaId?  — preset persona to request
 *   title       — page heading text
 *   placeholder — input placeholder text
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Paperclip, Image as ImageIcon, File, X, AlertCircle, Send, Mic, Sparkles, User, Bot, Clock, ChevronDown, PanelLeft, Copy, RefreshCw, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DAWAPersonaId } from '@/lib/dawa-personas';
import VoiceTextInput from '@/components/shared/VoiceTextInput';
import { DawaChatSidebar } from './DawaChatSidebar';
import { cn } from '@/lib/utils';
import DrugInteractionChecker from '@/components/medical/DrugInteractionChecker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileAttachment {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  preview?: string;
  base64?: string;
}

interface DawaTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  personaId?: DAWAPersonaId;
  sessionId?: string;
  citations?: DawaCitation[];
  attachments?: FileAttachment[];
  provider?: string;
  model?: string;
}

interface DawaCitation {
  id: string;
  title: string;
  source: string;
  url?: string;
  excerpt?: string;
  confidence?: number;
}

interface DawaApiResponse {
  answer: string;
  persona: DAWAPersonaId;
  sessionId?: string;
  citations?: DawaCitation[];
  error?: string;
  provider?: string;
  model?: string;
}

interface DawaChatProps {
  portal: string;
  personaId?: DAWAPersonaId;
  title: string;
  placeholder?: string;
  showPatientPin?: boolean;
  allowVoice?: boolean;
  allowFileUpload?: boolean;
  maxFileSizeMB?: number;
}

interface Conversation {
  id: string;
  title: string;
  turns: DawaTurn[];
  timestamp: string;
  personaId?: DAWAPersonaId;
}

const DISCLAIMER_STORAGE_KEY = 'afya-dawa-disclaimer-dismissed';
const HISTORY_STORAGE_KEY = 'afya-dawa-conversation-history';
const MAX_CHARS = 2000;
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'];

// ─── Component ────────────────────────────────────────────────────────────────

export function DawaChat({
  portal,
  personaId,
  title,
  placeholder = 'Type your query...',
  showPatientPin = false,
  allowVoice = true,
  allowFileUpload = true,
  maxFileSizeMB = MAX_FILE_SIZE_MB,
}: DawaChatProps) {
  const [history, setHistory] = useState<DawaTurn[]>([]);
  const [query, setQuery] = useState('');
  const [patientId, setPatientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClinicalWarning, setShowClinicalWarning] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ChatGPT-like features state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<DAWAPersonaId>(personaId || 'DAWA-Clinical');
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);
  const [showDrugChecker, setShowDrugChecker] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  // Generate query suggestions based on portal and persona
  const generateSuggestions = useCallback(() => {
    const portalSuggestions: Record<string, string[]> = {
      medical: [
        'What are the common symptoms of malaria?',
        'How do I manage a patient with hypertension?',
        'What medications are contraindicated for pregnant patients?',
        'What are the standard protocols for sepsis?',
      ],
      pharmacy: [
        'What are the common drug interactions for antibiotics?',
        'How do I calculate pediatric dosages?',
        'What medications require special storage?',
        'What are the common side effects of antihypertensives?',
      ],
      lab: [
        'What are the normal ranges for CBC?',
        'How do I interpret liver function tests?',
        'What are the quality control requirements for chemistry analyzers?',
        'What are the common causes of hemolysis in blood samples?',
      ],
      admin: [
        'How do I optimize bed occupancy rates?',
        'What are the key metrics for hospital quality?',
        'How do I manage staff scheduling?',
        'What are the compliance requirements for patient data?',
      ],
      reception: [
        'How do I handle patient registration?',
        'What are the insurance verification steps?',
        'How do I manage patient queues?',
        'What information do I need for new patient intake?',
      ],
    };

    const personaSuggestions: Record<string, string[]> = {
      'DAWA-Clinical': [
        'What are the differential diagnoses for fever?',
        'How do I manage acute respiratory distress?',
        'What are the warning signs for sepsis?',
      ],
      'DAWA-Pharmacy': [
        'What are the drug interactions for warfarin?',
        'How do I manage polypharmacy in elderly patients?',
        'What are the storage requirements for insulin?',
      ],
      'DAWA-Lab': [
        'What are the reference ranges for electrolytes?',
        'How do I troubleshoot analyzer errors?',
        'What are the pre-analytical variables affecting test results?',
      ],
      'DAWA-Admin': [
        'How do I track hospital-acquired infections?',
        'What are the key performance indicators for hospitals?',
        'How do I manage supply chain disruptions?',
      ],
      'DAWA-Reception': [
        'How do I prioritize patient triage?',
        'What are the required documents for insurance claims?',
        'How do I handle patient complaints?',
      ],
    };

    const baseSuggestions = portalSuggestions[portal] || portalSuggestions.medical;
    const personaSpecific = personaSuggestions[selectedPersona] || [];

    // Combine and deduplicate
    const allSuggestions = [...new Set([...baseSuggestions, ...personaSpecific])];
    setSuggestions(allSuggestions.slice(0, 6));
  }, [portal, selectedPersona]);

  // Show suggestions when input is focused and empty
  useEffect(() => {
    if (!query && !loading) {
      generateSuggestions();
    } else {
      setShowSuggestions(false);
    }
  }, [query, loading, generateSuggestions]);

  // Load conversation history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        setConversations(JSON.parse(saved));
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Save conversation history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // Ignore errors
    }
  }, [conversations]);

  // Process uploaded files
  const processFiles = useCallback(async (files: File[]) => {
    setUploadError(null);
    const maxSizeBytes = maxFileSizeMB * 1024 * 1024;
    const newAttachments: FileAttachment[] = [];

    for (const file of files) {
      if (file.size > maxSizeBytes) {
        setUploadError(`${file.name} is too large (max ${maxFileSizeMB}MB)`);
        continue;
      }

      if (!ALLOWED_FILE_TYPES.includes(file.type) && !ALLOWED_FILE_TYPES.includes('*')) {
        setUploadError(`${file.name} is not a supported file type`);
        continue;
      }

      const attachment: FileAttachment = {
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        type: file.type,
        size: file.size,
      };

      if (file.type.startsWith('image/')) {
        try {
          const preview = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
          attachment.preview = preview;
          attachment.base64 = preview.split(',')[1];
        } catch {
          // No preview
        }
      }

      newAttachments.push(attachment);
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  }, [maxFileSizeMB]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  }, [processFiles]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const checkForClinicalContext = (text: string) => {
    const clinicalKeywords = [
      'diagnose', 'diagnosis', 'treatment', 'medication', 'medicine',
      'prescription', 'prescribe', 'dose', 'dosage', 'pain', 'sore',
      'fever', 'cough', 'ill', 'sick', 'symptoms', 'cure'
    ];
    const trigger = clinicalKeywords.some(keyword => text.toLowerCase().includes(keyword));
    setShowClinicalWarning(trigger);
  };

  const handleVoiceSubmit = async (text: string) => {
    setQuery(text);
    // Small delay to ensure state update before submit
    setTimeout(() => handleSubmit(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearHistory = () => setHistory([]);
  const remaining = MAX_CHARS - query.length;

  // ChatGPT-like helper functions
  const startNewChat = useCallback(() => {
    const newId = crypto.randomUUID();
    const newConversation: Conversation = {
      id: newId,
      title: 'New Chat',
      turns: [],
      timestamp: new Date().toISOString(),
      personaId: selectedPersona,
    };
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newId);
    setHistory([]);
    setQuery('');
  }, [selectedPersona]);

  const loadConversation = useCallback((conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setCurrentConversationId(conversationId);
      setHistory(conversation.turns);
      if (conversation.personaId) {
        setSelectedPersona(conversation.personaId);
      }
    }
  }, [conversations]);

  const deleteConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    if (currentConversationId === conversationId) {
      startNewChat();
    }
  }, [currentConversationId, startNewChat]);

  const saveCurrentConversation = useCallback(() => {
    if (currentConversationId && history.length > 0) {
      setConversations(prev => prev.map(c => {
        if (c.id === currentConversationId) {
          const firstUserMessage = history.find(t => t.role === 'user');
          const title = firstUserMessage?.content.slice(0, 50) || 'New Chat';
          return {
            ...c,
            title,
            turns: history,
            timestamp: new Date().toISOString(),
          };
        }
        return c;
      }));
    }
  }, [currentConversationId, history]);

  // Auto-save conversation when history changes
  useEffect(() => {
    if (history.length > 0) {
      saveCurrentConversation();
    }
  }, [history, saveCurrentConversation]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }, []);

  const regenerateResponse = useCallback(async () => {
    if (history.length === 0 || loading) return;
    
    const lastUserTurn = [...history].reverse().find(t => t.role === 'user');
    if (!lastUserTurn) return;

    const lastTurn = history[history.length - 1];
    if (lastTurn.role === 'assistant') {
      setHistory(h => h.slice(0, -1));
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/dawa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: lastUserTurn.content,
          personaId: selectedPersona,
          patientId: patientId.trim() || undefined,
        }),
      });

      const data: DawaApiResponse = await res.json();

      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }

      const assistantTurn: DawaTurn = {
        role: 'assistant',
        content: data.answer,
        timestamp: new Date().toISOString(),
        personaId: data.persona,
        sessionId: data.sessionId,
        citations: data.citations,
        provider: data.provider,
        model: data.model,
      };

      setHistory(h => [...h, assistantTurn]);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }, [history, loading, selectedPersona, patientId]);

  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim();
    if ((!trimmed && attachments.length === 0) || loading) return;

    checkForClinicalContext(trimmed);

    const userTurn: DawaTurn = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    setHistory((h) => [...h, userTurn]);
    setQuery('');
    setError(null);
    setLoading(true);

    // Store attachments and clear
    const currentAttachments = [...attachments];
    setAttachments([]);
    setUploadError(null);

    // Build conversation context (last 5 turns for context)
    const contextHistory = history.slice(-5);

    try {
      // Use multipart if we have files
      if (currentAttachments.length > 0) {
        const formData = new FormData();
        formData.append('query', trimmed);
        if (personaId) formData.append('personaId', personaId);
        if (patientId.trim()) formData.append('patientId', patientId.trim());
        formData.append('context', JSON.stringify(contextHistory));

        for (const attachment of currentAttachments) {
          formData.append('files', attachment.file);
        }

        const res = await fetch('/api/ai/dawa', {
          method: 'POST',
          body: formData,
        });

        const data: DawaApiResponse = await res.json();

        if (!res.ok) {
          setError(data.error ?? `Request failed (${res.status})`);
          setHistory((h) => h.slice(0, -1));
          return;
        }

        const assistantTurn: DawaTurn = {
          role: 'assistant',
          content: data.answer,
          timestamp: new Date().toISOString(),
          personaId: data.persona,
          sessionId: data.sessionId,
          citations: data.citations,
          provider: data.provider,
          model: data.model,
        };

        setHistory((h) => [...h, assistantTurn]);
      } else {
        const res = await fetch('/api/ai/dawa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: trimmed,
            personaId: personaId ?? undefined,
            patientId: patientId.trim() || undefined,
            context: contextHistory,
          }),
        });

        const data: DawaApiResponse = await res.json();

        if (!res.ok) {
          setError(data.error ?? `Request failed (${res.status})`);
          setHistory((h) => h.slice(0, -1));
          return;
        }

        const assistantTurn: DawaTurn = {
          role: 'assistant',
          content: data.answer,
          timestamp: new Date().toISOString(),
          personaId: data.persona,
          sessionId: data.sessionId,
          citations: data.citations,
          provider: data.provider,
          model: data.model,
        };

        setHistory((h) => [...h, assistantTurn]);
      }
    } catch {
      setError('Network error — please try again.');
      setHistory((h) => h.slice(0, -1));
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [query, patientId, personaId, loading, attachments, history]);

  return (
    <div className="flex h-full flex-row bg-transparent font-sans">
      <DawaChatSidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onStartNewChat={startNewChat}
        onLoadConversation={loadConversation}
        onDeleteConversation={deleteConversation}
      />
      <div className="flex-1 flex flex-col">
        {/* Premium Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-content-bg/10 rounded-lg transition-all text-mist/60 hover:text-white"
              type="button"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-card bg-emerald/10 border border-emerald/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <Sparkles className="w-5 h-5 text-emerald" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-logo tracking-tight leading-none">{title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
                <span className="text-[10px] font-bold text-mist/40 uppercase tracking-widest font-mono">Elite Workflow Engine</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDrugChecker(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-content-bg/10 transition-all text-mist/60 hover:text-white"
              type="button"
            >
              <Shield className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Drug Checker</span>
            </button>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                type="button"
              >
                <Clock className="w-3.5 h-3.5 text-mist/40 group-hover:text-red-400" />
                <span className="text-[10px] font-bold text-mist/40 uppercase tracking-widest group-hover:text-red-400">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Clinical Warning Bar */}
        <AnimatePresence>
          {showClinicalWarning && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 rounded-card border border-amber-500/20 bg-[#13100A] px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-amber-200/80 flex-1">
                  <span className="font-bold text-amber-500 uppercase tracking-wider block mb-0.5">Clinical Context Alert</span>
                  DAWA is for <span className="text-white font-semibold">Workflow & Protocol</span> support. For medical diagnosis, use 
                  <span className="text-emerald font-bold border-b border-emerald/30 ml-1 cursor-pointer">AfyaAI Triage</span>.
                </div>
                <button
                  onClick={() => setShowClinicalWarning(false)}
                  className="p-1 hover:bg-content-bg/5 rounded-lg text-mist/30 transition-colors"
                  type="button"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Conversation Stream */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-1 mb-4">
          {history.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-3xl bg-content-bg/5 border border-white/10 flex items-center justify-center mb-4 transition-transform hover:scale-110">
                <Bot className="w-8 h-8 text-mist/20" />
              </div>
              <h3 className="text-mist font-medium mb-2">How can I assist your workflow today?</h3>
              <p className="text-xs text-mist/40 leading-relaxed max-w-[240px]">
                Ask about hospital protocols, shift handovers, or patient routing procedures.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-6">
            {history.map((turn, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex flex-col", turn.role === 'user' ? 'items-end' : 'items-start')}
              >
                <div className={cn(
                  "flex items-center gap-2 mb-2",
                  turn.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center border",
                    turn.role === 'user' ? "bg-emerald/20 border-emerald/30" : "bg-content-bg/5 border-white/10"
                  )}>
                    {turn.role === 'user' ? <User className="w-3 h-3 text-emerald" /> : <Bot className="w-3 h-3 text-mist/60" />}
                  </div>
                  <span className="text-[9px] font-bold text-mist/30 uppercase tracking-[0.2em] font-mono">
                    {turn.role === 'user' ? 'Practitioner' : 'DAWA AI'}
                  </span>
                  {turn.role === 'assistant' && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald/10 border border-emerald/20 text-[8px] font-bold text-emerald uppercase tracking-tighter">
                      {turn.model || 'MedGemma v4'}
                    </span>
                  )}
                </div>

                <div className={cn(
                  "max-w-[85%] rounded-[24px] px-5 py-4 text-[13px] leading-relaxed shadow-xl transition-all hover:shadow-2xl group",
                  turn.role === 'user'
                    ? 'bg-gradient-to-br from-[#0C1410] to-[#141E19] text-white border border-emerald/20 rounded-tr-none hover:border-emerald/40'
                    : 'bg-[#0C1510] text-mist/90 border border-white/10 rounded-tl-none hover:border-white/20 hover:bg-[#142018]'
                )}>
                  {turn.attachments && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {turn.attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-card px-2.5 py-1.5 ring-1 ring-white/5 hover:bg-black/60 transition-colors">
                           {att.preview ? (
                             // eslint-disable-next-line @next/next/no-img-element
                             <img src={att.preview} alt="" className="w-7 h-7 object-cover rounded-lg" />
                           ) : (
                             <File className="w-4 h-4 text-mist/40" />
                           )}
                          <span className="text-[10px] font-medium text-white truncate max-w-[120px]">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {turn.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <div className="text-sm leading-relaxed opacity-90">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {turn.content}
                        </ReactMarkdown>
                      </div>
                      {turn.citations && turn.citations.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Paperclip className="w-3 h-3 text-emerald" />
                            <span className="text-[10px] font-bold text-emerald uppercase tracking-widest">Protocol Citations</span>
                          </div>
                          {turn.citations.map((citation, index) => {
                            const confidence = citation.confidence ?? 0.5;
                            const confidenceColor = confidence >= 0.8 ? 'text-emerald' : confidence >= 0.6 ? 'text-amber-400' : 'text-rose-400';
                            const confidenceLabel = confidence >= 0.8 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low';
                            return (
                              <a
                                key={citation.id}
                                href={citation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-2 rounded-card bg-content-bg/5 border border-white/10 hover:bg-content-bg/10 transition-all group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-semibold text-white">[{index + 1}] {citation.title}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[8px] font-bold uppercase tracking-tighter ${confidenceColor}`}>
                                      {confidenceLabel} ({Math.round(confidence * 100)}%)
                                    </span>
                                    <ChevronDown className="w-3 h-3 text-mist/30 -rotate-90 group-hover:text-white transition-colors" />
                                  </div>
                                </div>
                                <div className="text-[9px] text-mist/40 mt-1 uppercase tracking-tighter">{citation.source}</div>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    turn.content
                  )}
                </div>
                
                {/* Action buttons for assistant messages */}
                {turn.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => copyToClipboard(turn.content)}
                      className="p-1.5 hover:bg-content-bg/10 rounded-lg text-mist/40 hover:text-white transition-all"
                      type="button"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={regenerateResponse}
                      disabled={loading}
                      className="p-1.5 hover:bg-content-bg/10 rounded-lg text-mist/40 hover:text-white transition-all disabled:opacity-50"
                      type="button"
                      title="Regenerate response"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                    </button>
                  </div>
                )}
                
                <span className="text-[8px] font-mono text-mist/20 mt-1.5 px-2">
                  {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            ))}

            {loading && (
              <div className="flex justify-start items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-content-bg/5 border border-white/10 flex items-center justify-center animate-pulse">
                  <Bot className="w-3 h-3 text-mist/40" />
                </div>
                <div className="px-4 py-2.5 rounded-card bg-content-bg/5 border border-white/10 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-bounce [animation-delay:200ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-bounce [animation-delay:400ms]" />
                </div>
              </div>
            )}
          </div>
          <div ref={bottomRef} className="h-4" />
        </div>

        {/* Floating Pill Input Box */}
        <div className="relative z-10">
          {/* Attachment Previews above input */}
          {attachments.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 mb-3 px-2"
            >
              {attachments.map((att) => (
                <div key={att.id} className="group relative flex items-center gap-2 bg-emerald/10 border border-emerald/20 rounded-card pl-2 pr-1 py-1 ring-1 ring-emerald/20 hover:bg-emerald/15 transition-all">
                  <span className="text-[10px] font-bold text-emerald truncate max-w-[100px]">{att.name}</span>
                  <button 
                    onClick={() => removeAttachment(att.id)}
                    className="p-1 hover:bg-emerald/20 rounded-md text-emerald transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button onClick={clearAttachments} className="text-[10px] font-bold text-mist/40 hover:text-red-400 uppercase tracking-widest px-2 transition-colors">
                Clear All
              </button>
            </motion.div>
          )}

          <div className="relative group">
            <div className="absolute inset-0 bg-emerald/5 blur-xl group-focus-within:bg-emerald/10 transition-all opacity-0 group-focus-within:opacity-100" />
            <div className="relative flex items-end gap-2 bg-[#080F0C] border border-white/10 rounded-[28px] p-2 pr-3 focus-within:border-emerald/40 transition-all shadow-2xl">
              {/* File Button */}
              <div className="relative p-1">
                <button
                  onClick={() => setShowUploadMenu(!showUploadMenu)}
                  disabled={loading}
                  className="w-10 h-10 flex items-center justify-center rounded-card hover:bg-content-bg/10 text-mist/60 hover:text-white transition-all focus:outline-none"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                
                <AnimatePresence>
                  {showUploadMenu && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute left-0 bottom-full mb-4 bg-ink border border-white/10 rounded-card shadow-2xl p-2 min-w-[160px] overflow-hidden"
                    >
                      <button
                        onClick={() => { fileInputRef.current?.click(); setShowUploadMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-mist/60 hover:text-white hover:bg-content-bg/5 rounded-card transition-all uppercase tracking-widest"
                      >
                        <ImageIcon className="w-4 h-4 text-emerald" />
                        Add Media
                      </button>
                      <button
                        onClick={() => { fileInputRef.current?.click(); setShowUploadMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-mist/60 hover:text-white hover:bg-content-bg/5 rounded-card transition-all uppercase tracking-widest"
                      >
                        <File className="w-4 h-4 text-emerald" />
                        Add Doc
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_FILE_TYPES.join(',')}
                multiple
                onChange={handleFileInputChange}
                className="hidden"
              />

              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent border-none text-[13px] text-ink placeholder:text-gray-400 py-4 px-2 focus:ring-0 resize-none min-h-[52px] max-h-32 custom-scrollbar font-sans"
                aria-label="DAWA entry"
              />

              <div className="flex items-center p-1 gap-1">
                {allowVoice && (
                  <VoiceTextInput
                    placeholder=""
                    onSubmit={handleVoiceSubmit}
                    allowVoice={true}
                    allowSpeechOutput={false}
                    variant="compact"
                    disabled={loading}
                    className="bg-transparent"
                  />
                )}
                <button
                  onClick={handleSubmit}
                  disabled={loading || (!query.trim() && attachments.length === 0)}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-card transition-all",
                    (query.trim() || attachments.length > 0) && !loading
                      ? "bg-emerald text-white shadow-[0_4px_16px_rgba(16,185,129,0.4)]"
                      : "bg-content-bg/5 text-mist/20"
                  )}
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald/40 ring-4 ring-emerald/5" />
              <span className="text-[9px] font-bold text-mist/30 uppercase tracking-[0.2em] font-mono">Secure AI Node Active</span>
            </div>
            <span className={cn("text-[10px] font-mono font-bold transition-colors", remaining < 100 ? "text-red-500" : "text-mist/20")}>
              {query.length} / {MAX_CHARS}
            </span>
          </div>

          {/* Query suggestions */}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && !query && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-3 px-4"
              >
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setQuery(suggestion);
                        setShowSuggestions(false);
                        textareaRef.current?.focus();
                      }}
                      className="text-[10px] px-3 py-1.5 rounded-full bg-content-bg/5 border border-white/10 text-mist/70 hover:text-white hover:bg-content-bg/10 transition-all"
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Drug Interaction Checker Modal */}
      <AnimatePresence>
        {showDrugChecker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 pointer-events-auto"
              onClick={() => setShowDrugChecker(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl mx-4 bg-content-bg rounded-card shadow-2xl p-6 pointer-events-auto max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-ink">Drug Interaction Checker</h2>
                <button
                  onClick={() => setShowDrugChecker(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-slate hover:text-ink transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <DrugInteractionChecker />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
