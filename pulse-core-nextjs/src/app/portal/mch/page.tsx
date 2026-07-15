'use client';

import { useMemo, useState } from 'react';
import {
  LayoutDashboard, Users, Heart, Baby, Calendar, ShieldCheck,
  Search, RefreshCw, ChevronRight, Activity, Sparkles, AlertTriangle, CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/shared/ErrorBoundary';

interface AncPatient {
  id: string;
  name: string;
  age: number;
  weeksGestation: number;
  riskStatus: 'normal' | 'moderate' | 'high';
  bp: string;
  weight: number;
  nextVisit: string;
}

interface ImmunizationPatient {
  id: string;
  babyName: string;
  parentName: string;
  ageWeeks: number;
  vaccineDue: string;
  status: 'due' | 'overdue' | 'completed';
  nextVisit: string;
}

interface GrowthPatient {
  id: string;
  babyName: string;
  ageMonths: number;
  weightKg: number;
  heightCm: number;
  percentile: number;
  status: 'normal' | 'underweight' | 'overweight' | 'needs-review';
}

const ANC_DATA: AncPatient[] = [
  { id: '1', name: 'Mary Atieno', age: 26, weeksGestation: 24, riskStatus: 'normal', bp: '118/76', weight: 68.5, nextVisit: '2026-07-02' },
  { id: '2', name: 'Faith Mutua', age: 31, weeksGestation: 32, riskStatus: 'high', bp: '142/92', weight: 74.2, nextVisit: '2026-06-25' },
  { id: '3', name: 'Amina Omondi', age: 22, weeksGestation: 12, riskStatus: 'normal', bp: '110/70', weight: 59.0, nextVisit: '2026-07-15' },
  { id: '4', name: 'Phyllis Wambui', age: 29, weeksGestation: 28, riskStatus: 'moderate', bp: '130/84', weight: 71.0, nextVisit: '2026-07-08' },
];

const IMMUNIZATION_DATA: ImmunizationPatient[] = [
  { id: '1', babyName: 'Liam Kipchoge', parentName: 'Sarah Kipchoge', ageWeeks: 10, vaccineDue: 'Pentavalent II, Rotavirus II', status: 'due', nextVisit: '2026-06-22' },
  { id: '2', babyName: 'Chloe Cherono', parentName: 'Emily Cherono', ageWeeks: 14, vaccineDue: 'Pentavalent III, IPV', status: 'completed', nextVisit: '2026-08-10' },
  { id: '3', babyName: 'Jabari Onyango', parentName: 'Alice Onyango', ageWeeks: 6, vaccineDue: 'BCG, OPV 0 (Catch-up)', status: 'overdue', nextVisit: '2026-06-15' },
  { id: '4', babyName: 'Zola Wanjiku', parentName: 'Jane Wanjiku', ageWeeks: 36, vaccineDue: 'Measles-Rubella I', status: 'due', nextVisit: '2026-06-28' },
];

const GROWTH_DATA: GrowthPatient[] = [
  { id: '1', babyName: 'Liam Kipchoge', ageMonths: 2.5, weightKg: 5.8, heightCm: 58, percentile: 65, status: 'normal' },
  { id: '2', babyName: 'Chloe Cherono', ageMonths: 3.5, weightKg: 6.2, heightCm: 61, percentile: 48, status: 'normal' },
  { id: '3', babyName: 'Jabari Onyango', ageMonths: 1.5, weightKg: 3.9, heightCm: 52, percentile: 12, status: 'needs-review' },
  { id: '4', babyName: 'Zola Wanjiku', ageMonths: 9.0, weightKg: 8.9, heightCm: 72, percentile: 55, status: 'normal' },
];

export default function MchDashboard(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'anc' | 'immunization' | 'growth'>('anc');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('en-KE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }).format(new Date()),
    [],
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  // Filtered Lists
  const filteredAnc = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return ANC_DATA.filter(p => p.name.toLowerCase().includes(query) || p.riskStatus.toLowerCase().includes(query));
  }, [searchQuery]);

  const filteredImm = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return IMMUNIZATION_DATA.filter(p => p.babyName.toLowerCase().includes(query) || p.vaccineDue.toLowerCase().includes(query));
  }, [searchQuery]);

  const filteredGrowth = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return GROWTH_DATA.filter(p => p.babyName.toLowerCase().includes(query) || p.status.toLowerCase().includes(query));
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      {/* Command Center Banner */}
      <div className="relative overflow-hidden rounded-[2rem] border border-blue-500/20 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.15),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card md:p-6">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
              <Baby className="h-3.5 w-3.5" />
              MCH CLINICAL MODULE
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-5xl">
              Maternal & Child Health Command
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                {today}
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-slate/40 sm:inline-block" />
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" />
                ANC registries & immunization sync complete
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            {[
              { label: 'ANC Mothers', value: ANC_DATA.length, icon: <Heart className="h-4 w-4" /> },
              { label: 'Active Infants', value: IMMUNIZATION_DATA.length, icon: <Baby className="h-4 w-4" /> },
              { label: 'Needs Review', value: 1, icon: <AlertTriangle className="h-4 w-4" /> },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-content-border bg-content-bg p-3 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  {item.icon}
                </div>
                <p className="text-2xl font-semibold text-ink">{item.value}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns - Registries */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab Bar & Search */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1.5 p-1 rounded-full border border-content-border bg-content-surface max-w-max">
              {[
                { id: 'anc', label: 'ANC Registry', icon: <Heart className="w-3.5 h-3.5" /> },
                { id: 'immunization', label: 'Immunization', icon: <Baby className="w-3.5 h-3.5" /> },
                { id: 'growth', label: 'Growth Monitoring', icon: <Activity className="w-3.5 h-3.5" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setSearchQuery(''); }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition-all",
                    activeTab === tab.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate hover:bg-content-border/60 hover:text-ink"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-content-border bg-content-bg px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate transition-colors hover:bg-content-border hover:text-ink h-9"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
                Refresh
              </button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search patient, ID..."
                  className="w-full rounded-full border border-content-border bg-content-bg py-2 pl-10 pr-4 text-sm text-ink outline-none transition-all focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/15 sm:w-60 h-9"
                />
              </div>
            </div>
          </div>

          {/* Registry Table */}
          <div className="overflow-hidden rounded-[1.75rem] border border-content-border bg-content-bg shadow-card">
            <div className="overflow-x-auto">
              {activeTab === 'anc' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-content-border bg-content-surface/80">
                      {['Patient Name', 'Gestation (Weeks)', 'Vitals', 'Risk Factor', 'Next Visit', 'Action'].map((h) => (
                        <th key={h} className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-content-border/70">
                    {filteredAnc.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate">No ANC patients found.</td>
                      </tr>
                    ) : (
                      filteredAnc.map((p) => (
                        <tr key={p.id} className="group hover:bg-content-surface/50 transition-colors">
                          <td className="px-4 py-3.5 font-semibold text-ink group-hover:text-blue-600 transition-colors">
                            <div className="flex flex-col">
                              <span>{p.name}</span>
                              <span className="text-[11px] text-slate font-normal">{p.age} years</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-charcoal">{p.weeksGestation} weeks</span>
                            <span className="text-[11px] text-slate block">Trimester {p.weeksGestation < 13 ? 1 : p.weeksGestation < 27 ? 2 : 3}</span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-charcoal">
                            <div>BP: <strong className="text-ink">{p.bp}</strong></div>
                            <div>Weight: <strong className="text-ink">{p.weight} kg</strong></div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                              p.riskStatus === 'high' ? "bg-red-100 text-red-700" :
                              p.riskStatus === 'moderate' ? "bg-amber-100 text-amber-700" :
                              "bg-emerald-100 text-emerald-700"
                            )}>
                              {p.riskStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate">{p.nextVisit}</td>
                          <td className="px-4 py-3.5">
                            <button className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-blue-700 transition-all">
                              Record Visit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'immunization' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-content-border bg-content-surface/80">
                      {['Infant Name', 'Age (Weeks)', 'Vaccines Due', 'Status', 'Next Due', 'Action'].map((h) => (
                        <th key={h} className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-content-border/70">
                    {filteredImm.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate">No infants found.</td>
                      </tr>
                    ) : (
                      filteredImm.map((p) => (
                        <tr key={p.id} className="group hover:bg-content-surface/50 transition-colors">
                          <td className="px-4 py-3.5 font-semibold text-ink group-hover:text-blue-600 transition-colors">
                            <div className="flex flex-col">
                              <span>{p.babyName}</span>
                              <span className="text-[11px] text-slate font-normal">Parent: {p.parentName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-charcoal">{p.ageWeeks} weeks</td>
                          <td className="px-4 py-3.5 text-xs text-charcoal max-w-[180px] truncate" title={p.vaccineDue}>
                            {p.vaccineDue}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                              p.status === 'overdue' ? "bg-red-100 text-red-700" :
                              p.status === 'due' ? "bg-amber-100 text-amber-700" :
                              "bg-emerald-100 text-emerald-700"
                            )}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate">{p.nextVisit}</td>
                          <td className="px-4 py-3.5">
                            <button className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-blue-700 transition-all">
                              Log Dose
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'growth' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-content-border bg-content-surface/80">
                      {['Infant Name', 'Age (Months)', 'Weight & Height', 'Percentile', 'Status', 'Action'].map((h) => (
                        <th key={h} className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-content-border/70">
                    {filteredGrowth.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate">No growth records found.</td>
                      </tr>
                    ) : (
                      filteredGrowth.map((p) => (
                        <tr key={p.id} className="group hover:bg-content-surface/50 transition-colors">
                          <td className="px-4 py-3.5 font-semibold text-ink group-hover:text-blue-600 transition-colors">
                            {p.babyName}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-charcoal">{p.ageMonths} months</td>
                          <td className="px-4 py-3.5 text-xs text-charcoal">
                            <div>Weight: <strong className="text-ink">{p.weightKg} kg</strong></div>
                            <div>Height: <strong className="text-ink">{p.heightCm} cm</strong></div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-ink">{p.percentile}th</span>
                              <div className="w-16 h-1.5 bg-content-border rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600" style={{ width: `${p.percentile}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                              p.status === 'needs-review' ? "bg-red-100 text-red-700" :
                              p.status === 'underweight' ? "bg-amber-100 text-amber-700" :
                              "bg-emerald-100 text-emerald-700"
                            )}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <button className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-blue-700 transition-all">
                              Record Growth
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Columns - Sidebars & Pilot */}
        <div className="space-y-6">
          {/* MedGemma AI MCH Assistant */}
          <div className="rounded-[1.75rem] p-5 border border-blue-500/25 bg-blue-500/5 shadow-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block">MedGemma Pilot</span>
                <span className="text-[10px] text-slate font-medium block">Maternal & Child Health Assistant</span>
              </div>
            </div>
            <p className="text-sm text-charcoal leading-relaxed">
              We identified that infant <strong>Jabari Onyango</strong> is currently 6 weeks old but has missed the critical <strong>BCG & OPV 0</strong> catch-up schedule.
            </p>
            <div className="pt-2 flex flex-col gap-2.5">
              <button className="w-full py-2.5 bg-blue-600 text-white text-xs font-semibold uppercase tracking-wide rounded-full hover:bg-blue-700 transition-colors">
                Generate Catch-Up Schedule
              </button>
              <button className="w-full py-2.5 bg-content-bg border border-content-border text-charcoal text-[11px] font-semibold uppercase tracking-wide rounded-full hover:bg-content-surface transition-colors">
                Contact Mother via SMS
              </button>
            </div>
          </div>

          {/* Quick Registry Addition Info */}
          <div className="rounded-[1.75rem] p-5 border border-content-border bg-content-bg shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-charcoal uppercase tracking-wider flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success" /> MCH Registry Guidelines
            </h3>
            <p className="text-xs text-slate leading-relaxed">
              All ANC visits, vaccines, and child growth plots must sync to the national registries. The AfyaHero HOS auto-serializes MCH documentation into HL7 FHIR resources for compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
