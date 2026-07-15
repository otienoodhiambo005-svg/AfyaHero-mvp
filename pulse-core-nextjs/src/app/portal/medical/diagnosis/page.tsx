'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, BrainCircuit, FileText, Info, Microscope, ScanLine, ShieldPlus, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/shared/ErrorBoundary';

const DiagnosisAssistant = dynamic(() => import('@/components/medical/AIDiagnosticAssistant'), { ssr: false, loading: () => <div className="h-64 rounded-card border border-content-border bg-content-bg animate-pulse" /> });
const RadiologyAssistant = dynamic(() => import('@/components/medical/AIRadiologyAssistant'), { ssr: false, loading: () => <div className="h-64 rounded-card border border-content-border bg-content-bg animate-pulse" /> });
const PathologyAssistant = dynamic(() => import('@/components/medical/AIPathologyAssistant'), { ssr: false, loading: () => <div className="h-64 rounded-card border border-content-border bg-content-bg animate-pulse" /> });
const ScribeAssistant = dynamic(() => import('@/components/medical/AIScribeAssistant'), { ssr: false, loading: () => <div className="h-64 rounded-card border border-content-border bg-content-bg animate-pulse" /> });

const TABS = [
  { id: 'diagnosis', label: 'Clinical Diagnosis', icon: BrainCircuit, color: 'emerald' },
  { id: 'radiology', label: 'Radiology AI', icon: ScanLine, color: 'blue' },
  { id: 'pathology', label: 'Pathology AI', icon: Microscope, color: 'violet' },
  { id: 'scribe', label: 'AI Scribe', icon: FileText, color: 'amber' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TAB_SUMMARY: Record<TabId, string> = {
  diagnosis: 'Differential support with confidence ranking, risk framing, and source-aware clinical guidance.',
  radiology: 'Structured imaging interpretation with impression, findings, differentials, and follow-up signals.',
  pathology: 'Specimen-focused pathology support with markers, staging context, and workflow recommendations.',
  scribe: 'Consultation-to-note assistant for structured summaries and action-oriented next-step plans.',
};

const isTabId = (value: string | null): value is TabId => {
  return value !== null && TABS.some((tab) => tab.id === value);
};

const TAB_COLORS: Record<string, { active: string; hover: string; border: string; glow: string }> = {
  emerald: { active: 'bg-emerald-500/10 text-emerald-600', hover: 'hover:text-emerald-600', border: 'border-emerald-500', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.1)]' },
  blue:    { active: 'bg-blue-500/10 text-blue-600',       hover: 'hover:text-blue-600',    border: 'border-blue-500',    glow: 'shadow-[0_0_15px_rgba(37,99,235,0.1)]' },
  violet:  { active: 'bg-violet-500/10 text-violet-600', hover: 'hover:text-violet-600',  border: 'border-violet-500',  glow: 'shadow-[0_0_15px_rgba(139,92,246,0.1)]' },
  amber:   { active: 'bg-amber-500/10 text-amber-600',    hover: 'hover:text-amber-600',   border: 'border-amber-500',   glow: 'shadow-[0_0_15px_rgba(245,158,11,0.1)]' },
};

export default function ClinicalDiagnosisPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tool');
  const initialTab: TabId = isTabId(urlTab) ? urlTab : 'diagnosis';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    const next = searchParams.get('tool');
    if (isTabId(next) && next !== activeTab) {
      setTimeout(() => setActiveTab(next), 0);
    }
  }, [activeTab, searchParams]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tool', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const governanceChips = useMemo(() => ([
    'Grounded retrieval enabled',
    'Prompt cache enabled',
    'Provider/model traceability',
    'Clinician review required',
  ]), []);

  return (
    <div className="space-y-8 pb-32">
      {/* Header with Antigravity Flair */}
      <div className="flex flex-col gap-6 relative">
        <div className="absolute top-0 left-0 w-64 h-64 bg-portal-primary/5 blur-[120px] -ml-32 -mt-32 pointer-events-none" />
        
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-portal-primary/10 border border-portal-primary/20 text-[10px] font-black uppercase tracking-[0.3em] text-portal-primary shadow-card shadow-portal-primary/5">
            <Stethoscope className="w-4 h-4" />
            Clinical AI Suite
          </div>
          <h1 className="text-5xl font-serif italic text-ink tracking-tight py-2 leading-[1.1]">
            AI Clinical <br />
            <span className="text-portal-primary">Diagnosis Assistant</span>
          </h1>
          <p className="text-lg text-slate max-w-2xl font-medium leading-relaxed">
            {TAB_SUMMARY[activeTab]}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 relative z-10">
          {governanceChips.map((chip) => (
            <span key={chip} className="rounded-full border border-content-border bg-content-bg px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate shadow-card flex items-center gap-2">
              <ShieldPlus className="w-3 h-3 text-portal-primary" />
              {chip}
            </span>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 bg-content-surface border border-content-border rounded-[2rem] p-2 overflow-x-auto custom-scrollbar">
        {TABS.map((tab) => {
          const colors = TAB_COLORS[tab.color];
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2',
                isActive
                  ? `${colors.active} border-current ${colors.glow}`
                  : `text-slate border-transparent ${colors.hover} hover:bg-content-bg`
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="min-h-[600px]">
          {activeTab === 'diagnosis' && <ErrorBoundary label="Clinical Diagnosis"><DiagnosisAssistant /></ErrorBoundary>}
          {activeTab === 'radiology' && <ErrorBoundary label="Radiology AI"><RadiologyAssistant /></ErrorBoundary>}
          {activeTab === 'pathology' && <ErrorBoundary label="Pathology AI"><PathologyAssistant /></ErrorBoundary>}
          {activeTab === 'scribe' && <ErrorBoundary label="AI Scribe"><ScribeAssistant /></ErrorBoundary>}
        </div>

        {/* Context sidebar adapts per tab */}
        <div className="bg-content-bg border border-content-border rounded-3xl p-6 space-y-6 h-fit shadow-xl">
          {activeTab === 'diagnosis' && (
            <>
              <SidebarHeader icon={ShieldPlus} color="emerald" title="TB screening quick guide" subtitle='Use the "TB screening" quick prompt to prefill.' />
              <div className="rounded-2xl border border-content-border bg-content-surface px-5 py-4 space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Flag high-risk signs
                </div>
                <ul className="text-xs text-slate list-disc pl-5 space-y-2 font-medium">
                  <li>Persistent cough &gt;3 weeks, weight loss, night sweats, fever</li>
                  <li>Close contact with confirmed TB case, immunocompromise, or HIV status unknown</li>
                  <li>Order CXR and sputum GeneXpert; initiate airborne precautions while evaluating</li>
                </ul>
              </div>
            </>
          )}

          {activeTab === 'radiology' && (
            <>
              <SidebarHeader icon={ScanLine} color="blue" title="Radiology AI Guide" subtitle="Interprets 2D imaging — X-ray, CT, MRI, Ultrasound." />
              <HowToUse steps={[
                'Select imaging modality and body region',
                'Paste the radiologist\'s findings or describe what you see',
                'AI returns structured impression, findings, differentials, and follow-up',
              ]} />
            </>
          )}

          {activeTab === 'pathology' && (
            <>
              <SidebarHeader icon={Microscope} color="violet" title="Pathology AI Guide" subtitle="Histopathology and cytopathology analysis." />
              <HowToUse steps={[
                'Select stain type and provide clinical history',
                'Describe the specimen gross and microscopic findings',
                'AI returns diagnosis, markers, grading, and next-step recommendations',
              ]} />
            </>
          )}

          {activeTab === 'scribe' && (
            <>
              <SidebarHeader icon={FileText} color="amber" title="AI Scribe Guide" subtitle="Auto-generate clinical notes from consultation transcripts." />
              <HowToUse steps={[
                'Paste consultation dialogue (Doctor: ... / Patient: ...)',
                'AI generates a structured clinical summary and next steps',
                'Use "Copy to clipboard" to paste into the patient record',
              ]} />
            </>
          )}

          <div className="text-[10px] text-slate font-bold uppercase tracking-widest leading-loose p-4 bg-content-surface rounded-2xl border border-content-border">
            <Info className="w-4 h-4 text-portal-primary mb-2" />
            Review all AI outputs with clinical judgment before acting. This screen supports decisions and does not replace clinician assessment.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sidebar sub-components ──────────────────────────────────────────────── */

const BG_MAP: Record<string, string> = {
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
  blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.1)]',
  violet:  'bg-violet-500/10 border-violet-500/20 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.1)]',
  amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
};

function SidebarHeader({ icon: Icon, color, title, subtitle }: {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className={cn('w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0', BG_MAP[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-ink uppercase tracking-tight">{title}</h2>
        <p className="text-[11px] text-slate font-medium leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
}

function HowToUse({ steps }: { steps: string[] }) {
  return (
    <div className="rounded-2xl border border-content-border bg-content-surface px-5 py-4 space-y-3">
      <div className="text-[10px] font-black text-slate uppercase tracking-widest">How to use</div>
      <ul className="text-xs text-slate list-disc pl-5 space-y-2 font-medium">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}
