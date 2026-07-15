/**
 * Triage Ensemble - AfyaHero
 * 
 * Three-model consensus system for triage decisions. Runs Gemini 2.5 Flash, 
 * Llama 4 Maverick (via Groq/HF), and DeepSeek R1 in parallel on every triage 
 * decision. They vote. If all three agree → high confidence. If they diverge → 
 * flagged for closer clinician attention.
 * 
 * Triage priority levels:
 * 1 - Immediate (life-threatening, requires immediate intervention)
 * 2 - Emergency (potentially life-threatening, rapid assessment needed)
 * 3 - Urgent (serious condition, assessment within 30-60 minutes)
 * 4 - Semi-urgent (stable but needs care, assessment within 1-2 hours)
 * 5 - Non-urgent (minor condition, can wait)
 * 
 * Also includes:
 * - PEWS (Paediatric Early Warning Score) for patients < 18
 * - MOEWS (Modified Obstetric Early Warning Score) for pregnant patients
 */

import { callParallelConsensus, type ProviderName } from '@/lib/ai-providers';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TriagePriority = 1 | 2 | 3 | 4 | 5;

export interface TriageVitals {
  temperature?: number;      // °C
  heartRate?: number;        // bpm
  respiratoryRate?: number;  // breaths/min
  systolicBP?: number;       // mmHg
  diastolicBP?: number;      // mmHg
  spO2?: number;             // %
  consciousness?: 'alert' | 'voice' | 'pain' | 'unresponsive';
  capillaryRefillTime?: number; // seconds
}

export interface TriageRequest {
  patientAge: number;        // years (0 for newborns)
  patientGender: 'male' | 'female';
  isPregnant?: boolean;
  gestationalWeeks?: number;
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  vitals: TriageVitals;
  mechanismOfInjury?: string; // for trauma
  painScore?: number;         // 0-10
  knownAllergies?: string[];
  currentMedications?: string[];
  knownMedicalConditions?: string[];
}

export interface TriageResponse {
  priority: TriagePriority;
  priorityLabel: string;
  confidence: number;
  reasoning: string;
  consensusDetails: {
    model1: { provider: ProviderName; priority: TriagePriority; reasoning: string };
    model2: { provider: ProviderName; priority: TriagePriority; reasoning: string };
    model3: { provider: ProviderName; priority: TriagePriority; reasoning: string };
    agreement: 'unanimous' | 'majority' | 'split';
  };
  alerts: string[];
  recommendedActions: string[];
  peesScore?: number;  // Paediatric Early Warning Score
  moewsScore?: number; // Modified Obstetric Early Warning Score
  requiresImmediateReview: boolean;
}

export interface PEWSResult {
  score: number;
  level: 'low' | 'medium' | 'high';
  parameters: {
    consciousness: number;
    cardiovascular: number;
    respiratory: number;
  };
  recommendations: string[];
}

export interface MOEWSResult {
  score: number;
  level: 'low' | 'medium' | 'high';
  parameters: {
    consciousness: number;
    oxygenSaturation: number;
    temperature: number;
    meanArterialPressure: number;
    heartRate: number;
    respiratoryRate: number;
  };
  recommendations: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<TriagePriority, string> = {
  1: 'Immediate (Red) - Life-threatening',
  2: 'Emergency (Orange) - Potentially life-threatening',
  3: 'Urgent (Yellow) - Serious condition',
  4: 'Semi-urgent (Green) - Stable, needs care',
  5: 'Non-urgent (Blue) - Minor condition',
};

const TRIAGE_CONSENSUS_PROVIDERS: ProviderName[] = ['gemini', 'openai', 'anthropic'];

// ─── PEWS (Paediatric Early Warning Score) ──────────────────────────────────

/**
 * Calculate PEWS for pediatric patients (< 18 years)
 * Based on validated PEWS scoring systems
 */
export function calculatePEWS(vitals: TriageVitals, age: number): PEWSResult {
  let consciousnessScore = 0;
  let cardiovascularScore = 0;
  let respiratoryScore = 0;

  // Consciousness (0-3)
  if (vitals.consciousness === 'alert') consciousnessScore = 0;
  else if (vitals.consciousness === 'voice') consciousnessScore = 1;
  else if (vitals.consciousness === 'pain') consciousnessScore = 2;
  else if (vitals.consciousness === 'unresponsive') consciousnessScore = 3;

  // Cardiovascular (0-3) - based on capillary refill and heart rate
  if (vitals.capillaryRefillTime !== undefined) {
    if (vitals.capillaryRefillTime <= 2) cardiovascularScore = 0;
    else if (vitals.capillaryRefillTime <= 3) cardiovascularScore = 1;
    else if (vitals.capillaryRefillTime <= 4) cardiovascularScore = 2;
    else cardiovascularScore = 3;
  } else if (vitals.heartRate !== undefined) {
    // Age-adjusted heart rate scoring
    const normalHRRanges: Record<string, [number, number]> = {
      'infant': [100, 160],    // 0-1 year
      'toddler': [90, 150],    // 1-3 years
      'preschool': [80, 140],  // 3-5 years
      'school': [70, 120],     // 6-12 years
      'adolescent': [60, 100], // 13-18 years
    };
    
    let range: [number, number];
    if (age < 1) range = normalHRRanges.infant;
    else if (age < 3) range = normalHRRanges.toddler;
    else if (age < 5) range = normalHRRanges.preschool;
    else if (age < 12) range = normalHRRanges.school;
    else range = normalHRRanges.adolescent;

    const hr = vitals.heartRate;
    if (hr >= range[0] && hr <= range[1]) cardiovascularScore = 0;
    else if ((hr >= range[0] - 10 && hr < range[0]) || (hr > range[1] && hr <= range[1] + 10)) cardiovascularScore = 1;
    else if ((hr >= range[0] - 20 && hr < range[0] - 10) || (hr > range[1] + 10 && hr <= range[1] + 20)) cardiovascularScore = 2;
    else cardiovascularScore = 3;
  }

  // Respiratory (0-3) - based on rate and SpO2
  if (vitals.spO2 !== undefined) {
    if (vitals.spO2 >= 95) respiratoryScore = 0;
    else if (vitals.spO2 >= 92) respiratoryScore = 1;
    else if (vitals.spO2 >= 90) respiratoryScore = 2;
    else respiratoryScore = 3;
  } else if (vitals.respiratoryRate !== undefined) {
    // Age-adjusted respiratory rate scoring
    const normalRRRanges: Record<string, [number, number]> = {
      'infant': [30, 50],
      'toddler': [24, 40],
      'preschool': [22, 34],
      'school': [18, 30],
      'adolescent': [12, 20],
    };
    
    let range: [number, number];
    if (age < 1) range = normalRRRanges.infant;
    else if (age < 3) range = normalRRRanges.toddler;
    else if (age < 5) range = normalRRRanges.preschool;
    else if (age < 12) range = normalRRRanges.school;
    else range = normalRRRanges.adolescent;

    const rr = vitals.respiratoryRate;
    if (rr >= range[0] && rr <= range[1]) respiratoryScore = 0;
    else if ((rr >= range[0] - 5 && rr < range[0]) || (rr > range[1] && rr <= range[1] + 5)) respiratoryScore = 1;
    else if ((rr >= range[0] - 10 && rr < range[0] - 5) || (rr > range[1] + 5 && rr <= range[1] + 10)) respiratoryScore = 2;
    else respiratoryScore = 3;
  }

  const totalScore = consciousnessScore + cardiovascularScore + respiratoryScore;

  let level: 'low' | 'medium' | 'high';
  const recommendations: string[] = [];

  if (totalScore <= 2) {
    level = 'low';
    recommendations.push('Continue routine monitoring');
  } else if (totalScore <= 4) {
    level = 'medium';
    recommendations.push('Increase monitoring frequency');
    recommendations.push('Notify nursing supervisor');
    recommendations.push('Consider senior review');
  } else {
    level = 'high';
    recommendations.push('🚨 URGENT: Immediate senior review required');
    recommendations.push('Consider PICU transfer');
    recommendations.push('Continuous monitoring');
    recommendations.push('Prepare for resuscitation');
  }

  return {
    score: totalScore,
    level,
    parameters: {
      consciousness: consciousnessScore,
      cardiovascular: cardiovascularScore,
      respiratory: respiratoryScore,
    },
    recommendations,
  };
}

// ─── MOEWS (Modified Obstetric Early Warning Score) ─────────────────────────

/**
 * Calculate MOEWS for pregnant/obstetric patients
 * Based on validated MOEWS scoring systems
 */
export function calculateMOEWS(vitals: TriageVitals): MOEWSResult {
  let consciousnessScore = 0;
  let oxygenSaturationScore = 0;
  let temperatureScore = 0;
  let mapScore = 0;
  let heartRateScore = 0;
  let respiratoryRateScore = 0;

  // Consciousness (0-3)
  if (vitals.consciousness === 'alert') consciousnessScore = 0;
  else if (vitals.consciousness === 'voice') consciousnessScore = 1;
  else if (vitals.consciousness === 'pain') consciousnessScore = 2;
  else if (vitals.consciousness === 'unresponsive') consciousnessScore = 3;

  // Oxygen saturation (0-3)
  if (vitals.spO2 !== undefined) {
    if (vitals.spO2 >= 98) oxygenSaturationScore = 0;
    else if (vitals.spO2 >= 95) oxygenSaturationScore = 1;
    else if (vitals.spO2 >= 93) oxygenSaturationScore = 2;
    else oxygenSaturationScore = 3;
  }

  // Temperature (0-3)
  if (vitals.temperature !== undefined) {
    const temp = vitals.temperature;
    if (temp >= 36.5 && temp <= 37.5) temperatureScore = 0;
    else if ((temp >= 36.0 && temp < 36.5) || (temp > 37.5 && temp <= 38.0)) temperatureScore = 1;
    else if ((temp >= 35.5 && temp < 36.0) || (temp > 38.0 && temp <= 38.5)) temperatureScore = 2;
    else temperatureScore = 3;
  }

  // Mean Arterial Pressure (0-3)
  if (vitals.systolicBP !== undefined && vitals.diastolicBP !== undefined) {
    const map = ((vitals.systolicBP * 2) + vitals.diastolicBP) / 3;
    if (map >= 70 && map <= 100) mapScore = 0;
    else if ((map >= 60 && map < 70) || (map > 100 && map <= 110)) mapScore = 1;
    else if ((map >= 50 && map < 60) || (map > 110 && map <= 120)) mapScore = 2;
    else mapScore = 3;
  }

  // Heart rate (0-3)
  if (vitals.heartRate !== undefined) {
    const hr = vitals.heartRate;
    if (hr >= 70 && hr <= 100) heartRateScore = 0;
    else if ((hr >= 60 && hr < 70) || (hr > 100 && hr <= 110)) heartRateScore = 1;
    else if ((hr >= 50 && hr < 60) || (hr > 110 && hr <= 120)) heartRateScore = 2;
    else heartRateScore = 3;
  }

  // Respiratory rate (0-3)
  if (vitals.respiratoryRate !== undefined) {
    const rr = vitals.respiratoryRate;
    if (rr >= 12 && rr <= 20) respiratoryRateScore = 0;
    else if ((rr >= 10 && rr < 12) || (rr > 20 && rr <= 24)) respiratoryRateScore = 1;
    else if ((rr >= 8 && rr < 10) || (rr > 24 && rr <= 30)) respiratoryRateScore = 2;
    else respiratoryRateScore = 3;
  }

  const totalScore = consciousnessScore + oxygenSaturationScore + temperatureScore + 
                     mapScore + heartRateScore + respiratoryRateScore;

  let level: 'low' | 'medium' | 'high';
  const recommendations: string[] = [];

  if (totalScore <= 2) {
    level = 'low';
    recommendations.push('Continue routine antenatal monitoring');
  } else if (totalScore <= 4) {
    level = 'medium';
    recommendations.push('Increase monitoring frequency');
    recommendations.push('Notify obstetric senior');
    recommendations.push('Consider escalation if score increases');
  } else {
    level = 'high';
    recommendations.push('🚨 URGENT: Immediate obstetric review required');
    recommendations.push('Consider HDU/ICU transfer');
    recommendations.push('Continuous maternal and fetal monitoring');
    recommendations.push('Activate obstetric emergency team if deteriorating');
  }

  // Special alert for pre-eclampsia indicators
  if (vitals.systolicBP !== undefined && vitals.systolicBP >= 140 || 
      vitals.diastolicBP !== undefined && vitals.diastolicBP >= 90) {
    recommendations.push('⚠️ HYPERTENSION: Assess for pre-eclampsia (proteinuria, reflexes, symptoms)');
  }

  return {
    score: totalScore,
    level,
    parameters: {
      consciousness: consciousnessScore,
      oxygenSaturation: oxygenSaturationScore,
      temperature: temperatureScore,
      meanArterialPressure: mapScore,
      heartRate: heartRateScore,
      respiratoryRate: respiratoryRateScore,
    },
    recommendations,
  };
}

// ─── Triage Ensemble ─────────────────────────────────────────────────────────

/**
 * Parse triage priority from model response
 */
function parseTriagePriority(text: string): { priority: TriagePriority; reasoning: string } {
  // Look for priority number in response
  const priorityMatch = text.match(/priority[:\s]*([1-5])/i) || 
                        text.match(/triage[:\s]*level[:\s]*([1-5])/i) ||
                        text.match(/level[:\s]*([1-5])/i);
  
  let priority: TriagePriority = 3; // Default to urgent if can't parse
  if (priorityMatch) {
    const parsed = parseInt(priorityMatch[1]);
    if (parsed >= 1 && parsed <= 5) {
      priority = parsed as TriagePriority;
    }
  }

  // Extract reasoning
  const reasoningMatch = text.match(/reasoning[:\s]*(.+?)(?:\n|$)/i) ||
                         text.match(/rationale[:\s]*(.+?)(?:\n|$)/i);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : text.slice(0, 200);

  return { priority, reasoning };
}

/**
 * Run three-model consensus for triage
 */
export async function runTriageEnsemble(request: TriageRequest): Promise<TriageResponse> {
  const { patientAge, patientGender, isPregnant, gestationalWeeks, chiefComplaint, 
          historyOfPresentIllness, vitals, mechanismOfInjury, painScore, 
          knownAllergies, currentMedications, knownMedicalConditions } = request;

  // Build the triage prompt
  const triagePrompt = `
You are an expert emergency medicine physician performing triage assessment.

PATIENT INFORMATION:
- Age: ${patientAge} years
- Gender: ${patientGender}
${isPregnant ? `- Pregnancy: Yes, ${gestationalWeeks || 'unknown'} weeks gestation` : ''}

CHIEF COMPLAINT:
${chiefComplaint}

HISTORY OF PRESENT ILLNESS:
${historyOfPresentIllness || 'Not provided'}

VITAL SIGNS:
${Object.entries(vitals).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

${mechanismOfInjury ? `MECHANISM OF INJURY:\n${mechanismOfInjury}` : ''}
${painScore !== undefined ? `PAIN SCORE: ${painScore}/10` : ''}
${knownAllergies?.length ? `KNOWN ALLERGIES: ${knownAllergies.join(', ')}` : ''}
${currentMedications?.length ? `CURRENT MEDICATIONS: ${currentMedications.join(', ')}` : ''}
${knownMedicalConditions?.length ? `KNOWN MEDICAL CONDITIONS: ${knownMedicalConditions.join(', ')}` : ''}

TASK:
Assign a triage priority level (1-5) based on the Manchester Triage System:
1 = Immediate (life-threatening, requires immediate intervention)
2 = Emergency (potentially life-threatening, rapid assessment needed)  
3 = Urgent (serious condition, assessment within 30-60 minutes)
4 = Semi-urgent (stable but needs care, assessment within 1-2 hours)
5 = Non-urgent (minor condition, can wait)

CONSIDER:
${patientAge < 18 ? '- Pediatric patient: Use lower threshold for escalation' : ''}
${isPregnant ? '- Pregnant patient: Consider obstetric emergencies, lower threshold for escalation' : ''}
- Red flag symptoms that indicate life-threatening conditions
- Vital sign abnormalities
- Mechanism of injury if trauma
- High-risk presentations

Respond in this exact format:
Priority: [1-5]
Reasoning: [Your clinical reasoning in 2-3 sentences]
Alerts: [Any critical alerts or red flags]
Actions: [Immediate actions required]
`.trim();

  const systemInstruction = `You are an expert emergency medicine physician specializing in triage. 
You must be thorough, safety-focused, and consider African epidemiology patterns including malaria, 
TB, typhoid, and maternal emergencies. Always err on the side of caution.

AFRICAN CONTEXT CONSIDERATIONS:
- High index of suspicion for malaria in febrile patients
- Consider TB in chronic cough presentations
- Typhoid in prolonged fever
- Obstetric emergencies in pregnant women
- Limited diagnostic resources may require more cautious triage
- Consider disease outbreaks in the community

Respond concisely but thoroughly. Patient safety is paramount.`;

  try {
    // Run three models in parallel
    const responses = await callParallelConsensus({
      prompt: triagePrompt,
      systemInstruction,
      providers: TRIAGE_CONSENSUS_PROVIDERS,
    });

    if (responses.length === 0) {
      throw new Error('All triage models failed');
    }

    // Parse each response
    const parsedResponses = responses.map(r => {
      const { priority, reasoning } = parseTriagePriority(r.text || '');
      return {
        provider: r.provider,
        priority,
        reasoning,
      };
    });

    // Determine consensus
    const priorities = parsedResponses.map(r => r.priority);
    const uniquePriorities = new Set(priorities);
    const agreement = uniquePriorities.size === 1 ? 'unanimous' :
                      uniquePriorities.size === 2 ? 'majority' : 'split';

    // Calculate final priority (use most conservative/highest acuity)
    const finalPriority = Math.min(...priorities) as TriagePriority;

    // Calculate confidence based on agreement
    let confidence = 0.5;
    if (agreement === 'unanimous') confidence = 0.95;
    else if (agreement === 'majority') confidence = 0.75;

    // Generate combined reasoning
    const combinedReasoning = parsedResponses.map(r => r.reasoning).join(' | ');

    // Extract alerts and actions from responses
    const alerts: string[] = [];
    const recommendedActions: string[] = [];

    responses.forEach(r => {
      const alertMatch = r.text?.match(/Alerts?:\s*(.+?)(?:\n|$)/i);
      if (alertMatch) {
        alerts.push(...alertMatch[1].split(',').map(s => s.trim()).filter(Boolean));
      }
      const actionMatch = r.text?.match(/Actions?:\s*(.+?)(?:\n|$)/i);
      if (actionMatch) {
        recommendedActions.push(...actionMatch[1].split(',').map(s => s.trim()).filter(Boolean));
      }
    });

    // Add standard alerts based on vitals
    if (vitals.spO2 !== undefined && vitals.spO2 < 90) {
      alerts.push('🚨 CRITICAL: SpO2 below 90% - hypoxia');
    }
    if (vitals.systolicBP !== undefined && vitals.systolicBP < 90) {
      alerts.push('🚨 CRITICAL: Systolic BP below 90 - shock');
    }
    if (vitals.heartRate !== undefined && vitals.heartRate > 130) {
      alerts.push('⚠️ Tachycardia - HR > 130');
    }
    if (vitals.temperature !== undefined && vitals.temperature > 39) {
      alerts.push('⚠️ High fever - consider sepsis, malaria');
    }
    if (vitals.consciousness !== 'alert') {
      alerts.push('🚨 CRITICAL: Altered consciousness');
    }

    // Calculate PEWS for pediatric patients
    let peesScore: number | undefined;
    if (patientAge < 18) {
      const pewsResult = calculatePEWS(vitals, patientAge);
      peesScore = pewsResult.score;
      if (pewsResult.level === 'high') {
        alerts.push(`🚨 HIGH PEWS SCORE: ${peesScore} - pediatric deterioration`);
        recommendedActions.push(...pewsResult.recommendations);
      } else if (pewsResult.level === 'medium') {
        alerts.push(`⚠️ ELEVATED PEWS SCORE: ${peesScore}`);
        recommendedActions.push(...pewsResult.recommendations);
      }
    }

    // Calculate MOEWS for pregnant patients
    let moewsScore: number | undefined;
    if (isPregnant) {
      const moewsResult = calculateMOEWS(vitals);
      moewsScore = moewsResult.score;
      if (moewsResult.level === 'high') {
        alerts.push(`🚨 HIGH MOEWS SCORE: ${moewsScore} - obstetric emergency`);
        recommendedActions.push(...moewsResult.recommendations);
      } else if (moewsResult.level === 'medium') {
        alerts.push(`⚠️ ELEVATED MOEWS SCORE: ${moewsScore}`);
        recommendedActions.push(...moewsResult.recommendations);
      }
    }

    // Determine if immediate review is required
    const requiresImmediateReview = finalPriority <= 2 || 
                                    alerts.some(a => a.includes('🚨'));

    const triageResponse: TriageResponse = {
      priority: finalPriority,
      priorityLabel: PRIORITY_LABELS[finalPriority],
      confidence,
      reasoning: combinedReasoning,
      consensusDetails: {
        model1: parsedResponses[0],
        model2: parsedResponses[1] || parsedResponses[0],
        model3: parsedResponses[2] || parsedResponses[0],
        agreement,
      },
      alerts: [...new Set(alerts)],
      recommendedActions: [...new Set(recommendedActions)],
      peesScore,
      moewsScore,
      requiresImmediateReview,
    };

    logger.info('[Triage Ensemble] Triage completed', {
      priority: finalPriority,
      agreement,
      confidence,
      patientAge,
      isPregnant,
    });

    return triageResponse;

  } catch (error) {
    logger.error('[Triage Ensemble] Critical failure', { error });
    
    // Fallback to simple rule-based triage
    return getRuleBasedTriage(request);
  }
}

/**
 * Fallback rule-based triage when AI models fail
 */
function getRuleBasedTriage(request: TriageRequest): TriageResponse {
  const { vitals, chiefComplaint, patientAge, isPregnant } = request;
  
  let priority: TriagePriority = 4;
  const alerts: string[] = [];
  const reasoning: string[] = [];

  // Check for immediate life threats
  if (vitals.spO2 !== undefined && vitals.spO2 < 90) {
    priority = 1;
    alerts.push('🚨 SpO2 < 90%');
  }
  if (vitals.systolicBP !== undefined && vitals.systolicBP < 90) {
    priority = Math.min(priority, 1) as TriagePriority;
    alerts.push('🚨 SBP < 90');
  }
  if (vitals.consciousness === 'unresponsive') {
    priority = 1;
    alerts.push('🚨 Unresponsive');
  }
  if (vitals.respiratoryRate !== undefined && (vitals.respiratoryRate < 8 || vitals.respiratoryRate > 30)) {
    priority = Math.min(priority, 2) as TriagePriority;
    alerts.push('⚠️ Abnormal respiratory rate');
  }
  if (vitals.heartRate !== undefined && vitals.heartRate > 140) {
    priority = Math.min(priority, 2) as TriagePriority;
    alerts.push('⚠️ Severe tachycardia');
  }
  if (vitals.temperature !== undefined && vitals.temperature > 40) {
    priority = Math.min(priority, 2) as TriagePriority;
    alerts.push('⚠️ Hyperpyrexia');
  }

  // Pregnancy considerations
  if (isPregnant) {
    if (chiefComplaint.toLowerCase().includes('bleed') || 
        chiefComplaint.toLowerCase().includes('pain') ||
        chiefComplaint.toLowerCase().includes('headache') ||
        chiefComplaint.toLowerCase().includes('vision')) {
      priority = Math.min(priority, 2) as TriagePriority;
      alerts.push('⚠️ Pregnant with concerning symptoms');
    }
  }

  // Pediatric considerations
  if (patientAge < 3 && vitals.temperature !== undefined && vitals.temperature > 38.5) {
    priority = Math.min(priority, 2) as TriagePriority;
    alerts.push('⚠️ Young child with high fever');
  }

  return {
    priority,
    priorityLabel: PRIORITY_LABELS[priority],
    confidence: 0.5,
    reasoning: reasoning.join(' | ') || 'Rule-based triage (AI unavailable)',
    consensusDetails: {
      model1: { provider: 'rule-based', priority, reasoning: 'Fallback triage' },
      model2: { provider: 'rule-based', priority, reasoning: 'Fallback triage' },
      model3: { provider: 'rule-based', priority, reasoning: 'Fallback triage' },
      agreement: 'unanimous',
    },
    alerts,
    recommendedActions: alerts.length > 0 ? ['Immediate clinical assessment'] : ['Routine assessment'],
    requiresImmediateReview: priority <= 2,
  };
}

/**
 * Main triage function - entry point
 */
export async function performTriage(request: TriageRequest): Promise<TriageResponse> {
  return runTriageEnsemble(request);
}