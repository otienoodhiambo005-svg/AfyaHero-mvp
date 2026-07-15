/**
 * AI-Native Consultation Module - AfyaHero
 * 
 * Provides AI-assisted clinical consultation features:
 * - Live differential diagnosis generation
 * - SOAP note generation from voice/text
 * - Clinical protocol lookup
 * - Drug interaction checking during prescribing
 * - Context-aware clinical suggestions
 * - Personalized recommendations using clinical memory
 */

import { orchestrateAI } from '@/lib/ai-orchestrator';
import { checkDrugInteractions } from '@/lib/predictive-risk-models';
import { getContextAwareDifferentials, generatePatientSummary } from '@/lib/clinical-memory';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DifferentialDiagnosis {
  condition: string;
  probability: number;
  reasoning: string;
  icd10Code?: string;
  redFlags?: string[];
  suggestedTests?: string[];
  suggestedTreatment?: string[];
  confidenceScore?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  consensusAgreement?: number;
}

export interface SoapNoteRequest {
  patientId: string;
  clinicianId: string;
  facilityId: string;
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  reviewOfSystems?: string;
  physicalExam?: string;
  vitals?: Record<string, number>;
  assessment?: string;
  plan?: string;
  voiceTranscript?: string;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10Codes: string[];
  confidenceScore: number;
}

export interface ClinicalProtocol {
  condition: string;
  protocol: string;
  steps: Array<{
    action: string;
    category: 'assessment' | 'investigation' | 'treatment' | 'referral';
    priority: 'routine' | 'urgent' | 'emergency';
    completed: boolean;
  }>;
  references: string[];
}

export interface ConsultationContext {
  patientAge: number;
  patientGender: 'male' | 'female';
  isPregnant?: boolean;
  gestationalWeeks?: number;
  chiefComplaint: string;
  symptoms: string[];
  vitals?: {
    temperature?: number;
    heartRate?: number;
    respiratoryRate?: number;
    systolicBP?: number;
    diastolicBP?: number;
    spO2?: number;
  };
  history?: string;
  currentMedications?: string[];
  allergies?: string[];
  knownConditions?: string[];
  checkInteractions?: boolean;
}

// ─── Differential Diagnosis Engine ────────────────────────────────────────────

/**
 * Generate live differential diagnosis based on presenting symptoms and context
 */
export async function generateDifferentialDiagnosis(
  context: ConsultationContext,
  facilityId?: string,
  patientId?: string
): Promise<DifferentialDiagnosis[]> {
  // Build the clinical prompt
  let prompt = buildDifferentialPrompt(context);
  
  // Get facility-specific epidemiology if available
  let systemInstruction = buildSystemInstruction(context, facilityId);

  // Integrate clinical memory for personalized recommendations if facilityId provided
  if (facilityId) {
    try {
      const contextAwareDifferentials = await getContextAwareDifferentials(
        facilityId,
        context.symptoms,
        { age: context.patientAge, gender: context.patientGender }
      );
      if (contextAwareDifferentials && contextAwareDifferentials.length > 0) {
        // Add personalized differentials to the prompt
        const personalizedContext = '\n\nFacility epidemiology context:\n' +
          contextAwareDifferentials.map(d => 
            `- ${d.diagnosis} (probability: ${(d.probability * 100).toFixed(0)}%)\n` +
            `  Reasoning: ${d.reasoning}\n` +
            `  Epidemiology: ${d.epidemiologyContext}`
          ).join('\n');
        prompt += personalizedContext;
        systemInstruction += '\n\nConsider the facility epidemiology context above when generating differentials. Adjust probabilities based on local disease patterns.';
      }
    } catch (error) {
      // If clinical memory fails, proceed without it
      logger.error(
        'Failed to retrieve clinical memory for context-aware differentials',
        error instanceof Error ? error : { error: String(error) },
      );
    }
  }
  
  // Call AI orchestrator for differential diagnosis
  const response = await orchestrateAI({
    taskType: 'diagnosis',
    prompt,
    systemInstruction,
    patientId,
    clinicianId: undefined,
    facilityId,
    context: {
      symptoms: context.symptoms,
      vitals: context.vitals ? Object.fromEntries(
        Object.entries(context.vitals).filter(([_, v]) => v !== undefined)
      ) as Record<string, number> : undefined,
    },
    requireConsensus: true,
  });

  if (!response.success || !response.text) {
    return getDefaultDifferentials(context);
  }

  // Parse the AI response into structured differentials
  let differentials = parseDifferentialResponse(response.text, context);

  // Add confidence scoring based on consensus agreement
  if (response.consensusDetails && response.confidenceScore !== undefined) {
    const consensusAgreement = response.consensusDetails.agreement;
    const confidenceScore = response.confidenceScore;
    differentials = differentials.map(d => ({
      ...d,
      confidenceScore,
      consensusAgreement,
      confidenceLevel: confidenceScore >= 0.9 ? 'high' : 
                       confidenceScore >= 0.7 ? 'medium' : 'low',
    }));
  }

  // Check for drug interactions if requested and medications are available
  if (context.checkInteractions && context.currentMedications && context.currentMedications.length > 0) {
    try {
      // Extract suggested treatments from differentials
      const suggestedTreatments = differentials
        .flatMap(d => d.suggestedTreatment || [])
        .filter(t => t && t.trim().length > 0);

      if (suggestedTreatments.length > 0) {
        const interactionResult = await checkPrescriptionInteractions({
          newMedications: suggestedTreatments,
          currentMedications: context.currentMedications,
          allergies: context.allergies,
          conditions: context.knownConditions,
          patientAge: context.patientAge,
        });

        // Add interaction alerts to red flags if any interactions found
        if (interactionResult.interactions.length > 0) {
          const interactionAlerts = interactionResult.interactions
            .filter(i => i.severity === 'major' || i.severity === 'contraindicated')
            .map(i => `Drug interaction: ${i.drug1} + ${i.drug2} (${i.severity}) - ${i.recommendation}`);

          differentials = differentials.map(d => ({
            ...d,
            redFlags: [...(d.redFlags || []), ...interactionAlerts],
          }));
        }
      }
    } catch (error) {
      // If interaction check fails, log but don't fail the diagnosis
      logger.error('Failed to check drug interactions', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Sort by probability
  return differentials.sort((a, b) => b.probability - a.probability).slice(0, 5);
}

function buildDifferentialPrompt(context: ConsultationContext): string {
  const parts: string[] = [];
  
  parts.push(`Patient: ${context.patientAge} year old ${context.patientGender}`);
  
  if (context.isPregnant) {
    parts.push(`Pregnant, ${context.gestationalWeeks} weeks gestation`);
  }
  
  parts.push(`\nChief Complaint: ${context.chiefComplaint}`);
  parts.push(`\nSymptoms: ${context.symptoms.join(', ')}`);
  
  if (context.vitals) {
    const vitalParts: string[] = [];
    if (context.vitals.temperature) vitalParts.push(`Temp: ${context.vitals.temperature}°C`);
    if (context.vitals.heartRate) vitalParts.push(`HR: ${context.vitals.heartRate} bpm`);
    if (context.vitals.respiratoryRate) vitalParts.push(`RR: ${context.vitals.respiratoryRate}/min`);
    if (context.vitals.systolicBP && context.vitals.diastolicBP) {
      vitalParts.push(`BP: ${context.vitals.systolicBP}/${context.vitals.diastolicBP} mmHg`);
    }
    if (context.vitals.spO2) vitalParts.push(`SpO2: ${context.vitals.spO2}%`);
    if (vitalParts.length > 0) {
      parts.push(`\nVitals: ${vitalParts.join(', ')}`);
    }
  }
  
  if (context.history) {
    parts.push(`\nHistory: ${context.history}`);
  }
  
  if (context.knownConditions && context.knownConditions.length > 0) {
    parts.push(`\nKnown Conditions: ${context.knownConditions.join(', ')}`);
  }
  
  parts.push('\n\nGenerate a ranked differential diagnosis with probabilities, reasoning, and ICD-10 codes.');
  
  return parts.join('\n');
}

function buildSystemInstruction(_context: ConsultationContext, _facilityId?: string): string {
  const parts: string[] = [
    'You are an expert clinical decision support AI for East African healthcare settings.',
    'Consider the local epidemiology and disease patterns.',
    'Prioritize conditions common in East Africa:',
    '- Malaria (especially P. falciparum)',
    '- Tuberculosis',
    '- Typhoid fever',
    '- Lower respiratory infections',
    '- Diarrheal diseases',
    '- Maternal and child health conditions',
    '- HIV/AIDS and opportunistic infections',
    '',
    'For each differential:',
    '1. List the condition name',
    '2. Provide estimated probability (0-100%)',
    '3. Explain the reasoning based on presenting symptoms',
    '4. Include ICD-10 code if applicable',
    '5. Note any red flags that would require urgent attention',
    '6. Suggest relevant investigations',
    '',
    'Format each differential as:',
    'Condition: [name]',
    'Probability: [X%]',
    'Reasoning: [explanation]',
    'ICD-10: [code]',
    'Red Flags: [list]',
    'Suggested Tests: [list]',
  ];
  
  return parts.join('\n');
}

function parseDifferentialResponse(response: string, context: ConsultationContext): DifferentialDiagnosis[] {
  const differentials: DifferentialDiagnosis[] = [];
  
  // Parse the AI response - look for structured format
  const sections = response.split(/\n(?=Condition:)/);
  
  for (const section of sections) {
    const conditionMatch = section.match(/Condition:\s*(.+)/i);
    const probMatch = section.match(/Probability:\s*(\d+)%/i);
    const reasoningMatch = section.match(/Reasoning:\s*(.+)/i);
    const icdMatch = section.match(/ICD-10:\s*([A-Z]\d+)/i);
    const redFlagsMatch = section.match(/Red Flags?:\s*(.+)/i);
    const testsMatch = section.match(/Suggested Tests?:\s*(.+)/i);
    
    if (conditionMatch) {
      differentials.push({
        condition: conditionMatch[1].trim(),
        probability: probMatch ? parseInt(probMatch[1]) : 50,
        reasoning: reasoningMatch ? reasoningMatch[1].trim() : '',
        icd10Code: icdMatch ? icdMatch[1].toUpperCase() : undefined,
        redFlags: redFlagsMatch ? redFlagsMatch[1].split(',').map(f => f.trim()) : [],
        suggestedTests: testsMatch ? testsMatch[1].split(',').map(t => t.trim()) : [],
      });
    }
  }
  
  // If parsing failed, return default differentials
  if (differentials.length === 0) {
    return getDefaultDifferentials(context);
  }
  
  // Sort by probability
  return differentials.sort((a, b) => b.probability - a.probability).slice(0, 5);
}

function getDefaultDifferentials(context: ConsultationContext): DifferentialDiagnosis[] {
  // Fallback differentials based on common African presentations
  const chiefComplaint = context.chiefComplaint.toLowerCase();
  
  if (chiefComplaint.includes('fever') || context.vitals?.temperature && context.vitals.temperature > 38) {
    return [
      {
        condition: 'Malaria',
        probability: 60,
        reasoning: 'Fever is the hallmark symptom of malaria, which is endemic in East Africa',
        icd10Code: 'B54',
        redFlags: ['Altered consciousness', 'Seizures', 'Severe anemia'],
        suggestedTests: ['Malaria RDT', 'Blood smear', 'FBC'],
      },
      {
        condition: 'Typhoid Fever',
        probability: 25,
        reasoning: 'Prolonged fever with possible gastrointestinal symptoms',
        icd10Code: 'A01',
        redFlags: ['Abdominal pain', 'GI bleeding', 'Altered mental status'],
        suggestedTests: ['Blood culture', 'Widal test', 'LFTs'],
      },
      {
        condition: 'Lower Respiratory Tract Infection',
        probability: 15,
        reasoning: 'Consider if cough or respiratory symptoms present',
        icd10Code: 'J18',
        redFlags: ['Difficulty breathing', 'SpO2 < 90%', 'Chest pain'],
        suggestedTests: ['Chest X-ray', 'Sputum culture'],
      },
    ];
  }
  
  // Default fallback
  return [
    {
      condition: 'Viral Syndrome',
      probability: 40,
      reasoning: 'Most common cause of acute symptoms',
      icd10Code: 'B34.9',
      redFlags: [],
      suggestedTests: ['Clinical diagnosis'],
    },
  ];
}

// ─── SOAP Note Generation ─────────────────────────────────────────────────────

/**
 * Generate structured SOAP note from clinical encounter data
 */
export async function generateSoapNote(request: SoapNoteRequest): Promise<SoapNote> {
  const prompt = buildSoapPrompt(request);
  
  const response = await orchestrateAI({
    taskType: 'documentation',
    prompt,
    systemInstruction: buildSoapSystemInstruction(),
    patientId: request.patientId,
    clinicianId: request.clinicianId,
    facilityId: request.facilityId,
    requireConsensus: false,
  });

  if (!response.success || !response.text) {
    return createBasicSoapNote(request);
  }

  return parseSoapResponse(response.text, request);
}

function buildSoapPrompt(request: SoapNoteRequest): string {
  const parts: string[] = [];
  
  if (request.voiceTranscript) {
    parts.push(`Voice Transcript:\n${request.voiceTranscript}\n`);
  }
  
  if (request.chiefComplaint) {
    parts.push(`Chief Complaint: ${request.chiefComplaint}`);
  }
  
  if (request.historyOfPresentIllness) {
    parts.push(`History of Present Illness:\n${request.historyOfPresentIllness}`);
  }
  
  if (request.pastMedicalHistory) {
    parts.push(`Past Medical History:\n${request.pastMedicalHistory}`);
  }
  
  if (request.reviewOfSystems) {
    parts.push(`Review of Systems:\n${request.reviewOfSystems}`);
  }
  
  if (request.physicalExam) {
    parts.push(`Physical Examination:\n${request.physicalExam}`);
  }
  
  if (request.vitals) {
    const vitalParts: string[] = [];
    for (const [key, value] of Object.entries(request.vitals)) {
      if (value !== undefined) {
        vitalParts.push(`${key}: ${value}`);
      }
    }
    if (vitalParts.length > 0) {
      parts.push(`Vitals: ${vitalParts.join(', ')}`);
    }
  }
  
  if (request.assessment) {
    parts.push(`Assessment:\n${request.assessment}`);
  }
  
  if (request.plan) {
    parts.push(`Plan:\n${request.plan}`);
  }
  
  parts.push('\nGenerate a structured SOAP note with ICD-10 codes.');
  
  return parts.join('\n');
}

function buildSoapSystemInstruction(): string {
  return `You are a clinical documentation specialist. Generate a structured SOAP note:

SUBJECTIVE (S):
- Chief complaint in patient's own words
- History of present illness (onset, duration, character, aggravating/relieving factors)
- Review of systems
- Past medical history, medications, allergies

OBJECTIVE (O):
- Vital signs
- Physical examination findings
- Relevant lab/imaging results

ASSESSMENT (A):
- Primary diagnosis with ICD-10 code
- Differential diagnoses
- Problem list

PLAN (P):
- Investigations ordered
- Medications prescribed
- Treatments administered
- Follow-up instructions
- Referrals if needed

Format the output clearly with S:, O:, A:, P: sections.`;
}

function parseSoapResponse(response: string, request: SoapNoteRequest): SoapNote {
  // Parse the SOAP note from AI response
  const sMatch = response.match(/S:\s*([\s\S]*?)(?=O:|$)/i);
  const oMatch = response.match(/O:\s*([\s\S]*?)(?=A:|$)/i);
  const aMatch = response.match(/A:\s*([\s\S]*?)(?=P:|$)/i);
  const pMatch = response.match(/P:\s*([\s\S]*?)(?=$)/i);
  
  const icd10Codes: string[] = [];
  const icdMatches = response.matchAll(/[A-Z]\d{2}(\.\d+)?/g);
  for (const match of icdMatches) {
    if (!icd10Codes.includes(match[0])) {
      icd10Codes.push(match[0]);
    }
  }
  
  return {
    subjective: sMatch ? sMatch[1].trim() : request.chiefComplaint,
    objective: oMatch ? oMatch[1].trim() : '',
    assessment: aMatch ? aMatch[1].trim() : '',
    plan: pMatch ? pMatch[1].trim() : '',
    icd10Codes,
    confidenceScore: 0.8,
  };
}

function createBasicSoapNote(request: SoapNoteRequest): SoapNote {
  return {
    subjective: request.chiefComplaint,
    objective: '',
    assessment: '',
    plan: '',
    icd10Codes: [],
    confidenceScore: 0.5,
  };
}

// ─── Clinical Protocol Lookup ─────────────────────────────────────────────────

/**
 * Get relevant clinical protocols for a diagnosed condition
 */
export async function getClinicalProtocol(
  condition: string,
  facilityId?: string
): Promise<ClinicalProtocol | null> {
  const prompt = `Provide a clinical protocol for: ${condition}\n\nInclude specific steps for assessment, investigation, treatment, and referral criteria. Follow Kenya MOH guidelines where applicable.`;
  
  const response = await orchestrateAI({
    taskType: 'protocol_lookup',
    prompt,
    systemInstruction: 'You are a clinical guideline expert. Provide evidence-based protocols following Kenya Ministry of Health guidelines and WHO recommendations for East African settings.',
    facilityId,
    requireConsensus: false,
  });

  if (!response.success || !response.text) {
    return null;
  }

  return parseProtocolResponse(response.text, condition);
}

function parseProtocolResponse(response: string, condition: string): ClinicalProtocol {
  // Parse protocol steps from AI response
  const steps: ClinicalProtocol['steps'] = [];
  const lines = response.split('\n');
  
  for (const line of lines) {
    if (line.match(/^\d+\./)) {
      const stepText = line.replace(/^\d+\.\s*/, '').trim();
      let category: ClinicalProtocol['steps'][0]['category'] = 'assessment';
      let priority: ClinicalProtocol['steps'][0]['priority'] = 'routine';
      
      if (stepText.toLowerCase().includes('urgent') || stepText.toLowerCase().includes('immediately')) {
        priority = 'urgent';
      } else if (stepText.toLowerCase().includes('emergency') || stepText.toLowerCase().includes('stat')) {
        priority = 'emergency';
      }
      
      if (stepText.toLowerCase().includes('test') || stepText.toLowerCase().includes('lab') || stepText.toLowerCase().includes('investigate')) {
        category = 'investigation';
      } else if (stepText.toLowerCase().includes('treat') || stepText.toLowerCase().includes('medicate') || stepText.toLowerCase().includes('prescribe')) {
        category = 'treatment';
      } else if (stepText.toLowerCase().includes('refer') || stepText.toLowerCase().includes('transfer')) {
        category = 'referral';
      }
      
      steps.push({
        action: stepText,
        category,
        priority,
        completed: false,
      });
    }
  }
  
  return {
    condition,
    protocol: response,
    steps,
    references: ['Kenya MOH Guidelines', 'WHO Guidelines'],
  };
}

// ─── Drug Interaction Check During Prescribing ────────────────────────────────

/**
 * Check for drug interactions when prescribing
 */
export type InteractionResult = {
  interactions: Array<{
    drug1: string;
    drug2: string;
    severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
    description: string;
    recommendation: string;
  }>;
  alerts: string[];
  requiresReview: boolean;
};

export async function checkPrescriptionInteractions(params: {
  newMedications: string[];
  currentMedications: string[];
  allergies?: string[];
  conditions?: string[];
  patientAge?: number;
  patientWeight?: number;
}): Promise<InteractionResult> {
  const allMedications = [...params.newMedications, ...params.currentMedications];
  
  const result = checkDrugInteractions({
    medications: allMedications,
    allergies: params.allergies,
    conditions: params.conditions,
  });
  
  const alerts: string[] = [];
  
  // Add weight-based dosing alerts for pediatrics
  if (params.patientAge !== undefined && params.patientAge < 12 && params.patientWeight) {
    for (const med of params.newMedications) {
      // Check if medication requires weight-based dosing
      const weightBasedMeds = ['paracetamol', 'amoxicillin', 'ibuprofen', 'metronidazole'];
      if (weightBasedMeds.some(m => med.toLowerCase().includes(m))) {
        alerts.push(`💊 ${med}: Ensure weight-based dosing (${params.patientWeight}kg)`);
      }
    }
  }
  
  // Add pregnancy alerts
  if (params.conditions?.includes('pregnancy')) {
    const pregnancyUnsafe = ['ace_inhibitors', 'warfarin', 'isotretinoin', 'methotrexate'];
    for (const med of params.newMedications) {
      if (pregnancyUnsafe.some(u => med.toLowerCase().includes(u))) {
        alerts.push(`🤰 ${med}: Contraindicated in pregnancy - consider alternatives`);
      }
    }
  }
  
  return {
    interactions: result.interactions,
    alerts,
    requiresReview: result.requiresReview || alerts.length > 0,
  };
}

/**
 * Generate a real-time draft SOAP note from live segments
 */
export async function generateSoapNoteDraft(
  segments: Array<{ text: string; speaker: string }>,
  patientId?: string,
  clinicianId?: string,
  facilityId?: string
): Promise<SoapNote> {
  const combinedTranscript = segments
    .map(s => `${s.speaker.toUpperCase()}: ${s.text}`)
    .join('\n');

  return generateSoapNote({
    patientId: patientId || 'draft',
    clinicianId: clinicianId || 'draft',
    facilityId: facilityId || 'draft',
    chiefComplaint: 'Live consultation in progress...',
    voiceTranscript: combinedTranscript,
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const AIConsultation = {
  generateDifferentialDiagnosis,
  generateSoapNote,
  getClinicalProtocol,
  checkPrescriptionInteractions,
  generateSoapNoteDraft,
};