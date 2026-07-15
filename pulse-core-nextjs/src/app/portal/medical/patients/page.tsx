'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search, BrainCircuit, Plus, ChevronRight,
  Activity, Pill, FileText, ClipboardList, Syringe, FlaskConical,
  Video, Mic,
} from 'lucide-react';
import Teleconsultation from '@/components/medical/Teleconsultation';
import AfyaScribePanel from '@/components/medical/AfyaScribePanel';
import AIDiagnosticAssistant from '@/components/medical/AIDiagnosticAssistant';
import { cn } from '@/lib/utils';
import { PatientDetailPanel, type PatientDetail } from '@/components/portal/PatientDetailPanel';
import { SOAPEditor } from '@/components/portal/SOAPEditor';
import PatientRegistrationForm from '@/components/portal/PatientRegistrationForm';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import { readDataSourceUnavailablePayload } from '@/lib/degraded-mode';

interface PatientSummary {
  id: string;
  pid: string;
  name: string;
  age: number;
  sex: 'M' | 'F';
  bloodGroup: string;
  allergies: string[];
  complaint: string;
  status: string;
}

interface Medication {
  drug: string;
  dose: string;
  freq: string;
  duration: string;
}

interface Problem {
  name: string;
  since: string;
  status: 'Active' | 'Resolved' | 'Chronic';
}

interface SOAPNote {
  date: string;
  author: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface Order {
  id: string;
  type: string;
  test: string;
  ordered: string;
  status: 'Pending' | 'Processing' | 'Completed';
}

interface FhirSummaryPayload {
  patient?: { id?: string };
  observations?: Array<{ code?: { text?: string }; valueQuantity?: { value?: number; unit?: string } }>;
  medicationRequests?: Array<{ medicationCodeableConcept?: { text?: string } }>;
}

interface VitalTile {
  label: 'BP' | 'Pulse' | 'Temp' | 'SpO2' | 'RR';
  value: string;
  unit: string;
  color: string;
}

const patients: PatientSummary[] = [
  { id: '1', pid: 'PID-11234', name: 'Hassan Ali', age: 52, sex: 'M', bloodGroup: 'A+', allergies: ['Penicillin', 'Sulfa'], complaint: 'Chest pain, SOB', status: 'In Consult' },
  { id: '2', pid: 'PID-11235', name: 'Fatuma Wanjiru', age: 34, sex: 'F', bloodGroup: 'O+', allergies: ['NSAIDs'], complaint: 'Severe anaemia, fatigue', status: 'Admitted' },
  { id: '3', pid: 'PID-11236', name: 'Peter Kamau', age: 45, sex: 'M', bloodGroup: 'B+', allergies: [], complaint: 'Persistent cough, 3 weeks', status: 'Waiting' },
  { id: '4', pid: 'PID-11237', name: 'Grace Abuya', age: 28, sex: 'F', bloodGroup: 'AB+', allergies: ['Codeine'], complaint: 'Antenatal visit, G2P1', status: 'Done' },
  { id: '5', pid: 'PID-11238', name: 'Wanjiru Njeri', age: 62, sex: 'F', bloodGroup: 'O-', allergies: ['Latex'], complaint: 'DM follow-up, HTN', status: 'Waiting' },
  { id: '6', pid: 'PID-11239', name: 'Joseph Odhiambo', age: 19, sex: 'M', bloodGroup: 'A-', allergies: [], complaint: 'Malaria symptoms, fever', status: 'Waiting' },
];

const medicationsByPatient: Record<string, Medication[]> = {
  '1': [
    { drug: 'Aspirin', dose: '75mg', freq: 'Once daily', duration: 'Ongoing' },
    { drug: 'Atorvastatin', dose: '40mg', freq: 'Once nightly', duration: 'Ongoing' },
    { drug: 'Metoprolol', dose: '25mg', freq: 'Twice daily', duration: '30 days' },
  ],
  '2': [
    { drug: 'Ferrous Sulphate', dose: '200mg', freq: 'Twice daily', duration: '60 days' },
    { drug: 'Folic Acid', dose: '5mg', freq: 'Once daily', duration: '30 days' },
  ],
  '3': [
    { drug: 'Amoxicillin', dose: '500mg', freq: 'Three times daily', duration: '7 days' },
  ],
  '4': [{ drug: 'Folic Acid', dose: '5mg', freq: 'Once daily', duration: 'Until delivery' }],
  '5': [
    { drug: 'Metformin', dose: '500mg', freq: 'Twice daily', duration: 'Ongoing' },
    { drug: 'Amlodipine', dose: '5mg', freq: 'Once daily', duration: 'Ongoing' },
  ],
  '6': [{ drug: 'Artemether/Lumefantrine', dose: '80/480mg', freq: 'Twice daily', duration: '3 days' }],
};

const problemsByPatient: Record<string, Problem[]> = {
  '1': [
    { name: 'Hypertensive heart disease', since: '2019', status: 'Chronic' },
    { name: 'Hyperkalaemia (K+ 6.8)', since: 'Today', status: 'Active' },
  ],
  '2': [
    { name: 'Iron deficiency anaemia', since: '2024', status: 'Active' },
    { name: 'G2P1 pregnancy, 28 weeks', since: '2024', status: 'Active' },
  ],
  '3': [{ name: 'Community-acquired pneumonia', since: '3 weeks ago', status: 'Active' }],
  '4': [{ name: 'Normal pregnancy, 28 weeks', since: '2024', status: 'Active' }],
  '5': [
    { name: 'Type 2 Diabetes Mellitus', since: '2015', status: 'Chronic' },
    { name: 'Essential hypertension', since: '2017', status: 'Chronic' },
  ],
  '6': [{ name: 'Plasmodium falciparum malaria', since: '2 days ago', status: 'Active' }],
};

const soapNotesByPatient: Record<string, SOAPNote[]> = {
  '1': [
    { date: '15 Jan 2025', author: 'Dr. Amina', subjective: 'Patient reports chest pain radiating to jaw, onset 2 hours ago. Diaphoresis noted. Pain score 7/10.', objective: 'BP 158/96, P 98, SpO₂ 94%. ECG: ST elevation V2-V4. K+ 6.8 mEq/L (critical).', assessment: 'Acute STEMI with concurrent hyperkalaemia. High risk.', plan: '1. Aspirin 300mg STAT\n2. Clopidogrel 600mg loading\n3. Urgent cardiology referral\n4. Calcium gluconate IV for K+ management\n5. Continuous monitoring' },
    { date: '10 Jan 2025', author: 'Dr. Amina', subjective: 'Routine follow-up for hypertension. No chest pain. Compliant with medications.', objective: 'BP 142/88, P 76, SpO₂ 98%. Fundi clear.', assessment: 'Hypertension, suboptimal control.', plan: 'Increase Metoprolol to 50mg BD. RV in 2 weeks.' },
  ],
  '2': [
    { date: '15 Jan 2025', author: 'Dr. Amina', subjective: 'Severe fatigue, pallor. Breathless on minimal exertion. Hb 5.2 g/dL.', objective: 'Pale conjunctivae, tachycardia 112bpm, BP 90/60. Fundal height 28cm.', assessment: 'Severe iron deficiency anaemia in pregnancy — transfusion threshold.', plan: '1. Admit for blood transfusion 2 units PRBC\n2. IV Iron sucrose 200mg\n3. Fetal monitoring\n4. Obstetrics consult' },
  ],
};

const ordersByPatient: Record<string, Order[]> = {
  '1': [
    { id: 'ORD-001', type: 'Lab', test: 'CBC + Differential', ordered: '07:35', status: 'Completed' },
    { id: 'ORD-002', type: 'Lab', test: 'Serum Electrolytes', ordered: '07:36', status: 'Completed' },
    { id: 'ORD-003', type: 'Imaging', test: 'ECG 12-lead', ordered: '07:40', status: 'Completed' },
    { id: 'ORD-004', type: 'Lab', test: 'Troponin I (serial)', ordered: '08:00', status: 'Processing' },
  ],
  '2': [
    { id: 'ORD-005', type: 'Lab', test: 'CBC + Iron studies', ordered: '08:10', status: 'Completed' },
    { id: 'ORD-006', type: 'Imaging', test: 'Obstetric USS', ordered: '08:15', status: 'Pending' },
  ],
  '3': [
    { id: 'ORD-007', type: 'Imaging', test: 'Chest X-Ray PA', ordered: '08:30', status: 'Completed' },
    { id: 'ORD-008', type: 'Lab', test: 'Sputum AFB ×3', ordered: '08:31', status: 'Pending' },
  ],
};

type TabType = 'Clinical' | 'AI Tools' | 'Connect' | 'History';
const TABS: TabType[] = ['Clinical', 'AI Tools', 'Connect', 'History'];

const statusBadge = (s: string): string => {
  switch (s) {
    case 'In Consult': return 'bg-success/5 text-success border border-success/20';
    case 'Admitted':   return 'bg-info/5 text-info border border-info/20';
    case 'Waiting':    return 'bg-warning/5 text-warning border border-warning/20';
    case 'Done':       return 'bg-slate-100 text-slate-600 border border-content-border';
    default:           return 'bg-slate-100 text-slate-600 border border-content-border';
  }
};

const problemStatusColor = (s: Problem['status']): string => {
  switch (s) {
    case 'Active':   return 'text-warning';
    case 'Chronic':  return 'text-danger';
    case 'Resolved': return 'text-success';
  }
};

export default function PatientsPage(): React.ReactElement {
  const [patientsList, setPatientsList] = useState<PatientSummary[]>(patients);
  const [search, setSearch] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>('1');
  const [activeTab, setActiveTab] = useState<TabType>('Clinical');
  const [aiDraftVisible, setAiDraftVisible] = useState<boolean>(false);
  const [soap, setSoap] = useState<{ s: string; o: string; a: string; p: string }>({ s: '', o: '', a: '', p: '' });
  const [soapNotesState, setSoapNotesState] = useState<Record<string, SOAPNote[]>>(soapNotesByPatient);
    const [panelOpen, setPanelOpen] = useState(false);
    const [registrationOpen, setRegistrationOpen] = useState(false);
    const [aiTriageContext, setAiTriageContext] = useState<{ symptoms: string; context: string } | null>(null);
  const [fhirSummary, setFhirSummary] = useState<FhirSummaryPayload | null>(null);
  const [communityFollowUpRequired, setCommunityFollowUpRequired] = useState(false);
  const [communityFollowUpReason, setCommunityFollowUpReason] = useState('');
  const [degradedNotice, setDegradedNotice] = useState<string | null>(null);
  
  useEffect(() => {
    const loadPatients = async () => {
      try {
        const response = await fetch('/api/data?entity=patients');
        if (!response.ok) {
          const degradedPayload = await readDataSourceUnavailablePayload(response);
          if (degradedPayload) {
            setDegradedNotice(
              'Live patient feed is temporarily unavailable. Showing local patient list.',
            );
          }
          return;
        }
        const rows = await response.json() as Array<{
          id: string;
          pid?: string;
          name?: string;
          age?: number;
          gender?: 'M' | 'F';
          blood_group?: string;
          allergies?: string[];
          complaint?: string;
          status?: string;
        }>;
        if (!Array.isArray(rows) || rows.length === 0) return;
        const normalized: PatientSummary[] = rows.map((row, index) => ({
          id: row.id,
          pid: row.pid ?? `PID-${10000 + index}`,
          name: row.name ?? 'Unknown Patient',
          age: row.age ?? 0,
          sex: row.gender ?? 'M',
          bloodGroup: row.blood_group ?? 'Unknown',
          allergies: Array.isArray(row.allergies) ? row.allergies : [],
          complaint: row.complaint ?? 'General consultation',
          status: row.status ?? 'Waiting',
        }));
        setPatientsList(normalized);
        setSelectedId((prev) => (normalized.some((p) => p.id === prev) ? prev : normalized[0].id));
        setDegradedNotice(null);
      } catch (error) {
        logger.warn('Falling back to local patient list', { error });
        setDegradedNotice('Unable to refresh live patient feed right now. Showing local patient list.');
      }
    };
    void loadPatients();
  }, []);

  useEffect(() => {
    const loadFhirSummary = async () => {
      if (!selectedId) return;
      try {
        const response = await fetch(`/api/medical/patients/${selectedId}/fhir-summary`);
        if (!response.ok) {
          setFhirSummary(null);
          return;
        }
        const payload = await response.json() as FhirSummaryPayload;
        setFhirSummary(payload);
      } catch {
        setFhirSummary(null);
      }
    };
    void loadFhirSummary();
  }, [selectedId]);

    const filtered = patientsList.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.pid.toLowerCase().includes(search.toLowerCase())
  );

  const selected = patientsList.find((p) => p.id === selectedId) ?? patientsList[0];
  const problems = problemsByPatient[selected.id] ?? [];
    const notes = soapNotesState[selected.id] ?? [];
    const orders = ordersByPatient[selected.id] ?? [];

  const fhirMedicationNames = useMemo(
    () =>
      (fhirSummary?.medicationRequests ?? [])
        .map((med) => med.medicationCodeableConcept?.text?.trim())
        .filter((value): value is string => Boolean(value)),
    [fhirSummary],
  );

  const overviewMedications = useMemo(
    () => {
      const meds = medicationsByPatient[selected.id] ?? [];
      return fhirMedicationNames.length > 0
        ? fhirMedicationNames.map((name) => ({
            drug: name,
            dose: 'FHIR',
            freq: 'As documented',
            duration: 'Active',
          }))
        : meds;
    },
    [fhirMedicationNames, selected.id],
  );

  const overviewVitals = useMemo<VitalTile[]>(() => {
    const fallback: VitalTile[] = [
      { label: 'BP', value: '158/96', unit: 'mmHg', color: 'text-danger' },
      { label: 'Pulse', value: '98', unit: 'bpm', color: 'text-warning' },
      { label: 'Temp', value: '37.4', unit: '°C', color: 'text-ink' },
      { label: 'SpO2', value: '94', unit: '%', color: 'text-warning' },
      { label: 'RR', value: '20', unit: '/min', color: 'text-ink' },
    ];

    const observations = fhirSummary?.observations ?? [];
    if (observations.length === 0) return fallback;

    const findByCode = (codeText: string): number | undefined =>
      observations.find((obs) => obs.code?.text === codeText)?.valueQuantity?.value;

    const systolic = findByCode('Systolic Blood Pressure');
    const diastolic = findByCode('Diastolic Blood Pressure');
    const pulse = findByCode('Heart Rate');
    const temp = findByCode('Body Temperature');
    const spo2 = findByCode('Oxygen Saturation');
    const rr = findByCode('Respiratory Rate');

    return [
      { label: 'BP', value: systolic && diastolic ? `${systolic}/${diastolic}` : fallback[0].value, unit: 'mmHg', color: 'text-danger' },
      { label: 'Pulse', value: pulse ? String(pulse) : fallback[1].value, unit: 'bpm', color: 'text-warning' },
      { label: 'Temp', value: temp ? String(temp) : fallback[2].value, unit: '°C', color: 'text-ink' },
      { label: 'SpO2', value: spo2 ? String(spo2) : fallback[3].value, unit: '%', color: 'text-warning' },
      { label: 'RR', value: rr ? String(rr) : fallback[4].value, unit: '/min', color: 'text-ink' },
    ];
  }, [fhirSummary]);

    const detailedPatient: PatientDetail = {
        id: selected.id,
        name: selected.name,
        patient_id: selected.pid,
        age: selected.age,
        gender: selected.sex === 'M' ? 'Male' : 'Female',
        phone: '',
        national_id: '',
        blood_type: selected.bloodGroup,
        insurance: '',
        SHIF_no: '',
        emergency_contact: '',
        emergency_phone: '',
        allergies: selected.allergies.map(a => ({ substance: a, severity: 'moderate' })),
        conditions: problems.map(p => p.name),
        vitals: {
            bp: overviewVitals[0]?.value ?? '158/96',
            pulse: Number(overviewVitals[1]?.value ?? 98),
            spo2: Number(overviewVitals[3]?.value ?? 94),
            temp: `${overviewVitals[2]?.value ?? '37.4'}${overviewVitals[2]?.unit ?? '°C'}`,
            rr: Number(overviewVitals[4]?.value ?? 20),
            weight: '72 kg'
        },
        medications: overviewMedications.map(m => ({
            name: m.drug,
            dosage: m.dose,
            frequency: m.freq,
            active: true
        })),
        recent_records: notes.map(n => ({
            id: Math.random().toString(),
            date: n.date,
            type: 'Consultation',
            doctor: n.author,
            summary: n.assessment
        }))
    };

    const handleAnalysisSync = (analysis: any) => {
        if (analysis.soapDraft) {
            setSoap(prev => ({
                ...prev,
                s: analysis.soapDraft.subjective || prev.s,
                o: analysis.soapDraft.objective || prev.o,
                a: analysis.soapDraft.assessment || prev.a,
                p: analysis.soapDraft.plan || prev.p,
            }));
            toast.success('AI Scribe synchronized clinical draft', {
                description: 'Real-time SOAP insights updated.',
                icon: '✨'
            });
        } else {
            setSoap(prev => ({
                ...prev,
                s: prev.s ? `${prev.s}\n\nAI Summary: ${analysis.summary}` : `AI Summary: ${analysis.summary}`,
                a: prev.a ? `${prev.a}\n\nDifferential: ${analysis.differentialDiagnosis.map((d: any) => typeof d === 'string' ? d : d.diagnosis).join(', ')}` : `Differential: ${analysis.differentialDiagnosis.map((d: any) => typeof d === 'string' ? d : d.diagnosis).join(', ')}`,
                p: prev.p ? `${prev.p}\n\nAI Actions: ${analysis.recommendedActions.join('\n')}` : `AI Actions: ${analysis.recommendedActions.join('\n')}`
            }));
            toast.success('AI insights imported to SOAP notes');
        }
    };

    const handleTriageDeepDive = (symptoms: string) => {
        setAiTriageContext({
            symptoms,
            context: `Triage Report Deep Dive: ${selected.name} (${selected.pid})`
        });
        setPanelOpen(false);
        setActiveTab('AI Tools');
    };

  const submitCommunityFollowUp = async (params: {
    patientRef: string;
    patientName: string;
    carePlan: string;
    followUpReason?: string;
  }) => {
    const upsertResponse = await fetch('/api/apps/chp/care-plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        patientRef: params.patientRef,
        patientName: params.patientName,
        carePlan: params.carePlan,
        communityFollowUpRequired: true,
        followUpReason: params.followUpReason,
        source: 'medical-portal.soap',
      }),
    });

    if (!upsertResponse.ok) {
      throw new Error(`CHP care plan upsert failed (${upsertResponse.status})`);
    }

    const confirmationResponse = await fetch(
      `/api/apps/chp/care-plans?patientRef=${encodeURIComponent(params.patientRef)}`,
    );
    if (!confirmationResponse.ok) {
      throw new Error(`CHP care plan confirmation failed (${confirmationResponse.status})`);
    }

    const confirmation = await confirmationResponse.json() as {
      found?: boolean;
      carePlanId?: string;
    };

    if (!confirmation.found || !confirmation.carePlanId) {
      throw new Error('CHP care plan confirmation returned no active record.');
    }

    toast.success('Community follow-up sent to CHP app', {
      description: `Care plan ID: ${confirmation.carePlanId}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Patient Workspace</h1>
        <button 
          onClick={() => setRegistrationOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-control bg-portal-primary hover:bg-portal-primary-hover text-white text-sm font-medium transition-colors w-fit shadow-lg shadow-portal-primary/10"
        >
          <Plus className="w-4 h-4" /> New Patient
        </button>
      </div>

      {degradedNotice && (
        <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-2.5 text-sm text-warning">
          {degradedNotice}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search patients by name, PID, phone..."
          aria-label="Search patients by name, PID, or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-content-bg border border-content-border text-ink placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Patient List */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedId(p.id); setActiveTab('Clinical'); setAiDraftVisible(false); }}
              className={cn(
                'w-full text-left rounded-card border p-4 transition-all',
                selectedId === p.id
                  ? 'bg-portal-primary-light/20 border-portal-primary/20 shadow-card'
                  : 'bg-content-bg border-content-border hover:border-content-border hover:shadow-card'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.pid} · {p.age}y {p.sex}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate max-w-[180px]">{p.complaint}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', statusBadge(p.status))}>{p.status}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Patient Detail */}
        <div className="lg:col-span-2 rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
          {/* Patient Header */}
          <div className="px-5 py-4 border-b border-content-border">
            <div className="flex flex-wrap items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success font-bold text-sm shrink-0">
                {selected.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-ink">{selected.name}</h2>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', statusBadge(selected.status))}>{selected.status}</span>
                </div>
                <p className="text-xs text-slate-500">{selected.pid} · {selected.age}y {selected.sex} · {selected.bloodGroup}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {selected.allergies.length > 0
                  ? selected.allergies.map((a) => (
                      <span key={a} className="text-xs px-2 py-0.5 rounded bg-danger/10 text-danger border border-danger/20">
                        ⚠ {a}
                      </span>
                    ))
                  : <span className="text-xs text-success font-medium">NKDA</span>
                }
                <button
                  onClick={() => setPanelOpen(true)}
                  className="ml-2 text-[10px] font-bold uppercase tracking-widest text-portal-primary hover:text-portal-primary-hover flex items-center gap-1 border border-portal-primary/20 px-2 py-1 rounded-lg bg-portal-primary-light/10 transition-all shadow-card"
                >
                  <Activity className="w-3 h-3" /> Deep Dive
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-content-border overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-label={`${tab} tab`}
                aria-pressed={activeTab === tab}
                className={cn(
                  'px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                  activeTab === tab
                    ? 'text-portal-primary border-b-2 border-portal-primary'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-5">
            {activeTab === 'Clinical' && (
              <div className="space-y-5">
                {/* Vitals */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" /> Vitals
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {overviewVitals.map((v) => (
                      <div key={v.label} className="rounded-lg bg-content-bg border border-content-border p-3 text-center shadow-card">
                        <p className="text-xs text-slate-500">{v.label}</p>
                        <p className={cn('text-lg font-bold mt-1', v.color)}>{v.value}</p>
                        <p className="text-xs text-slate-500">{v.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Current Medications */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Pill className="w-3.5 h-3.5" /> Current Medications
                  </h3>
                  {overviewMedications.length === 0
                    ? <p className="text-sm text-slate-500">No active medications</p>
                    : (
                      <div className="space-y-2">
                        {overviewMedications.map((m, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-content-bg border border-content-border px-4 py-2.5 shadow-card">
                            <div>
                              <p className="text-sm font-medium text-ink">{m.drug}</p>
                              <p className="text-xs text-slate-500">{m.dose} · {m.freq}</p>
                            </div>
                            <span className="text-xs text-slate-500">{m.duration}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>

                {/* Problem List */}
              <div>
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ClipboardList className="w-3.5 h-3.5" /> Problem List
                </h3>
                <div className="space-y-2">
                  {problems.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-content-bg border border-content-border px-4 py-2.5 shadow-card">
                      <p className="text-sm text-ink">{p.name}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">Since {p.since}</span>
                        <span className={cn('text-xs font-medium', problemStatusColor(p.status))}>{p.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <hr className="border-content-border" />

              {/* SOAP Notes */}
              <div>
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> SOAP Notes
                </h3>
                <div className="space-y-3">
                  {notes.map((note, i) => (
                    <div key={i} className="rounded-lg bg-content-bg border border-content-border p-4 shadow-card">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-portal-primary">{note.date}</span>
                        <span className="text-xs text-slate-500">{note.author}</span>
                      </div>
                      {[
                        { label: 'S', content: note.subjective },
                        { label: 'O', content: note.objective },
                        { label: 'A', content: note.assessment },
                        { label: 'P', content: note.plan },
                      ].map((s) => (
                        <div key={s.label} className="flex gap-2 mb-2 last:mb-0">
                          <span className="text-xs font-bold text-portal-primary w-4 shrink-0">{s.label}:</span>
                          <p className="text-xs text-slate-700 whitespace-pre-line">{s.content}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-content-border bg-content-surface p-4 mt-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={communityFollowUpRequired}
                      onChange={(event) => setCommunityFollowUpRequired(event.target.checked)}
                      className="h-4 w-4 rounded border-content-border"
                    />
                    Community follow-up required (send care plan to CHP app)
                  </label>
                  {communityFollowUpRequired && (
                    <textarea
                      value={communityFollowUpReason}
                      onChange={(event) => setCommunityFollowUpReason(event.target.value)}
                      className="mt-3 w-full rounded-md border border-content-border bg-content-bg px-3 py-2 text-sm text-ink"
                      rows={3}
                      placeholder="Follow-up reason for CHP team (optional)"
                    />
                  )}
                </div>

                <SOAPEditor 
                  patientName={selected.name}
                  initialData={{
                    subjective: soap.s,
                    objective: soap.o,
                    assessment: soap.a,
                    plan: soap.p,
                  }}
                  onSave={async (data) => {
                    try {
                      const res = await fetch('/api/medical/encounters/notes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ patient_id: selected.id, ...data }),
                      });
                      if (!res.ok) throw new Error('Failed to save note');
                      toast.success('SOAP note saved');
                    } catch {
                      toast.error('Could not persist SOAP note. Please retry.');
                    }
                  }}
                />
              </div>

              {/* Divider */}
              <hr className="border-content-border" />

              {/* Orders */}
              <div>
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ClipboardList className="w-3.5 h-3.5" /> Orders
                </h3>
                <div className="flex gap-2 flex-wrap mb-3">
                  {[
                    { icon: <FlaskConical className="w-3.5 h-3.5" />, label: '+ Lab' },
                    { icon: <FileText className="w-3.5 h-3.5" />, label: '+ Imaging' },
                    { icon: <Syringe className="w-3.5 h-3.5" />, label: '+ Referral' },
                  ].map((b) => (
                    <button key={b.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-content-bg border border-content-border text-portal-primary text-xs hover:bg-content-surface transition-colors font-medium">
                      {b.icon} {b.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {orders.length === 0
                    ? <p className="text-sm text-slate-500">No orders for this patient</p>
                    : orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between rounded-lg bg-content-bg border border-content-border px-4 py-3 shadow-card">
                        <div>
                          <p className="text-sm font-medium text-ink">{o.test}</p>
                          <p className="text-xs text-slate-500">{o.type} · Ordered {o.ordered}</p>
                        </div>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', {
                          'bg-warning/5 text-warning': o.status === 'Pending',
                          'bg-info/5 text-info': o.status === 'Processing',
                          'bg-success/5 text-success': o.status === 'Completed',
                        })}>
                          {o.status}
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Connect' && (
            <div className="h-[600px]">
              <Teleconsultation 
                roomId={`tele-${selected.id}`} 
                patientName={selected.name}
                patientContext={`PID: ${selected.pid}, Complaint: ${selected.complaint}`}
                onAnalysisSync={handleAnalysisSync}
              />
            </div>
          )}

            {activeTab === 'AI Tools' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Diagnostic Assistant</h3>
                  <div className="h-[500px]">
                    <AIDiagnosticAssistant 
                      initialSymptoms={aiTriageContext?.symptoms || selected.complaint}
                      activeContext={aiTriageContext?.context || `PID: ${selected.pid}, Age: ${selected.age}, Sex: ${selected.sex}, FHIRObservations: ${fhirSummary?.observations?.length ?? 0}, FHIRMeds: ${fhirSummary?.medicationRequests?.length ?? 0}`}
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">AI Scribe</h3>
                  <div className="h-[400px]">
                    <AfyaScribePanel 
                      consultationId={`scribe-${selected.id}`}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'History' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold">Previous Visits</p>
                {[
                  { date: '10 Jan 2025', type: 'OPD', doc: 'Dr. Amina', dx: 'Hypertension review' },
                  { date: '18 Dec 2024', type: 'OPD', doc: 'Dr. Mwangi', dx: 'Chest pain evaluation' },
                  { date: '05 Nov 2024', type: 'Emergency', doc: 'Dr. Kamau', dx: 'Hypertensive urgency' },
                ].map((v, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-content-bg border border-content-border px-4 py-3 shadow-card">
                    <div>
                      <p className="text-sm font-medium text-ink">{v.dx}</p>
                      <p className="text-xs text-slate-500">{v.doc} · {v.type}</p>
                    </div>
                    <span className="text-xs text-slate-500">{v.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <PatientDetailPanel 
        patient={detailedPatient}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onTriageDeepDive={handleTriageDeepDive}
      />

      <PatientRegistrationForm 
        open={registrationOpen}
        onClose={() => setRegistrationOpen(false)}
        onSuccess={(patient) => {
          toast.success('Patient Registered Successfully', {
            description: `${patient.name} has been added to the registry.`,
            icon: '✅'
          });
        }}
      />
    </div>
  );
}
