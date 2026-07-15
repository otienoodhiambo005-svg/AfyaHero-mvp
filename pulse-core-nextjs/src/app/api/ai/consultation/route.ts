/**
 * POST /api/ai/consultation
 * 
 * AI-assisted clinical consultation endpoint providing:
 * - Differential diagnosis generation
 * - SOAP note generation
 * - Clinical protocol lookup
 * - Prescription interaction checking
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enforceApiRateLimit,
  enforceRequestFirewall,
  enforceTrustedOrigin,
  readJsonBody,
  requireRoles,
} from '@/lib/api-security';
import {
  generateDifferentialDiagnosis,
  generateSoapNote,
  getClinicalProtocol,
  checkPrescriptionInteractions,
  type ConsultationContext,
  type DifferentialDiagnosis,
  type SoapNote,
  type ClinicalProtocol,
  type InteractionResult,
} from '@/lib/ai-consultation';
import logger from '@/lib/logger';

type ConsultationResponse =
  | { success: boolean; message: string }
  | DifferentialDiagnosis[]
  | SoapNote
  | ClinicalProtocol
  | InteractionResult;

export async function POST(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    // Rate limit
    const rateLimit = await enforceApiRateLimit(request, 'api:ai:consultation');
    if (rateLimit) return rateLimit;

    // Auth + session
    const session = requireRoles(request, ['medical', 'lab', 'pharmacy']);
    if (session instanceof NextResponse) return session;

    // Parse + validate body
    const body = await readJsonBody<{
      action?: unknown;
      data?: unknown;
    }>(request);
    if (body instanceof NextResponse) return body;

    // Validate action
    const action = body.action;
    const validActions = ['differential', 'soap', 'protocol', 'interactions'];
    if (!action || typeof action !== 'string' || !validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Valid values: ${validActions.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate data
    if (!body.data || typeof body.data !== 'object') {
      return NextResponse.json(
        { error: 'data object is required' },
        { status: 400 },
      );
    }

    const data = body.data as Record<string, unknown>;
    const start = Date.now();
    let result: any;

    switch (action) {
      case 'differential': {
        // Validate required fields
        if (!data.patientAge || !data.patientGender || !data.chiefComplaint || !Array.isArray(data.symptoms)) {
          return NextResponse.json(
            { error: 'patientAge, patientGender, chiefComplaint, and symptoms are required' },
            { status: 400 },
          );
        }

        const context: ConsultationContext = {
          patientAge: Number(data.patientAge),
          patientGender: data.patientGender as 'male' | 'female',
          isPregnant: data.isPregnant as boolean | undefined,
          gestationalWeeks: data.gestationalWeeks as number | undefined,
          chiefComplaint: String(data.chiefComplaint),
          symptoms: data.symptoms as string[],
          vitals: data.vitals as ConsultationContext['vitals'],
          history: data.history as string | undefined,
          knownConditions: Array.isArray(data.knownConditions) ? data.knownConditions as string[] : undefined,
        };

        result = await generateDifferentialDiagnosis(
          context,
          session.hospitalId
        );
        break;
      }

      case 'soap': {
        if (!data.patientId || !data.chiefComplaint) {
          return NextResponse.json(
            { error: 'patientId and chiefComplaint are required' },
            { status: 400 },
          );
        }

        result = await generateSoapNote({
          patientId: String(data.patientId),
          clinicianId: session.id,
          facilityId: session.hospitalId,
          chiefComplaint: String(data.chiefComplaint),
          historyOfPresentIllness: data.historyOfPresentIllness as string | undefined,
          pastMedicalHistory: data.pastMedicalHistory as string | undefined,
          reviewOfSystems: data.reviewOfSystems as string | undefined,
          physicalExam: data.physicalExam as string | undefined,
          vitals: data.vitals as Record<string, number> | undefined,
          assessment: data.assessment as string | undefined,
          plan: data.plan as string | undefined,
          voiceTranscript: data.voiceTranscript as string | undefined,
        });
        break;
      }

      case 'protocol': {
        if (!data.condition) {
          return NextResponse.json(
            { error: 'condition is required' },
            { status: 400 },
          );
        }

        result = await getClinicalProtocol(
          String(data.condition),
          session.hospitalId
        );
        break;
      }

      case 'interactions': {
        if (!Array.isArray(data.newMedications) || !Array.isArray(data.currentMedications)) {
          return NextResponse.json(
            { error: 'newMedications and currentMedications arrays are required' },
            { status: 400 },
          );
        }

        result = await checkPrescriptionInteractions({
          newMedications: data.newMedications as string[],
          currentMedications: data.currentMedications as string[],
          allergies: Array.isArray(data.allergies) ? data.allergies as string[] : undefined,
          conditions: Array.isArray(data.conditions) ? data.conditions as string[] : undefined,
          patientAge: data.patientAge as number | undefined,
          patientWeight: data.patientWeight as number | undefined,
        });
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 },
        );
    }

     const latencyMs = Date.now() - start;

     let responseBody: any;
     if (result && typeof result === 'object') {
       responseBody = { ...result, latencyMs };
     } else {
       responseBody = { result, latencyMs };
     }

     return NextResponse.json(responseBody);

  } catch (err) {
    logger.error('[Consultation route] Internal server error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/ai/consultation
 * 
 * Returns available consultation AI services
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireRoles(request, ['medical', 'lab', 'pharmacy']);
    if (session instanceof NextResponse) return session;

    return NextResponse.json({
      name: 'AI Consultation Assistant',
      version: '1.0.0',
      description: 'AI-assisted clinical consultation with differential diagnosis, SOAP notes, and protocol guidance',
      availableActions: {
        differential: {
          name: 'Differential Diagnosis',
          description: 'Generate ranked differential diagnoses with probabilities and reasoning',
          requiredFields: ['patientAge', 'patientGender', 'chiefComplaint', 'symptoms'],
          optionalFields: ['vitals', 'history', 'knownConditions', 'isPregnant', 'gestationalWeeks'],
        },
        soap: {
          name: 'SOAP Note Generation',
          description: 'Generate structured SOAP notes from clinical consultation data',
          requiredFields: ['patientId', 'chiefComplaint'],
          optionalFields: ['historyOfPresentIllness', 'pastMedicalHistory', 'physicalExam', 'vitals', 'assessment', 'plan', 'voiceTranscript'],
        },
        protocol: {
          name: 'Clinical Protocol Lookup',
          description: 'Get evidence-based clinical protocols following Kenya MOH guidelines',
          requiredFields: ['condition'],
        },
        interactions: {
          name: 'Prescription Interaction Check',
          description: 'Check for drug interactions and contraindications',
          requiredFields: ['newMedications', 'currentMedications'],
          optionalFields: ['allergies', 'conditions', 'patientAge', 'patientWeight'],
        },
      },
      features: {
        africanEpidemiology: true,
        offlineCapable: false,
        consensusDiagnosis: true,
        kenyaMohGuidelines: true,
      },
    });
  } catch (err) {
    logger.error('[Consultation GET] Error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}