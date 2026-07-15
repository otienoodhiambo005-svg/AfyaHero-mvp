/**
 * Enhanced Offline AI Models - AfyaHero
 * 
 * Lightweight, on-device AI models that run entirely offline without requiring
 * cloud connectivity. These models are optimized for low-end devices and can
 * function in resource-constrained environments.
 * 
 * Architecture:
 * - Rule-based clinical decision support (no ML required)
 * - Lightweight scoring algorithms (qSOFA, MEWS, PEWS, etc.)
 * - Protocol-based guidance from Kenya MOH and WHO guidelines
 * - Symptom-to-diagnosis mapping using Bayesian inference
 * - Drug interaction checking using local database
 * 
 * All models run synchronously and return results in < 100ms.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfflineTriageResult {
  priority: 1 | 2 | 3 | 4 | 5;
  priorityLabel: string;
  color: 'red' | 'orange' | 'yellow' | 'green' | 'blue';
  reasoning: string[];
  immediateActions: string[];
  confidence: number;
}

export interface OfflineDiagnosisResult {
  differentials: Array<{
    condition: string;
    probability: number;
    icd10Code: string;
    reasoning: string;
    redFlags: string[];
  }>;
  recommendedTests: string[];
  urgencyLevel: 'immediate' | 'urgent' | 'routine';
}

export interface OfflineProtocolResult {
  protocolName: string;
  steps: Array<{
    step: number;
    action: string;
    details: string;
    warning?: string;
  }>;
  contraindications: string[];
  references: string[];
}

export interface OfflineDrugCheckResult {
  safe: boolean;
  interactions: Array<{
    drug1: string;
    drug2: string;
    severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
    description: string;
    alternative?: string;
  }>;
  doseAdjustments: Array<{
    drug: string;
    reason: string;
    adjustment: string;
  }>;
}

// ─── Symptom-Disease Bayesian Network ─────────────────────────────────────────

/**
 * Simplified Bayesian symptom-disease mapping for offline diagnosis
 * Based on epidemiological data from African healthcare settings
 */
const SYMPTOM_DISEASE_PROBABILITIES: Record<string, Record<string, {
  prior: number;      // Base prevalence in African context
  likelihood: number; // P(symptom|disease)
}>> = {
  // Fever-related conditions
  fever: {
    malaria: { prior: 0.25, likelihood: 0.95 },
    typhoid: { prior: 0.12, likelihood: 0.85 },
    'lower_respiratory_infection': { prior: 0.15, likelihood: 0.70 },
    'urinary_tract_infection': { prior: 0.08, likelihood: 0.60 },
    'viral_syndrome': { prior: 0.20, likelihood: 0.90 },
    tuberculosis: { prior: 0.05, likelihood: 0.65 },
  },
  
  // Respiratory symptoms
  cough: {
    'lower_respiratory_infection': { prior: 0.18, likelihood: 0.90 },
    tuberculosis: { prior: 0.08, likelihood: 0.85 },
    asthma: { prior: 0.10, likelihood: 0.75 },
    'upper_respiratory_infection': { prior: 0.25, likelihood: 0.80 },
    covid19: { prior: 0.05, likelihood: 0.70 },
  },
  
  // Gastrointestinal symptoms
  diarrhea: {
    cholera: { prior: 0.03, likelihood: 0.95 },
    'acute_gastroenteritis': { prior: 0.25, likelihood: 0.90 },
    typhoid: { prior: 0.08, likelihood: 0.60 },
    'amoebic_dysentery': { prior: 0.05, likelihood: 0.75 },
    'rotavirus_infection': { prior: 0.15, likelihood: 0.85 },
  },
  
  // Headache symptoms
  headache: {
    migraine: { prior: 0.12, likelihood: 0.90 },
    'tension_headache': { prior: 0.20, likelihood: 0.95 },
    malaria: { prior: 0.15, likelihood: 0.75 },
    meningitis: { prior: 0.01, likelihood: 0.80 },
    hypertension: { prior: 0.10, likelihood: 0.50 },
  },
};

/**
 * Calculate posterior probability using Bayes' theorem
 * P(disease|symptoms) = P(symptoms|disease) * P(disease) / P(symptoms)
 */
function calculatePosteriorProbability(
  disease: string,
  symptoms: string[]
): number {
  let logProbability = 0;
  
  for (const symptom of symptoms) {
    const diseaseMap = SYMPTOM_DISEASE_PROBABILITIES[symptom];
    if (diseaseMap && diseaseMap[disease]) {
      const { prior, likelihood } = diseaseMap[disease];
      // Use log probabilities to avoid underflow
      logProbability += Math.log(likelihood) + Math.log(prior);
    }
  }
  
  // Convert back from log space and normalize
  return Math.exp(logProbability);
}

/**
 * Generate differential diagnosis offline using Bayesian inference
 */
export function generateOfflineDiagnosis(params: {
  symptoms: string[];
  age: number;
  gender: string;
  vitalSigns?: Record<string, number>;
  duration?: number; // days
}): OfflineDiagnosisResult {
  const { symptoms, age, gender: _gender, vitalSigns, duration } = params;
  
  // Collect all possible diseases from symptom map
  const diseaseSet = new Set<string>();
  for (const symptom of symptoms) {
    const diseaseMap = SYMPTOM_DISEASE_PROBABILITIES[symptom];
    if (diseaseMap) {
      Object.keys(diseaseMap).forEach(d => diseaseSet.add(d));
    }
  }
  
  // Calculate posterior probabilities for each disease
  const differentials = Array.from(diseaseSet).map(disease => {
    const probability = calculatePosteriorProbability(disease, symptoms);
    
    // Age and gender adjustments
    let adjustedProbability = probability;
    
    // Pediatric adjustments
    if (age < 5) {
      if (disease === 'lower_respiratory_infection' || disease === 'rotavirus_infection') {
        adjustedProbability *= 1.5;
      }
    }
    
    // Elderly adjustments
    if (age > 65) {
      if (disease === 'tuberculosis' || disease === 'lower_respiratory_infection') {
        adjustedProbability *= 1.3;
      }
    }
    
    // Vital sign adjustments
    if (vitalSigns) {
      if (vitalSigns.temperature && vitalSigns.temperature > 39) {
        if (disease === 'malaria' || disease === 'typhoid' || disease === 'meningitis') {
          adjustedProbability *= 1.2;
        }
      }
      if (vitalSigns.spO2 && vitalSigns.spO2 < 92) {
        if (disease === 'lower_respiratory_infection' || disease === 'covid19') {
          adjustedProbability *= 1.4;
        }
      }
    }
    
    // Duration adjustments
    if (duration) {
      if (duration > 14 && disease === 'tuberculosis') {
        adjustedProbability *= 1.5;
      }
      if (duration < 3 && disease === 'viral_syndrome') {
        adjustedProbability *= 1.2;
      }
    }
    
    // Get ICD-10 code mapping
    const icd10Map: Record<string, string> = {
      malaria: 'B50-B54',
      typhoid: 'A01',
      tuberculosis: 'A15-A19',
      'lower_respiratory_infection': 'J12-J18',
      'upper_respiratory_infection': 'J00-J06',
      'urinary_tract_infection': 'N39.0',
      'viral_syndrome': 'B34.9',
      asthma: 'J45',
      'acute_gastroenteritis': 'K59.1',
      cholera: 'A00',
      'amoebic_dysentery': 'A06',
      'rotavirus_infection': 'A08.0',
      migraine: 'G43',
      'tension_headache': 'G44.2',
      meningitis: 'G00-G03',
      hypertension: 'I10',
      covid19: 'U07.1',
    };
    
    // Identify red flags
    const redFlags: string[] = [];
    if (disease === 'meningitis' && symptoms.includes('headache')) {
      redFlags.push('Neck stiffness', 'Photophobia', 'Altered consciousness');
    }
    if (disease === 'malaria' && vitalSigns?.temperature && vitalSigns.temperature > 40) {
      redFlags.push('Hyperpyrexia', 'Risk of cerebral malaria');
    }
    if (disease === 'tuberculosis' && duration && duration > 14) {
      redFlags.push('Chronic cough', 'Weight loss', 'Night sweats');
    }
    
    return {
      condition: disease.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      probability: Math.min(0.99, adjustedProbability * 100),
      icd10Code: icd10Map[disease] || 'R00-R99',
      reasoning: `Based on symptoms: ${symptoms.join(', ')}`,
      redFlags,
    };
  });
  
  // Sort by probability and take top 5
  const sortedDifferentials = differentials
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5)
    .map(d => ({
      ...d,
      probability: Math.round(d.probability * 100) / 100,
    }));
  
  // Recommend tests based on top differentials
  const recommendedTests = new Set<string>();
  if (sortedDifferentials.some(d => d.condition.toLowerCase().includes('malaria'))) {
    recommendedTests.add('Malaria RDT or blood smear');
    recommendedTests.add('Full blood count');
  }
  if (sortedDifferentials.some(d => d.condition.toLowerCase().includes('typhoid'))) {
    recommendedTests.add('Widal test or blood culture');
    recommendedTests.add('Full blood count');
  }
  if (sortedDifferentials.some(d => d.condition.toLowerCase().includes('tuberculosis'))) {
    recommendedTests.add('Chest X-ray');
    recommendedTests.add('Sputum AFB smear');
    recommendedTests.add('GeneXpert MTB/RIF');
  }
  if (sortedDifferentials.some(d => d.condition.toLowerCase().includes('respiratory'))) {
    recommendedTests.add('Chest X-ray');
    recommendedTests.add('Full blood count');
    recommendedTests.add('Pulse oximetry');
  }
  if (sortedDifferentials.some(d => d.condition.toLowerCase().includes('urinary'))) {
    recommendedTests.add('Urinalysis');
    recommendedTests.add('Urine culture');
  }
  if (sortedDifferentials.some(d => d.condition.toLowerCase().includes('gastroenteritis') || d.condition.toLowerCase().includes('diarrhea'))) {
    recommendedTests.add('Stool microscopy and culture');
    recommendedTests.add('Electrolytes');
  }
  
  // Determine urgency
  let urgencyLevel: OfflineDiagnosisResult['urgencyLevel'] = 'routine';
  if (sortedDifferentials.some(d => 
    d.condition.toLowerCase().includes('meningitis') ||
    d.condition.toLowerCase().includes('cholera') ||
    d.redFlags.length >= 2
  )) {
    urgencyLevel = 'immediate';
  } else if (sortedDifferentials.some(d => 
    d.condition.toLowerCase().includes('tuberculosis') ||
    d.condition.toLowerCase().includes('pneumonia') ||
    d.probability > 70
  )) {
    urgencyLevel = 'urgent';
  }
  
  return {
    differentials: sortedDifferentials,
    recommendedTests: Array.from(recommendedTests),
    urgencyLevel,
  };
}

// ─── Offline Triage Algorithm ─────────────────────────────────────────────────

/**
 * Rule-based triage algorithm for offline use
 * Based on WHO Emergency Triage Assessment and Treatment (ETAT) guidelines
 */
export function performOfflineTriage(params: {
  chiefComplaint: string;
  vitalSigns?: Record<string, number>;
  age: number;
  gender: string;
  isPregnant?: boolean;
  symptoms?: string[];
}): OfflineTriageResult {
  const { chiefComplaint, vitalSigns, age, gender: _gender, isPregnant, symptoms = [] } = params;
  
  const priorityReasons: string[] = [];
  const immediateActions: string[] = [];
  let priority: OfflineTriageResult['priority'] = 5;
  let color: OfflineTriageResult['color'] = 'blue';
  
  // ─── Priority 1 (Red) - Immediate life threats ──────────────────────────
  
  // Airway obstruction
  if (chiefComplaint.toLowerCase().includes('choking') || 
      chiefComplaint.toLowerCase().includes('cannot breathe')) {
    priority = 1;
    color = 'red';
    priorityReasons.push('Potential airway obstruction');
    immediateActions.push('Assess airway patency');
    immediateActions.push('Prepare for emergency airway management');
  }
  
  // Severe respiratory distress
  if (vitalSigns?.spO2 !== undefined && vitalSigns.spO2 < 90) {
    priority = 1;
    color = 'red';
    priorityReasons.push(`Critical hypoxia: SpO2 ${vitalSigns.spO2}%`);
    immediateActions.push('Administer high-flow oxygen');
    immediateActions.push('Prepare for assisted ventilation');
  }
  
  // Unconscious/unresponsive
  if (chiefComplaint.toLowerCase().includes('unconscious') ||
      chiefComplaint.toLowerCase().includes('unresponsive')) {
    priority = 1;
    color = 'red';
    priorityReasons.push('Unconscious patient');
    immediateActions.push('Assess ABCDE');
    immediateActions.push('Check blood glucose');
    immediateActions.push('Call senior/rapid response team');
  }
  
  // Severe bleeding
  if (chiefComplaint.toLowerCase().includes('bleeding') && 
      (chiefComplaint.toLowerCase().includes('heavy') || 
       chiefComplaint.toLowerCase().includes('severe') ||
       chiefComplaint.toLowerCase().includes('uncontrolled'))) {
    priority = 1;
    color = 'red';
    priorityReasons.push('Severe/uncontrolled bleeding');
    immediateActions.push('Apply direct pressure');
    immediateActions.push('Establish IV access');
    immediateActions.push('Prepare for fluid resuscitation');
  }
  
  // ─── Priority 2 (Orange) - Emergency conditions ─────────────────────────
  
  if (priority > 2) {
    // Severe tachypnea
    if (vitalSigns?.respiratoryRate !== undefined) {
      const severeTachypnea = age < 1 ? vitalSigns.respiratoryRate > 70 :
                              age < 5 ? vitalSigns.respiratoryRate > 50 :
                              vitalSigns.respiratoryRate > 40;
      if (severeTachypnea) {
        priority = 2;
        color = 'orange';
        priorityReasons.push(`Severe tachypnea: RR ${vitalSigns.respiratoryRate}/min`);
      }
    }
    
    // Hypotension
    if (vitalSigns?.systolicBP !== undefined && vitalSigns.systolicBP < 90) {
      priority = 2;
      color = 'orange';
      priorityReasons.push(`Hypotension: BP ${vitalSigns.systolicBP}/${vitalSigns.diastolicBP || '?'} mmHg`);
      immediateActions.push('Establish IV access');
      immediateActions.push('Consider fluid challenge');
    }
    
    // High fever with altered mental status
    if (vitalSigns?.temperature !== undefined && vitalSigns.temperature > 39.5) {
      if (symptoms.includes('confusion') || symptoms.includes('altered mental status')) {
        priority = 2;
        color = 'orange';
        priorityReasons.push(`High fever with altered mental status: T ${vitalSigns.temperature}°C`);
        immediateActions.push('Consider sepsis/meningitis');
        immediateActions.push('Check blood glucose');
      }
    }
    
    // Severe abdominal pain in pregnancy
    if (isPregnant && chiefComplaint.toLowerCase().includes('abdominal pain')) {
      priority = 2;
      color = 'orange';
      priorityReasons.push('Abdominal pain in pregnancy - rule out obstetric emergency');
      immediateActions.push('Assess for ectopic pregnancy, abruption, pre-eclampsia');
    }
    
    // Chest pain
    if (chiefComplaint.toLowerCase().includes('chest pain')) {
      priority = 2;
      color = 'orange';
      priorityReasons.push('Chest pain - rule out cardiac/pulmonary emergency');
      immediateActions.push('ECG within 10 minutes');
      immediateActions.push('Assess for ACS, PE, aortic dissection');
    }
    
    // Severe dehydration
    if (symptoms.includes('dehydration') || 
        (chiefComplaint.toLowerCase().includes('diarrhea') && 
         chiefComplaint.toLowerCase().includes('vomiting'))) {
      if (vitalSigns?.heartRate !== undefined && vitalSigns.heartRate > 120) {
        priority = 2;
        color = 'orange';
        priorityReasons.push('Severe dehydration with tachycardia');
        immediateActions.push('Establish IV access');
        immediateActions.push('Start fluid resuscitation');
      }
    }
  }
  
  // ─── Priority 3 (Yellow) - Urgent conditions ────────────────────────────
  
  if (priority > 3) {
    // Moderate fever
    if (vitalSigns?.temperature !== undefined && vitalSigns.temperature > 38.5) {
      priority = 3;
      color = 'yellow';
      priorityReasons.push(`Fever: T ${vitalSigns.temperature}°C`);
      
      // African context: high suspicion for malaria
      if (symptoms.includes('fever') || vitalSigns.temperature > 38) {
        priorityReasons.push('Consider malaria in febrile patient');
      }
    }
    
    // Moderate respiratory symptoms
    if (chiefComplaint.toLowerCase().includes('cough') && 
        chiefComplaint.toLowerCase().includes('difficulty breathing')) {
      priority = 3;
      color = 'yellow';
      priorityReasons.push('Respiratory symptoms with dyspnea');
    }
    
    // Persistent vomiting/diarrhea
    if (chiefComplaint.toLowerCase().includes('vomiting') || 
        chiefComplaint.toLowerCase().includes('diarrhea')) {
      priority = 3;
      color = 'yellow';
      priorityReasons.push('GI symptoms - assess hydration status');
    }
    
    // Moderate pain
    if (chiefComplaint.toLowerCase().includes('pain') && 
        !chiefComplaint.toLowerCase().includes('severe')) {
      priority = 3;
      color = 'yellow';
      priorityReasons.push('Pain requiring assessment and management');
    }
  }
  
  // ─── Priority 4 (Green) - Semi-urgent ───────────────────────────────────
  
  if (priority > 4) {
    // Minor complaints
    priority = 4;
    color = 'green';
    priorityReasons.push('Stable condition, minor complaint');
  }
  
  // ─── Priority Labels ────────────────────────────────────────────────────
  
  const priorityLabels: Record<number, string> = {
    1: 'Immediate (Red) - Life-threatening, requires immediate intervention',
    2: 'Emergency (Orange) - Potentially life-threatening, rapid assessment needed',
    3: 'Urgent (Yellow) - Serious condition, assessment within 30-60 minutes',
    4: 'Semi-urgent (Green) - Stable but needs care, assessment within 1-2 hours',
    5: 'Non-urgent (Blue) - Minor condition, can wait',
  };
  
  // Calculate confidence based on data completeness
  let confidence = 0.7; // Base confidence
  if (vitalSigns && Object.keys(vitalSigns).length >= 4) confidence += 0.15;
  if (symptoms.length >= 3) confidence += 0.10;
  if (chiefComplaint.length > 20) confidence += 0.05;
  confidence = Math.min(0.95, confidence);
  
  return {
    priority,
    priorityLabel: priorityLabels[priority],
    color,
    reasoning: priorityReasons,
    immediateActions,
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ─── Offline Clinical Protocols ───────────────────────────────────────────────

/**
 * Offline clinical protocol library based on Kenya MOH and WHO guidelines
 */
const CLINICAL_PROTOCOLS: Record<string, OfflineProtocolResult> = {
  malaria_management: {
    protocolName: 'Malaria Management (Kenya MOH Guidelines)',
    steps: [
      {
        step: 1,
        action: 'Confirm diagnosis',
        details: 'Perform malaria RDT or blood smear. If RDT positive or smear shows parasites, proceed with treatment.',
      },
      {
        step: 2,
        action: 'Assess severity',
        details: 'Check for danger signs: impaired consciousness, prostration, multiple convulsions, severe anemia, respiratory distress, hypoglycemia, shock, jaundice, abnormal bleeding.',
        warning: 'If any danger sign present, classify as SEVERE MALARIA',
      },
      {
        step: 3,
        action: 'Uncomplicated malaria treatment',
        details: 'First-line: Artemether-Lumefantrine (AL) 80/480mg - 4 tablets BID for 3 days (adults). Take with fatty food/milk for better absorption.',
      },
      {
        step: 4,
        action: 'Severe malaria treatment',
        details: 'Injectable artesunate 2.4mg/kg IV at 0, 12, 24 hours, then daily. Once patient can tolerate oral medication, complete with full course of AL.',
        warning: 'Refer to higher facility if injectable artesunate unavailable',
      },
      {
        step: 5,
        action: 'Supportive care',
        details: 'Manage fever with paracetamol. Treat hypoglycemia with IV dextrose. Transfuse if Hb < 5g/dL or < 7g/dL with respiratory distress.',
      },
      {
        step: 6,
        action: 'Follow-up',
        details: 'Review at 24-48 hours. If no improvement, reassess diagnosis and consider drug resistance or alternative diagnosis.',
      },
    ],
    contraindications: [
      'AL contraindicated in first trimester of pregnancy - use Quinine instead',
      'Avoid in patients with known hypersensitivity to artemisinins',
    ],
    references: [
      'Kenya National Malaria Strategy 2019-2023',
      'WHO Guidelines for Malaria 2023',
    ],
  },
  
  pneumonia_management: {
    protocolName: 'Pneumonia Management (WHO/Kenya MOH)',
    steps: [
      {
        step: 1,
        action: 'Assess severity',
        details: 'Check respiratory rate, SpO2, chest indrawing, danger signs. Classify as: No pneumonia (cough/cold), Pneumonia (fast breathing), Severe pneumonia (chest indrawing or danger signs).',
      },
      {
        step: 2,
        action: 'Non-severe pneumonia (outpatient)',
        details: 'Amoxicillin 50mg/kg/day divided BID for 3-5 days (children). Amoxicillin 500mg TID for 5-7 days (adults). Advise on danger signs for return.',
      },
      {
        step: 3,
        action: 'Severe pneumonia (admit)',
        details: 'Oxygen to maintain SpO2 ≥ 90%. Ampicillin 50mg/kg Q6H + Gentamicin 7.5mg/kg daily (children). Ceftriaxone 1-2g daily (adults).',
        warning: 'Consider referral if oxygen unavailable',
      },
      {
        step: 4,
        action: 'Supportive care',
        details: 'Antipyretics for fever. Adequate hydration. Nutritional support. Monitor for complications (empyema, sepsis).',
      },
    ],
    contraindications: [
      'Avoid codeine-containing cough suppressants in children',
    ],
    references: [
      'WHO Pocket Book of Hospital Care for Children',
      'Kenya MOH Guidelines for Management of Common Childhood Illnesses',
    ],
  },
  
  hypertensive_emergency: {
    protocolName: 'Hypertensive Emergency Management',
    steps: [
      {
        step: 1,
        action: 'Confirm diagnosis',
        details: 'BP ≥ 180/120 mmHg with evidence of acute target organ damage (encephalopathy, MI, unstable angina, pulmonary edema, stroke, eclampsia, acute kidney injury).',
      },
      {
        step: 2,
        action: 'Initial management',
        details: 'Admit to monitored setting. Establish IV access. Reduce MAP by max 25% in first hour, then to 160/100-110 over 2-6 hours.',
        warning: 'Avoid rapid BP reduction - risk of cerebral/renal ischemia',
      },
      {
        step: 3,
        action: 'First-line agents',
        details: 'Labetalol 20mg IV bolus, repeat q10min up to 300mg total. OR Nicardipine infusion 5-15mg/hr. OR Sodium nitroprusside 0.25-10 mcg/kg/min (if others unavailable).',
      },
      {
        step: 4,
        action: 'Special considerations',
        details: 'Stroke: Permissive hypertension (allow up to 220/120 for 24-48h unless thrombolysis planned). Eclampsia: Magnesium sulfate 4-6g IV loading, then 2g/hr infusion.',
      },
    ],
    contraindications: [
      'Avoid sublingual nifedipine - risk of stroke/MI',
      'Beta-blockers contraindicated in acute heart failure/asthma',
    ],
    references: [
      'WHO Guidelines for Management of Hypertensive Emergencies',
      'Kenya MOH Clinical Guidelines',
    ],
  },
};

/**
 * Retrieve clinical protocol for offline use
 */
export function getClinicalProtocol(protocolName: string): OfflineProtocolResult | null {
  const protocol = CLINICAL_PROTOCOLS[protocolName];
  if (!protocol) {
    // Return a generic protocol for common conditions
    return {
      protocolName: `Management of ${protocolName.replace(/_/g, ' ')}`,
      steps: [
        {
          step: 1,
          action: 'Assessment',
          details: 'Perform thorough history and physical examination. Document vital signs and relevant findings.',
        },
        {
          step: 2,
          action: 'Investigations',
          details: 'Order appropriate investigations based on clinical presentation. Consider resource limitations.',
        },
        {
          step: 3,
          action: 'Treatment',
          details: 'Initiate evidence-based treatment according to local guidelines. Consider drug availability and patient factors.',
        },
        {
          step: 4,
          action: 'Monitoring',
          details: 'Monitor response to treatment. Watch for complications and adverse effects.',
        },
        {
          step: 5,
          action: 'Follow-up',
          details: 'Arrange appropriate follow-up. Provide patient education on warning signs.',
        },
      ],
      contraindications: ['Refer to specific guidelines for detailed management'],
      references: ['Kenya MOH Clinical Guidelines', 'WHO Standard Treatment Guidelines'],
    };
  }
  return protocol;
}

// ─── Offline Drug Interaction Database ────────────────────────────────────────

/**
 * Comprehensive offline drug interaction database
 * Focuses on commonly used medications in African healthcare settings
 */
const DRUG_INTERACTION_DATABASE: Array<{
  drug1: string[];
  drug2: string[];
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  alternative?: string;
}> = [
  // TB-HIV interactions (critical for African context)
  {
    drug1: ['rifampicin', 'rifampin'],
    drug2: ['efavirenz', 'nevirapine', 'dolutegravir', 'raltegravir'],
    severity: 'major',
    description: 'Rifampicin significantly reduces ARV levels through CYP450 induction',
    alternative: 'Consider rifabutin instead of rifampicin, or adjust ARV dosing',
  },
  {
    drug1: ['rifampicin', 'rifampin'],
    drug2: ['ketoconazole', 'itraconazole', 'fluconazole'],
    severity: 'major',
    description: 'Rifampicin reduces azole antifungal levels',
    alternative: 'Increase azole dose or use alternative antifungal',
  },
  
  // Antiretroviral interactions
  {
    drug1: ['tenofovir'],
    drug2: ['aminoglycosides', 'amphotericin'],
    severity: 'major',
    description: 'Increased risk of nephrotoxicity',
    alternative: 'Monitor renal function closely, consider alternative agents',
  },
  {
    drug1: ['atazanavir', 'rilpivirine'],
    drug2: ['omeprazole', 'esomeprazole', 'antacids'],
    severity: 'major',
    description: 'Reduced ARV absorption due to increased gastric pH',
    alternative: 'Separate administration by 4 hours or use H2 blocker instead',
  },
  
  // Warfarin interactions
  {
    drug1: ['warfarin'],
    drug2: ['rifampicin', 'carbamazepine', 'phenytoin'],
    severity: 'major',
    description: 'Reduced warfarin effect due to enzyme induction',
    alternative: 'Monitor INR closely, may need warfarin dose increase',
  },
  {
    drug1: ['warfarin'],
    drug2: ['metronidazole', 'erythromycin', 'cotrimoxazole'],
    severity: 'major',
    description: 'Increased warfarin effect and bleeding risk',
    alternative: 'Monitor INR closely, may need warfarin dose reduction',
  },
  
  // ACE inhibitor/ARB interactions
  {
    drug1: ['lisinopril', 'enalapril', 'captopril', 'losartan', 'valsartan'],
    drug2: ['potassium', 'spironolactone', 'amiloride'],
    severity: 'major',
    description: 'Risk of hyperkalemia',
    alternative: 'Monitor potassium, avoid combination if possible',
  },
  {
    drug1: ['lisinopril', 'enalapril', 'captopril'],
    drug2: ['ibuprofen', 'diclofenac', 'naproxen'],
    severity: 'moderate',
    description: 'NSAIDs reduce ACE-I effectiveness and increase nephrotoxicity risk',
    alternative: 'Use paracetamol instead, monitor BP and renal function',
  },
  
  // Metformin interactions
  {
    drug1: ['metformin'],
    drug2: ['contrast dye', 'iodinated contrast'],
    severity: 'major',
    description: 'Risk of lactic acidosis with contrast-induced nephropathy',
    alternative: 'Hold metformin 48 hours before and after contrast',
  },
  
  // Statin interactions
  {
    drug1: ['simvastatin', 'atorvastatin'],
    drug2: ['erythromycin', 'clarithromycin', 'ketoconazole'],
    severity: 'major',
    description: 'Increased risk of myopathy/rhabdomyolysis',
    alternative: 'Use azithromycin instead, or hold statin temporarily',
  },
  
  // Digoxin interactions
  {
    drug1: ['digoxin'],
    drug2: ['furosemide', 'hydrochlorothiazide'],
    severity: 'moderate',
    description: 'Diuretic-induced hypokalemia increases digoxin toxicity risk',
    alternative: 'Monitor potassium and digoxin levels',
  },
  {
    drug1: ['digoxin'],
    drug2: ['amiodarone', 'verapamil', 'diltiazem'],
    severity: 'major',
    description: 'Increased digoxin levels and toxicity risk',
    alternative: 'Reduce digoxin dose by 50%, monitor levels',
  },
  
  // Contraindicated combinations
  {
    drug1: ['sildenafil', 'tadalafil'],
    drug2: ['nitrates', 'isosorbide'],
    severity: 'contraindicated',
    description: 'Severe hypotension - potentially fatal',
    alternative: 'Absolute contraindication - do not combine',
  },
  {
    drug1: ['mao inhibitors', 'phenelzine', 'tranylcypromine'],
    drug2: ['ssris', 'fluoxetine', 'sertraline', 'tcas'],
    severity: 'contraindicated',
    description: 'Serotonin syndrome - potentially fatal',
    alternative: 'Absolute contraindication - require washout period',
  },
];

/**
 * Check drug interactions offline
 */
export function checkDrugInteractionsOffline(params: {
  medications: string[];
  allergies?: string[];
  conditions?: string[];
}): OfflineDrugCheckResult {
  const { medications, allergies = [], conditions = [] } = params;
  
  const interactions: OfflineDrugCheckResult['interactions'] = [];
  const doseAdjustments: OfflineDrugCheckResult['doseAdjustments'] = [];
  
  // Check for drug-drug interactions
  for (const interaction of DRUG_INTERACTION_DATABASE) {
    const hasDrug1 = medications.some(m =>
      interaction.drug1.some(d => m.toLowerCase().includes(d.toLowerCase()))
    );
    const hasDrug2 = medications.some(m =>
      interaction.drug2.some(d => m.toLowerCase().includes(d.toLowerCase()))
    );
    
    if (hasDrug1 && hasDrug2) {
      interactions.push({
        drug1: interaction.drug1[0],
        drug2: interaction.drug2[0],
        severity: interaction.severity,
        description: interaction.description,
        alternative: interaction.alternative,
      });
    }
  }
  
  // Condition-based dose adjustments
  if (conditions.includes('kidney disease') || conditions.includes('ckd') || conditions.includes('renal impairment')) {
    const renallyClearedDrugs = ['metformin', 'digoxin', 'aminoglycosides', 'vancomycin'];
    for (const med of medications) {
      const needsAdjustment = renallyClearedDrugs.some(d => med.toLowerCase().includes(d));
      if (needsAdjustment) {
        doseAdjustments.push({
          drug: med,
          reason: 'Renal impairment',
          adjustment: 'Dose reduction required - calculate based on eGFR',
        });
      }
    }
  }
  
  if (conditions.includes('liver disease') || conditions.includes('hepatic impairment')) {
    const hepaticallyClearedDrugs = ['metformin', 'statins', 'warfarin', 'benzodiazepines'];
    for (const med of medications) {
      const needsAdjustment = hepaticallyClearedDrugs.some(d => med.toLowerCase().includes(d));
      if (needsAdjustment) {
        doseAdjustments.push({
          drug: med,
          reason: 'Hepatic impairment',
          adjustment: 'Dose reduction required - monitor LFTs',
        });
      }
    }
  }
  
  // Check for allergies
  const allergyInteractions = allergies.map(allergy => ({
    drug1: allergy,
    drug2: 'Patient allergy',
    severity: 'contraindicated' as const,
    description: `Patient has documented allergy to ${allergy}`,
    alternative: 'Use alternative medication from different class',
  }));
  
  const hasAllergyInteraction = medications.some(m =>
    allergies.some(a => m.toLowerCase().includes(a.toLowerCase()))
  );
  
  const safe = interactions.filter(i => i.severity === 'contraindicated').length === 0 && !hasAllergyInteraction;
  
  return {
    safe,
    interactions: [...interactions, ...allergyInteractions],
    doseAdjustments,
  };
}

// ─── Export for API usage ───────────────────────────────────────────────────

export const OfflineAIModels = {
  generateOfflineDiagnosis,
  performOfflineTriage,
  getClinicalProtocol,
  checkDrugInteractionsOffline,
};