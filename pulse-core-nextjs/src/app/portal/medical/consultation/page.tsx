'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Keyboard,
  Loader2,
  Pill,
  Plus,
  RefreshCw,
  Stethoscope,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';
import { useMedicalQueue, type MedicalQueueItem } from '@/hooks/useMedicalQueue';
import DeteriorationRiskDisplay from '@/components/medical/DeteriorationRiskDisplay';
import DocumentationSuggestions from '@/components/medical/DocumentationSuggestions';
import FollowUpRecommendations from '@/components/medical/FollowUpRecommendations';

type InputTab = 'soap' | 'diagnosis' | 'plan' | 'keyboard';
type InputField = 'notes' | 'diagnosis' | 'plan';

interface PatientSummary extends Record<string, unknown> {
  id?: string;
  pid?: string;
  name?: string;
  age?: number | string;
  gender?: string;
  isPregnant?: boolean;
  gestationalWeeks?: number;
}

interface ActiveConsultation {
  id: string;
  patientId: string;
  status: string;
  createdAt?: string;
  patient: PatientSummary;
  vitals?: Record<string, number>;
  consciousness?: string;
  source: 'api' | 'demo';
}

interface ConsultationApiResponse {
  consultation?: {
    id?: string;
    patientId?: string;
    status?: string;
    createdAt?: string;
  };
  patient?: PatientSummary;
  aiDiagnosis?: unknown;
  error?: string;
}

interface DiagnosisCandidate {
  diagnosis?: string;
  name?: string;
  confidence?: number;
  icd10?: string;
  reasoning?: string;
}

interface AiDiagnosis {
  differentialDiagnosis?: DiagnosisCandidate[];
  recommendedActions?: string[];
  summary?: string;
  latencyMs?: number;
  result?: unknown;
}

const INPUT_TABS: Array<{ key: InputTab; label: string; icon: React.ReactNode }> = [
  { key: 'soap', label: 'SOAP Note', icon: <FileText className="h-4 w-4" /> },
  { key: 'diagnosis', label: 'Assessment', icon: <Stethoscope className="h-4 w-4" /> },
  { key: 'plan', label: 'Plan & Orders', icon: <ClipboardCheck className="h-4 w-4" /> },
  { key: 'keyboard', label: 'Clinical Keyboard', icon: <Keyboard className="h-4 w-4" /> },
];

const DEMO_QUEUE: MedicalQueueItem[] = [
  {
    id: 'demo-q-1',
    patientId: 'demo-patient-1',
    patient: { name: 'Grace Muthoni', age: '42', pid: 'PID-11231', gender: 'female' },
    priority: 'urgent',
    status: 'waiting',
    complaint: 'Chest tightness, palpitations, dizziness',
    waitMinutes: 18,
    room: 'Room 3',
  },
  {
    id: 'demo-q-2',
    patientId: 'demo-patient-2',
    patient: { name: 'Daniel Otieno', age: '9', pid: 'PID-11232', gender: 'male' },
    priority: 'normal',
    status: 'waiting',
    complaint: 'Fever and productive cough',
    waitMinutes: 11,
    room: 'Room 5',
  },
  {
    id: 'demo-q-3',
    patientId: 'demo-patient-3',
    patient: { name: 'Amina Keita', age: '29', pid: 'PID-11233', gender: 'female' },
    priority: 'critical',
    status: 'waiting',
    complaint: 'Severe abdominal pain in pregnancy',
    waitMinutes: 6,
    room: 'Resus',
  },
];

const QUICK_PHRASES = [
  {
    group: 'History',
    phrases: [
      'Onset was gradual with no reported trauma.',
      'No known drug allergies reported today.',
      'Symptoms worsen with exertion and improve with rest.',
    ],
  },
  {
    group: 'Exam',
    phrases: [
      'Patient is alert, oriented, and not in acute distress.',
      'Chest is clear bilaterally with no added sounds.',
      'Abdomen is soft with localized tenderness and no guarding.',
    ],
  },
  {
    group: 'Plan',
    phrases: [
      'Order CBC, U&E, LFTs, and focused bedside observations.',
      'Start supportive care and reassess response within 30 minutes.',
      'Escalate to senior review if warning signs progress.',
    ],
  },
];

const WORKSPACE_FEATURES: Array<{ label: string; icon: typeof FileText }> = [
  { label: 'SOAP note', icon: FileText },
  { label: 'Risk review', icon: AlertTriangle },
  { label: 'AI differential', icon: BrainCircuit },
  { label: 'Care plan', icon: ClipboardCheck },
];

const PLAN_SUGGESTIONS: Array<{ title: string; body: string; icon: typeof Activity }> = [
  { title: 'Labs', body: 'CBC, U&E, LFT, glucose', icon: Activity },
  { title: 'Medication', body: 'Analgesia, fluids, review allergies', icon: Pill },
  { title: 'Review', body: 'Reassess vitals and response', icon: ClipboardCheck },
];

function patientName(item: MedicalQueueItem): string {
  return item.patient?.name ?? 'Unknown patient';
}

function normalizeAge(age: PatientSummary['age']): number | undefined {
  if (typeof age === 'number') return age;
  if (typeof age === 'string') {
    const numeric = Number(age);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
}

function getPatientId(item: MedicalQueueItem): string {
  return item.patientId ?? item.patient?.pid ?? item.id;
}

function getPriorityStyle(priority: MedicalQueueItem['priority']): string {
  if (priority === 'critical' || priority === 'emergency') return 'bg-red-50 text-red-700 border-red-200';
  if (priority === 'urgent') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (priority === 'low') return 'bg-slate-50 text-slate-600 border-slate-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function getDifferentials(aiDiagnosis: AiDiagnosis | null): DiagnosisCandidate[] {
  if (!aiDiagnosis) return [];
  if (Array.isArray(aiDiagnosis.differentialDiagnosis)) return aiDiagnosis.differentialDiagnosis;
  if (Array.isArray(aiDiagnosis.result)) return aiDiagnosis.result as DiagnosisCandidate[];
  return [];
}

function getRecommendedActions(aiDiagnosis: AiDiagnosis | null): string[] {
  if (!aiDiagnosis || !Array.isArray(aiDiagnosis.recommendedActions)) return [];
  return aiDiagnosis.recommendedActions;
}

function toAiDiagnosis(value: unknown): AiDiagnosis | null {
  if (!value || typeof value !== 'object') return null;
  return value as AiDiagnosis;
}

function makeDemoConsultation(item: MedicalQueueItem): ActiveConsultation {
  const patient: PatientSummary = {
    id: getPatientId(item),
    pid: item.patient?.pid,
    name: patientName(item),
    age: item.patient?.age,
    gender: item.patient?.gender,
  };

  return {
    id: `demo-consult-${item.id}`,
    patientId: getPatientId(item),
    status: 'IN_PROGRESS',
    createdAt: new Date().toISOString(),
    patient,
    source: 'demo',
    vitals: { systolicBp: 124, diastolicBp: 78, pulse: 86, temperature: 37, spo2: 98 },
    consciousness: 'alert',
  };
}

export default function ConsultationPage() {
  const { queue, loading, error: queueError, refresh: refreshQueue } = useMedicalQueue();
  const [activeConsultation, setActiveConsultation] = useState<ActiveConsultation | null>(null);
  const [aiDiagnosis, setAiDiagnosis] = useState<AiDiagnosis | null>(null);
  const [notes, setNotes] = useState('');
  const [diagnosisText, setDiagnosisText] = useState('');
  const [planText, setPlanText] = useState('');
  const [activeTab, setActiveTab] = useState<InputTab>('soap');
  const [activeField, setActiveField] = useState<InputField>('notes');
  const [generatingDiagnosis, setGeneratingDiagnosis] = useState(false);
  const [startingQueueId, setStartingQueueId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const visibleQueue = queue.length > 0 ? queue : DEMO_QUEUE;
  const urgentCount = visibleQueue.filter((item) => item.priority === 'urgent' || item.priority === 'critical' || item.priority === 'emergency').length;
  const differentials = getDifferentials(aiDiagnosis);
  const recommendedActions = getRecommendedActions(aiDiagnosis);
  const activeAge = normalizeAge(activeConsultation?.patient.age);

  const activePatientLabel = useMemo(() => {
    if (!activeConsultation) return 'No patient selected';
    return activeConsultation.patient.name ?? activeConsultation.patientId;
  }, [activeConsultation]);

  const startConsultation = async (item: MedicalQueueItem) => {
    setStartingQueueId(item.id);
    setActionError(null);
    setActionSuccess(null);

    const patientId = getPatientId(item);
    try {
      const response = await fetch('/api/medical/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          chiefComplaint: item.complaint || 'General consultation',
          useAiDiagnosis: true,
        }),
      });
      const data = await response.json() as ConsultationApiResponse;

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to start consultation.');
      }

      const patient: PatientSummary = {
        id: patientId,
        pid: item.patient?.pid,
        name: data.patient?.name ?? item.patient?.name,
        age: data.patient?.age ?? item.patient?.age,
        gender: data.patient?.gender ?? item.patient?.gender,
      };

      setActiveConsultation({
        id: data.consultation?.id ?? `consult-${item.id}`,
        patientId: data.consultation?.patientId ?? patientId,
        status: data.consultation?.status ?? 'IN_PROGRESS',
        createdAt: data.consultation?.createdAt,
        patient,
        source: 'api',
      });
      setAiDiagnosis(toAiDiagnosis(data.aiDiagnosis));
      setNotes(`Chief complaint: ${item.complaint || 'General consultation'}\n\nHistory:\n\nExamination:\n`);
      setDiagnosisText('');
      setPlanText('');
      setActiveTab('soap');
      void refreshQueue();
    } catch (error) {
      logger.warn('Using local demo consultation fallback', { error });
      setActiveConsultation(makeDemoConsultation(item));
      setAiDiagnosis({
        summary: 'Demo consultation opened locally. Clinical APIs can be reconnected without changing the workspace flow.',
        recommendedActions: ['Capture focused history', 'Review vitals and risk screen', 'Document diagnosis and plan'],
      });
      setNotes(`Chief complaint: ${item.complaint || 'General consultation'}\n\nHistory:\n\nExamination:\n`);
      setDiagnosisText('');
      setPlanText('');
      setActiveTab('soap');
      setActionError('Clinical record service is unavailable, so this consultation is running in local demo mode.');
    } finally {
      setStartingQueueId(null);
    }
  };

  const generateAIDiagnosis = async () => {
    if (!activeConsultation) return;

    setGeneratingDiagnosis(true);
    setActionError(null);
    try {
      const response = await fetch('/api/ai/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'differential',
          data: {
            patientAge: activeAge ?? 30,
            patientGender: (activeConsultation.patient.gender?.toLowerCase() === 'female' ? 'female' : 'male'),
            chiefComplaint: notes.split('\n')[0]?.replace('Chief complaint:', '').trim() || 'General consultation',
            symptoms: [],
            history: notes,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to generate AI diagnosis.');
      }

      setAiDiagnosis(toAiDiagnosis(await response.json()));
    } catch (error) {
      logger.error('Failed to generate AI diagnosis', { error });
      setActionError('AI diagnosis could not be generated. Continue documenting and retry when services recover.');
    } finally {
      setGeneratingDiagnosis(false);
    }
  };

  const completeConsultation = async () => {
    if (!activeConsultation) return;

    setActionError(null);
    setActionSuccess(null);

    try {
      if (activeConsultation.source === 'api') {
        const response = await fetch(`/api/medical/consultation/${activeConsultation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Completed',
            notes: `${notes}\n\nPlan:\n${planText}`.trim(),
            diagnosis: diagnosisText,
          }),
        });

        if (!response.ok) {
          throw new Error('Unable to complete consultation.');
        }
      }

      setActiveConsultation(null);
      setAiDiagnosis(null);
      setNotes('');
      setDiagnosisText('');
      setPlanText('');
      setActiveTab('soap');
      setActionSuccess('Consultation completed.');
      void refreshQueue();
    } catch (error) {
      logger.error('Failed to complete consultation', { error });
      setActionError('Consultation could not be completed. Review the note and try again.');
    }
  };

  const insertPhrase = (phrase: string) => {
    const append = (value: string) => `${value}${value.trim().length > 0 ? '\n' : ''}${phrase}`;
    if (activeField === 'diagnosis') {
      setDiagnosisText(append);
    } else if (activeField === 'plan') {
      setPlanText(append);
    } else {
      setNotes(append);
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = INPUT_TABS.findIndex((tab) => tab.key === activeTab);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setActiveTab(INPUT_TABS[(currentIndex + 1) % INPUT_TABS.length].key);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setActiveTab(INPUT_TABS[(currentIndex - 1 + INPUT_TABS.length) % INPUT_TABS.length].key);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="rounded-card border border-content-border bg-content-bg px-8 py-7 text-center shadow-card">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-portal-primary" />
          <p className="font-semibold text-ink">Preparing consultation room</p>
          <p className="mt-1 text-sm text-slate">Loading queue and clinical workspace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-card border border-content-border bg-content-bg p-5 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-portal-primary/20 bg-portal-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-portal-primary font-mono">
              <Activity className="h-3.5 w-3.5" />
              Doctor workspace
            </div>
            <h1 className="text-2xl font-bold text-ink">Consultation Room</h1>
            <p className="text-sm text-slate">Queue, patient context, AI support, and structured note entry in one clinical workspace.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:min-w-[420px]">
            <div className="rounded-control border border-content-border bg-content-surface p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate font-mono">Waiting</p>
              <p className="mt-1 text-xl font-bold text-ink">{visibleQueue.length}</p>
            </div>
            <div className="rounded-control border border-content-border bg-content-surface p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate font-mono">Urgent</p>
              <p className="mt-1 text-xl font-bold text-amber-600">{urgentCount}</p>
            </div>
            <div className="rounded-control border border-content-border bg-content-surface p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate font-mono">Active</p>
              <p className="mt-1 truncate text-sm font-bold text-portal-primary">{activeConsultation ? activePatientLabel : 'None'}</p>
            </div>
          </div>
        </div>
      </header>

      {(queueError || actionError || actionSuccess) && (
        <div
          role={actionError || queueError ? 'alert' : 'status'}
          className={cn(
            'rounded-card border px-4 py-3 text-sm font-medium shadow-card',
            actionSuccess
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-800',
          )}
        >
          {actionSuccess ?? actionError ?? `Queue service returned: ${queueError}. Demo queue is available locally.`}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="rounded-card border border-content-border bg-content-bg shadow-card">
          <div className="border-b border-content-border p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold text-ink">
                <ClipboardList className="h-5 w-5 text-portal-primary" />
                Waiting Queue
              </h2>
              <button
                type="button"
                onClick={() => void refreshQueue()}
                className="inline-flex items-center gap-2 rounded-control border border-content-border bg-content-surface px-3 py-2 text-xs font-semibold text-ink transition hover:bg-content-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>
          <div className="max-h-[720px] space-y-3 overflow-y-auto p-3">
            {visibleQueue.length === 0 ? (
              <div className="rounded-card border border-dashed border-content-border bg-content-surface p-8 text-center">
                <Stethoscope className="mx-auto mb-3 h-10 w-10 text-slate" />
                <p className="font-semibold text-ink">No waiting patients</p>
                <p className="mt-1 text-sm text-slate">The clinical queue is clear.</p>
              </div>
            ) : (
              visibleQueue.map((item) => {
                const isStarting = startingQueueId === item.id;
                const isActive = activeConsultation?.patientId === getPatientId(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => item.status === 'waiting' && void startConsultation(item)}
                    disabled={item.status !== 'waiting' || isStarting}
                    className={cn(
                      'w-full rounded-control border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35 disabled:cursor-not-allowed disabled:opacity-70',
                      isActive
                        ? 'border-portal-primary bg-portal-primary/10 shadow-card'
                        : 'border-content-border bg-content-surface hover:border-portal-primary/40 hover:bg-portal-primary/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{patientName(item)}</p>
                        <p className="mt-1 text-xs text-slate">
                          {item.patient?.pid ?? getPatientId(item)} · {item.patient?.age ?? 'Age —'} · {item.room ?? 'Room pending'}
                        </p>
                      </div>
                      {isStarting ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-portal-primary" />
                      ) : (
                        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', getPriorityStyle(item.priority))}>
                          {item.priority}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-charcoal">{item.complaint || 'General consultation'}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate">
                      <Clock className="h-3.5 w-3.5" />
                      {item.waitMinutes ?? '—'} min waiting
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="space-y-5">
          {!activeConsultation ? (
            <section className="rounded-card border border-content-border bg-content-bg p-8 shadow-card">
              <div className="grid gap-8 lg:grid-cols-[1fr_280px] lg:items-center">
                <div>
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-card bg-portal-primary/10 text-portal-primary">
                    <Stethoscope className="h-7 w-7" />
                  </div>
                  <h2 className="text-2xl font-bold text-ink">Select a patient to begin</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate">
                    Start from the queue to open a complete consultation screen with patient context, AI differential support,
                    structured note tabs, follow-up tools, and a clinical quick-entry keyboard.
                  </p>
                </div>
                <div className="rounded-card border border-content-border bg-content-surface p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate font-mono">Workspace includes</p>
                  <div className="mt-4 space-y-3">
                    {WORKSPACE_FEATURES.map(({ label, icon: Component }) => {
                      return (
                        <div key={label} className="flex items-center gap-3 text-sm font-medium text-ink">
                          <Component className="h-4 w-4 text-portal-primary" />
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="rounded-card border border-content-border bg-content-bg p-5 shadow-card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-card bg-portal-primary/10 text-portal-primary">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-ink">{activePatientLabel}</h2>
                        <span className="rounded-full bg-portal-primary/10 px-3 py-1 text-xs font-semibold text-portal-primary">
                          {activeConsultation.source === 'demo' ? 'Demo consultation' : 'In progress'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate">
                        {activeConsultation.patient.pid ?? activeConsultation.patientId} · Age {activeConsultation.patient.age ?? '—'} · {activeConsultation.patient.gender ?? 'Gender —'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
                    <div className="rounded-control border border-content-border bg-content-surface p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate font-mono">Status</p>
                      <p className="mt-1 text-xs font-bold text-portal-primary">{activeConsultation.status}</p>
                    </div>
                    <div className="rounded-control border border-content-border bg-content-surface p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate font-mono">Note</p>
                      <p className="mt-1 text-xs font-bold text-ink">{notes.trim().length} chars</p>
                    </div>
                    <div className="rounded-control border border-content-border bg-content-surface p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate font-mono">AI</p>
                      <p className="mt-1 text-xs font-bold text-ink">{differentials.length || recommendedActions.length ? 'Ready' : 'Pending'}</p>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid gap-5 2xl:grid-cols-[1fr_380px]">
                <section className="rounded-card border border-content-border bg-content-bg shadow-card">
                  <div
                    role="tablist"
                    aria-label="Consultation input tabs"
                    onKeyDown={handleTabKeyDown}
                    className="grid grid-cols-2 gap-2 border-b border-content-border p-3 md:grid-cols-4"
                  >
                    {INPUT_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        id={`consult-tab-${tab.key}`}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        aria-controls={`consult-panel-${tab.key}`}
                        tabIndex={activeTab === tab.key ? 0 : -1}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                          'inline-flex items-center justify-center gap-2 rounded-control px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35',
                          activeTab === tab.key
                            ? 'bg-portal-primary text-white shadow-card'
                            : 'bg-content-surface text-slate hover:bg-portal-primary/5 hover:text-ink',
                        )}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-5">
                    {activeTab === 'soap' && (
                      <div id="consult-panel-soap" role="tabpanel" aria-labelledby="consult-tab-soap" className="space-y-3">
                        <label htmlFor="consult-notes" className="text-sm font-semibold text-ink">Clinical note</label>
                        <textarea
                          id="consult-notes"
                          value={notes}
                          onFocus={() => setActiveField('notes')}
                          onChange={(event) => setNotes(event.target.value)}
                          placeholder="Chief complaint, history, examination, working impression..."
                          className="min-h-[360px] w-full resize-y rounded-card border border-content-border bg-content-surface p-4 text-sm leading-6 text-ink outline-none transition placeholder:text-slate focus:border-portal-primary/50 focus:ring-2 focus:ring-portal-primary/20"
                        />
                      </div>
                    )}

                    {activeTab === 'diagnosis' && (
                      <div id="consult-panel-diagnosis" role="tabpanel" aria-labelledby="consult-tab-diagnosis" className="space-y-3">
                        <label htmlFor="consult-diagnosis" className="text-sm font-semibold text-ink">Assessment and diagnosis</label>
                        <textarea
                          id="consult-diagnosis"
                          value={diagnosisText}
                          onFocus={() => setActiveField('diagnosis')}
                          onChange={(event) => setDiagnosisText(event.target.value)}
                          placeholder="Working diagnosis, differentials, ICD-10 notes, rule-outs..."
                          className="min-h-[300px] w-full resize-y rounded-card border border-content-border bg-content-surface p-4 text-sm leading-6 text-ink outline-none transition placeholder:text-slate focus:border-portal-primary/50 focus:ring-2 focus:ring-portal-primary/20"
                        />
                        <button
                          type="button"
                          onClick={generateAIDiagnosis}
                          disabled={generatingDiagnosis}
                          className="inline-flex items-center gap-2 rounded-control border border-portal-primary bg-portal-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-portal-primary/90 disabled:opacity-60"
                        >
                          {generatingDiagnosis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          Generate differential
                        </button>
                      </div>
                    )}

                    {activeTab === 'plan' && (
                      <div id="consult-panel-plan" role="tabpanel" aria-labelledby="consult-tab-plan" className="space-y-3">
                        <label htmlFor="consult-plan" className="text-sm font-semibold text-ink">Plan, orders, and disposition</label>
                        <textarea
                          id="consult-plan"
                          value={planText}
                          onFocus={() => setActiveField('plan')}
                          onChange={(event) => setPlanText(event.target.value)}
                          placeholder="Investigations, medications, procedures, follow-up, discharge or admission criteria..."
                          className="min-h-[300px] w-full resize-y rounded-card border border-content-border bg-content-surface p-4 text-sm leading-6 text-ink outline-none transition placeholder:text-slate focus:border-portal-primary/50 focus:ring-2 focus:ring-portal-primary/20"
                        />
                        <div className="grid gap-3 md:grid-cols-3">
                          {PLAN_SUGGESTIONS.map(({ title, body, icon: Component }) => {
                            return (
                              <button
                                key={title}
                                type="button"
                                onClick={() => insertPhrase(body)}
                                className="rounded-control border border-content-border bg-content-surface p-3 text-left transition hover:border-portal-primary/40 hover:bg-portal-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35"
                              >
                                <Component className="mb-2 h-4 w-4 text-portal-primary" />
                                <p className="text-sm font-semibold text-ink">{title}</p>
                                <p className="mt-1 text-xs text-slate">{body}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeTab === 'keyboard' && (
                      <div id="consult-panel-keyboard" role="tabpanel" aria-labelledby="consult-tab-keyboard" className="space-y-5">
                        <div className="flex flex-wrap gap-2">
                          {[
                            ['notes', 'SOAP note'],
                            ['diagnosis', 'Assessment'],
                            ['plan', 'Plan'],
                          ].map(([field, label]) => (
                            <button
                              key={field}
                              type="button"
                              onClick={() => setActiveField(field as InputField)}
                              className={cn(
                                'rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35',
                                activeField === field
                                  ? 'border-portal-primary bg-portal-primary text-white'
                                  : 'border-content-border bg-content-surface text-slate hover:text-ink',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="grid gap-4 lg:grid-cols-3">
                          {QUICK_PHRASES.map((group) => (
                            <div key={group.group} className="rounded-card border border-content-border bg-content-surface p-4">
                              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate font-mono">{group.group}</p>
                              <div className="space-y-2">
                                {group.phrases.map((phrase) => (
                                  <button
                                    key={phrase}
                                    type="button"
                                    onClick={() => insertPhrase(phrase)}
                                    className="w-full rounded-control border border-content-border bg-content-bg px-3 py-2 text-left text-xs leading-5 text-charcoal transition hover:border-portal-primary/40 hover:bg-portal-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary/35"
                                  >
                                    {phrase}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <aside className="space-y-5">
                  <DeteriorationRiskDisplay
                    patientId={activeConsultation.patientId}
                    vitals={activeConsultation.vitals}
                    consciousness={activeConsultation.consciousness}
                    age={activeAge}
                    gender={activeConsultation.patient.gender}
                    isPregnant={activeConsultation.patient.isPregnant}
                    gestationalWeeks={activeConsultation.patient.gestationalWeeks}
                  />

                  <section className="rounded-card border border-content-border bg-content-bg shadow-card">
                    <div className="flex items-center justify-between gap-3 border-b border-content-border p-4">
                      <h2 className="flex items-center gap-2 font-semibold text-ink">
                        <BrainCircuit className="h-5 w-5 text-portal-primary" />
                        AI Differential
                      </h2>
                      <button
                        type="button"
                        onClick={generateAIDiagnosis}
                        disabled={generatingDiagnosis}
                        className="rounded-control border border-portal-primary/30 px-3 py-1.5 text-xs font-semibold text-portal-primary transition hover:bg-portal-primary hover:text-white disabled:opacity-60"
                      >
                        {generatingDiagnosis ? 'Generating' : 'Refresh'}
                      </button>
                    </div>
                    <div className="space-y-3 p-4">
                      {aiDiagnosis?.summary && (
                        <div className="rounded-control border border-portal-primary/20 bg-portal-primary/5 p-3 text-sm text-ink">
                          {aiDiagnosis.summary}
                        </div>
                      )}
                      {differentials.length > 0 ? (
                        <div className="space-y-2">
                          {differentials.slice(0, 4).map((item, index) => (
                            <div key={`${item.diagnosis ?? item.name ?? 'dx'}-${index}`} className="rounded-control border border-content-border bg-content-surface p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-ink">{item.diagnosis ?? item.name ?? 'Clinical possibility'}</p>
                                {item.confidence !== undefined && (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                    {item.confidence}%
                                  </span>
                                )}
                              </div>
                              {item.icd10 && <p className="mt-1 text-xs text-slate">ICD-10 {item.icd10}</p>}
                              {item.reasoning && <p className="mt-2 text-xs leading-5 text-charcoal">{item.reasoning}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate">No differential generated yet.</p>
                      )}
                      {recommendedActions.length > 0 && (
                        <div className="rounded-control border border-content-border bg-content-surface p-3">
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate font-mono">Recommended actions</p>
                          <ul className="space-y-1">
                            {recommendedActions.map((action) => (
                              <li key={action} className="flex gap-2 text-xs leading-5 text-charcoal">
                                <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </section>

                  <DocumentationSuggestions
                    documentType="soap_note"
                    patientContext={activeConsultation.patient}
                    partialContent={notes}
                    suggestionsFor="completion"
                  />

                  <FollowUpRecommendations
                    patientId={activeConsultation.patientId}
                    diagnosis={diagnosisText}
                    treatment={{ plan: planText }}
                    riskFactors={activeConsultation.patient}
                    socialContext={{}}
                    dischargeCondition="stable"
                  />
                </aside>
              </div>

              <div className="sticky bottom-4 z-10 rounded-card border border-content-border bg-content-bg p-3 shadow-[0_18px_45px_-20px_rgba(15,76,117,0.35)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">{activePatientLabel}</p>
                    <p className="text-xs text-slate">Complete the note, assessment, and plan before closing the consultation.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (notes || diagnosisText || planText) {
                          const confirmed = window.confirm('Discard this consultation? Notes and diagnosis will be lost.');
                          if (!confirmed) return;
                        }
                        setActiveConsultation(null);
                        setAiDiagnosis(null);
                        setNotes('');
                        setDiagnosisText('');
                        setPlanText('');
                        setActionError(null);
                      }}
                      className="rounded-control border border-content-border bg-content-bg px-4 py-2 text-sm font-semibold text-ink transition hover:bg-content-surface"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void completeConsultation()}
                      className="inline-flex items-center gap-2 rounded-control bg-portal-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-portal-primary/90"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Complete Consultation
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
