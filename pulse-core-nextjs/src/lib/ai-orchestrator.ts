/**
 * AI Orchestrator - AfyaHero
 * 
 * Central routing layer that decides which AI model(s) to invoke for any given clinical event,
 * manages consensus logic, handles fallback if a model is unavailable, and ensures no single 
 * point of AI failure.
 * 
 * Architecture:
 * - Routes clinical events to appropriate AI models based on task type
 * - Manages three-model consensus for high-stakes decisions (triage, diagnosis)
 * - Implements confidence scoring and override detection
 * - Handles offline queuing for cloud-based AI
 * - Logs all AI decisions for audit and learning
 */

import { callWithCascade, callParallelConsensus, type ProviderName, type NormalizedProviderResponse } from '@/lib/ai-providers';
import { logAIInteraction, type AIAnalysisType } from '@/lib/ai-audit';
import {
  checkDrugInteractionsOffline,
  generateOfflineDiagnosis,
  getClinicalProtocol,
  performOfflineTriage,
} from '@/lib/ai-offline-models';
import logger from '@/lib/logger';
import { queueRequest } from '@/lib/network-utils';
import { getNetworkStatus } from '@/lib/network-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrchestratorTaskType = 
  | 'triage'           // Three-model consensus for triage decisions
  | 'diagnosis'        // Differential diagnosis with consensus
  | 'documentation'    // SOAP note generation from voice/text
  | 'drug_interaction' // Medication safety checking
  | 'lab_interpretation' // Lab result interpretation
  | 'imaging_analysis' // X-ray, wound, skin lesion analysis
  | 'risk_prediction'  // Sepsis, maternal deterioration, readmission risk
  | 'clinical_query'   // General clinical question answering
  | 'protocol_lookup'  // Clinical guideline retrieval
  | 'referral_draft'   // Referral letter generation
  | 'billing_coding'    // ICD-10/CPT auto-coding
  | 'population_health' // Outbreak detection, AMR surveillance
  | 'mch_care'         // Maternal & child health protocols
  | 'hiv_tb_management' // HIV/TB longitudinal care
  ;

export interface OrchestratorRequest {
  taskType: OrchestratorTaskType;
  prompt: string;
  systemInstruction?: string;
  patientId?: string;
  clinicianId?: string;
  facilityId?: string;
  context?: {
    vitals?: Record<string, number>;
    symptoms?: string[];
    history?: string;
    medications?: string[];
    allergies?: string[];
    labResults?: Array<{ test: string; value: string | number; unit: string; referenceRange?: string }>;
    imaging?: Array<{ type: string; findings?: string }>;
  };
  priority?: 'routine' | 'urgent' | 'emergency';
  requireConsensus?: boolean;
  maxLatencyMs?: number;
  offlineAllowed?: boolean;
}

export interface OrchestratorResponse {
  text: string;
  taskType: OrchestratorTaskType;
  provider: ProviderName;
  model: string;
  latencyMs: number;
  success: boolean;
  confidenceScore?: number;
  consensusDetails?: {
    models: ProviderName[];
    responses: string[];
    agreement: number; // 0-100% agreement
    finalDecision: string;
  };
  error?: string;
  cached?: boolean;
  offline?: boolean;
  requiresReview?: boolean;
}

export interface ConsensusResult {
  agreement: number;
  finalDecision: string;
  individualResponses: Array<{
    provider: ProviderName;
    model: string;
    text: string;
    confidence?: number;
  }>;
  flaggedForReview: boolean;
  reasoning: string;
}

// ─── Configuration ─────────────────────────────────────────────────────────────

const TRIAGE_CONSENSUS_PROVIDERS: ProviderName[] = ['gemini', 'openai', 'anthropic', 'deepseek', 'groq'];
const DIAGNOSIS_CONSENSUS_PROVIDERS: ProviderName[] = ['gemini', 'anthropic', 'deepseek', 'openai', 'groq'];
const DEFAULT_CONSENSUS_PROVIDERS: ProviderName[] = ['gemini', 'anthropic'];

const CONSENSUS_AGREEMENT_THRESHOLD = 0.8; // 80% agreement required for high confidence
const HIGH_CONFIDENCE_THRESHOLD = 0.9;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.7;
const OFFLINE_AI_CONFIDENCE = 0.68;

const TASK_TO_CASCADE_MAP: Record<OrchestratorTaskType, ProviderName[]> = {
  triage: ['hf', 'groq', 'gemini', 'anthropic'],
  diagnosis: ['anthropic', 'gemini', 'hf', 'groq', 'openai', 'deepseek'],
  documentation: ['anthropic', 'gemini', 'hf', 'groq'],
  drug_interaction: ['hf', 'groq', 'gemini', 'anthropic'],
  lab_interpretation: ['hf', 'groq', 'gemini', 'anthropic'],
  imaging_analysis: ['anthropic', 'gemini', 'hf', 'deepseek'],
  risk_prediction: ['hf', 'groq', 'gemini'],
  clinical_query: ['hf', 'groq', 'gemini', 'anthropic'],
  protocol_lookup: ['hf', 'groq', 'gemini'],
  referral_draft: ['anthropic', 'gemini', 'hf', 'groq'],
  billing_coding: ['hf', 'groq', 'gemini'],
  population_health: ['hf', 'groq', 'gemini', 'anthropic'],
  mch_care: ['gemini', 'anthropic', 'hf', 'groq'],
  hiv_tb_management: ['gemini', 'anthropic', 'hf', 'groq'],
};

// ─── Core Orchestrator Functions ──────────────────────────────────────────────

/**
 * Calculate confidence score based on consensus agreement and provider reliability
 */
function calculateConfidenceScore(
  consensusResult: ConsensusResult,
  _taskType: OrchestratorTaskType
): number {
  const agreementWeight = 0.6;
  const providerReliabilityWeight = 0.4;
  
  // Base confidence from agreement
  let confidence = consensusResult.agreement * agreementWeight;
  
  // Adjust for provider reliability (anthropic and gemini are most reliable for clinical tasks)
  const reliableProviders = consensusResult.individualResponses.filter(r => 
    r.provider === 'anthropic' || r.provider === 'gemini'
  );
  const reliabilityScore = reliableProviders.length / consensusResult.individualResponses.length;
  confidence += reliabilityScore * providerReliabilityWeight;
  
  // Penalty for flagged reviews
  if (consensusResult.flaggedForReview) {
    confidence *= 0.7;
  }
  
  return Math.min(1.0, Math.max(0.0, confidence));
}

/**
 * Determine if a response requires human review based on confidence and task type
 */
function requiresHumanReview(
  confidenceScore: number,
  taskType: OrchestratorTaskType,
  consensusResult?: ConsensusResult
): boolean {
  // Emergency cases always require review if confidence < 95%
  if (confidenceScore < HIGH_CONFIDENCE_THRESHOLD) {
    return true;
  }
  
  // High-stakes tasks require review if any disagreement
  if (['triage', 'diagnosis', 'drug_interaction', 'imaging_analysis'].includes(taskType)) {
    if (consensusResult && consensusResult.agreement < 1.0) {
      return true;
    }
  }
  
  return false;
}

function canRunOffline(taskType: OrchestratorTaskType): boolean {
  return ['triage', 'diagnosis', 'drug_interaction', 'protocol_lookup'].includes(taskType);
}

function runOfflineAI(request: OrchestratorRequest, start: number): OrchestratorResponse {
  const age = extractAge(request.prompt);
  const gender = extractGender(request.prompt);
  const context = request.context;
  const result = (() => {
    if (request.taskType === 'triage') {
      return performOfflineTriage({
        chiefComplaint: request.prompt,
        vitalSigns: context?.vitals,
        age,
        gender,
        symptoms: context?.symptoms,
      });
    }

    if (request.taskType === 'diagnosis') {
      return generateOfflineDiagnosis({
        symptoms: context?.symptoms ?? extractSymptoms(request.prompt),
        age,
        gender,
        vitalSigns: context?.vitals,
      });
    }

    if (request.taskType === 'drug_interaction') {
      return checkDrugInteractionsOffline({
        medications: context?.medications ?? extractList(request.prompt),
        allergies: context?.allergies,
      });
    }

    return getClinicalProtocol(request.prompt);
  })();

  return {
    text: formatOfflineResult(request.taskType, result),
    taskType: request.taskType,
    provider: 'rule-based',
    model: 'offline-clinical-rules-v1',
    latencyMs: Date.now() - start,
    success: true,
    confidenceScore: OFFLINE_AI_CONFIDENCE,
    offline: true,
    requiresReview: true,
  };
}

function formatOfflineResult(taskType: OrchestratorTaskType, result: unknown): string {
  return [
    'Offline AI result generated from local clinical rules.',
    `Task: ${taskType}`,
    'Human review required before clinical action.',
    JSON.stringify(result, null, 2),
  ].join('\n\n');
}

function extractAge(prompt: string): number {
  const ageMatch = prompt.match(/\b(?:age|aged)\s*:?\s*(\d{1,3})\b/i) ?? prompt.match(/\b(\d{1,3})\s*(?:year|yr|y\/o)/i);
  if (!ageMatch) {
    return 30;
  }

  const age = Number(ageMatch[1]);
  return Number.isFinite(age) && age > 0 ? age : 30;
}

function extractGender(prompt: string): string {
  if (/\bfemale\b|\bwoman\b|\bgirl\b/i.test(prompt)) {
    return 'female';
  }

  if (/\bmale\b|\bman\b|\bboy\b/i.test(prompt)) {
    return 'male';
  }

  return 'unknown';
}

function extractSymptoms(prompt: string): string[] {
  const knownSymptoms = ['fever', 'cough', 'diarrhea', 'headache'];
  const normalizedPrompt = prompt.toLowerCase();
  const symptoms = knownSymptoms.filter((symptom) => normalizedPrompt.includes(symptom));
  return symptoms.length > 0 ? symptoms : ['fever'];
}

function extractList(prompt: string): string[] {
  return prompt
    .split(/,|\n|;|\band\b/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Run three-model consensus for high-stakes decisions
 */
async function runConsensus(
  prompt: string,
  systemInstruction: string,
  providers: ProviderName[]
): Promise<ConsensusResult> {
  try {
    // Call all providers in parallel
    const responses = await callParallelConsensus({
      prompt,
      systemInstruction,
      providers,
    });
    
    if (responses.length === 0) {
      throw new Error('All consensus providers failed');
    }
    
    // Analyze agreement between responses
    const texts = responses.map(r => r.text?.toLowerCase().trim() || '');
    const uniqueTexts = new Set(texts);
    const agreement = uniqueTexts.size === 1 ? 1.0 : 1.0 / uniqueTexts.size;
    
    // Determine final decision (majority vote or most reliable provider if split)
    let finalDecision: string;
    let flaggedForReview = false;
    let reasoning = '';
    
    if (agreement >= CONSENSUS_AGREEMENT_THRESHOLD) {
      // High agreement - use the most common response
      const textCounts = new Map<string, number>();
      texts.forEach(text => textCounts.set(text, (textCounts.get(text) || 0) + 1));
      finalDecision = Array.from(textCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];
      reasoning = `High agreement (${(agreement * 100).toFixed(0)}%) across ${responses.length} models`;
    } else {
      // Low agreement - flag for review and use most reliable provider
      const reliableResponse = responses.find(r => r.provider === 'anthropic' || r.provider === 'gemini');
      finalDecision = reliableResponse?.text || responses[0].text || '';
      flaggedForReview = true;
      reasoning = `Low agreement (${(agreement * 100).toFixed(0)}%) - flagged for clinician review. Used ${reliableResponse?.provider || 'primary'} model response.`;
    }
    
    const consensusResult: ConsensusResult = {
      agreement,
      finalDecision,
      individualResponses: responses.map(r => ({
        provider: r.provider,
        model: r.model,
        text: r.text || '',
        confidence: undefined, // Could be extracted from response if available
      })),
      flaggedForReview,
      reasoning,
    };
    
    return consensusResult;
    
  } catch (error) {
    logger.error('[Orchestrator] Consensus failed', { error, providers });
    throw error;
  }
}

/**
 * Main orchestrator function - routes request to appropriate AI service
 */
export async function orchestrateAI(
  request: OrchestratorRequest
): Promise<OrchestratorResponse> {
  const start = Date.now();
  const { taskType, prompt, systemInstruction, patientId, clinicianId, facilityId, priority: _priority, requireConsensus, maxLatencyMs: _maxLatencyMs, offlineAllowed } = request;
  
  // Check network status
  const networkStatus = getNetworkStatus();
  const isOffline = networkStatus === 'offline';
  
  // If offline and task doesn't allow offline processing, queue it
  if (isOffline && !offlineAllowed) {
    logger.warn('[Orchestrator] Offline mode, queuing request', { taskType, patientId });
    queueRequest({
      method: 'POST',
      url: '/api/ai/orchestrate',
      body: request,
    });
    
    return {
      text: 'Request queued for processing when connectivity is restored.',
      taskType: taskType as OrchestratorTaskType,
      provider: 'offline-queue' as ProviderName,
      model: 'queue-v1',
      latencyMs: Date.now() - start,
      success: false,
      error: 'Offline: Request queued for later processing',
      offline: true,
      requiresReview: false,
    };
  }

  if (isOffline && offlineAllowed) {
    if (canRunOffline(taskType)) {
      const offlineResponse = runOfflineAI(request, start);
      void logAIInteraction({
        userRole: 'medical',
        userSubrole: undefined,
        userName: clinicianId || 'unknown',
        hospitalId: facilityId || 'unknown',
        aiType: taskType as AIAnalysisType,
        providerUsed: offlineResponse.provider,
        modelUsed: offlineResponse.model,
        latencyMs: offlineResponse.latencyMs,
        success: offlineResponse.success,
        inputSummary: prompt.slice(0, 200),
        outputSummary: offlineResponse.text.slice(0, 200),
        confidenceScore: offlineResponse.confidenceScore,
        requiresReview: offlineResponse.requiresReview,
      });
      return offlineResponse;
    }

    queueRequest({
      method: 'POST',
      url: '/api/ai/orchestrate',
      body: request,
    });

    return {
      text: 'This AI workflow requires cloud connectivity and has been queued for processing when the network returns.',
      taskType,
      provider: 'rule-based',
      model: 'offline-queue-v1',
      latencyMs: Date.now() - start,
      success: false,
      error: 'Offline: cloud-only AI workflow queued',
      offline: true,
      requiresReview: true,
    };
  }
  
  try {
    let response: NormalizedProviderResponse;
    let consensusResult: ConsensusResult | undefined;
    let confidenceScore: number = 0;
    let requiresReview: boolean = false;
    
    // Determine if this task requires consensus
    const shouldUseConsensus = requireConsensus || 
      ['triage', 'diagnosis', 'drug_interaction'].includes(taskType);
    
    if (shouldUseConsensus) {
      // Run three-model consensus for high-stakes decisions
      const consensusProviders = taskType === 'triage' 
        ? TRIAGE_CONSENSUS_PROVIDERS 
        : taskType === 'diagnosis' 
          ? DIAGNOSIS_CONSENSUS_PROVIDERS 
          : DEFAULT_CONSENSUS_PROVIDERS;
      
      consensusResult = await runConsensus(
        prompt, 
        systemInstruction || `You are an expert clinical AI assistant for ${taskType} tasks.`, 
        consensusProviders
      );
      
      response = {
        text: consensusResult.finalDecision,
        provider: consensusResult.individualResponses[0]?.provider || 'gemini',
        model: consensusResult.individualResponses[0]?.model || 'unknown',
        latencyMs: Date.now() - start,
        success: true,
        error: undefined,
      };
      
      confidenceScore = calculateConfidenceScore(consensusResult, taskType);
    } else {
      // Single model call with cascade fallback
      const cascadeProviders = TASK_TO_CASCADE_MAP[taskType] || ['hf', 'groq', 'gemini'];
      
      response = await callWithCascade({
        prompt,
        systemInstruction: systemInstruction || `You are an expert clinical AI assistant for ${taskType} tasks.`,
        aiType: taskType,
        providers: cascadeProviders,
      });
      
      // Calculate confidence based on provider reliability
      const providerReliability: Record<string, number> = {
        'anthropic': 0.95,
        'gemini': 0.90,
        'openai': 0.92,
        'deepseek': 0.88,
        'hf': 0.75,
        'groq': 0.80,
        'rule-based': 0.50,
        'vertex': 0.88,
        'openrouter': 0.85,
      };
      confidenceScore = providerReliability[response.provider] || 0.7;
    }
    
    // Determine if human review is required
    requiresReview = requiresHumanReview(confidenceScore, taskType, consensusResult);
    
    // Log AI interaction for audit and learning
    void logAIInteraction({
      userRole: 'medical',
      userSubrole: undefined,
      userName: clinicianId || 'unknown',
      hospitalId: facilityId || 'unknown',
      aiType: taskType as AIAnalysisType,
      providerUsed: response.provider,
      modelUsed: response.model,
      latencyMs: Date.now() - start,
      success: response.success,
      errorMessage: response.error,
      inputSummary: prompt.slice(0, 200),
      outputSummary: (response.text || '').slice(0, 200),
      confidenceScore,
      requiresReview,
      consensusDetails: consensusResult ? {
        agreement: consensusResult.agreement,
        flaggedForReview: consensusResult.flaggedForReview,
      } : undefined,
    });
    
    const orchestratorResponse: OrchestratorResponse = {
      text: response.text || '',
      taskType,
      provider: response.provider,
      model: response.model,
      latencyMs: Date.now() - start,
      success: response.success,
      confidenceScore,
      consensusDetails: consensusResult ? {
        models: consensusResult.individualResponses.map(r => r.provider),
        responses: consensusResult.individualResponses.map(r => r.text),
        agreement: consensusResult.agreement,
        finalDecision: consensusResult.finalDecision,
      } : undefined,
      error: response.error,
      requiresReview,
    };
    
    return orchestratorResponse;
    
  } catch (error) {
    logger.error('[Orchestrator] Critical failure', { error, taskType, patientId });
    
    return {
      text: 'AI service temporarily unavailable. Please proceed with clinical judgment.',
      taskType,
      provider: 'error' as ProviderName,
      model: 'fallback',
      latencyMs: Date.now() - start,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown orchestrator error',
      requiresReview: true,
    };
  }
}

/**
 * Get recommended providers for a specific task type
 */
export function getProvidersForTask(taskType: OrchestratorTaskType): ProviderName[] {
  return TASK_TO_CASCADE_MAP[taskType] || ['hf', 'groq', 'gemini'];
}

/**
 * Check if a task type requires consensus
 */
export function requiresConsensus(taskType: OrchestratorTaskType): boolean {
  return ['triage', 'diagnosis', 'drug_interaction', 'imaging_analysis'].includes(taskType);
}

/**
 * Get confidence level label from score
 */
export function getConfidenceLabel(score: number): 'high' | 'medium' | 'low' {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return 'high';
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}