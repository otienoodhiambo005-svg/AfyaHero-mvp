/**
 * Predictive Risk Models - AfyaHero
 * 
 * Fast, task-specific models that run locally on the device or at the edge.
 * These models run on structured numerical data and don't need a large language model -
 * they can run offline on low-end devices.
 * 
 * Models included:
 * - Sepsis Early Warning (using vitals trend data)
 * - Maternal Deterioration Risk (for obstetric emergencies)
 * - Readmission Risk Scoring
 * - Drug Interaction Checker (basic, offline-capable)
 * - Pediatric Deterioration Risk
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SepsisResult {
  risk: 'low' | 'medium' | 'high' | 'critical';
  score: number; // qSOFA or MEWS-based score
  criteria: {
    respiratoryRate: number;
    consciousness: number;
    systolicBP: number;
    temperature?: number;
    heartRate?: number;
  };
  recommendations: string[];
  requiresImmediateAction: boolean;
}

export interface MaternalRiskResult {
  risk: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  conditions: {
    preEclampsia: boolean;
    hemorrhage: boolean;
    sepsis: boolean;
    obstructedLabor: boolean;
  };
  recommendations: string[];
  requiresImmediateAction: boolean;
}

export interface ReadmissionRiskResult {
  risk: 'low' | 'medium' | 'high';
  score: number;
  factors: string[];
  recommendations: string[];
}

export interface DrugInteractionResult {
  interactions: Array<{
    drug1: string;
    drug2: string;
    severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
    description: string;
    recommendation: string;
  }>;
  allergies: Array<{
    drug: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe';
  }>;
  requiresReview: boolean;
}

export interface PediatricRiskResult {
  risk: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  peesScore: number;
  criteria: {
    consciousness: number;
    cardiovascular: number;
    respiratory: number;
  };
  recommendations: string[];
  requiresImmediateAction: boolean;
}

// ─── Sepsis Early Warning Model ──────────────────────────────────────────────

/**
 * Calculate qSOFA (quick Sequential Organ Failure Assessment) score
 * Validated for sepsis screening in resource-limited settings
 */
export function calculateSepsisRisk(vitals: {
  respiratoryRate?: number;
  systolicBP?: number;
  consciousness?: 'alert' | 'voice' | 'pain' | 'unresponsive';
  temperature?: number;
  heartRate?: number;
  age?: number;
}): SepsisResult {
  let score = 0;
  const criteria = {
    respiratoryRate: 0,
    consciousness: 0,
    systolicBP: 0,
    temperature: 0,
    heartRate: 0,
  };

  // Respiratory rate ≥ 22/min (qSOFA criterion)
  if (vitals.respiratoryRate !== undefined && vitals.respiratoryRate >= 22) {
    score += 1;
    criteria.respiratoryRate = 1;
  }

  // Altered mental status (GCS < 15)
  if (vitals.consciousness && vitals.consciousness !== 'alert') {
    score += 1;
    criteria.consciousness = 1;
  }

  // Systolic BP ≤ 100 mmHg (qSOFA criterion)
  if (vitals.systolicBP !== undefined && vitals.systolicBP <= 100) {
    score += 1;
    criteria.systolicBP = 1;
  }

  // Additional criteria for enhanced sensitivity
  // Temperature > 38.3°C or < 36°C
  if (vitals.temperature !== undefined && (vitals.temperature > 38.3 || vitals.temperature < 36)) {
    score += 1;
    criteria.temperature = 1;
  }

  // Heart rate > 90/min
  if (vitals.heartRate !== undefined && vitals.heartRate > 90) {
    score += 1;
    criteria.heartRate = 1;
  }

  // Determine risk level
  let risk: SepsisResult['risk'] = 'low';
  const recommendations: string[] = [];
  let requiresImmediateAction = false;

  if (score >= 4) {
    risk = 'critical';
    requiresImmediateAction = true;
    recommendations.push('🚨 CRITICAL: High probability of sepsis - immediate senior review');
    recommendations.push('Start sepsis protocol: blood cultures, lactate, broad-spectrum antibiotics');
    recommendations.push('Consider ICU/HDU transfer');
    recommendations.push('Hourly monitoring of vitals');
  } else if (score >= 3) {
    risk = 'high';
    requiresImmediateAction = true;
    recommendations.push('⚠️ HIGH RISK: Possible sepsis - urgent clinical review');
    recommendations.push('Obtain blood cultures and lactate');
    recommendations.push('Consider empiric antibiotics');
    recommendations.push('Increase monitoring frequency');
  } else if (score >= 2) {
    risk = 'medium';
    recommendations.push('Monitor closely for sepsis progression');
    recommendations.push('Consider infection source');
    recommendations.push('Repeat vitals in 1-2 hours');
  } else {
    risk = 'low';
    recommendations.push('Continue routine monitoring');
    recommendations.push('Maintain awareness of sepsis risk');
  }

  // African context considerations
  if (vitals.temperature !== undefined && vitals.temperature > 38.5) {
    recommendations.push('Consider malaria, typhoid in febrile patient');
    recommendations.push('Rapid diagnostic tests if available');
  }

  return {
    risk,
    score,
    criteria: {
      respiratoryRate: criteria.respiratoryRate,
      consciousness: criteria.consciousness,
      systolicBP: criteria.systolicBP,
      temperature: criteria.temperature,
      heartRate: criteria.heartRate,
    },
    recommendations,
    requiresImmediateAction,
  };
}

// ─── Maternal Deterioration Risk Model ───────────────────────────────────────

/**
 * Calculate maternal deterioration risk
 * Screens for pre-eclampsia, hemorrhage, sepsis, and obstructed labor
 */
export function calculateMaternalRisk(params: {
  systolicBP?: number;
  diastolicBP?: number;
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  spO2?: number;
  consciousness?: 'alert' | 'voice' | 'pain' | 'unresponsive';
  gestationalWeeks?: number;
  isPostpartum?: boolean;
  vaginalBleeding?: 'none' | 'light' | 'moderate' | 'heavy';
  abdominalPain?: boolean;
  headache?: boolean;
  visualDisturbances?: boolean;
  proteinuria?: 'negative' | '1+' | '2+' | '3+' | '4+';
  contractions?: boolean;
  ruptureOfMembranes?: boolean;
}): MaternalRiskResult {
  let score = 0;
  const conditions = {
    preEclampsia: false,
    hemorrhage: false,
    sepsis: false,
    obstructedLabor: false,
  };
  const recommendations: string[] = [];
  let requiresImmediateAction = false;

  // Pre-eclampsia screening
  if (params.systolicBP !== undefined && params.systolicBP >= 140) {
    score += 2;
    conditions.preEclampsia = true;
    recommendations.push('⚠️ HYPERTENSION: Assess for pre-eclampsia');
  }
  if (params.diastolicBP !== undefined && params.diastolicBP >= 90) {
    score += 2;
    conditions.preEclampsia = true;
  }
  if (params.headache && params.visualDisturbances) {
    score += 2;
    conditions.preEclampsia = true;
    recommendations.push('CNS symptoms + hypertension = possible severe pre-eclampsia');
  }
  if (params.proteinuria && params.proteinuria !== 'negative') {
    score += 1;
    conditions.preEclampsia = true;
  }

  // Severe hypertension
  if (params.systolicBP !== undefined && params.systolicBP >= 160) {
    score += 3;
    requiresImmediateAction = true;
    recommendations.push('🚨 SEVERE HYPERTENSION: Emergency magnesium sulfate');
  }

  // Hemorrhage screening
  if (params.vaginalBleeding === 'heavy') {
    score += 3;
    conditions.hemorrhage = true;
    requiresImmediateAction = true;
    recommendations.push('🚨 HEAVY BLEEDING: Activate obstetric emergency protocol');
  } else if (params.vaginalBleeding === 'moderate') {
    score += 2;
    conditions.hemorrhage = true;
    recommendations.push('⚠️ MODERATE BLEEDING: Monitor closely, prepare for intervention');
  }

  // Tachycardia (possible hemorrhage or sepsis)
  if (params.heartRate !== undefined && params.heartRate > 110) {
    score += 2;
    recommendations.push('Tachycardia - assess for hemorrhage or sepsis');
  }

  // Sepsis screening
  if (params.temperature !== undefined && params.temperature > 38) {
    score += 2;
    conditions.sepsis = true;
    recommendations.push('⚠️ FEVER: Consider chorioamnionitis or puerperal sepsis');
  }
  if (params.temperature !== undefined && params.temperature > 39) {
    score += 3;
    requiresImmediateAction = true;
    recommendations.push('🚨 HIGH FEVER: Start sepsis protocol');
  }

  // Obstructed labor indicators
  if (params.contractions && params.ruptureOfMembranes && params.gestationalWeeks !== undefined && params.gestationalWeeks >= 37) {
    // Prolonged rupture of membranes
    score += 1;
    recommendations.push('Monitor for prolonged labor');
  }

  // Determine risk level
  let risk: MaternalRiskResult['risk'] = 'low';

  if (score >= 6) {
    risk = 'critical';
    requiresImmediateAction = true;
    recommendations.push('🚨 CRITICAL: Immediate obstetrician review required');
    recommendations.push('Prepare for emergency intervention');
  } else if (score >= 4) {
    risk = 'high';
    requiresImmediateAction = true;
    recommendations.push('⚠️ HIGH RISK: Urgent senior obstetric review');
  } else if (score >= 2) {
    risk = 'medium';
    recommendations.push('Increase monitoring frequency');
    recommendations.push('Notify obstetric team');
  } else {
    risk = 'low';
    recommendations.push('Continue routine antenatal/intrapartum care');
  }

  return {
    risk,
    score,
    conditions,
    recommendations,
    requiresImmediateAction,
  };
}

// ─── Readmission Risk Model ──────────────────────────────────────────────────

/**
 * Calculate readmission risk based on clinical and social factors
 * Simple model suitable for resource-limited settings
 */
export function calculateReadmissionRisk(params: {
  age: number;
  diagnosis: string[];
  comorbidities: string[];
  previousAdmissions?: number;
  lengthOfStay?: number;
  dischargeCondition?: 'stable' | 'improved' | 'unchanged' | 'deteriorated';
  socialSupport?: 'good' | 'moderate' | 'poor' | 'none';
  distanceFromFacility?: number; // km
  followUpScheduled?: boolean;
  medicationAdherence?: 'good' | 'moderate' | 'poor';
}): ReadmissionRiskResult {
  let score = 0;
  const factors: string[] = [];

  // Age factors
  if (params.age < 5 || params.age > 65) {
    score += 1;
    factors.push('Extreme age');
  }

  // Multiple comorbidities
  if (params.comorbidities.length >= 3) {
    score += 2;
    factors.push('Multiple comorbidities');
  } else if (params.comorbidities.length >= 2) {
    score += 1;
    factors.push('Comorbidities present');
  }

  // High-risk diagnoses
  const highRiskDiagnoses = ['heart failure', 'copd', 'diabetes', 'kidney disease', 'hiv', 'tb'];
  const hasHighRiskDiagnosis = params.diagnosis.some(d => 
    highRiskDiagnoses.some(hr => d.toLowerCase().includes(hr))
  );
  if (hasHighRiskDiagnosis) {
    score += 2;
    factors.push('High-risk diagnosis');
  }

  // Previous admissions
  if (params.previousAdmissions !== undefined && params.previousAdmissions >= 3) {
    score += 2;
    factors.push('Frequent readmissions');
  } else if (params.previousAdmissions !== undefined && params.previousAdmissions >= 2) {
    score += 1;
    factors.push('Previous readmissions');
  }

  // Discharge condition
  if (params.dischargeCondition === 'deteriorated') {
    score += 3;
    factors.push('Deteriorated at discharge');
  } else if (params.dischargeCondition === 'unchanged') {
    score += 1;
    factors.push('No improvement at discharge');
  }

  // Social support
  if (params.socialSupport === 'none' || params.socialSupport === 'poor') {
    score += 2;
    factors.push('Poor social support');
  }

  // Distance from facility
  if (params.distanceFromFacility !== undefined && params.distanceFromFacility > 50) {
    score += 1;
    factors.push('Long distance from facility');
  }

  // Follow-up not scheduled
  if (!params.followUpScheduled) {
    score += 1;
    factors.push('No follow-up scheduled');
  }

  // Medication adherence
  if (params.medicationAdherence === 'poor') {
    score += 2;
    factors.push('Poor medication adherence');
  }

  // Determine risk level
  let risk: ReadmissionRiskResult['risk'] = 'low';
  const recommendations: string[] = [];

  if (score >= 8) {
    risk = 'high';
    recommendations.push('High readmission risk - intensive follow-up required');
    recommendations.push('Schedule follow-up within 7 days');
    recommendations.push('Consider community health worker visit');
    recommendations.push('Patient education on warning signs');
  } else if (score >= 5) {
    risk = 'medium';
    recommendations.push('Moderate readmission risk');
    recommendations.push('Schedule follow-up within 14 days');
    recommendations.push('Reinforce medication adherence');
  } else {
    risk = 'low';
    recommendations.push('Standard discharge planning');
    recommendations.push('Routine follow-up as indicated');
  }

  return {
    risk,
    score,
    factors,
    recommendations,
  };
}

// ─── Drug Interaction Checker ────────────────────────────────────────────────

/**
 * Basic offline drug interaction checker
 * Focuses on common and dangerous interactions in African context
 */
export function checkDrugInteractions(params: {
  medications: string[];
  allergies?: string[];
  conditions?: string[];
}): DrugInteractionResult {
  const interactions: DrugInteractionResult['interactions'] = [];
  const allergyAlerts: DrugInteractionResult['allergies'] = [];
  let requiresReview = false;

  // Common dangerous interactions (simplified for offline use)
  const interactionDatabase: Array<{
    drug1: string[];
    drug2: string[];
    severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
    description: string;
    recommendation: string;
  }> = [
    // Warfarin interactions
    {
      drug1: ['warfarin'],
      drug2: ['aspirin', 'ibuprofen', 'diclofenac'],
      severity: 'major',
      description: 'NSAIDs increase bleeding risk with warfarin',
      recommendation: 'Avoid combination or monitor INR closely',
    },
    // ACE inhibitor + potassium
    {
      drug1: ['lisinopril', 'enalapril', 'captopril'],
      drug2: ['potassium', 'spironolactone'],
      severity: 'major',
      description: 'Risk of hyperkalemia',
      recommendation: 'Monitor potassium levels',
    },
    // Metformin + contrast
    {
      drug1: ['metformin'],
      drug2: ['contrast dye'],
      severity: 'major',
      description: 'Risk of lactic acidosis',
      recommendation: 'Hold metformin 48 hours before contrast',
    },
    // Rifampicin interactions (critical for TB/HIV co-treatment)
    {
      drug1: ['rifampicin', 'rifampin'],
      drug2: ['efavirenz', 'nevirapine', 'dolutegravir'],
      severity: 'major',
      description: 'Rifampicin reduces ARV levels',
      recommendation: 'Adjust ARV dosing or consider alternative TB regimen',
    },
    // Statin + macrolide
    {
      drug1: ['simvastatin', 'atorvastatin'],
      drug2: ['erythromycin', 'clarithromycin'],
      severity: 'major',
      description: 'Increased risk of myopathy/rhabdomyolysis',
      recommendation: 'Use azithromycin instead or hold statin',
    },
  ];

  // Check for interactions
  for (const interaction of interactionDatabase) {
    const hasDrug1 = params.medications.some(m => 
      interaction.drug1.some(d => m.toLowerCase().includes(d.toLowerCase()))
    );
    const hasDrug2 = params.medications.some(m => 
      interaction.drug2.some(d => m.toLowerCase().includes(d.toLowerCase()))
    );

    if (hasDrug1 && hasDrug2) {
      interactions.push({
        drug1: interaction.drug1.join(', '),
        drug2: interaction.drug2.join(', '),
        severity: interaction.severity,
        description: interaction.description,
        recommendation: interaction.recommendation,
      });
      if (interaction.severity === 'major' || interaction.severity === 'contraindicated') {
        requiresReview = true;
      }
    }
  }

  // Check for allergies
  if (params.allergies) {
    for (const allergy of params.allergies) {
      const hasAllergen = params.medications.some(m => 
        m.toLowerCase().includes(allergy.toLowerCase())
      );
      if (hasAllergen) {
        allergyAlerts.push({
          drug: allergy,
          reaction: 'Known allergy',
          severity: 'severe',
        });
        requiresReview = true;
      }
    }
  }

  // Condition-based contraindications
  if (params.conditions) {
    // Asthma + beta blockers
    if (params.conditions.includes('asthma')) {
      const hasBetaBlocker = params.medications.some(m => 
        m.toLowerCase().endsWith('olol')
      );
      if (hasBetaBlocker) {
        interactions.push({
          drug1: 'beta-blocker',
          drug2: 'asthma',
          severity: 'major',
          description: 'Beta-blockers can worsen asthma',
          recommendation: 'Consider cardioselective beta-blocker or alternative',
        });
        requiresReview = true;
      }
    }

    // Kidney disease + NSAIDs
    if (params.conditions.includes('kidney disease') || params.conditions.includes('ckd')) {
      const hasNSAID = params.medications.some(m => 
        ['ibuprofen', 'diclofenac', 'naproxen', 'indomethacin'].some(n => 
          m.toLowerCase().includes(n)
        )
      );
      if (hasNSAID) {
        interactions.push({
          drug1: 'NSAID',
          drug2: 'kidney disease',
          severity: 'major',
          description: 'NSAIDs can worsen kidney function',
          recommendation: 'Avoid NSAIDs or use with extreme caution',
        });
        requiresReview = true;
      }
    }
  }

  return {
    interactions,
    allergies: allergyAlerts,
    requiresReview,
  };
}

// ─── Pediatric Deterioration Risk Model ──────────────────────────────────────

/**
 * Calculate pediatric deterioration risk using PEWS
 * Already implemented in triage-ensemble.ts, this is a standalone version
 */
export function calculatePediatricRisk(params: {
  age: number;
  consciousness?: 'alert' | 'voice' | 'pain' | 'unresponsive';
  heartRate?: number;
  respiratoryRate?: number;
  spO2?: number;
  capillaryRefillTime?: number;
  temperature?: number;
}): PediatricRiskResult {
  let consciousnessScore = 0;
  let cardiovascularScore = 0;
  let respiratoryScore = 0;

  // Consciousness (0-3)
  if (params.consciousness === 'alert') consciousnessScore = 0;
  else if (params.consciousness === 'voice') consciousnessScore = 1;
  else if (params.consciousness === 'pain') consciousnessScore = 2;
  else if (params.consciousness === 'unresponsive') consciousnessScore = 3;

  // Cardiovascular (0-3)
  if (params.capillaryRefillTime !== undefined) {
    if (params.capillaryRefillTime <= 2) cardiovascularScore = 0;
    else if (params.capillaryRefillTime <= 3) cardiovascularScore = 1;
    else if (params.capillaryRefillTime <= 4) cardiovascularScore = 2;
    else cardiovascularScore = 3;
  } else if (params.heartRate !== undefined) {
    // Age-adjusted heart rate
    const normalHR = params.age < 1 ? [100, 160] :
                     params.age < 3 ? [90, 150] :
                     params.age < 5 ? [80, 140] :
                     params.age < 12 ? [70, 120] : [60, 100];
    
    const hr = params.heartRate;
    if (hr >= normalHR[0] && hr <= normalHR[1]) cardiovascularScore = 0;
    else if ((hr >= normalHR[0] - 10 && hr < normalHR[0]) || (hr > normalHR[1] && hr <= normalHR[1] + 10)) cardiovascularScore = 1;
    else if ((hr >= normalHR[0] - 20 && hr < normalHR[0] - 10) || (hr > normalHR[1] + 10 && hr <= normalHR[1] + 20)) cardiovascularScore = 2;
    else cardiovascularScore = 3;
  }

  // Respiratory (0-3)
  if (params.spO2 !== undefined) {
    if (params.spO2 >= 95) respiratoryScore = 0;
    else if (params.spO2 >= 92) respiratoryScore = 1;
    else if (params.spO2 >= 90) respiratoryScore = 2;
    else respiratoryScore = 3;
  } else if (params.respiratoryRate !== undefined) {
    const normalRR = params.age < 1 ? [30, 50] :
                     params.age < 3 ? [24, 40] :
                     params.age < 5 ? [22, 34] :
                     params.age < 12 ? [18, 30] : [12, 20];
    
    const rr = params.respiratoryRate;
    if (rr >= normalRR[0] && rr <= normalRR[1]) respiratoryScore = 0;
    else if ((rr >= normalRR[0] - 5 && rr < normalRR[0]) || (rr > normalRR[1] && rr <= normalRR[1] + 5)) respiratoryScore = 1;
    else if ((rr >= normalRR[0] - 10 && rr < normalRR[0] - 5) || (rr > normalRR[1] + 5 && rr <= normalRR[1] + 10)) respiratoryScore = 2;
    else respiratoryScore = 3;
  }

  const totalScore = consciousnessScore + cardiovascularScore + respiratoryScore;

  let risk: PediatricRiskResult['risk'] = 'low';
  const recommendations: string[] = [];
  let requiresImmediateAction = false;

  if (totalScore >= 5) {
    risk = 'critical';
    requiresImmediateAction = true;
    recommendations.push('🚨 CRITICAL: Immediate senior/picu review');
    recommendations.push('Continuous monitoring');
    recommendations.push('Prepare for resuscitation');
  } else if (totalScore >= 3) {
    risk = 'high';
    requiresImmediateAction = true;
    recommendations.push('⚠️ HIGH RISK: Urgent senior review');
    recommendations.push('Consider PICU transfer');
    recommendations.push('Increase monitoring frequency');
  } else if (totalScore >= 2) {
    risk = 'medium';
    recommendations.push('Notify nursing supervisor');
    recommendations.push('Consider senior review');
    recommendations.push('Increase monitoring');
  } else {
    risk = 'low';
    recommendations.push('Continue routine monitoring');
  }

  return {
    risk,
    score: totalScore,
    peesScore: totalScore,
    criteria: {
      consciousness: consciousnessScore,
      cardiovascular: cardiovascularScore,
      respiratory: respiratoryScore,
    },
    recommendations,
    requiresImmediateAction,
  };
}

// ─── Export for API usage ───────────────────────────────────────────────────

export const PredictiveRiskModels = {
  calculateSepsisRisk,
  calculateMaternalRisk,
  calculateReadmissionRisk,
  checkDrugInteractions,
  calculatePediatricRisk,
};