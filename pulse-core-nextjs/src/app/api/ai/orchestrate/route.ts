/**
 * POST /api/ai/orchestrate
 * 
 * Unified AI orchestration endpoint that routes requests to appropriate AI models
 * based on task type, manages consensus for high-stakes decisions, and handles
 * offline queuing.
 * 
 * Request body:
 *   {
 *     taskType: 'triage' | 'diagnosis' | 'documentation' | 'drug_interaction' | 
 *               'lab_interpretation' | 'imaging_analysis' | 'risk_prediction' |
 *               'clinical_query' | 'protocol_lookup' | 'referral_draft' |
 *               'billing_coding' | 'population_health' | 'mch_care' | 'hiv_tb_management',
 *     prompt: string,
 *     systemInstruction?: string,
 *     patientId?: string,
 *     clinicianId?: string,
 *     facilityId?: string,
 *     context?: {
 *       vitals?: Record<string, number>,
 *       symptoms?: string[],
 *       history?: string,
 *       medications?: string[],
 *       allergies?: string[],
 *       labResults?: Array<{ test: string, value: any, unit: string }>,
 *       imaging?: Array<{ type: string, findings?: string }>
 *     },
 *     priority?: 'routine' | 'urgent' | 'emergency',
 *     requireConsensus?: boolean,
 *     maxLatencyMs?: number,
 *     offlineAllowed?: boolean
 *   }
 * 
 * Response:
 *   {
 *     text: string,
 *     taskType: string,
 *     provider: string,
 *     model: string,
 *     latencyMs: number,
 *     success: boolean,
 *     confidenceScore?: number,
 *     consensusDetails?: {
 *       models: string[],
 *       responses: string[],
 *       agreement: number,
 *       finalDecision: string
 *     },
 *     error?: string,
 *     cached?: boolean,
 *     offline?: boolean,
 *     requiresReview?: boolean
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
  validateOptionalString,
} from '@/lib/api-security';
import { orchestrateAI, type OrchestratorTaskType, type OrchestratorRequest } from '@/lib/ai-orchestrator';
import { logAIInteraction } from '@/lib/ai-audit';
import logger from '@/lib/logger';

const VALID_TASK_TYPES: OrchestratorTaskType[] = [
  'triage',
  'diagnosis',
  'documentation',
  'drug_interaction',
  'lab_interpretation',
  'imaging_analysis',
  'risk_prediction',
  'clinical_query',
  'protocol_lookup',
  'referral_draft',
  'billing_coding',
  'population_health',
  'mch_care',
  'hiv_tb_management',
];

const OFFLINE_CAPABLE_TASK_TYPES: OrchestratorTaskType[] = [
  'triage',
  'diagnosis',
  'drug_interaction',
  'protocol_lookup',
];

export async function POST(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:ai:orchestrate');
    if (rateLimit) return rateLimit;

    // Auth + session
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      taskType?: unknown;
      prompt?: unknown;
      systemInstruction?: unknown;
      patientId?: unknown;
      clinicianId?: unknown;
      facilityId?: unknown;
      context?: unknown;
      priority?: unknown;
      requireConsensus?: unknown;
      maxLatencyMs?: unknown;
      offlineAllowed?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate taskType
    const rawTaskType = body.taskType;
    if (!rawTaskType || typeof rawTaskType !== 'string' || !VALID_TASK_TYPES.includes(rawTaskType as OrchestratorTaskType)) {
      return NextResponse.json(
        { error: `Invalid taskType. Valid values: ${VALID_TASK_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
    const taskType = rawTaskType as OrchestratorTaskType;

    // Validate prompt
    const prompt = body.prompt;
    if (!prompt || typeof prompt !== 'string' || prompt.length < 5 || prompt.length > 10000) {
      return NextResponse.json(
        { error: 'prompt must be a string between 5 and 10000 characters' },
        { status: 400 },
      );
    }

    // Optional fields
    const systemInstruction = (validateOptionalString(body.systemInstruction, 'systemInstruction', { max: 2000 }) instanceof NextResponse ? undefined : validateOptionalString(body.systemInstruction, 'systemInstruction', { max: 2000 })) as string | undefined;
    const patientId = (validateOptionalString(body.patientId, 'patientId', { max: 36 }) instanceof NextResponse ? undefined : validateOptionalString(body.patientId, 'patientId', { max: 36 })) as string | undefined;
    const clinicianId = (validateOptionalString(body.clinicianId, 'clinicianId', { max: 36 }) instanceof NextResponse ? undefined : validateOptionalString(body.clinicianId, 'clinicianId', { max: 36 })) as string | undefined;
    const facilityId = (validateOptionalString(body.facilityId, 'facilityId', { max: 36 }) instanceof NextResponse ? undefined : validateOptionalString(body.facilityId, 'facilityId', { max: 36 })) as string | undefined;
    
    const priority = ['routine', 'urgent', 'emergency'].includes(String(body.priority))
      ? (body.priority as 'routine' | 'urgent' | 'emergency')
      : undefined;
    
    const requireConsensus = body.requireConsensus === true;
    const maxLatencyMs = typeof body.maxLatencyMs === 'number' ? body.maxLatencyMs : undefined;
    const offlineAllowed = body.offlineAllowed === true;

     // Context validation
     let context: OrchestratorRequest['context'] | undefined = undefined;
     if (body.context && typeof body.context === 'object') {
       context = body.context;
     }

    // Execute orchestration
    const response = await orchestrateAI({
      taskType: taskType as OrchestratorTaskType,
      prompt,
      systemInstruction: systemInstruction || undefined,
      patientId: patientId || undefined,
      clinicianId: clinicianId || session.id,
      facilityId: facilityId || session.hospitalId,
      context,
      priority,
      requireConsensus,
      maxLatencyMs,
      offlineAllowed,
    });

    // Log the interaction
    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: taskType,
      providerUsed: response.provider,
      modelUsed: response.model,
      latencyMs: response.latencyMs,
      success: response.success,
      errorMessage: response.error,
      inputSummary: prompt.slice(0, 200),
      outputSummary: (response.text || '').slice(0, 200),
      confidenceScore: response.confidenceScore,
      requiresReview: response.requiresReview,
      consensusDetails: response.consensusDetails ? {
        agreement: response.consensusDetails.agreement,
        flaggedForReview: response.consensusDetails.agreement < 0.8,
      } : undefined,
    });

    return NextResponse.json(response, {
      headers: {
        'X-AI-Provider': response.provider,
        'X-AI-Model': response.model,
        'X-AI-Latency': response.latencyMs.toString(),
        'X-AI-Confidence': (response.confidenceScore || 0).toString(),
        ...(response.requiresReview ? { 'X-AI-Requires-Review': 'true' } : {}),
      },
    });

  } catch (err) {
    logger.error('[Orchestrate route] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/ai/orchestrate
 * 
 * Returns available task types and their configurations
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    const taskConfigs = VALID_TASK_TYPES.map(taskType => ({
      taskType,
      requiresConsensus: ['triage', 'diagnosis', 'drug_interaction', 'imaging_analysis'].includes(taskType),
      offlineCapable: OFFLINE_CAPABLE_TASK_TYPES.includes(taskType),
      description: getTaskDescription(taskType),
      typicalLatencyMs: getTypicalLatency(taskType),
    }));

    return NextResponse.json({
      availableTasks: taskConfigs,
      offlineCapabilities: {
        model: 'offline-clinical-rules-v1',
        provider: 'rule-based',
        requiresHumanReview: true,
        supportedTasks: OFFLINE_CAPABLE_TASK_TYPES,
      },
      version: '1.0.0',
    });
  } catch (err) {
    logger.error('[Orchestrate GET] Error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getTaskDescription(taskType: OrchestratorTaskType): string {
  const descriptions: Record<OrchestratorTaskType, string> = {
    triage: 'Three-model consensus for triage decisions based on vitals and symptoms',
    diagnosis: 'Differential diagnosis with multi-model consensus and epidemiology awareness',
    documentation: 'SOAP note generation from voice or text transcription',
    drug_interaction: 'Medication safety checking including interactions and allergies',
    lab_interpretation: 'Lab result interpretation in clinical context',
    imaging_analysis: 'X-ray, wound, and skin lesion analysis with vision models',
    risk_prediction: 'Sepsis, maternal deterioration, and readmission risk prediction',
    clinical_query: 'General clinical question answering with evidence grounding',
    protocol_lookup: 'Clinical guideline retrieval and application',
    referral_draft: 'Referral letter generation from patient data',
    billing_coding: 'ICD-10 and procedure code auto-assignment',
    population_health: 'Outbreak detection, AMR surveillance, and epidemiological analysis',
    mch_care: 'Maternal and child health protocol guidance',
    hiv_tb_management: 'HIV/TB longitudinal care management',
  };
  return descriptions[taskType] || 'AI-powered clinical assistance';
}

function getTypicalLatency(taskType: OrchestratorTaskType): number {
  const latencies: Record<OrchestratorTaskType, number> = {
    triage: 3000,
    diagnosis: 5000,
    documentation: 4000,
    drug_interaction: 2000,
    lab_interpretation: 3000,
    imaging_analysis: 8000,
    risk_prediction: 2000,
    clinical_query: 3000,
    protocol_lookup: 2000,
    referral_draft: 4000,
    billing_coding: 2000,
    population_health: 5000,
    mch_care: 4000,
    hiv_tb_management: 4000,
  };
  return latencies[taskType] || 3000;
}