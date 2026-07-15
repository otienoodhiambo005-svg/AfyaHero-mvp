'use client';

import { useState } from 'react';
import { Search, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddDrugModal } from './modals/AddDrugModal';

type DrugCategory = 'All' | 'Antibiotics' | 'Antihypertensives' | 'Antidiabetics' | 'Analgesics' | 'Antiparasitics' | 'Antiretrovirals' | 'Antituberculosals' | 'Cardiovascular' | 'Other';
type LifecycleState = 'Approved' | 'Restricted' | 'Deferred' | 'Discontinued';
type ProcurementPolicy = 'Contracted' | 'Local Purchase' | 'Donation' | 'KEMSA / Ministry';

interface Formulation {
  form: string;
  strength: string;
  route: string;
}

interface DrugEntry {
  id: string;
  brand: string;
  generic: string;
  drugClass: string;
  category: DrugCategory;
  formulations: Formulation[];
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
  price: number;
  adultDose: string;
  paedDose: string;
  contraindications: string[];
  interactions: string[];
  hasGeneric: boolean;
  genericSaving: number;
  lifecycle: LifecycleState;
  procurement: ProcurementPolicy;
}

interface InteractionResult {
  drug1: string;
  drug2: string;
  severity: 'None' | 'Minor' | 'Moderate' | 'Major';
  description: string;
  recommendation: string;
}

const drugs: DrugEntry[] = [
  {
    id: '1', brand: 'Augmentin', generic: 'Amoxicillin + Clavulanate', drugClass: 'Penicillin / β-lactamase inhibitor',
    category: 'Antibiotics', formulations: [{ form: 'Tablet', strength: '625mg', route: 'Oral' }, { form: 'Syrup', strength: '228.5mg/5mL', route: 'Oral' }],
    stockStatus: 'Low Stock', price: 1200, adultDose: '625mg every 8–12 hours × 7–14 days', paedDose: '25mg/kg/day in 2 doses × 5–7 days',
    contraindications: ['Penicillin allergy', 'Mononucleosis (rash risk)', 'Severe hepatic impairment'],
    interactions: ['Warfarin (↑INR)', 'Methotrexate (↑toxicity)', 'Probenecid (↑levels)'],
    hasGeneric: true, genericSaving: 400,
    lifecycle: 'Approved', procurement: 'Contracted',
  },
  {
    id: '2', brand: 'Coartem', generic: 'Artemether/Lumefantrine', drugClass: 'Artemisinin combination therapy',
    category: 'Antiparasitics', formulations: [{ form: 'Tablet', strength: '20/120mg', route: 'Oral' }, { form: 'Dispersible tablet', strength: '20/120mg', route: 'Oral' }],
    stockStatus: 'In Stock', price: 750, adultDose: '4 tabs at 0, 8, 24, 36, 48, 60h (body weight ≥35kg)', paedDose: '1–3 tabs per dose per weight band',
    contraindications: ['1st trimester pregnancy (relative)', 'QTc prolongation', 'Severe malaria (use IV artesunate)'],
    interactions: ['QTc-prolonging drugs', 'CYP3A4 inhibitors', 'Grapefruit juice'],
    hasGeneric: false, genericSaving: 0,
    lifecycle: 'Approved', procurement: 'KEMSA / Ministry',
  },
  {
    id: '2.1', brand: 'Artesun', generic: 'Artesunate', drugClass: 'Artemisinin derivative',
    category: 'Antiparasitics', formulations: [{ form: 'Powder for inj', strength: '60mg', route: 'IV/IM' }],
    stockStatus: 'In Stock', price: 1500, adultDose: '2.4mg/kg IV at 0, 12, 24h then daily', paedDose: '3.0mg/kg if <20kg',
    contraindications: ['Hypersensitivity to artemisinins'],
    interactions: ['Pyronaridine', 'Amodiaquine'],
    hasGeneric: false, genericSaving: 0,
    lifecycle: 'Approved', procurement: 'KEMSA / Ministry',
  },
  {
    id: '3', brand: 'Glucophage', generic: 'Metformin', drugClass: 'Biguanide antihyperglycaemic',
    category: 'Antidiabetics', formulations: [{ form: 'Tablet', strength: '500mg', route: 'Oral' }, { form: 'Tablet', strength: '1000mg', route: 'Oral' }],
    stockStatus: 'Out of Stock', price: 320, adultDose: '500–2000mg daily in divided doses with food', paedDose: '≥10 years: 500mg BD, max 2g/day',
    contraindications: ['eGFR <30 mL/min', 'Lactic acidosis risk (contrast)', 'Hepatic failure', 'Alcoholism'],
    interactions: ['Ciprofloxacin (↑hypoglycaemia risk)', 'Iodinated contrast (hold 48h)', 'Alcohol (lactic acidosis)'],
    hasGeneric: true, genericSaving: 120,
    lifecycle: 'Approved', procurement: 'Local Purchase',
  },
  {
    id: '4', brand: 'Norvasc', generic: 'Amlodipine', drugClass: 'Dihydropyridine calcium channel blocker',
    category: 'Antihypertensives', formulations: [{ form: 'Tablet', strength: '5mg', route: 'Oral' }, { form: 'Tablet', strength: '10mg', route: 'Oral' }],
    stockStatus: 'Low Stock', price: 450, adultDose: '5–10mg once daily. Titrate after 2 weeks.', paedDose: '6–17 years: 2.5–5mg once daily',
    contraindications: ['Cardiogenic shock', 'Unstable angina (relative)', 'Severe aortic stenosis'],
    interactions: ['Cyclosporin (↑levels)', 'Simvastatin >20mg (myopathy)', 'CYP3A4 inhibitors (azoles, macrolides)'],
    hasGeneric: true, genericSaving: 150,
    lifecycle: 'Restricted', procurement: 'Contracted',
  },
  {
    id: '5', brand: 'Brufen', generic: 'Ibuprofen', drugClass: 'Non-steroidal anti-inflammatory (NSAID)',
    category: 'Analgesics', formulations: [{ form: 'Tablet', strength: '400mg', route: 'Oral' }, { form: 'Syrup', strength: '100mg/5mL', route: 'Oral' }, { form: 'Gel', strength: '5%', route: 'Topical' }],
    stockStatus: 'In Stock', price: 280, adultDose: '400–800mg TDS–QID with food. Max 2.4g/day.', paedDose: '5–10mg/kg/dose TDS. Max 30mg/kg/day',
    contraindications: ['Active peptic ulcer', 'Renal impairment', 'Asthma (NSAID sensitivity)', 'Pregnancy 3rd trimester'],
    interactions: ['Warfarin (↑bleed)', 'ACE inhibitors (↓efficacy, ↑renal risk)', 'Methotrexate (↑toxicity)', 'Lithium'],
    hasGeneric: true, genericSaving: 80,
    lifecycle: 'Approved', procurement: 'Contracted',
  },
  {
    id: '6', brand: 'Zithromax', generic: 'Azithromycin', drugClass: 'Macrolide antibiotic',
    category: 'Antibiotics', formulations: [{ form: 'Tablet', strength: '500mg', route: 'Oral' }, { form: 'Syrup', strength: '200mg/5mL', route: 'Oral' }],
    stockStatus: 'In Stock', price: 890, adultDose: '500mg on day 1, then 250mg OD for 4 days', paedDose: '10mg/kg on day 1, then 5mg/kg for 4 days',
    contraindications: ['Macrolide allergy', 'QTc prolongation', 'Hepatic disease (caution)'],
    interactions: ['QTc-prolonging drugs', 'Warfarin (↑INR monitor)', 'Digoxin (↑levels)'],
    hasGeneric: true, genericSaving: 300,
    lifecycle: 'Approved', procurement: 'Donation',
  },
  {
    id: '7', brand: 'Lasix', generic: 'Furosemide', drugClass: 'Loop diuretic',
    category: 'Cardiovascular', formulations: [{ form: 'Tablet', strength: '40mg', route: 'Oral' }, { form: 'Injection', strength: '10mg/mL', route: 'IV/IM' }],
    stockStatus: 'In Stock', price: 180, adultDose: '20–80mg OD–BD. IV: 20–40mg over 2 min.', paedDose: '0.5–2mg/kg OD–BD. Max 6mg/kg/day',
    contraindications: ['Anuria', 'Severe hypokalaemia', 'Hepatic coma', 'Sulfonamide allergy'],
    interactions: ['Digoxin (↑toxicity via K+ loss)', 'NSAIDs (↓efficacy)', 'Aminoglycosides (↑ototoxicity)', 'Lithium'],
    hasGeneric: true, genericSaving: 60,
    lifecycle: 'Approved', procurement: 'Contracted',
  },
  {
    id: '8', brand: 'Panadol', generic: 'Paracetamol', drugClass: 'Non-opioid analgesic / antipyretic',
    category: 'Analgesics', formulations: [{ form: 'Tablet', strength: '500mg', route: 'Oral' }, { form: 'Syrup', strength: '120mg/5mL', route: 'Oral' }, { form: 'Suppository', strength: '125mg', route: 'Rectal' }],
    stockStatus: 'In Stock', price: 95, adultDose: '500mg–1g every 4–6h. Max 4g/day.', paedDose: '15mg/kg/dose every 4–6h. Max 60mg/kg/day.',
    contraindications: ['Active liver disease', 'Chronic alcohol use (relative)'],
    interactions: ['Warfarin (↑INR at high doses)', 'Alcohol (↑hepatotoxicity)', 'Anticonvulsants (↓levels)'],
    hasGeneric: false, genericSaving: 0,
    lifecycle: 'Approved', procurement: 'Contracted',
  },
  {
    id: '9', brand: 'Tivicay', generic: 'Dolutegravir', drugClass: 'Integrase Inhibitor (INSTI)',
    category: 'Antiretrovirals', formulations: [{ form: 'Tablet', strength: '50mg', route: 'Oral' }],
    stockStatus: 'In Stock', price: 0, adultDose: '50mg once daily (first-line ART in Kenya)', paedDose: 'Weight-based dosing per NASCOP guidelines',
    contraindications: ['Hypersensitivity', 'Severe hepatic impairment (caution)'],
    interactions: ['Metformin (↑levels)', 'Rifampicin (↑DTG dose to 50mg BD)', 'Mg/Al Antacids (separate by 6h)'],
    hasGeneric: false, genericSaving: 0,
    lifecycle: 'Approved', procurement: 'Donation',
  },
  {
    id: '10', brand: 'Rifadin', generic: 'Rifampicin', drugClass: 'Ansamycin Antibiotic',
    category: 'Antituberculosals', formulations: [{ form: 'Capsule', strength: '150mg', route: 'Oral' }, { form: 'Capsule', strength: '300mg', route: 'Oral' }],
    stockStatus: 'In Stock', price: 120, adultDose: '10mg/kg once daily, max 600mg daily (on empty stomach)', paedDose: '10–20mg/kg daily',
    contraindications: ['Jaundice', 'Porphyria', 'Hypersensitivity'],
    interactions: ['Dolutegravir (↓DTG levels)', 'Warfarin (↓INR)', 'Oral Contraceptives (↓efficacy)', 'Protease Inhibitors'],
    hasGeneric: true, genericSaving: 40,
    lifecycle: 'Approved', procurement: 'KEMSA / Ministry',
  },
];

const CATEGORIES: DrugCategory[] = ['All', 'Antibiotics', 'Antihypertensives', 'Antidiabetics', 'Analgesics', 'Antiparasitics', 'Antiretrovirals', 'Antituberculosals', 'Cardiovascular', 'Other'];

const lifecycleBadge = (l: LifecycleState): string => {
  switch (l) {
    case 'Approved':    return 'bg-success/5 text-success border-success/20';
    case 'Restricted':  return 'bg-danger/5 text-danger border-danger/20';
    case 'Deferred':    return 'bg-warning/5 text-warning border-warning/20';
    case 'Discontinued':return 'bg-slate-100 text-slate-500 border-content-border';
    default: return 'bg-slate-100 text-slate-500 border-content-border';
  }
};

const procurementBadge = (p: ProcurementPolicy): string => {
  switch (p) {
    case 'Contracted':    return 'bg-primary/5 text-primary border-primary/20';
    case 'Local Purchase':return 'bg-violet-50 text-violet-600 border-violet-100';
    case 'Donation':      return 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100';
    case 'KEMSA / Ministry': return 'bg-warning/5 text-warning border-warning/20';
    default: return 'bg-content-surface text-slate-600 border-content-border/50';
  }
};

const stockBadge = (s: DrugEntry['stockStatus']): string => {
  switch (s) {
    case 'In Stock':    return 'bg-success/5 text-success';
    case 'Low Stock':   return 'bg-warning/5 text-warning';
    case 'Out of Stock':return 'bg-danger/5 text-danger';
  }
};

const interactionSeverityStyles: Record<InteractionResult['severity'], string> = {
  None:     'bg-success/5 text-success border border-success/20',
  Minor:    'bg-primary/5 text-primary border border-primary/20',
  Moderate: 'bg-warning/5 text-warning border border-warning/20',
  Major:    'bg-danger/5 text-danger border border-danger/20',
};

const mockInteractionResult: InteractionResult = {
  drug1: 'Metformin 500mg', drug2: 'Ciprofloxacin 500mg',
  severity: 'Moderate',
  description: 'Fluoroquinolone antibiotics may potentiate the hypoglycaemic effect of metformin, resulting in significant blood glucose lowering. The mechanism involves inhibition of pancreatic β-cell ATP-sensitive potassium channels.',
  recommendation: 'Monitor blood glucose levels closely during and 48 hours after ciprofloxacin therapy. Educate patient on hypoglycaemia symptoms. Consider alternative antibiotic if available and clinically appropriate.',
};

export default function PharmacyFormularyPage(): React.ReactElement {
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<DrugCategory>('All');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drug1, setDrug1] = useState<string>('Metformin 500mg');
  const [drug2, setDrug2] = useState<string>('Ciprofloxacin 500mg');
  const [interactionResult, setInteractionResult] = useState<InteractionResult | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const toggleExpand = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = drugs.filter((d) => {
    const matchSearch = !search || d.brand.toLowerCase().includes(search.toLowerCase()) ||
      d.generic.toLowerCase().includes(search.toLowerCase()) ||
      d.drugClass.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || d.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6 rounded-3xl border border-content-border bg-content-surface p-4 shadow-card md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Drug Formulary</h1>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary">
            1,247 drugs
          </span>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-card bg-portal-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-portal-primary-hover motion-safe:hover:scale-[1.01] active:scale-[0.99]"
          >
            Propose New Drug
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by brand name, generic name, or drug class..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search formulary by brand, generic name, or drug class"
          className="w-full rounded-card border border-content-border bg-content-bg py-3 pl-12 pr-4 text-charcoal placeholder:text-slate focus:border-portal-primary/35 focus:outline-none focus:ring-2 focus:ring-portal-primary/15"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              category === cat
                ? 'bg-primary/5 text-primary border border-primary/20'
                : 'bg-content-bg text-slate-500 border border-content-border hover:border-content-border'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Drug List */}
      <div className="space-y-3">
        {filtered.map((drug) => (
          <div key={drug.id} className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
            {/* Drug Header */}
            <button
              className="w-full text-left px-5 py-4 flex flex-wrap items-start gap-3 hover:bg-content-surface transition-colors"
              onClick={() => toggleExpand(drug.id)}
            >
              <div className="flex-1 min-w-[180px]">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-base font-bold text-ink">{drug.brand}</span>
                  <span className="text-xs text-slate-500">({drug.generic})</span>
                  {drug.hasGeneric && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/5 text-primary border border-primary/20">
                      Generic available — save KES {drug.genericSaving}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{drug.drugClass}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {drug.formulations.map((f, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                      {f.form} {f.strength} ({f.route})
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('text-[10px] px-2 py-0.5 rounded border uppercase font-black tracking-widest', lifecycleBadge(drug.lifecycle))}>{drug.lifecycle}</span>
                <span className={cn('text-[10px] px-2 py-0.5 rounded border uppercase font-black tracking-widest', procurementBadge(drug.procurement))}>{drug.procurement}</span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full', stockBadge(drug.stockStatus))}>{drug.stockStatus}</span>
                <span className="text-sm font-black text-ink">KES {drug.price}</span>
                {expanded.has(drug.id)
                  ? <ChevronDown className="w-4 h-4 text-slate-400" />
                  : <ChevronRight className="w-4 h-4 text-slate-400" />
                }
              </div>
            </button>

            {/* Expanded Details */}
            {expanded.has(drug.id) && (
              <div className="border-t border-content-border p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Dosing</p>
                    <p className="text-xs text-slate-600"><span className="text-ink font-medium">Adult:</span> {drug.adultDose}</p>
                    <p className="text-xs text-slate-600 mt-1"><span className="text-ink font-medium">Paediatric:</span> {drug.paedDose}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Contraindications</p>
                    <div className="flex flex-wrap gap-1.5">
                      {drug.contraindications.map((c, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-danger/5 text-danger border border-red-200">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Key Interactions</p>
                  <div className="space-y-1.5">
                    {drug.interactions.map((inter, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
                        <span className="text-xs text-slate-600">{inter}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Drug Interaction Checker */}
      <div className="rounded-card bg-content-bg border border-content-border p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-primary" /> Drug Interaction Checker
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Drug 1</label>
            <input
              value={drug1}
              onChange={(e) => setDrug1(e.target.value)}
              placeholder="Search drug 1..."
              className="w-full px-3 py-2 rounded-lg bg-content-bg border border-content-border text-ink placeholder:text-slate-400 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Drug 2</label>
            <input
              value={drug2}
              onChange={(e) => setDrug2(e.target.value)}
              placeholder="Search drug 2..."
              className="w-full px-3 py-2 rounded-lg bg-content-bg border border-content-border text-ink placeholder:text-slate-400 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>
        <button
          onClick={() => setInteractionResult(mockInteractionResult)}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors mb-4"
        >
          Check Interaction
        </button>
        {interactionResult && (
          <div className="rounded-lg bg-content-surface border border-content-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', interactionSeverityStyles[interactionResult.severity])}>
                {interactionResult.severity} Interaction
              </span>
            </div>
            <p className="text-sm font-semibold text-ink mb-2">{interactionResult.drug1} ↔ {interactionResult.drug2}</p>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">{interactionResult.description}</p>
            <div className="rounded-lg bg-warning/5 border border-warning/20 p-3">
              <p className="text-xs font-medium text-warning">Recommendation</p>
              <p className="text-xs text-slate-600 mt-1">{interactionResult.recommendation}</p>
            </div>
          </div>
        )}
      </div>

      <AddDrugModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}
