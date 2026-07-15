/**
 * POST /api/ai/triage
 * 
 * AI-powered triage endpoint using three-model consensus ensemble.
 * Performs triage assessment with PEWS for pediatric patients and MOEWS for obstetric patients.
 * 
 * Request body:
 *   {
 *     patientAge: number,
 *     patientGender: 'male' | 'female',
 *     isPregnant?: boolean,
 *     gestationalWeeks?: number,
 *     chiefComplaint: string,
 *     historyOfPresentIllness?: string,
 *     vitals: {
 *       temperature?: number,
 *       heartRate?: number,
 *       respiratoryRate?: number,
 *       systolicBP?: number,
 *       diastolicBP?: number,
 *       spO2?: number,
 *       consciousness?: 'alert' | 'voice' | 'pain' | 'unresponsive',
 *       capillaryRefillTime?: number
 *     },
 *     mechanismOfInjury?: string,
 *     painScore?: number,
 *     knownAllergies?: string[],
 *     currentMedications?: string[],
 *     knownMedicalConditions?: string[]
 *   }
 * 
 * Response:
 *   {
 *     priority: 1 | 2 | 3 | 4 | 5,
 *     priorityLabel: string,
 *     confidence: number,
 *     reasoning: string,
 *     consensusDetails: {
 *       model1: { provider: string, priority: number, reasoning: string },
 *       model2: { provider: string, priority: number, reasoning: string },
 *       model3: { provider: string, priority: number, reasoning: string },
 *       agreement: 'unanimous' | 'majority' | 'split'
 *     },
 *     alerts: string[],
 *     recommendedActions: string[],
 *     peesScore?: number,
 *     moewsScore?: number,
 *     requiresImmediateReview: boolean
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
} from '@/lib/api-security';
import { performTriage, type TriageRequest, type TriageVitals } from '@/lib/triage-ensemble';
import { logAIInteraction } from '@/lib/ai-audit';
import logger from '@/lib/logger';

// Valid consciousness levels
const VALID_CONSCIOUSNESS_LEVELS = ['alert', 'voice', 'pain', 'unresponsive'] as const;

export async function POST(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit - triage is high priority
    const rateLimit = await enforceApiRateLimit(request, 'api:ai:triage');
    if (rateLimit) return rateLimit;

    // Auth + session (allow reception for initial triage)
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      patientAge?: unknown;
      patientGender?: unknown;
      isPregnant?: unknown;
      gestationalWeeks?: unknown;
      chiefComplaint?: unknown;
      historyOfPresentIllness?: unknown;
      vitals?: unknown;
      mechanismOfInjury?: unknown;
      painScore?: unknown;
      knownAllergies?: unknown;
      currentMedications?: unknown;
      knownMedicalConditions?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate patientAge
    if (body.patientAge === undefined || body.patientAge === null) {
      return NextResponse.json(
        { error: 'patientAge is required' },
        { status: 400 },
      );
    }
    const patientAge = Number(body.patientAge);
    if (isNaN(patientAge) || patientAge < 0 || patientAge > 120) {
      return NextResponse.json(
        { error: 'patientAge must be a number between 0 and 120' },
        { status: 400 },
      );
    }

    // Validate patientGender
    if (body.patientGender !== 'male' && body.patientGender !== 'female') {
      return NextResponse.json(
        { error: "patientGender must be 'male' or 'female'" },
        { status: 400 },
      );
    }

    // Validate chiefComplaint
    if (!body.chiefComplaint || typeof body.chiefComplaint !== 'string' || body.chiefComplaint.length < 3) {
      return NextResponse.json(
        { error: 'chiefComplaint is required (minimum 3 characters)' },
        { status: 400 },
      );
    }

    // Parse optional fields
    const isPregnant = body.isPregnant === true;
    const gestationalWeeks = typeof body.gestationalWeeks === 'number' ? body.gestationalWeeks : undefined;
    const historyOfPresentIllness = typeof body.historyOfPresentIllness === 'string' ? body.historyOfPresentIllness : undefined;
    const mechanismOfInjury = typeof body.mechanismOfInjury === 'string' ? body.mechanismOfInjury : undefined;
    const painScore = typeof body.painScore === 'number' ? body.painScore : undefined;
    const knownAllergies = Array.isArray(body.knownAllergies) ? body.knownAllergies : undefined;
    const currentMedications = Array.isArray(body.currentMedications) ? body.currentMedications : undefined;
    const knownMedicalConditions = Array.isArray(body.knownMedicalConditions) ? body.knownMedicalConditions : undefined;

    // Validate vitals
    if (!body.vitals || typeof body.vitals !== 'object') {
      return NextResponse.json(
        { error: 'vitals object is required' },
        { status: 400 },
      );
    }

    const vitals: TriageVitals = {};
    const vitalsObj = body.vitals as Record<string, unknown>;

    if (typeof vitalsObj.temperature === 'number') vitals.temperature = vitalsObj.temperature;
    if (typeof vitalsObj.heartRate === 'number') vitals.heartRate = vitalsObj.heartRate;
    if (typeof vitalsObj.respiratoryRate === 'number') vitals.respiratoryRate = vitalsObj.respiratoryRate;
    if (typeof vitalsObj.systolicBP === 'number') vitals.systolicBP = vitalsObj.systolicBP;
    if (typeof vitalsObj.diastolicBP === 'number') vitals.diastolicBP = vitalsObj.diastolicBP;
    if (typeof vitalsObj.spO2 === 'number') vitals.spO2 = vitalsObj.spO2;
    if (typeof vitalsObj.capillaryRefillTime === 'number') vitals.capillaryRefillTime = vitalsObj.capillaryRefillTime;

    if (typeof vitalsObj.consciousness === 'string') {
      if ((VALID_CONSCIOUSNESS_LEVELS as readonly string[]).includes(vitalsObj.consciousness)) {
        vitals.consciousness = vitalsObj.consciousness as typeof VALID_CONSCIOUSNESS_LEVELS[number];
      } else {
        return NextResponse.json(
          { error: `Invalid consciousness level. Valid values: ${VALID_CONSCIOUSNESS_LEVELS.join(', ')}` },
          { status: 400 },
        );
      }
    }

    // Build triage request
    const triageRequest: TriageRequest = {
      patientAge,
      patientGender: body.patientGender as 'male' | 'female',
      isPregnant,
      gestationalWeeks,
      chiefComplaint: body.chiefComplaint,
      historyOfPresentIllness,
      vitals,
      mechanismOfInjury,
      painScore,
      knownAllergies,
      currentMedications,
      knownMedicalConditions,
    };

    // Perform triage
    const triageResponse = await performTriage(triageRequest);

    // Log the interaction
    void logAIInteraction({
      userRole: session.role,
      userSubrole: session.subrole,
      userName: session.name,
      hospitalId: session.hospitalId,
      aiType: 'triage',
      providerUsed: 'consensus',
      modelUsed: 'triage-ensemble-v1',
      latencyMs: 0, // Will be calculated by triage function
      success: true,
      inputSummary: `${body.chiefComplaint} (${patientAge}y ${body.patientGender})`,
      outputSummary: `Priority ${triageResponse.priority}: ${triageResponse.priorityLabel}`,
      confidenceScore: triageResponse.confidence,
      requiresReview: triageResponse.requiresImmediateReview,
      consensusDetails: {
        agreement: triageResponse.consensusDetails.agreement === 'unanimous' ? 1.0 :
                   triageResponse.consensusDetails.agreement === 'majority' ? 0.67 : 0.33,
        flaggedForReview: triageResponse.consensusDetails.agreement === 'split',
      },
    });

    return NextResponse.json(triageResponse, {
      headers: {
        'X-Triage-Priority': triageResponse.priority.toString(),
        'X-Triage-Confidence': triageResponse.confidence.toString(),
        ...(triageResponse.requiresImmediateReview ? { 'X-Triage-Immediate': 'true' } : {}),
      },
    });

  } catch (err) {
    logger.error('[Triage route] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/ai/triage
 * 
 * Returns triage information and available scoring systems
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireRoles(request, ['reception', 'medical', 'lab', 'pharmacy', 'admin']);
    if (session instanceof NextResponse) return session;

    return NextResponse.json({
      name: 'AI Triage System',
      version: '1.0.0',
      description: 'Three-model consensus triage with PEWS and MOEWS scoring',
      priorityLevels: {
        1: 'Immediate (Red) - Life-threatening, requires immediate intervention',
        2: 'Emergency (Orange) - Potentially life-threatening, rapid assessment needed',
        3: 'Urgent (Yellow) - Serious condition, assessment within 30-60 minutes',
        4: 'Semi-urgent (Green) - Stable but needs care, assessment within 1-2 hours',
        5: 'Non-urgent (Blue) - Minor condition, can wait',
      },
      scoringSystems: {
        PEWS: {
          name: 'Paediatric Early Warning Score',
          appliesTo: 'Patients < 18 years',
          parameters: ['consciousness', 'cardiovascular', 'respiratory'],
          range: '0-9',
          levels: {
            low: '0-2 - Continue routine monitoring',
            medium: '3-4 - Increase monitoring, notify supervisor',
            high: '5+ - Urgent senior review, consider PICU',
          },
        },
        MOEWS: {
          name: 'Modified Obstetric Early Warning Score',
          appliesTo: 'Pregnant/obstetric patients',
          parameters: ['consciousness', 'oxygen saturation', 'temperature', 'MAP', 'heart rate', 'respiratory rate'],
          range: '0-18',
          levels: {
            low: '0-2 - Continue routine antenatal monitoring',
            medium: '3-4 - Increase monitoring, notify obstetric senior',
            high: '5+ - Urgent obstetric review, consider HDU/ICU',
          },
        },
      },
      consensusProviders: ['Gemini 2.5 Flash', 'OpenAI GPT-4o-mini', 'Anthropic Claude 3.5 Sonnet'],
      africanContext: {
        considerations: [
          'High index of suspicion for malaria in febrile patients',
          'Consider TB in chronic cough presentations',
          'Typhoid in prolonged fever',
          'Obstetric emergencies in pregnant women',
          'Consider disease outbreaks in the community',
        ],
      },
    });
  } catch (err) {
    logger.error('[Triage GET] Error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}