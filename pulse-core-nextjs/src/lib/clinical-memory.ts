/**
 * Clinical Memory System - AfyaHero
 * 
 * Implements the three levels of living clinical memory:
 * 1. Patient Memory - AI-maintained longitudinal record with synthesized clinical narrative
 * 2. Clinician Memory - Learning of individual clinician patterns and preferences
 * 3. Facility Memory - Epidemiological awareness per facility
 * 
 * This system continuously updates as data enters, providing context-aware AI assistance
 * that improves over time.
 */

import logger from '@/lib/logger';
import { orchestrateAI } from '@/lib/ai-orchestrator';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatientClinicalNarrative {
  patientId: string;
  /** AI-synthesized clinical story - updated on every encounter */
  narrative: {
    /** Chief complaints and presenting symptoms over time */
    presentingConcerns: Array<{
      concern: string;
      firstReported: string;
      lastUpdated: string;
      frequency: number;
      severity: 'mild' | 'moderate' | 'severe';
      status: 'active' | 'resolved' | 'chronic';
    }>;
    /** Key medical history synthesized from all encounters */
    medicalHistory: {
      chronicConditions: string[];
      pastSurgeries: string[];
      hospitalizations: string[];
      allergies: string[];
      medications: Array<{
        name: string;
        dose?: string;
        frequency?: string;
        startDate: string;
        endDate?: string;
        active: boolean;
      }>;
    };
    /** Social and family history */
    socialHistory: {
      occupation?: string;
      smoking?: 'never' | 'former' | 'current';
      alcohol?: 'never' | 'former' | 'current';
      livingSituation?: string;
      familyHistory: string[];
    };
    /** Trends and patterns detected by AI */
    patterns: Array<{
      pattern: string;
      confidence: number;
      evidence: string[];
      detectedAt: string;
    }>;
    /** Risk factors identified */
    riskFactors: Array<{
      factor: string;
      level: 'low' | 'medium' | 'high';
      category: 'lifestyle' | 'genetic' | 'environmental' | 'clinical';
    }>;
  };
  /** Last encounter summary for quick reference */
  lastEncounter: {
    date: string;
    chiefComplaint: string;
    diagnosis: string[];
    treatment: string[];
    followUp?: string;
  } | null;
  /** Health trajectory assessment */
  trajectory: {
    direction: 'improving' | 'stable' | 'declining' | 'uncertain';
    confidence: number;
    keyIndicators: string[];
    lastAssessed: string;
  };
  /** Version for optimistic concurrency */
  version: number;
  lastUpdated: string;
}

export interface ClinicianPatterns {
  clinicianId: string;
  /** Diagnostic style patterns */
  diagnosticStyle: {
    /** Common differential diagnoses they consider */
    preferredDifferentials: Record<string, string[]>;
    /** Tendency to order tests (conservative vs comprehensive) */
    testOrderingStyle: 'conservative' | 'moderate' | 'comprehensive';
    /** Common diagnoses they make */
    frequentDiagnoses: Record<string, number>;
    /** Time spent per patient type */
    consultationPatterns: {
      averageDurationMinutes: number;
      byComplaintType: Record<string, number>;
    };
  };
  /** Prescribing preferences */
  prescribingPreferences: {
    /** Preferred medications by condition */
    preferredMedications: Record<string, string[]>;
    /** Generic vs brand preference */
    genericPreference: number; // 0-1, where 1 = always generic
    /** Antibiotic stewardship score */
    antibioticStewardship: number; // 0-1, where 1 = excellent stewardship
    /** Controlled substance prescribing patterns */
    controlledSubstancePatterns: {
      frequency: number;
      types: string[];
    };
  };
  /** Override patterns - when they disagree with AI */
  overridePatterns: {
    /** Types of AI suggestions they commonly override */
    commonOverrides: Record<string, number>;
    /** Override rate by AI confidence level */
    overrideByConfidence: {
      high: number;
      medium: number;
      low: number;
    };
    /** Reasons for overrides (if documented) */
    overrideReasons: string[];
  };
  /** Learning metrics */
  learningMetrics: {
    /** AI suggestions accepted vs rejected */
    acceptanceRate: number;
    /** Improvement in diagnostic accuracy over time */
    diagnosticAccuracyTrend: 'improving' | 'stable' | 'declining';
    /** Areas where AI assistance is most valued */
    valuedAssistanceAreas: string[];
  };
  version: number;
  lastUpdated: string;
}

export interface FacilityEpidemiology {
  facilityId: string;
  /** Current disease outbreaks and alerts */
  currentOutbreaks: Array<{
    disease: string;
    confirmedCases: number;
    suspectedCases: number;
    deaths: number;
    startDate: string;
    status: 'active' | 'contained' | 'resolved';
    affectedDemographics: string[];
    geographicClusters: string[];
  }>;
  /** Disease burden - what conditions are presenting most */
  diseaseBurden: {
    topConditions: Array<{
      condition: string;
      icd10Code: string;
      count: number;
      trend: 'increasing' | 'stable' | 'decreasing';
      percentageOfTotal: number;
    }>;
    seasonalPatterns: Record<string, {
      peakMonths: number[];
      averageCases: number;
      trend: 'increasing' | 'stable' | 'decreasing';
    }>;
    demographicPatterns: Record<string, {
      ageGroup: string;
      gender: string;
      commonConditions: string[];
    }>;
  };
  /** Antimicrobial resistance patterns */
  antibiogram: {
    organism: string;
    antibiotic: string;
    resistanceRate: number;
    sampleSize: number;
    lastUpdated: string;
  }[];
  /** Resource utilization */
  resourceUtilization: {
    bedOccupancyRate: number;
    averageLengthOfStay: number;
    readmissionRate: number;
    referralRate: number;
    commonReferralReasons: string[];
  };
  /** Quality indicators */
  qualityIndicators: {
    maternalMortalityRatio: number;
    neonatalMortalityRate: number;
    surgicalSiteInfectionRate: number;
    medicationErrorRate: number;
    patientSatisfactionScore: number;
  };
  /** Population health metrics */
  populationHealth: {
    vaccinationCoverage: Record<string, number>;
    chronicDiseaseControl: Record<string, {
      controlled: number;
      uncontrolled: number;
      lostToFollowUp: number;
    }>;
    screeningRates: Record<string, number>;
  };
  version: number;
  lastUpdated: string;
}

// ─── In-Memory Cache (would be persisted to database in production) ──────────

const patientMemoryCache = new Map<string, PatientClinicalNarrative>();
const clinicianMemoryCache = new Map<string, ClinicianPatterns>();
const facilityMemoryCache = new Map<string, FacilityEpidemiology>();

// ─── Patient Memory Functions ────────────────────────────────────────────────

/**
 * Get or create patient clinical narrative
 */
export async function getPatientNarrative(patientId: string): Promise<PatientClinicalNarrative | null> {
  // Check cache first
  if (patientMemoryCache.has(patientId)) {
    return patientMemoryCache.get(patientId) || null;
  }
  
  // In production, fetch from database
  // For now, return null (new patient)
  return null;
}

/**
 * Create a new patient clinical narrative
 */
export function createPatientNarrative(
  patientId: string,
  initialData: Partial<PatientClinicalNarrative['narrative']>
): PatientClinicalNarrative {
  const now = new Date().toISOString();
  const narrative: PatientClinicalNarrative = {
    patientId,
    narrative: {
      presentingConcerns: [],
      medicalHistory: {
        chronicConditions: [],
        pastSurgeries: [],
        hospitalizations: [],
        allergies: [],
        medications: [],
      },
      socialHistory: {
        familyHistory: [],
      },
      patterns: [],
      riskFactors: [],
      ...initialData,
    },
    lastEncounter: null,
    trajectory: {
      direction: 'uncertain',
      confidence: 0,
      keyIndicators: [],
      lastAssessed: now,
    },
    version: 1,
    lastUpdated: now,
  };
  
  patientMemoryCache.set(patientId, narrative);
  return narrative;
}

/**
 * Update patient narrative with new encounter data
 * Uses AI to synthesize and update the clinical story
 */
export async function updatePatientNarrative(
  patientId: string,
  encounterData: {
    chiefComplaint: string;
    historyOfPresentIllness: string;
    physicalExam: string;
    assessment: string[];
    plan: string[];
    vitals?: Record<string, number>;
    labResults?: Array<{ test: string; value: string; unit: string }>;
  }
): Promise<PatientClinicalNarrative> {
  let narrative = await getPatientNarrative(patientId);
  
  if (!narrative) {
    narrative = createPatientNarrative(patientId, {});
  }
  
  // Use AI to synthesize the update
  const synthesisPrompt = `
Synthesize this new encounter data into the patient's clinical narrative.

Current narrative summary:
${JSON.stringify(narrative.narrative, null, 2)}

New encounter data:
${JSON.stringify(encounterData, null, 2)}

Provide updates to:
1. Presenting concerns (add new, update existing, mark resolved)
2. Medical history (add new conditions, update medications)
3. Patterns detected (identify any new trends)
4. Risk factors (update based on new data)
5. Trajectory assessment (improving/stable/declining?)

Return as JSON with only the fields that need updating.
`.trim();

  try {
    const aiResponse = await orchestrateAI({
      taskType: 'documentation',
      prompt: synthesisPrompt,
      systemInstruction: `You are an AI clinical documentation assistant. Synthesize encounter data into structured clinical narratives. 
      Focus on accuracy, completeness, and identifying important clinical patterns.
      Return only valid JSON with the fields that need updating.`,
      patientId,
      requireConsensus: false,
    });
    
    if (aiResponse.success && aiResponse.text) {
      const updates = JSON.parse(aiResponse.text);
      
      // Apply updates
      if (updates.presentingConcerns) {
        narrative.narrative.presentingConcerns = updates.presentingConcerns;
      }
      if (updates.medicalHistory) {
        narrative.narrative.medicalHistory = {
          ...narrative.narrative.medicalHistory,
          ...updates.medicalHistory,
        };
      }
      if (updates.patterns) {
        narrative.narrative.patterns = [
          ...narrative.narrative.patterns,
          ...updates.patterns,
        ];
      }
      if (updates.riskFactors) {
        narrative.narrative.riskFactors = updates.riskFactors;
      }
      if (updates.trajectory) {
        narrative.trajectory = updates.trajectory;
      }
      
      // Update last encounter
      narrative.lastEncounter = {
        date: new Date().toISOString(),
        chiefComplaint: encounterData.chiefComplaint,
        diagnosis: encounterData.assessment,
        treatment: encounterData.plan,
      };
      
      narrative.version++;
      narrative.lastUpdated = new Date().toISOString();
      
      patientMemoryCache.set(patientId, narrative);
      
      logger.info('[Clinical Memory] Patient narrative updated', {
        patientId,
        version: narrative.version,
      });
    }
  } catch (error) {
    logger.error('[Clinical Memory] Failed to update patient narrative', {
      patientId,
      error,
    });
    
    // Still update basic encounter info even if AI synthesis fails
    narrative.lastEncounter = {
      date: new Date().toISOString(),
      chiefComplaint: encounterData.chiefComplaint,
      diagnosis: encounterData.assessment,
      treatment: encounterData.plan,
    };
    narrative.version++;
    narrative.lastUpdated = new Date().toISOString();
    patientMemoryCache.set(patientId, narrative);
  }
  
  return narrative;
}

/**
 * Get intelligent patient summary for clinician review
 * This is what the clinician sees when they open a patient file
 */
export async function generatePatientSummary(patientId: string): Promise<{
  summary: string;
  keyChanges: string[];
  concerns: string[];
  recommendations: string[];
}> {
  const narrative = await getPatientNarrative(patientId);
  
  if (!narrative) {
    return {
      summary: 'No prior clinical history available.',
      keyChanges: [],
      concerns: [],
      recommendations: [],
    };
  }
  
  const summaryPrompt = `
Generate a concise clinical summary for this patient that a doctor can quickly review.

Patient narrative:
${JSON.stringify(narrative, null, 2)}

Provide:
1. A 3-4 sentence summary of the patient's overall health status
2. Key changes since last visit (if any)
3. Active concerns that need attention
4. Recommendations for this encounter

Return as JSON with fields: summary, keyChanges, concerns, recommendations.
`.trim();

  try {
    const aiResponse = await orchestrateAI({
      taskType: 'documentation',
      prompt: summaryPrompt,
      systemInstruction: 'You are an AI clinical assistant. Generate concise, actionable patient summaries for busy clinicians.',
      patientId,
      requireConsensus: false,
    });
    
    if (aiResponse.success && aiResponse.text) {
      return JSON.parse(aiResponse.text);
    }
  } catch (error) {
    logger.error('[Clinical Memory] Failed to generate patient summary', {
      patientId,
      error,
    });
  }
  
  // Fallback to basic summary
  return {
    summary: `Patient with ${narrative.narrative.medicalHistory.chronicConditions.length} chronic condition(s). 
    Last seen ${narrative.lastEncounter?.date ? 'on ' + new Date(narrative.lastEncounter.date).toLocaleDateString() : 'never'}.`,
    keyChanges: [],
    concerns: narrative.narrative.presentingConcerns
      .filter(c => c.status === 'active')
      .map(c => c.concern),
    recommendations: [],
  };
}

// ─── Clinician Memory Functions ──────────────────────────────────────────────

/**
 * Get or create clinician patterns
 */
export async function getClinicianPatterns(clinicianId: string): Promise<ClinicianPatterns | null> {
  if (clinicianMemoryCache.has(clinicianId)) {
    return clinicianMemoryCache.get(clinicianId) || null;
  }
  return null;
}

/**
 * Create new clinician patterns
 */
export function createClinicianPatterns(clinicianId: string): ClinicianPatterns {
  const now = new Date().toISOString();
  const patterns: ClinicianPatterns = {
    clinicianId,
    diagnosticStyle: {
      preferredDifferentials: {},
      testOrderingStyle: 'moderate',
      frequentDiagnoses: {},
      consultationPatterns: {
        averageDurationMinutes: 15,
        byComplaintType: {},
      },
    },
    prescribingPreferences: {
      preferredMedications: {},
      genericPreference: 0.8,
      antibioticStewardship: 1.0,
      controlledSubstancePatterns: {
        frequency: 0,
        types: [],
      },
    },
    overridePatterns: {
      commonOverrides: {},
      overrideByConfidence: {
        high: 0,
        medium: 0,
        low: 0,
      },
      overrideReasons: [],
    },
    learningMetrics: {
      acceptanceRate: 1.0,
      diagnosticAccuracyTrend: 'stable',
      valuedAssistanceAreas: [],
    },
    version: 1,
    lastUpdated: now,
  };
  
  clinicianMemoryCache.set(clinicianId, patterns);
  return patterns;
}

/**
 * Record AI suggestion and whether it was accepted or overridden
 */
export async function recordAIInteraction(
  clinicianId: string,
  interaction: {
    taskType: string;
    aiSuggestion: string;
    accepted: boolean;
    confidenceScore: number;
    overrideReason?: string;
  }
): Promise<void> {
  let patterns = await getClinicianPatterns(clinicianId);
  
  if (!patterns) {
    patterns = createClinicianPatterns(clinicianId);
  }
  
  // Update override patterns
  if (!interaction.accepted) {
    const overrideKey = interaction.taskType;
    patterns.overridePatterns.commonOverrides[overrideKey] = 
      (patterns.overridePatterns.commonOverrides[overrideKey] || 0) + 1;
    
    const confidenceLevel = interaction.confidenceScore >= 0.9 ? 'high' :
                           interaction.confidenceScore >= 0.7 ? 'medium' : 'low';
    patterns.overridePatterns.overrideByConfidence[confidenceLevel]++;
    
    if (interaction.overrideReason) {
      if (!patterns.overridePatterns.overrideReasons.includes(interaction.overrideReason)) {
        patterns.overridePatterns.overrideReasons.push(interaction.overrideReason);
      }
    }
  }
  
  // Update acceptance rate
  const totalInteractions = Object.values(patterns.overridePatterns.commonOverrides).reduce((a, b) => a + b, 0);
  const totalOverrides = Object.values(patterns.overridePatterns.commonOverrides).reduce((a, b) => a + b, 0);
  patterns.learningMetrics.acceptanceRate = totalInteractions > 0 
    ? 1 - (totalOverrides / totalInteractions)
    : 1.0;
  
  patterns.version++;
  patterns.lastUpdated = new Date().toISOString();
  
  clinicianMemoryCache.set(clinicianId, patterns);
  
  logger.info('[Clinical Memory] Clinician interaction recorded', {
    clinicianId,
    accepted: interaction.accepted,
    confidenceLevel: interaction.confidenceScore,
  });
}

/**
 * Get personalized AI recommendations for a clinician
 */
export async function getPersonalizedRecommendations(
  clinicianId: string,
  context: {
    patientSymptoms: string[];
    patientVitals?: Record<string, number>;
  }
): Promise<{
  suggestedDifferentials: string[];
  suggestedTests: string[];
  suggestedProtocols: string[];
}> {
  const patterns = await getClinicianPatterns(clinicianId);
  
  if (!patterns) {
    return {
      suggestedDifferentials: [],
      suggestedTests: [],
      suggestedProtocols: [],
    };
  }
  
  // Use AI to generate personalized recommendations based on clinician's style
  const recommendationPrompt = `
Generate personalized clinical recommendations based on this clinician's practice patterns.

Clinician's diagnostic style:
${JSON.stringify(patterns.diagnosticStyle, null, 2)}

Clinician's prescribing preferences:
${JSON.stringify(patterns.prescribingPreferences, null, 2)}

Current patient presentation:
- Symptoms: ${context.patientSymptoms.join(', ')}
${context.patientVitals ? `- Vitals: ${JSON.stringify(context.patientVitals)}` : ''}

Provide recommendations that align with this clinician's style while ensuring clinical safety.
Return as JSON with fields: suggestedDifferentials, suggestedTests, suggestedProtocols.
`.trim();

  try {
    const aiResponse = await orchestrateAI({
      taskType: 'clinical_query',
      prompt: recommendationPrompt,
      systemInstruction: 'You are an AI clinical assistant that personalizes recommendations based on individual clinician patterns.',
      requireConsensus: false,
    });
    
    if (aiResponse.success && aiResponse.text) {
      return JSON.parse(aiResponse.text);
    }
  } catch (error) {
    logger.error('[Clinical Memory] Failed to generate personalized recommendations', {
      clinicianId,
      error,
    });
  }
  
  return {
    suggestedDifferentials: [],
    suggestedTests: [],
    suggestedProtocols: [],
  };
}

// ─── Facility Memory Functions ───────────────────────────────────────────────

/**
 * Get or create facility epidemiology
 */
export async function getFacilityEpidemiology(facilityId: string): Promise<FacilityEpidemiology | null> {
  if (facilityMemoryCache.has(facilityId)) {
    return facilityMemoryCache.get(facilityId) || null;
  }
  return null;
}

/**
 * Create new facility epidemiology
 */
export function createFacilityEpidemiology(facilityId: string): FacilityEpidemiology {
  const now = new Date().toISOString();
  const epidemiology: FacilityEpidemiology = {
    facilityId,
    currentOutbreaks: [],
    diseaseBurden: {
      topConditions: [],
      seasonalPatterns: {},
      demographicPatterns: {},
    },
    antibiogram: [],
    resourceUtilization: {
      bedOccupancyRate: 0,
      averageLengthOfStay: 0,
      readmissionRate: 0,
      referralRate: 0,
      commonReferralReasons: [],
    },
    qualityIndicators: {
      maternalMortalityRatio: 0,
      neonatalMortalityRate: 0,
      surgicalSiteInfectionRate: 0,
      medicationErrorRate: 0,
      patientSatisfactionScore: 0,
    },
    populationHealth: {
      vaccinationCoverage: {},
      chronicDiseaseControl: {},
      screeningRates: {},
    },
    version: 1,
    lastUpdated: now,
  };
  
  facilityMemoryCache.set(facilityId, epidemiology);
  return epidemiology;
}

/**
 * Update facility epidemiology with new case data
 */
export async function updateFacilityEpidemiology(
  facilityId: string,
  caseData: {
    diagnosis: string;
    icd10Code: string;
    patientAge: number;
    patientGender: string;
    outcome?: 'discharged' | 'admitted' | 'transferred' | 'died';
    labResults?: Array<{ test: string; value: string; unit: string }>;
  }
): Promise<FacilityEpidemiology> {
  let epidemiology = await getFacilityEpidemiology(facilityId);
  
  if (!epidemiology) {
    epidemiology = createFacilityEpidemiology(facilityId);
  }
  
  // Use AI to update epidemiological patterns
  const updatePrompt = `
Update facility epidemiology based on this new case.

Current epidemiology:
${JSON.stringify({
  currentOutbreaks: epidemiology.currentOutbreaks,
  topConditions: epidemiology.diseaseBurden.topConditions,
}, null, 2)}

New case:
${JSON.stringify(caseData, null, 2)}

Provide updates to:
1. Disease burden (update counts, detect trends)
2. Outbreak detection (flag any unusual clustering)
3. Demographic patterns (update age/gender distributions)

Return as JSON with only the fields that need updating.
`.trim();

  try {
    const aiResponse = await orchestrateAI({
      taskType: 'population_health',
      prompt: updatePrompt,
      systemInstruction: 'You are an AI epidemiologist. Analyze case data to update facility-level disease surveillance.',
      facilityId,
      requireConsensus: false,
    });
    
    if (aiResponse.success && aiResponse.text) {
      const updates = JSON.parse(aiResponse.text);
      
      if (updates.diseaseBurden) {
        epidemiology.diseaseBurden = {
          ...epidemiology.diseaseBurden,
          ...updates.diseaseBurden,
        };
      }
      if (updates.currentOutbreaks) {
        epidemiology.currentOutbreaks = updates.currentOutbreaks;
      }
      
      epidemiology.version++;
      epidemiology.lastUpdated = new Date().toISOString();
      
      facilityMemoryCache.set(facilityId, epidemiology);
      
      logger.info('[Clinical Memory] Facility epidemiology updated', {
        facilityId,
        version: epidemiology.version,
      });
    }
  } catch (error) {
    logger.error('[Clinical Memory] Failed to update facility epidemiology', {
      facilityId,
      error,
    });
  }
  
  return epidemiology;
}

/**
 * Get context-aware differential diagnosis suggestions based on facility epidemiology
 */
export async function getContextAwareDifferentials(
  facilityId: string,
  symptoms: string[],
  patientDemographics: {
    age: number;
    gender: string;
  }
): Promise<Array<{
  diagnosis: string;
  probability: number;
  reasoning: string;
  epidemiologyContext: string;
}>> {
  const epidemiology = await getFacilityEpidemiology(facilityId);
  
  if (!epidemiology) {
    return [];
  }
  
  const differentialPrompt = `
Generate context-aware differential diagnoses based on facility epidemiology.

Facility epidemiology (current disease patterns):
${JSON.stringify({
  currentOutbreaks: epidemiology.currentOutbreaks,
  topConditions: epidemiology.diseaseBurden.topConditions.slice(0, 10),
  seasonalPatterns: epidemiology.diseaseBurden.seasonalPatterns,
}, null, 2)}

Patient presentation:
- Symptoms: ${symptoms.join(', ')}
- Age: ${patientDemographics.age}
- Gender: ${patientDemographics.gender}
- Current month: ${new Date().getMonth() + 1}

Generate differential diagnoses that account for:
1. Local disease prevalence
2. Current outbreaks
3. Seasonal patterns
4. Patient demographics

Return as JSON array with fields: diagnosis, probability (0-1), reasoning, epidemiologyContext.
`.trim();

  try {
    const aiResponse = await orchestrateAI({
      taskType: 'diagnosis',
      prompt: differentialPrompt,
      systemInstruction: 'You are an AI epidemiologist and clinician. Generate differentials that account for local disease patterns.',
      facilityId,
      requireConsensus: true,
    });
    
    if (aiResponse.success && aiResponse.text) {
      return JSON.parse(aiResponse.text);
    }
  } catch (error) {
    logger.error('[Clinical Memory] Failed to generate context-aware differentials', {
      facilityId,
      error,
    });
  }
  
  return [];
}

/**
 * Check for potential outbreak based on recent case patterns
 */
export async function checkForOutbreak(
  facilityId: string,
  recentCases: Array<{
    diagnosis: string;
    date: string;
    patientAge: number;
    location?: string;
  }>
): Promise<{
  outbreakDetected: boolean;
  disease?: string;
  confidence: number;
  evidence: string[];
  recommendedActions: string[];
}> {
  const epidemiology = await getFacilityEpidemiology(facilityId);
  
  if (!epidemiology) {
    return {
      outbreakDetected: false,
      confidence: 0,
      evidence: [],
      recommendedActions: [],
    };
  }
  
  const outbreakPrompt = `
Analyze these recent cases for potential outbreak detection.

Baseline epidemiology:
${JSON.stringify({
  topConditions: epidemiology.diseaseBurden.topConditions,
  seasonalPatterns: epidemiology.diseaseBurden.seasonalPatterns,
}, null, 2)}

Recent cases (last 7 days):
${JSON.stringify(recentCases, null, 2)}

Detect any unusual clustering or increase in specific conditions.
Consider:
1. Absolute increase in cases
2. Geographic clustering
3. Demographic patterns
4. Seasonal expectations

Return as JSON with fields: outbreakDetected, disease, confidence, evidence, recommendedActions.
`.trim();

  try {
    const aiResponse = await orchestrateAI({
      taskType: 'population_health',
      prompt: outbreakPrompt,
      systemInstruction: 'You are an AI epidemiologist specialized in outbreak detection. Be conservative - false positives are costly.',
      facilityId,
      requireConsensus: true,
    });
    
    if (aiResponse.success && aiResponse.text) {
      return JSON.parse(aiResponse.text);
    }
  } catch (error) {
    logger.error('[Clinical Memory] Failed to check for outbreak', {
      facilityId,
      error,
    });
  }
  
  return {
    outbreakDetected: false,
    confidence: 0,
    evidence: [],
    recommendedActions: [],
  };
}

// ─── Export for API usage ───────────────────────────────────────────────────

export const ClinicalMemory = {
  // Patient Memory
  getPatientNarrative,
  createPatientNarrative,
  updatePatientNarrative,
  generatePatientSummary,
  
  // Clinician Memory
  getClinicianPatterns,
  createClinicianPatterns,
  recordAIInteraction,
  getPersonalizedRecommendations,
  
  // Facility Memory
  getFacilityEpidemiology,
  createFacilityEpidemiology,
  updateFacilityEpidemiology,
  getContextAwareDifferentials,
  checkForOutbreak,
};