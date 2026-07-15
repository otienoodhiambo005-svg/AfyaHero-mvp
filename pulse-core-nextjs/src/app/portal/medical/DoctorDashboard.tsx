'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit, Clock, Bell, FlaskConical,
  FileText, RefreshCw, User, Search, Stethoscope,
  Activity, Calendar, Sparkles, ChevronRight, Users, ShieldCheck, Timer
} from 'lucide-react';
import type { EducationTopicData } from '@/lib/health-news';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { useMedicalQueue } from '@/hooks/useMedicalQueue';
import LoadingState from '@/components/ui/LoadingState';
import StatusBadge from '@/components/ui/StatusBadge';
const HealthNewsPanel = dynamic(() => import('@/components/shared/HealthNewsPanel'), { ssr: false, loading: () => <div className="h-48 rounded-card border border-content-border bg-content-bg animate-pulse" /> });
import { KPIHeroStrip } from '@/components/portal/KPIHeroStrip';
import { tokens } from '@/styles/design-tokens';

const ACCENT = tokens.colors.primary[500]; // Royal Blue for Medical Portal

interface PatientRow {
  num: number;
  name: string;
  ageSex: string;
  time: string;
  complaint: string;
  bp: string;
  spo2: string;
  status: 'Waiting' | 'In Consult' | 'Done' | 'Admitted' | 'Referred';
}

interface InboxItem {
  icon: React.ReactNode;
  text: string;
  time: string;
  type: 'lab' | 'imaging' | 'referral' | 'rx';
}

interface DoctorTask {
  id: string;
  title: string;
  message: string;
  channel: 'chat' | 'task';
  createdAt: string;
}


const HEALTH_NEWS_TOPICS: EducationTopicData[] = [
  {
    title: 'Hypertension follow-up counseling essentials',
    tag: 'Chronic Care',
    duration: '5 min read',
    summary: 'Reinforce adherence, home BP monitoring, salt reduction, and danger signs that require urgent review.',
    actionLabel: 'Open checklist',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=70&auto=format&fit=crop',
  },
];

export default function DoctorDashboard(): React.ReactElement {
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('en-KE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }).format(new Date()),
    [],
  );
  const { queue: rawQueue, loading: loadingPatients, refresh: refreshQueue } = useMedicalQueue();
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [doctorTasks, setDoctorTasks] = useState<DoctorTask[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);

  // Transform queue data to patient rows
  const patientsList = useMemo<PatientRow[]>(() =>
    rawQueue.map((item, index) => ({
      num: index + 1,
      name: item.patient?.name || 'Unknown',
      ageSex: `${item.patient?.age || '?'} ?`,
      time: item.arrivedAt ? new Date(item.arrivedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '?',
      complaint: item.complaint || 'General consultation',
      bp: '-',
      spo2: '-',
      status: item.status === 'waiting' ? 'Waiting' : item.status === 'in_progress' ? 'In Consult' : 'Done',
    })),
    [rawQueue]
  );

  useEffect(() => {
    let active = true;

    const loadDoctorTasks = async (): Promise<void> => {
      try {
        const response = await fetch('/api/medical/doctor-tasks', { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) return;
        const data = (await response.json()) as { tasks?: DoctorTask[] };
        if (!active) return;
        setDoctorTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } catch {
        if (!active) return;
        setDoctorTasks([]);
      }
    };
    loadDoctorTasks();

    const interval = setInterval(() => {
      loadDoctorTasks();
    }, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const filteredPatients = useMemo(() => {
    if (!searchQuery) return patientsList;
    const query = searchQuery.toLowerCase();
    return patientsList.filter((p) =>
      p.name.toLowerCase().includes(query) ||
      p.complaint.toLowerCase().includes(query)
    );
  }, [patientsList, searchQuery]);

  const waitingCount = patientsList.filter((patient) => patient.status === 'Waiting').length;
  const inConsultCount = patientsList.filter((patient) => patient.status === 'In Consult').length;

  return (
    <div className="space-y-section">
      <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card md:p-6">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-portal-primary/10 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-portal-primary/25 bg-portal-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-portal-primary">
              <Stethoscope className="h-3.5 w-3.5" />
              Doctor command center
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-5xl">
              Dr. Amina, your clinical queue is ready.
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-portal-primary" />
                {today || 'Loading date...'}
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-slate/40 sm:inline-block" />
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" />
                Orders, tasks, and queue synchronized
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            {[
              { label: 'Waiting', value: waitingCount, icon: <Users className="h-4 w-4" /> },
              { label: 'In consult', value: inConsultCount, icon: <Activity className="h-4 w-4" /> },
              { label: 'Tasks', value: doctorTasks.length, icon: <Bell className="h-4 w-4" /> },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-content-border bg-content-bg p-3 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-portal-primary/10 text-portal-primary">
                  {item.icon}
                </div>
                <p className="text-2xl font-semibold text-ink">{item.value}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <KPIHeroStrip role="medical" accentColor={ACCENT} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="overflow-hidden rounded-[1.75rem] border border-content-border bg-content-bg shadow-card">
            <div className="flex flex-col gap-4 border-b border-content-border bg-content-surface px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                  <Timer className="h-5 w-5 text-portal-primary" />
                  Clinical Queue
                </h2>
                <p className="mt-1 text-xs text-slate">Prioritized by arrival time, triage state, and active consult status.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={() => void refreshQueue()}
                  className="inline-flex items-center justify-center gap-2 rounded-control border border-content-border bg-content-bg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate transition-colors hover:bg-content-border hover:text-ink"
                >
                  <RefreshCw className={cn('w-4 h-4', loadingPatients && 'animate-spin')} />
                  Refresh
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ID, Name, or Vitals..."
                    className="w-full rounded-control border border-content-border bg-content-bg py-2 pl-10 pr-4 text-sm text-ink outline-none transition-all focus:border-portal-primary/40 focus:ring-2 focus:ring-portal-primary/15 sm:w-72"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-content-border bg-content-surface">
                    {['#', 'Patient Identity', 'Complaint / Intelligence', 'Vitals Grid', 'Pulse Status', 'Go'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-content-border/70">
                  {loadingPatients ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8">
                        <LoadingState title="Loading patient queue" inline />
                      </td>
                    </tr>
                  ) : filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8">
                        <div className="flex flex-col items-center text-center">
                          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <Users className="h-5 w-5" />
                          </div>
                          <p className="text-ink font-medium">No patients in queue</p>
                          <p className="text-sm text-slate">The clinical queue is currently empty.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map((p, idx) => (
                      <tr 
                        key={p.num} 
                        className="group cursor-pointer transition-colors hover:bg-content-surface/70"
                      >
                        <td className="px-4 py-3 text-slate text-xs">{(idx + 1).toString().padStart(2, '0')}</td>
                        <td className="px-4 py-3 font-semibold text-ink group-hover:text-portal-primary transition-colors">
                          <div className="flex flex-col">
                            <span>{p.name}</span>
                            <span className="text-[11px] text-slate font-normal">{p.ageSex}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-charcoal line-clamp-1 max-w-[240px]">{p.complaint}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate uppercase">BP</span>
                              <span className="text-ink text-xs">{p.bp}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate uppercase">SpO2</span>
                              <span className="text-ink text-xs">{p.spo2}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={
                              p.status === 'Waiting' ? 'warning' :
                              p.status === 'In Consult' ? 'info' :
                              p.status === 'Done' ? 'success' :
                              p.status === 'Admitted' ? 'active' : 'pending'
                            }
                            size="sm"
                          >
                            {p.status}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-8 h-8 rounded-control bg-portal-primary/10 text-portal-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-content-bg rounded-card border border-content-border shadow-card overflow-hidden flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-content-border bg-content-surface">
              <h2 className="text-xs font-semibold text-charcoal uppercase tracking-wide flex items-center gap-2">
                <Bell className="w-4 h-4 text-portal-primary" /> Clinical Inbox
              </h2>
              <span className="text-[10px] font-semibold bg-portal-primary text-white px-2 py-0.5 rounded-full">{inbox.length}</span>
            </div>
            <div className="p-2 space-y-1">
              {inbox.map((item, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-control hover:bg-content-surface transition-all group cursor-pointer border border-transparent hover:border-content-border">
                  <div className="w-9 h-9 rounded-control bg-content-surface border border-content-border flex items-center justify-center shrink-0 group-hover:border-portal-primary/40 transition-colors">
                    <div className="text-portal-primary">{item.icon}</div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-charcoal line-clamp-2 leading-snug group-hover:text-portal-primary transition-colors">{item.text}</p>
                    <p className="text-[10px] text-slate mt-1 uppercase tracking-wide">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-content-bg rounded-card border border-content-border shadow-card overflow-hidden flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-content-border bg-content-surface">
              <h2 className="text-xs font-semibold text-charcoal uppercase tracking-wide flex items-center gap-2">
                <Bell className="w-4 h-4 text-portal-primary" /> Doctor Tasks
              </h2>
              <span className="text-[10px] font-semibold bg-portal-primary text-white px-2 py-0.5 rounded-full">{doctorTasks.length}</span>
            </div>
            <div className="p-2 space-y-1">
              {doctorTasks.length === 0 && (
                <div className="px-4 py-6 text-xs text-slate">No open doctor notifications.</div>
              )}
              {doctorTasks.map((task) => (
                <div key={task.id} className="flex gap-3 p-3 rounded-control hover:bg-content-surface transition-all border border-transparent hover:border-content-border">
                  <div className="w-9 h-9 rounded-control bg-content-surface border border-content-border flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-portal-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink line-clamp-1">{task.title}</p>
                    <p className="text-[11px] text-slate line-clamp-2">{task.message}</p>
                    <p className="text-[10px] text-slate mt-1 uppercase tracking-wide">
                      {task.channel} task
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-card p-card border border-portal-primary/25 bg-portal-primary-light/25 shadow-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-control bg-portal-primary/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-portal-primary" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-portal-primary">MedGemma Pilot</span>
            </div>
            <p className="text-sm text-charcoal leading-relaxed">
              Dr. Amina, internal analytics indicate <strong>Grace Abuya</strong> is physically ready for discharge. Her vital trends align with 98.4% of successful recovery patterns.
            </p>
            <div className="pt-2 flex flex-col gap-2.5">
              <button className="w-full py-3 bg-portal-primary text-white text-xs font-semibold uppercase tracking-wide rounded-control hover:bg-portal-primary-hover transition-colors">
                Approve Discharge
              </button>
              <button className="w-full py-3 bg-content-bg border border-content-border text-charcoal text-[11px] font-semibold uppercase tracking-wide rounded-control hover:bg-content-surface transition-colors">
                Request Context
              </button>
            </div>
          </div>
        </div>
      </div>

      <ErrorBoundary label="Health News">
        <HealthNewsPanel
          accentColor={ACCENT}
          heading="Clinical moments for every consultation"
          description="Deliver evidence-based counseling prompts while documenting. Automated medical news snippets curated for your role and current patient list."
          insightTitle="Today's clinical focus"
          insightText="The facility is seeing a 15% uptick in seasonal respiratory infections. Prioritize TB screening questions and hydration counseling for pediatric cases."
          role="medical"
          topics={HEALTH_NEWS_TOPICS}
        />
      </ErrorBoundary>
    </div>
  );
}
